// 关卡可解性验证 (无头、无浏览器)：在 Node 里直接运行关卡模拟 LevelWorld。
// 对每一关：
//   1) 用配置里的参考解法 solution 走与玩家完全相同的画线检测 (不能穿过禁画区/地形、墨水够用)
//   2) 用多个随机种子模拟整个倒计时，断言主角存活 -> 胜利
//   3) 对照组：只画一条无用的短线，断言主角会失败 (保证关卡确实有威胁)
//   4) 参考解法必须拿到 3 星
//   5) (1.3) 通用罩子：不看关卡、直接在她身上画罩子 (12 种) 的胜率 / 三星率；
//      全量运行时断言第 4 关起平均胜率 ≤ 25%、三星率 ≤ 5% (--no-dome 跳过)
// 用法: node tools/verify_levels.mjs [关卡号...] [--seeds=5] [-v]
import { build } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { domeStats } from './lib/bots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.window = { Matter: require(path.join(root, 'vendor/matter.min.js')) };

const args = process.argv.slice(2);
const seedsArg = args.find((a) => a.startsWith('--seeds='));
const SEEDS = seedsArg ? Number(seedsArg.split('=')[1]) : 5;
const verbose = args.includes('-v');
const noDome = args.includes('--no-dome');
const only = args.filter((a) => /^\d+$/.test(a)).map(Number);

const entry = path.join(os.tmpdir(), `adl-entry-${process.pid}.js`);
const out = path.join(os.tmpdir(), `adl-sim-${process.pid}.mjs`);
fs.writeFileSync(entry, `
export { LevelWorld } from ${JSON.stringify(path.join(root, 'src/core/LevelWorld.js'))};
export { EventBus } from ${JSON.stringify(path.join(root, 'src/core/EventBus.js'))};
export { LEVELS, getLevel } from ${JSON.stringify(path.join(root, 'src/config/LevelConfig.js'))};
`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'error' });
const { LevelWorld, EventBus, LEVELS, getLevel } = await import(pathToFileURL(out).href);
fs.rmSync(entry); fs.rmSync(out);

function run(level, seed, pts) {
  const events = new EventBus();
  const w = new LevelWorld(level, events, seed);
  const draw = w.drawing.drawPolyline(pts);
  let t = 0;
  if (draw.line) {
    while ((w.state === 'survive' || w.state === 'won') && t < level.time + 1.5) { w.simulate(0.25); t += 0.25; if (w.state === 'won' && t > level.time + 0.5) break; }
  }
  const r = { draw, state: w.state, result: w.result, t: Math.round(w.time * 100) / 100, bees: w.hazards.count('bee') };
  w.destroy();
  return r;
}

// 对照组：在屏幕上找一个能画的短线位置 (远离主角)
function controlLine(level) {
  const events = new EventBus();
  const w = new LevelWorld(level, events, 1);
  for (const y of [140, 170, 200, 400]) {
    for (const x of [30, 470, 250]) {
      if (Math.abs(x - level.heroine.x) < 120 && y > 300) continue;
      const pts = [{ x, y }, { x: x + 40, y }];
      if (w.drawing.canPlace(pts[0]) && w.drawing.canPlace(pts[1])) { w.destroy(); return pts; }
    }
  }
  w.destroy();
  return null;
}

let failures = 0;
const rows = [];
const domes = [];
for (const raw of LEVELS) {
  if (only.length && !only.includes(raw.id)) continue;
  const level = getLevel(raw.id);
  const wins = []; let msg = '';
  for (let s = 1; s <= SEEDS; s++) {
    const r = run(level, s, level.solution);
    if (!r.draw.ok) { msg = `画线被拒绝 (rejected=${r.draw.rejected}, inkOut=${r.draw.inkOut}, reason=${r.draw.reason || ''} ${JSON.stringify(r.draw.at || '')})`; wins.push(false); break; }
    const ok = r.state === 'won' && r.result.stars === 3;
    if (r.state === 'won' && r.result.stars !== 3 && !msg) msg = `seed ${s}: 参考解法只拿到 ${r.result.stars} 星`;
    wins.push(ok);
    if (!ok && !msg) msg = `seed ${s}: ${r.state} by ${r.result && r.result.by} @${r.t}s`;
    if (verbose) console.log(`  L${raw.id} seed${s}: ${r.state} ${JSON.stringify(r.result)} t=${r.t}`);
  }
  // 扰动解法：模拟玩家手抖 (每个点随机偏移 ±4 像素)，3 个变体中至少 2 个要胜利
  let jitterWins = 0;
  for (let j = 1; j <= 3; j++) {
    let st = j * 9973;
    const rnd = () => { st = (st * 16807) % 2147483647; return st / 2147483647 - 0.5; };
    const pts = level.solution.map((p, i) => (i === 0 || i === level.solution.length - 1 ? p : { x: p.x + rnd() * 8, y: p.y + rnd() * 8 }));
    const r = run(level, j, pts);
    if (r.state === 'won') jitterWins++;
    else if (verbose) console.log(`  L${raw.id} jitter${j}: ${r.draw.ok ? r.state + ' by ' + (r.result && r.result.by) : 'draw rejected'}`);
  }
  if (jitterWins < 2) { wins.push(false); msg += ` 扰动解法仅 ${jitterWins}/3 胜`; }
  const cl = controlLine(level);
  const ctrl = cl ? run(level, 1, cl) : null;
  const threat = ctrl && ctrl.state === 'lost';
  const okAll = wins.length >= SEEDS && wins.every(Boolean);
  const jit = `扰动 ${jitterWins}/3`;
  let dome = '';
  if (!noDome) {
    const d = domeStats(level, LevelWorld, EventBus);
    if (raw.id >= 4) domes.push(d);
    dome = `  罩子 ${String(Math.round(d.win * 100)).padStart(3)}% (三星 ${String(Math.round(d.three * 100)).padStart(3)}%)`;
  }
  if (!okAll || !threat) failures++;
  rows.push(`${okAll && threat ? '✔' : '✘'} L${String(raw.id).padStart(2)} ${raw.name.padEnd(8, '　')} 解法 ${wins.filter(Boolean).length}/${SEEDS} 胜 ${jit}  墨水 ${level.solutionLength}/${level.ink}${dome}  对照组: ${ctrl ? `${ctrl.state} by ${ctrl.result && ctrl.result.by} @${ctrl.t}s` : '无可画位置'} ${msg}`);
  console.log(rows[rows.length - 1]);
}
if (domes.length) {
  const win = domes.reduce((a, d) => a + d.win, 0) / domes.length;
  const three = domes.reduce((a, d) => a + d.three, 0) / domes.length;
  console.log(`\n第 4 关起 ${domes.length} 关：通用罩子平均胜率 ${Math.round(win * 100)}%，三星率 ${Math.round(three * 100)}%`);
  if (domes.length >= 37 && (win > 0.25 || three > 0.05)) { failures++; console.log('✘ 通用罩子太好用了 (目标：胜率 ≤ 25%，三星率 ≤ 5%)'); }
}
console.log(failures ? `\n失败 ${failures} 关` : `\n全部 ${rows.length} 关验证通过 ✔`);
process.exit(failures ? 1 : 0);
