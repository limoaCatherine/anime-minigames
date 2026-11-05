// 「手残玩家」机器人：模拟不精确的真人画线，统计每关通过率，用来找难度尖峰。
//   shaky : 参考解法 + 手抖 (每点 ±σ 噪声) + 整体偏移 (±12px) + 缩放 (0.92~1.08，以这一笔的中心为中心) + 重新采样成手绘点
//   dome  : 不看提示的通用画法——在主角身上画一个罩子 (12 种：半椭圆 / 方顶，多种宽度高度)
// 用法: node tools/sloppy_bot.mjs [关卡号...] [--n=16] [--json=out.json]
import fs from 'node:fs';
import { loadSim } from './lib/sim.mjs';
import { play as playBot, shaky, genericDome } from './lib/bots.mjs';

const S = await loadSim();
const { LevelWorld, EventBus, LEVELS, getLevel } = S;
const args = process.argv.slice(2);
const N = Number((args.find((a) => a.startsWith('--n=')) || '--n=16').slice(4));
const jsonOut = (args.find((a) => a.startsWith('--json=')) || '').slice(7);
const only = args.filter((a) => /^\d+$/.test(a)).map(Number);

const play = (level, pts, seed) => playBot(level, pts, seed, LevelWorld, EventBus);

const dome = (level, i) => genericDome(level, i, LevelWorld, EventBus);

const report = [];
for (const raw of LEVELS) {
  if (only.length && !only.includes(raw.id)) continue;
  const level = getLevel(raw.id);
  let sw = 0; let dw = 0; const fails = {};
  for (let i = 0; i < N; i++) {
    const a = play(level, shaky(level, i), 1 + (i % 5));
    if (a.won) sw++; else fails[a.drawn ? a.by : 'rejected'] = (fails[a.drawn ? a.by : 'rejected'] || 0) + 1;
  }
  const ND = 12;
  let ds = 0; let d3 = 0;
  for (let i = 0; i < ND; i++) { const a = play(level, dome(level, i), 1 + (i % 5)); if (a.won) { dw++; ds += a.stars; if (a.stars >= 3) d3++; } }
  const row = { id: raw.id, name: raw.name, shaky: sw / N, dome: dw / ND, dome3: d3 / ND, domeStars: dw ? ds / dw : 0, fails };
  report.push(row);
  console.log(`L${String(raw.id).padStart(2)} ${raw.name.padEnd(8, '　')} 手抖解法 ${String(Math.round(row.shaky * 100)).padStart(3)}%  通用罩子 ${String(Math.round(row.dome * 100)).padStart(3)}% (三星 ${String(Math.round(row.dome3 * 100)).padStart(3)}%)  失败原因 ${JSON.stringify(fails)}`);
}
const avg = (k) => Math.round((report.reduce((s, r) => s + r[k], 0) / report.length) * 100);
console.log(`\n平均：手抖解法 ${avg('shaky')}%，通用罩子 ${avg('dome')}%`);
const late = report.filter((r) => r.id >= 4);
if (late.length) {
  const m = (k) => Math.round((late.reduce((s, r) => s + r[k], 0) / late.length) * 100);
  console.log(`第 4 关起 (${late.length} 关)：手抖解法 ${m('shaky')}%，通用罩子胜率 ${m('dome')}%，罩子三星率 ${m('dome3')}%，手抖 < 85% 的关卡: ${late.filter((r) => r.shaky < 0.85).map((r) => r.id).join(',') || '无'}`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
