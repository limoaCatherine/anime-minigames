// 纯逻辑测试 (Node，无浏览器)：洗牌可解性、无死局、存档边界。
// 用法: node tools/test-logic.mjs
import { LEVELS, DAILY_LEVEL } from '../src/config/LevelConfig.js';
import { generateLevel } from '../src/systems/LayoutGenerator.js';
import { simulate, solvableShuffle, greedyPick } from '../src/systems/Solver.js';
import { buildCoverGraph } from '../src/systems/CoverSystem.js';
import { createRng } from '../src/core/Random.js';
import { GameConfig } from '../src/config/GameConfig.js';

const SIZE = GameConfig.card.size;
const CAP = GameConfig.slot.capacity;
let fails = 0, passes = 0;
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); c ? passes++ : fails++; };

/** 按"略带随机的贪心"玩 k 步，返回中途局面 (场上剩余卡 + 卡槽)；途中失败则返回 null */
function playPartial(cards, k, rng) {
  const live = cards.map((c) => ({ ...c }));
  const gone = new Set();
  let slot = [];
  for (let step = 0; step < k; step++) {
    const rest = live.filter((c) => !gone.has(c.id));
    const { coveredBy } = buildCoverGraph(rest, SIZE);
    const free = rest.filter((_, i) => coveredBy[i].length === 0);
    if (!free.length) return null;
    const pick = rng.next() < 0.7 ? greedyPick(free, slot) : free[rng.int(free.length)];
    gone.add(pick.id);
    slot.push(pick.type);
    if (slot.filter((t) => t === pick.type).length === 3) slot = slot.filter((t) => t !== pick.type);
    if (slot.length >= CAP) return null;
  }
  return { live: live.filter((c) => !gone.has(c.id)), slot };
}

console.log('\n[L1] 洗牌后仍然有解 (可解洗牌 vs 旧版随机洗牌)');
const rng = createRng(20261011);
for (const lv of [...LEVELS, DAILY_LEVEL]) {
  let states = 0, okNew = 0, okOld = 0, multisetOk = true, noSolution = 0;
  for (let s = 0; s < 40 && states < 25; s++) {
    const gen = generateLevel(lv, 5000 + s);
    const st = playPartial(gen.cards, 6 + rng.int(Math.max(1, Math.floor(gen.cards.length * 0.5))), rng);
    if (!st || st.live.length < 3) continue;
    states++;
    const res = solvableShuffle(st.live, st.slot, rng, { maxHold: lv.maxHold });
    if (res) {
      const after = st.live.map((c, i) => ({ ...c, type: res.types[i] }));
      if (simulate(after, res.order, SIZE, st.slot).ok) okNew++;
      const a = st.live.map((c) => c.type).sort().join(','), b = [...res.types].sort().join(',');
      if (a !== b) multisetOk = false;
    } else noSolution++;
    // 旧版：随机打乱花色，再看"存在解"的一个充分条件 (贪心 + 200 次随机顺序尝试)
    const types = st.live.map((c) => c.type);
    for (let i = types.length - 1; i > 0; i--) { const j = rng.int(i + 1); [types[i], types[j]] = [types[j], types[i]]; }
    const old = st.live.map((c, i) => ({ ...c, type: types[i] }));
    if (anySolution(old, st.slot)) okOld++;
  }
  check(okNew + noSolution === states && noSolution <= 1 && multisetOk,
    `${String(lv.id).padEnd(5)} ${states} 个中途局面：可解洗牌 ${okNew}/${states} 有解 (找不到解 ${noSolution})，花色总量不变 ${multisetOk}；旧版随机洗牌 ≥${okOld}/${states}`);
}

