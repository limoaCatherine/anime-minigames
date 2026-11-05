// 调试单关：node tools/inspect_level.mjs <关卡号> [solution|shaky:i|dome:i] [--seed=1]
// 打印画线结果、线最后的位置、胜负和原因。
import { loadSim } from './lib/sim.mjs';
import { shaky, genericDome } from './lib/bots.mjs';

const S = await loadSim();
const { LevelWorld, EventBus, getLevel } = S;
const args = process.argv.slice(2);
const id = Number(args[0]); const mode = args[1] || 'solution';
const seed = Number((args.find((a) => a.startsWith('--seed=')) || '--seed=1').slice(7));
const level = getLevel(id);
const [kind, idx] = mode.split(':');
const pts = kind === 'shaky' ? shaky(level, Number(idx)) : kind === 'dome' ? genericDome(level, Number(idx), LevelWorld, EventBus) : level.solution;
const w = new LevelWorld(level, new EventBus(), seed);
const d = w.drawing.drawPolyline(pts);
const r1 = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
console.log(`L${id} ${mode} ink ${level.ink} stars ${level.stars} sol ${level.solutionLength}`);
console.log('input', pts.length, 'pts', r1(pts[0]), '->', r1(pts[pts.length - 1]));
console.log('draw', { ok: d.ok, rejected: d.rejected, inkUsed: Math.round(d.inkUsed || 0), inkOut: d.inkOut, startBlocked: d.startBlocked, line: !!d.line });
const lineBodies = () => (w.lines || []).map((l) => l.body || l).filter(Boolean);
let t = 0;
while (d.line && w.state === 'survive' && t < level.time + 1) {
  w.simulate(0.5); t += 0.5;
  const lb = d.line.body || d.line;
  if (lb && lb.bounds) console.log(`t=${t} line bbox ${r1(lb.bounds.min)} .. ${r1(lb.bounds.max)} angle ${(lb.angle * 57.3).toFixed(0)} state ${w.state}`);
}
console.log('result', w.state, JSON.stringify(w.result));
