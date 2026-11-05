// 卡槽外观：木质托盘 + 7 个凹槽；剩 1 格时托盘变红闪烁提示危险。
// 另外绘制"移出暂存区"的 3 个虚线占位 (仅在道具/复活使用后显示)。
import { GameConfig } from '../config/GameConfig.js';
import { SlotSystem } from '../systems/SlotSystem.js';
import { roundRectPath, drawText } from './draw.js';

const SIZE = GameConfig.card.size;

export function drawSlotBar(ctx, count, time) {
  const cap = GameConfig.slot.capacity;
  const p0 = SlotSystem.slotPos(0);
  const p1 = SlotSystem.slotPos(cap - 1);
  const x = p0.x - 12;
  const y = p0.y - 12;
  const w = p1.x + SIZE - p0.x + 24;
  const h = SIZE + GameConfig.card.thickness + 24;
  const danger = count >= GameConfig.slot.warnAt;
  const tense = count >= GameConfig.slot.warnAt - 1;
  ctx.save();
  ctx.shadowColor = 'rgba(90,40,60,0.35)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRectPath(ctx, x, y + 6, w, h, 20);
  ctx.fillStyle = '#b07a52';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#f6d7b0');
  g.addColorStop(1, '#e2b285');
  roundRectPath(ctx, x, y, w, h, 20);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = danger ? `rgba(255,77,109,${0.6 + 0.4 * Math.sin(time * 10)})` : tense ? `rgba(255,170,60,${0.6 + 0.4 * Math.sin(time * 7)})` : '#fff3e2';
  ctx.lineWidth = tense ? 5 : 3;
  ctx.stroke();
  if (tense) {
    // 心跳般的红色外发光
    const beat = Math.pow(Math.max(0, Math.sin(time * (danger ? 12 : 7.6))), 6);
    ctx.save();
    ctx.globalAlpha = 0.25 + beat * 0.5;
    ctx.shadowColor = danger ? '#ff3b6b' : '#ffa53c';
    ctx.shadowBlur = 18 + beat * 14;
    ctx.strokeStyle = danger ? '#ff3b6b' : '#ffa53c';
    ctx.lineWidth = 3;
    roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 22);
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < cap; i++) {
    const p = SlotSystem.slotPos(i);
    roundRectPath(ctx, p.x, p.y, SIZE, SIZE + 2, 10);
    ctx.fillStyle = 'rgba(140,80,50,0.22)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.stroke();
  }
  ctx.restore();
  // 容量提示
  drawText(ctx, `${count}/${cap}`, x + w - 26, y - 2, { size: 15, color: danger ? '#ff4d6d' : '#8a5a3c', stroke: '#fff', strokeWidth: 4 });
}

export function drawTempRowHint(ctx, tempPos) {
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < GameConfig.tempRow.slots; i++) {
    const p = tempPos(i, 0);
    roundRectPath(ctx, p.x, p.y, SIZE, SIZE, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
