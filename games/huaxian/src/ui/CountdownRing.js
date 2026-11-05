// 生存倒计时环：顶部中央的大圆环 + 剩余秒数，最后 3 秒变红并跳动。
import { GameConfig } from '../config/GameConfig.js';
import { drawText } from './draw.js';

export function drawCountdownRing(ctx, x, y, left, total, time) {
  const k = Math.max(0, Math.min(1, left / total));
  const urgent = left <= 3;
  const r = 34;
  const pulse = urgent ? 1 + 0.08 * Math.max(0, Math.sin((left % 1) * Math.PI)) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = 'rgba(120,60,140,0.3)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(200,180,220,0.45)';
  ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.stroke();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, urgent ? '#ff4d6d' : GameConfig.colors.primary);
  g.addColorStop(1, urgent ? '#ff9a5c' : GameConfig.colors.secondary);
  ctx.strokeStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
  // 末端小圆点
  const ea = -Math.PI / 2 + Math.PI * 2 * k;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(Math.cos(ea) * (r - 2), Math.sin(ea) * (r - 2), 3, 0, Math.PI * 2); ctx.fill();
  drawText(ctx, String(Math.max(0, Math.ceil(left))), 0, 1, { size: 30, color: urgent ? '#ff4d6d' : GameConfig.colors.primaryDark });
  ctx.restore();
  void time;
}
