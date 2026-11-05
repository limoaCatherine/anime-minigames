// 画线的绘制：发光的粉色描边 + 流动的彩虹笔刷 + 白色高光芯。
// 画线中 (live) 与成形后 (solid，带「啵」的弹出动画) 使用不同样式。
import { GameConfig } from '../config/GameConfig.js';

function pathOf(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number}[]} pts
 * @param {{time:number, solid?:boolean, age?:number}} o
 */
export function drawInkLine(ctx, pts, { time, solid = false, age = 1 }) {
  if (!pts || pts.length < 2) {
    if (pts && pts.length === 1) {
      ctx.save();
      ctx.fillStyle = '#ff6fa8';
      ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    return;
  }
  const base = GameConfig.line.renderWidth;
  // 成形时的弹出：先变粗再回弹
  const pop = solid ? (age < 0.35 ? 1 + Math.sin((age / 0.35) * Math.PI) * 0.55 : 1) : 1;
  const w = base * pop;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 外发光
  ctx.shadowColor = solid ? 'rgba(226,69,127,0.45)' : 'rgba(255,111,168,0.95)';
  ctx.shadowBlur = solid ? 8 : 22;
  ctx.strokeStyle = solid ? '#d94f8c' : 'rgba(255,140,190,0.75)';
  ctx.lineWidth = w + (solid ? 5 : 9);
  pathOf(ctx, pts);
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  // 彩虹笔刷 (逐段变色，画线中会流动)
  let acc = 0;
  const speed = solid ? 30 : 160;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i];
    acc += Math.hypot(b.x - a.x, b.y - a.y);
    const hue = (330 + acc * 0.45 - time * speed) % 360;
    ctx.strokeStyle = `hsl(${(hue + 360) % 360}, 95%, ${solid ? 72 : 76}%)`;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // 白色高光芯
  ctx.globalAlpha = solid ? 0.7 : 0.9;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, w * 0.3);
  pathOf(ctx, pts);
  ctx.stroke();
  ctx.restore();
  // 成形瞬间的白光
  if (solid && age < 0.25) {
    ctx.save();
    ctx.globalAlpha = 1 - age / 0.25;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = w + 8;
    pathOf(ctx, pts);
    ctx.stroke();
    ctx.restore();
  }
}

/** 笔尖：闪亮的小星星 */
export function drawPenTip(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(time * 3);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ff6fa8';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 4 : 11;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 不能画的位置：红色叉 */
export function drawBlocked(ctx, p, k) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - k);
  ctx.translate(p.x, p.y);
  ctx.scale(1 + k * 0.3, 1 + k * 0.3);
  ctx.fillStyle = 'rgba(255,77,109,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
  ctx.restore();
}
