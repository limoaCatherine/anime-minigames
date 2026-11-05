// 画线机器人 (sloppy_bot / verify_levels / inspect_level 共用)
//   handDrawn  : 折线重采样成手绘点 + 平滑手抖
//   shaky      : 参考解法 + 手抖 + 整体偏移 ±12px + 缩放 0.92~1.08 (以这一笔的中心为中心)
//   genericDome: 不看关卡的「万能」画法——在主角身上画一个罩子 (12 种)
//   play       : 画线并模拟整局，返回 {won, drawn, by, stars, inkUsed}
import { rng } from './sim.mjs';

/** 沿折线每隔 step 像素重采样，并给每点加平滑的手抖噪声 */
export function handDrawn(pts, r, sigma, step = 7) {
  const out = [];
  let drift = 0; let driftY = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i];
    const L = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.max(1, Math.round(L / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      drift = drift * 0.8 + (r() - 0.5) * sigma; driftY = driftY * 0.8 + (r() - 0.5) * sigma;
      out.push({ x: a.x + (b.x - a.x) * (k / n) + drift, y: a.y + (b.y - a.y) * (k / n) + driftY });
    }
  }
  return out;
}

export function play(level, pts, seed, LevelWorld, EventBus) {
  const w = new LevelWorld(level, new EventBus(), seed);
  const d = w.drawing.drawPolyline(pts);
  let t = 0;
  if (d.line) while (w.state === 'survive' && t < level.time + 1) { w.simulate(0.25); t += 0.25; }
  const r = { won: w.state === 'won', drawn: !!d.line, by: w.result && w.result.by, stars: w.result && w.result.stars, inkUsed: Math.round(d.inkUsed || 0), inkOut: d.inkOut };
  w.destroy();
  return r;
}

export function shaky(level, i) {
  const r = rng(1000 + i * 7 + level.id * 131);
  // 1.3：缩放中心改为这一笔自己的中心 (真人是「瞄准一个位置画一个大概的形状」，而不是以主角为中心整体放大缩小)
  const hx = level.solution.reduce((s, p) => s + p.x, 0) / level.solution.length;
  const hy = level.solution.reduce((s, p) => s + p.y, 0) / level.solution.length;
  const s = 0.92 + r() * 0.16; const ox = (r() - 0.5) * 24; const oy = (r() - 0.5) * 24;
  const base = level.solution.map((p) => ({ x: hx + (p.x - hx) * s + ox, y: hy + (p.y - hy) * s + oy }));
  return handDrawn(base, r, 6);
}

/**
 * 通用罩子 (一半从左往右画，一半从右往左画) (不看关卡、不看提示的「万能」画法)：12 种
 *   0~7  半椭圆罩子：比主角宽 16~58px、高 14~42px，两脚落在主角脚边
 *   8~11 方顶罩子 (左脚 -> 左上 -> 右上 -> 右脚)：比主角宽 20~50px、高 20~40px
 */
export function genericDome(level, i, LevelWorld, EventBus) {
  const r = rng(5000 + i * 13 + level.id * 31);
  const w = new LevelWorld(level, new EventBus(), 1);
  const z = w.heroine.zone(0); w.destroy();
  const cx = z.x + z.w / 2; const feet = z.y + z.h;
  const pts = [];
  if (i % 12 < 8) {
    const rx = z.w / 2 + 16 + (i % 4) * 14 + r() * 6;
    const ry = z.h + 14 + (i % 3) * 14 + r() * 6;
    for (let k = 0; k <= 24; k++) { const a = Math.PI + (Math.PI * k) / 24; pts.push({ x: cx + Math.cos(a) * rx, y: feet - 8 + Math.sin(a) * ry }); }
  } else {
    const hw = z.w / 2 + 20 + (i % 4) * 10 + r() * 6; const top = z.y - 20 - (i % 3) * 10 - r() * 6; const b = feet - 8;
    pts.push({ x: cx - hw, y: b }, { x: cx - hw, y: top }, { x: cx + hw, y: top }, { x: cx + hw, y: b });
  }
  // 一半从左脚开始画，一半从右脚开始画 (被地形截断时，先画的那条腿会留下来)
  if (Math.floor(i / 2) % 2 === 1) pts.reverse();
  return handDrawn(pts, r, 4);
}

export const DOME_VARIANTS = 12;

/** 一关的「通用罩子」统计：胜率、三星率 */
export function domeStats(level, LevelWorld, EventBus, n = DOME_VARIANTS) {
  let won = 0; let three = 0;
  for (let i = 0; i < n; i++) {
    const a = play(level, genericDome(level, i, LevelWorld, EventBus), 1 + (i % 5), LevelWorld, EventBus);
    if (a.won) { won++; if (a.stars >= 3) three++; }
  }
  return { win: won / n, three: three / n };
}
