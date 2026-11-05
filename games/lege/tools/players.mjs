// 难度评估用的三种"模拟玩家" (纯逻辑，check_levels.mjs 使用)：
//   random  —— 每步在可点的卡里随便点一张，不用道具
//   greedy  —— Solver.greedyPick 的贪心策略，不用道具 (= 旧版曲线)
//   props   —— 贪心 + 把 移出 / 撤回 / 洗牌 / 复活 全部用上：
//              · 撤回：一步之后卡槽到 6 张且没消除，就撤回改拿另一张更安全的卡
//              · 移出：卡槽 ≥5 张且场上没有能凑满三张的卡时，移出最左边 3 张到暂存区
//              · 洗牌：移出用掉后再遇到同样的危险局面时使用 (可解洗牌，同游戏内逻辑)
//              · 复活：卡槽满了 → 再移出 3 张 (叠到暂存区最高一层上)
// 几何与游戏一致：遮挡 = 更高层 + 矩形相交；暂存区 3 格，叠放时同一格上层压住下层。
import { GameConfig } from '../src/config/GameConfig.js';
import { covers } from '../src/systems/CoverSystem.js';
import { greedyPick, solvableShuffle } from '../src/systems/Solver.js';

const SIZE = GameConfig.card.size;
const CAP = GameConfig.slot.capacity;

function tempPos(i, level) {
  const { slots, gap, stackOffsetY } = GameConfig.tempRow;
  const total = slots * SIZE + (slots - 1) * gap;
  return { x: (GameConfig.width - total) / 2 + i * (SIZE + gap), y: GameConfig.pileRowY - level * stackOffsetY };
}

class Sim {
  constructor(cards, maxHold = 5) {
    this.maxHold = maxHold;
    this.live = cards.map((c, i) => ({ x: c.x, y: c.y, layer: c.layer, type: c.type, zone: c.zone || 'board', idx: i }));
    this.slot = [];        // 花色数组，顺序同游戏 (插到同款后面)
    this.uses = { moveOut: 1, undo: 1, shuffle: 1, revive: 1 };
    this.last = null;      // 可撤回的上一步
  }
  free() {
    const L = this.live;
    return L.filter((a) => !L.some((o) => covers(o, a, SIZE)));
  }
  /** 拿一张卡；返回 { cleared, fail } */
  pick(card) {
    const before = this.slot.slice();
    this.live.splice(this.live.indexOf(card), 1);
    let last = -1;
    this.slot.forEach((t, i) => { if (t === card.type) last = i; });
    this.slot.splice(last >= 0 ? last + 1 : this.slot.length, 0, card.type);
    const same = this.slot.filter((t) => t === card.type).length;
    const cleared = same >= 3;
    if (cleared) this.slot = this.slot.filter((t) => t !== card.type);
    this.last = cleared ? null : { card, before };
    return { cleared, fail: this.slot.length >= CAP };
  }
  undo() {
    const m = this.last;
    this.live.push(m.card);
    this.slot = m.before;
    this.last = null;
    this.uses.undo--;
  }
  moveOut(n = 3) {
    const picks = this.slot.slice(0, n);
    if (!picks.length) return false;
    this.slot = this.slot.slice(picks.length);
    const temps = this.live.filter((c) => c.zone === 'temp');
    const level = temps.length ? Math.max(...temps.map((c) => c.layer - 100)) + 1 : 0;
    picks.forEach((type, i) => { const p = tempPos(i, level); this.live.push({ x: p.x, y: p.y, layer: 100 + level, type, zone: 'temp' }); });
    this.last = null;
    return true;
  }
  shuffle(rng) {
    const res = solvableShuffle(this.live, this.slot, rng, { maxHold: this.maxHold, budgetMs: 100 });
    if (res) res.types.forEach((t, i) => { this.live[i].type = t; });
    else { // 与游戏一致：无解时退回随机
      const ts = this.live.map((c) => c.type);
      for (let i = ts.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [ts[i], ts[j]] = [ts[j], ts[i]]; }
      ts.forEach((t, i) => { this.live[i].type = t; });
    }
    this.last = null;
    this.uses.shuffle--;
  }
  get done() { return this.live.length === 0 && this.slot.length === 0; }
}

export function playRandom(cards, rng) {
  const s = new Sim(cards);
  while (s.live.length) {
    const f = s.free();
    if (!f.length) return { ok: false };
    if (s.pick(f[Math.floor(rng.next() * f.length)]).fail) return { ok: false };
  }
  return { ok: s.done };
}

/** 贪心 + 全部道具 + 复活；返回 { ok, used: {moveOut, undo, shuffle, revive} } */
export function playWithProps(cards, rng, maxHold = 5) {
  const s = new Sim(cards, maxHold);
  const completes = (f) => f.some((c) => s.slot.filter((t) => t === c.type).length === 2);
  for (let guard = 0; guard < 4 * cards.length && !s.done; guard++) {
    let f = s.free();
    if (!f.length) {
      if (s.slot.length && s.uses.moveOut > 0) { s.moveOut(); s.uses.moveOut--; continue; }
      return { ok: false, used: s.uses };
    }
    // 危险局面：先移出，再洗牌
    if (s.slot.length >= 5 && !completes(f)) {
      if (s.uses.moveOut > 0) { s.moveOut(); s.uses.moveOut--; continue; }
      if (s.uses.shuffle > 0 && s.live.length > 1) { s.shuffle(rng); continue; }
    }
    const pick = greedyPick(f, s.slot);
    const r = s.pick(pick);
    // 撤回：拿完到 6 张还没消，换一张
    if (!r.cleared && s.slot.length >= CAP - 1 && s.uses.undo > 0 && s.last) {
      s.undo();
      f = s.free().filter((c) => c !== pick);
      if (f.length) {
        const alt = greedyPick(f, s.slot);
        const r2 = s.pick(alt);
        if (r2.fail && !revive(s)) return { ok: false, used: s.uses };
        continue;
      }
      const r3 = s.pick(pick);
      if (r3.fail && !revive(s)) return { ok: false, used: s.uses };
      continue;
    }
    if (r.fail && !revive(s)) return { ok: false, used: s.uses };
  }
  return { ok: s.done, used: s.uses };
}

function revive(s) {
  if (s.uses.revive <= 0) return false;
  s.uses.revive--;
  return s.moveOut(3);
}
