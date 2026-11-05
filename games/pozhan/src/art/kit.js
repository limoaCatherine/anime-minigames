// 美术工具：赛璐璐风格 (平涂 + 硬阴影 + 统一 2.4px 深紫描边) 的程序化绘制辅助函数。
// 所有场景道具都用这些函数画，保证线宽、描边色、高光处理一致。
import { GameConfig } from '../config/GameConfig.js';

export const INK = '#4a3656';           // 统一描边色 (深紫，比纯黑柔和)
export const LW = 2.4;                   // 统一线宽 (720 宽基准 2px → 540 逻辑宽约 2.4)
export const FONT = GameConfig.fontFamily;

/** 圆角矩形路径 */
export function rr(ctx, x, y, w, h, r = 6) {
  const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

/** 用当前路径填充 + 描边 */
export function fs(ctx, fill, lw = LW, stroke = INK) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}

/** 圆角矩形 + 填充描边 */
export function box(ctx, x, y, w, h, fill, r = 6, lw = LW) { rr(ctx, x, y, w, h, r); fs(ctx, fill, lw); }

/** 圆 / 椭圆 */
export function circle(ctx, x, y, r, fill, lw = LW) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fs(ctx, fill, lw); }
export function ellipse(ctx, x, y, rx, ry, fill, lw = LW, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fs(ctx, fill, lw); }

/** 多边形 */
export function poly(ctx, pts, fill, lw = LW) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  fs(ctx, fill, lw);
}

/** 线段 */
export function line(ctx, pts, color = INK, lw = LW) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
}

/** 在当前路径内裁剪绘制 (用于硬阴影 / 图案) */
export function clipTo(ctx, pathFn, draw) {
  ctx.save();
  pathFn();
  ctx.clip();
  draw();
  ctx.restore();
}

/** 地面上的软阴影 */
export function groundShadow(ctx, x, y, rx, ry = rx * 0.22, a = 0.18) {
  ctx.save();
  ctx.fillStyle = `rgba(60,30,80,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 高光小条 */
export function shine(ctx, x, y, w, h, a = 0.55) {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  rr(ctx, x, y, w, h, Math.min(w, h) / 2);
  ctx.fill();
  ctx.restore();
}

/** 文字 (场景内招牌/小字统一用系统中文字体) */
export function text(ctx, str, x, y, size = 16, color = INK, { weight = 'bold', align = 'center', baseline = 'middle', stroke = null, sw = 3, maxW = 0, italic = false } = {}) {
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  if (maxW) {
    const w = ctx.measureText(str).width;
    if (w > maxW) { ctx.translate(x, y); ctx.scale(maxW / w, 1); x = 0; y = 0; }
  }
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** 颜色加深 / 提亮 (#rrggbb) */
export function shade(hex, k = 0.82) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
export function tint(hex, k = 0.3) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v + (255 - v) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 带种子的伪随机 (场景装饰用，保证每帧一致) */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** 五角星路径 */
export function starPath(ctx, x, y, R, r = R * 0.45, n = 5) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

/** 樱花一朵 (5 瓣) */
export function blossom(ctx, x, y, r, fill = '#ffc4dc', lw = 1.2) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.58, 0, 0, Math.PI * 2);
    fs(ctx, fill, lw, '#d77fa3');
  }
  circle(ctx, 0, 0, r * 0.18, '#ffe27a', 0);
  ctx.restore();
}

/** 云 (几个圆拼成，扁平) */
export function cloud(ctx, x, y, w, fill = '#ffffff', lw = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  const h = w * 0.32;
  ctx.moveTo(x - w / 2, y);
  ctx.arc(x - w * 0.28, y - h * 0.15, h * 0.55, Math.PI, Math.PI * 1.75);
  ctx.arc(x - w * 0.02, y - h * 0.45, h * 0.75, Math.PI * 1.15, Math.PI * 1.9);
  ctx.arc(x + w * 0.27, y - h * 0.2, h * 0.6, Math.PI * 1.3, Math.PI * 2);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  fs(ctx, fill, lw, 'rgba(120,120,180,0.35)');
  ctx.restore();
}