/** 粗略判断随机局面是否有解：多次随机 DFS 贪心 (只用于和旧版对比) */
function anySolution(cards, slot0) {
  const r = createRng(cards.length * 7 + 1);
  for (let t = 0; t < 60; t++) {
    const gone = new Set(); let slot = slot0.slice(); let ok = true;
    const { coveredBy } = buildCoverGraph(cards, SIZE);
    for (let step = 0; step < cards.length; step++) {
      const free = cards.map((c, i) => ({ ...c, i })).filter((c) => !gone.has(c.i) && coveredBy[c.i].every((j) => gone.has(j)));
      const pick = r.next() < 0.8 ? greedyPick(free, slot) : free[r.int(free.length)];
      gone.add(pick.i); slot.push(pick.type);
      if (slot.filter((x) => x === pick.type).length === 3) slot = slot.filter((x) => x !== pick.type);
      if (slot.length >= CAP) { ok = false; break; }
    }
    if (ok && slot.length === 0) return true;
  }
  return false;
}

console.log('\n[L2] 洗牌：卡槽里已有一对时，第三张会被分到能点到的位置');
{
  const gen = generateLevel(LEVELS[6], 99);
  const st = playPartial(gen.cards, 4, createRng(3));
  const slot = [0, 0, 1, 2, 3, 4];   // 6 张，只有花色 0 能凑满
  const res = solvableShuffle(st.live.map((c) => ({ ...c, type: c.type })), slot, createRng(4), { maxHold: 6 });
  // 花色多重集合要和卡槽相容：这里直接构造一个与卡槽相容的场面
  const pool = []; const need = { 0: 1, 1: 2, 2: 2, 3: 2, 4: 2 };
  for (const [t, n] of Object.entries(need)) for (let i = 0; i < n; i++) pool.push(+t);
  const live = st.live.slice(0, 9 + 3 * Math.floor((st.live.length - 9) / 3)).map((c, i) => ({ ...c, type: i < pool.length ? pool[i] : 5 + Math.floor((i - pool.length) / 3) % 5 }));
  const r2 = solvableShuffle(live, slot, createRng(5), { maxHold: 6 });
  check(r2 && simulate(live.map((c, i) => ({ ...c, type: r2.types[i] })), r2.order, SIZE, slot).ok, `卡槽 6 张 (一对 + 4 张单张) → 洗牌后第一步就能凑满 (尝试 ${r2 && r2.tries} 次)`);
  void res;
  const r3 = solvableShuffle(live.slice(0, 3), [1, 2, 3, 4, 5, 6], createRng(6), { maxHold: 6 });
  check(r3 === null, '卡槽 6 张各不相同 (必输局面) → 返回 null，游戏退回随机洗牌并提示');
}

console.log('\n[L3] 不存在"有卡却没有可点的卡"的死局');
{
  let checked = 0, dead = 0;
  for (const lv of [...LEVELS, DAILY_LEVEL]) {
    const gen = generateLevel(lv, 7);
    const r = createRng(11);
    const gone = new Set();
    const { coveredBy } = buildCoverGraph(gen.cards, SIZE);
    for (let step = 0; step < gen.cards.length; step++) {
      const free = gen.cards.filter((c, i) => !gone.has(i) && coveredBy[i].every((j) => gone.has(j)));
      checked++;
      if (!free.length) { dead++; break; }
      gone.add(free[r.int(free.length)].id);
    }
  }
  check(dead === 0, `16 关随机取牌 ${checked} 个局面：任何时刻只要场上有卡就至少有 1 张可点`);
}

