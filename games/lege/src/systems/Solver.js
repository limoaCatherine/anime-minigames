// 求解器 (纯逻辑)：
//  - simulate(cards, order)    按给定顺序取牌，验证是否能清空 (参考解校验)
//  - greedy(cards)             模拟一个"普通玩家"的贪心策略，判断随便玩能否通关 (第 1 关校验)
//  - greedyPick(free, slot)    给出当前局面下贪心策略的下一步 (提示/自动测试用)
//  - solvableShuffle(...)      洗牌：给场上剩余卡重新分配花色，并保证 (结合卡槽里已有的卡) 仍存在一条通关路线
import { GameConfig } from '../config/GameConfig.js';
import { buildCoverGraph } from './CoverSystem.js';

const CAP = GameConfig.slot.capacity;

/** 槽内 + 新卡：返回新的槽 (同花色满 3 张消除)，以及是否失败 */
function pushSlot(slot, type) {
  const next = slot.slice();
  next.push(type);
  const same = next.filter((t) => t === type).length;
  if (same >= 3) {
    let removed = 0;
    for (let i = next.length - 1; i >= 0 && removed < 3; i--) if (next[i] === type) { next.splice(i, 1); removed++; }
  }
  return { slot: next, fail: next.length >= CAP };
}

/** 按 order 取牌模拟；initialSlot = 开始时卡槽里已有的花色 (洗牌校验用) */
export function simulate(cards, order, size = GameConfig.card.size, initialSlot = []) {
  const { coveredBy } = buildCoverGraph(cards, size);
  const gone = new Array(cards.length).fill(false);
  let slot = initialSlot.slice();
  if (order.length !== cards.length || new Set(order).size !== cards.length) return { ok: false, reason: '顺序不完整' };
  let peak = 0;
  for (const i of order) {
    if (gone[i] || coveredBy[i].some((j) => !gone[j])) return { ok: false, reason: `卡 ${i} 被压住` };
    gone[i] = true;
    const r = pushSlot(slot, cards[i].type);
    slot = r.slot;
    peak = Math.max(peak, slot.length);   // 消除结算后槽内滞留的最大张数
    if (r.fail) return { ok: false, reason: '卡槽已满' };
  }
  return { ok: slot.length === 0, peak, reason: slot.length ? '卡槽有残留' : '' };
}

/**
 * 贪心选择：优先能凑满 3 张的，其次槽里已有的花色，其次场上可见数量多的花色
 * @param {{type:number}[]} free 当前可点击的卡
 * @param {number[]} slotTypes 槽内花色
 */
