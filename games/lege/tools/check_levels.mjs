// 关卡可解性 & 难度曲线检查 (Node 直接运行，无需浏览器)：npm run check-levels [次数]
// 对每个关卡生成 N 次布局，校验：每种卡张数为 3 的倍数、参考解 (构造时的消除顺序) 一定能清空；
// 并统计三种模拟玩家的通关率 (tools/players.mjs)，作为难度曲线参考 —— 越低越难：
//   随机 = 随便点；贪心 = 总是优先凑对、不会规划、不用道具；贪心+道具 = 同贪心但把移出/撤回/洗牌/复活全用上
// 要求：困难/BOSS 关不能被任何一种"笨策略"轻松打穿。
import { LEVELS, getDailyLevel, tierOf } from '../src/config/LevelConfig.js';
import { getShape, OFFSET_MODES } from '../src/config/PatternLibrary.js';
import { generateLevel } from '../src/systems/LayoutGenerator.js';
import { simulate, greedy } from '../src/systems/Solver.js';
import { createRng } from '../src/core/Random.js';
import { playRandom, playWithProps } from './players.mjs';

const N = Number(process.argv[2]) || 200;
const pad = (s, n) => {
  s = String(s);
  const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, n - w));
};
let bad = 0;
const rows = [];
for (const L of [...LEVELS, getDailyLevel()]) {
  let ref = 0; let gok = 0; let mult3 = 0; let rok = 0; let pok = 0; let pok2 = 0;
  let stats;
  for (let s = 1; s <= N; s++) {
    const g = generateLevel(L, s * 7919);
    stats = g.stats;
    if (g.stats.counts.every((c) => c % 3 === 0)) mult3++;
    if (simulate(g.cards, g.solution).ok) ref++;
    if (greedy(g.cards).ok) gok++;
    if (playRandom(g.cards, createRng(s * 31 + 1)).ok) rok++;
    const pr = playWithProps(g.cards, createRng(s * 17 + 3), L.maxHold || 5);
    if (pr.ok) { pok++; if (pr.used.revive > 0) pok2++; }
  }
  if (mult3 !== N || ref !== N) bad++;
  rows.push({ L, stats, ref, mult3, rate: gok / N, rnd: rok / N, prop: pok / N, prop2: pok2 / N });
}

console.log(`\n难度曲线 (每关随机生成 ${N} 次)\n`);
console.log([pad('关卡', 6), pad('名称', 14), pad('档位', 10), pad('图案', 10), pad('错位', 10), pad('张数', 6), pad('牌桌+牌堆', 10),
  pad('层', 4), pad('种类', 6), pad('参考解空格', 11), pad('参考解', 11), pad('随机', 8), pad('贪心', 8), pad('贪心+道具', 10), pad('其中未复活', 10)].join(''));
for (const { L, stats, ref, mult3, rate, rnd, prop, prop2 } of rows) {
  const tag = (L.boss ? 'BOSS·' : '') + tierOf(L).name;
  const ok = mult3 === N && ref === N ? '✔' : '✘';
  const bar = '█'.repeat(Math.round(rate * 20));
  console.log([pad(L.id, 6), pad(L.title, 14), pad(tag, 10), pad(getShape(L.pattern).name, 10), pad(OFFSET_MODES[L.mode || 'half'].name, 10),
    pad(stats.total, 6), pad(`${stats.board}+${stats.piles}`, 10), pad(stats.layers, 4), pad(stats.types, 6),
    pad(7 - L.maxHold, 11), pad(`${ok} ${ref}/${N}`, 11), pad(`${(rnd * 100).toFixed(1)}%`, 8), pad(`${(rate * 100).toFixed(1)}%`, 8), pad(`${(prop * 100).toFixed(1)}%`, 10), pad(`${(prop2 * 100).toFixed(1)}%`, 10), bar].join(''));
}
console.log(`\n柱状条 = 贪心通关率。随机 / 贪心 / 贪心+道具 三种模拟玩家各自独立统计；"其中未复活" = 贪心+道具通关且没用复活 (可拿 2 星)。`);
console.log(`\n参考解空格 = 7 - maxHold：按"参考解"顺序消除时卡槽至少还空着几格 (越少越难)。`);
console.log(bad ? `\n✘ 有 ${bad} 个关卡未通过可解性检查` : '\n✔ 所有关卡：每种卡张数均为 3 的倍数，且参考解全部可清空');
if (process.argv.includes('--json')) console.log(JSON.stringify(rows.map((r) => ({ id: r.L.id, random: r.rnd, greedy: r.rate, props: r.prop, propsNoRevive: r.prop2 }))));
process.exit(bad ? 1 : 0);
