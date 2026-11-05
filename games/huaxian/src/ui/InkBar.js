// 墨水条：显示剩余墨水比例，标出三星/二星的用墨线。
import { GameConfig } from '../config/GameConfig.js';
import { roundRectPath, drawText, drawStar } from './draw.js';

export function drawInkBar(ctx, x, y, w, h, ratio, level, time, flash = 0) {
  const C = GameConfig.colors;
  ctx.save();
  // 铅笔图标
  ctx.save();
  ctx.translate(x - 20, y + h / 2);
  ctx.rotate(-0.7);
  ctx.fillStyle = '#ffd6e8'; ctx.fillRect(-4, -12, 8, 18);
  ctx.fillStyle = C.primary; ctx.fillRect(-4, -12, 8, 5);
  ctx.fillStyle = '#ffe0b8'; ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(4, 6); ctx.lineTo(0, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3d6e'; ctx.beginPath(); ctx.moveTo(-1.4, 10.5); ctx.lineTo(1.4, 10.5); ctx.lineTo(0, 13); ctx.closePath(); ctx.fill();
  ctx.restore();

  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = flash > 0 ? `rgba(255,77,109,${0.5 + 0.5 * Math.sin(time * 30)})` : 'rgba(255,143,199,0.8)';
  ctx.stroke();
  const fw = Math.max(0, (w - 6) * ratio);
  if (fw > 1) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff8fc7');
    g.addColorStop(0.5, '#c58bff');
    g.addColorStop(1, '#7fc8ff');
    roundRectPath(ctx, x + 3, y + 3, Math.max(h - 6, fw), h - 6, (h - 6) / 2);
    ctx.fillStyle = g;
    ctx.fill();
    roundRectPath(ctx, x + 6, y + 4, Math.max(0, fw - 6), (h - 6) * 0.35, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  }
  // 星级刻度 (1.3 加强)：剩余比例高于刻度 = 还能拿到对应星级。
  //   墨水条下方的色带标出各星级区间 (金 = 三星，浅紫 = 二星)；刻度线加粗并伸出墨水条；
  //   星星画在墨水条下方 (不和关卡名挤在一起)；丢掉的星变灰并画一道斜线
  if (level) {
    const marks = [[level.stars[0], 3, '#ffb800'], [level.stars[1], 2, '#a98bff']];
    let prev = x + w - 3;
    for (const [limit, , col] of marks) {
      const r = 1 - limit / level.ink;
      if (r <= 0) continue;
      const mx = x + 3 + (w - 6) * r;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      roundRectPath(ctx, mx, y + h + 2, Math.max(0, prev - mx - 2), 4, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      prev = mx;
    }
    marks.forEach(([limit, n, col]) => {
      const r = 1 - limit / level.ink;
      if (r <= 0) return;
      const mx = x + 3 + (w - 6) * r;
      const ok = ratio >= r;
      ctx.fillStyle = ok ? 'rgba(90,61,110,0.8)' : 'rgba(255,77,109,0.9)';
      ctx.fillRect(mx - 1.5, y - 3, 3, h + 9);
      const sy = y + h + 14;
      ctx.fillStyle = ok ? (n === 3 ? C.star : col) : 'rgba(180,170,190,0.9)';
      for (let i = 0; i < n; i++) drawStar(ctx, mx + 7 + i * 11, sy, 5.5, 2.4);
      if (!ok) {
        ctx.strokeStyle = 'rgba(255,77,109,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx + 1, sy + 6); ctx.lineTo(mx + 13 + (n - 1) * 11, sy - 6); ctx.stroke();
      }
    });
  }
  drawText(ctx, `${Math.round(ratio * 100)}%`, x + w + 24, y + h / 2 + 1, { size: 14, color: C.text });
  ctx.restore();
}