console.log('\n[L4] 存档：星星 / 解锁 / 每日挑战 / localStorage 不可用');
{
  const store = new Map();
  globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  const { SaveSystem } = await import('../src/systems/SaveSystem.js');
  const s = new SaveSystem('t');
  s.submit(1, { win: true, progress: 1, stars: 3 });
  s.submit('daily', { win: true, progress: 1, stars: 3 });
  check(s.totalStars === 3, `每日挑战的星星不计入主线星星总数 (总数 ${s.totalStars}/45)`);
  check(s.get('unlocked') === 2, '通关每日挑战不会解锁主线关卡');
  s.submit(5, { win: true, progress: 1, stars: 1 });
  check(s.get('unlocked') === 6, '直接通关第 5 关 → 解锁到第 6 关');
  s.submit(2, { win: true, progress: 1, stars: 2 });
  check(s.get('unlocked') === 6, '回头重玩旧关卡不会把解锁进度往回改');
  s.submit(1, { win: true, progress: 1, stars: 1 });
  check(s.starsOf(1) === 3, '重玩拿到更少的星星不会覆盖最好成绩');
  s.submit(3, { win: false, progress: 0.4 });
  s.submit(3, { win: false, progress: 0.2 });
  check(s.bestProgress(3) === 0.4 && !s.isCleared(3), '失败只更新最佳进度，不算通关');
  globalThis.window = { localStorage: { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } } };
  const warn = console.warn; console.warn = () => {};
  const m = new SaveSystem('t');
  console.warn = warn;
  m.submit(1, { win: true, progress: 1, stars: 2 });
  check(!m.available && m.starsOf(1) === 2 && m.get('unlocked') === 2, 'localStorage 抛异常 (file:// / 隐私模式) → 退化为内存存档，照常可玩');
  delete globalThis.window;
}


// —— L5：三种模拟玩家 —— 没有哪种"笨策略"能轻松打穿困难 / BOSS 关，曲线大体递减 ——
console.log('\n[L5] 模拟玩家：随机 / 贪心 / 贪心+全部道具');
{
  const { greedy } = await import('../src/systems/Solver.js');
  const { playRandom, playWithProps } = await import('./players.mjs');
  const { tierOf } = await import('../src/config/LevelConfig.js');
  const N = 60;
  const rate = {};
  for (const L of LEVELS) {
    let r = 0, g = 0, p = 0;
    for (let s = 1; s <= N; s++) {
      const lv = generateLevel(L, s * 7919);
      if (playRandom(lv.cards, createRng(s * 31 + 1)).ok) r++;
      if (greedy(lv.cards).ok) g++;
      if (playWithProps(lv.cards, createRng(s * 17 + 3), L.maxHold || 5).ok) p++;
    }
    rate[L.id] = { r: r / N, g: g / N, p: p / N, tier: tierOf(L).name, boss: !!L.boss };
  }
  const hard = LEVELS.filter((L) => L.boss || ['困难', '噩梦', '地狱'].includes(rate[L.id].tier));
  check(hard.every((L) => rate[L.id].r <= 0.02), `随机乱点：困难 / 噩梦 / BOSS 关通关率全部 ≤ 2% (最高 ${(Math.max(...hard.map((L) => rate[L.id].r)) * 100).toFixed(1)}%)`);
  check(hard.every((L) => rate[L.id].g <= 0.4), `只用贪心：困难以上全部 ≤ 40% (最高 ${(Math.max(...hard.map((L) => rate[L.id].g)) * 100).toFixed(1)}%)`);
  check(hard.every((L) => rate[L.id].p <= 0.9), `贪心 + 全部道具 + 复活：困难以上全部 ≤ 90% (最高 ${(Math.max(...hard.map((L) => rate[L.id].p)) * 100).toFixed(1)}%)`);
  check([10, 15].every((id) => rate[id].p <= 0.2), `地狱关 (10/15) 即使用光道具也 ≤ 20% (${(rate[10].p * 100).toFixed(0)}% / ${(rate[15].p * 100).toFixed(0)}%)`);
  check(rate[5].p >= 0.4 && rate[5].g >= 0.03, `第 5 关 BOSS 难但不是墙：贪心 ${(rate[5].g * 100).toFixed(0)}%，用上道具 ${(rate[5].p * 100).toFixed(0)}%`);
  check([1, 2, 3, 4].every((id) => rate[id].g >= 0.6), '前 4 关 (教学/简单/普通) 贪心就能大概率通过');
}

console.log(fails ? `\n逻辑测试：${passes} 通过，${fails} 失败` : `\n逻辑测试：全部 ${passes} 项通过 ✔`);
process.exit(fails ? 1 : 0);