export function greedyPick(free, slotTypes) {
  if (!free.length) return null;
  const inSlot = (t) => slotTypes.filter((x) => x === t).length;
  const freeCount = {};
  for (const c of free) freeCount[c.type] = (freeCount[c.type] || 0) + 1;
  let best = null;
  let bestScore = -Infinity;
  for (const c of free) {
    const s = inSlot(c.type);
    let score = s * 100 + Math.min(3, freeCount[c.type] + s) * 10;
    if (s === 2) score += 1000;
    // 侧边牌堆/暂存区的卡略微靠后，先清桌面
    if (c.zone === 'pile') score -= 1;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

export function greedy(cards, size = GameConfig.card.size) {
  const { coveredBy } = buildCoverGraph(cards, size);
  const gone = new Array(cards.length).fill(false);
  let slot = [];
  for (let step = 0; step < cards.length; step++) {
    const free = [];
    for (let i = 0; i < cards.length; i++) if (!gone[i] && coveredBy[i].every((j) => gone[j])) free.push({ ...cards[i], idx: i });
    const pick = greedyPick(free, slot);
    if (!pick) break;
    gone[pick.idx] = true;
    const r = pushSlot(slot, pick.type);
    slot = r.slot;
    if (r.fail) return { ok: false, steps: step + 1 };
  }
  return { ok: gone.every(Boolean) && slot.length === 0, steps: cards.length };
}

/**
 * 可解洗牌：保持场上剩余卡的位置与"花色多重集合"不变，只重新分配花色，使得
 * (卡槽里已有的卡 + 场上的卡) 仍然存在一条不会填满卡槽的清空路线。
 *   1. 在当前几何关系上随机得到一条合法取牌顺序 (每步都取当时未被压住的卡)
 *   2. 沿顺序分配花色，同时模拟卡槽 (初始 = 当前槽内花色)：
 *      优先凑满三张；开启新花色 / 补到 2 张 只在槽内滞留数允许时进行 (同生成器的 maxHold 规则)
 *   3. 用 simulate() 复核；失败就换一条顺序重试
 * @param {{x,y,layer,type}[]} live 场上剩余的卡 (位置取其"归位"坐标)
 * @param {number[]} slotTypes 卡槽内的花色
 * @returns {{types:number[], order:number[], tries:number}|null} types 与 live 一一对应；order 是 live 的下标顺序
 */
export function solvableShuffle(live, slotTypes, rng, { maxHold = 5, pComplete = 0.55, tries = 300, budgetMs = 250, size = GameConfig.card.size } = {}) {
  const n = live.length;
  if (!n) return { types: [], order: [], tries: 0 };
  const total = {};
  for (const c of live) total[c.type] = (total[c.type] || 0) + 1;
  // 每种花色 (场上 + 卡槽) 必须是 3 的倍数，否则怎么分配都清不完
  const all = { ...total };
  for (const t of slotTypes) all[t] = (all[t] || 0) + 1;
  if (Object.values(all).some((v) => v % 3)) return null;
  const { coveredBy, covering } = buildCoverGraph(live, size);   // 遮挡关系只算一次
  const t0 = Date.now();
  const hold0 = slotTypes.length;
  const cap = CAP - 1;                                          // 槽内最多滞留 6 张 (第 7 张 = 失败)
  // 平时按关卡的 maxHold 控制"憋"的程度；卡槽本来就很满时放宽到 6
  const limit = Math.max(1, Math.min(cap, Math.max(maxHold, hold0 + 1)));
  for (let attempt = 1; attempt <= tries && Date.now() - t0 < budgetMs; attempt++) {
    const order = clearOrder(coveredBy, covering, rng);
    if (order.length !== n) return null;            // 循环遮挡 (不应出现)
    const left = { ...total };
    const inSlot = {};
    for (const t of slotTypes) inSlot[t] = (inSlot[t] || 0) + 1;
    let hold = hold0;
    const types = new Array(n);
    let ok = true;
    for (const idx of order) {
      const avail = Object.keys(left).filter((t) => left[t] > 0).map(Number);
      const completers = avail.filter((t) => inSlot[t] === 2);
      // 加一张"不凑满"的卡之后：滞留数不能超过上限；若正好顶到上限，槽里必须还有一对 (下一步就能消掉)，否则会卡死
      const growers = avail.filter((t) => {
        const c = inSlot[t] || 0;
        if (c >= 2) return false;
        const nh = hold + 1;
        if (nh > limit) return false;
        if (nh < limit) return true;
        return c === 1 || Object.keys(inSlot).some((u) => inSlot[u] === 2 && left[u] > 0);
      });
      let t;
      if (completers.length && (!growers.length || rng.next() < pComplete)) t = completers[rng.int(completers.length)];
      else if (growers.length) {
        // 按剩余张数加权，避免某种花色一直不出现
        const w = growers.reduce((a, g) => a + left[g], 0);
        let r = rng.next() * w;
        t = growers[growers.length - 1];
        for (const g of growers) { r -= left[g]; if (r < 0) { t = g; break; } }
      } else { ok = false; break; }
      left[t]--;
      types[idx] = t;
      const c = (inSlot[t] || 0) + 1;
      if (c === 3) { inSlot[t] = 0; hold -= 2; } else { inSlot[t] = c; hold++; }
    }
    if (!ok) continue;
    if (replay(types, order, coveredBy, slotTypes)) return { types, order, tries: attempt };
  }
  return null;
}

/** 随机的合法清空顺序 (用预先算好的遮挡图) */
function clearOrder(coveredBy, covering, rng) {
  const blockers = coveredBy.map((l) => l.length);
  const free = [];
  for (let i = 0; i < blockers.length; i++) if (!blockers[i]) free.push(i);
  const order = [];
  while (free.length) {
    const k = rng.int(free.length);
    const i = free[k];
    free[k] = free[free.length - 1];
    free.pop();
    order.push(i);
    for (const j of covering[i]) if (--blockers[j] === 0) free.push(j);
  }
  return order;
}

/** 复核：按顺序取牌，检查遮挡与卡槽 (与 simulate 相同规则，但复用遮挡图) */
function replay(types, order, coveredBy, slot0) {
  const gone = new Array(types.length).fill(false);
  let slot = slot0.slice();
  for (const i of order) {
    if (gone[i] || coveredBy[i].some((j) => !gone[j])) return false;
    gone[i] = true;
    const r = pushSlot(slot, types[i]);
    slot = r.slot;
    if (r.fail) return false;
  }
  return slot.length === 0;
}
