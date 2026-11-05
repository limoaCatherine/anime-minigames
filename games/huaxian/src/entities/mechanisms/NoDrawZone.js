// 禁画区：没有碰撞体，只是阴影区域内不能画线 (线的边缘也不能进入)。
import { Mechanism } from './Mechanism.js';
import { roundRectPath } from '../../ui/draw.js';

export class NoDrawZone extends Mechanism {
  constructor(world, def) {
    super(world, def);
    this.layer = 'back';
  }

  zone() { const d = this.def; return { x: d.x, y: d.y, w: d.w, h: d.h }; }

  get zoneMode() { return 'line'; }

  render(ctx, time) {
    const d = this.def;
    ctx.save();
    roundRectPath(ctx, d.x, d.y, d.w, d.h, 12);
    ctx.fillStyle = 'rgba(120,90,160,0.16)';
    ctx.fill();
    ctx.clip();
    // 斜线阴影 (缓慢移动)
    ctx.strokeStyle = 'rgba(120,90,160,0.28)';
    ctx.lineWidth = 6;
    const off = (time * 12) % 24;
    for (let k = -d.h; k < d.w + d.h; k += 24) {
      ctx.beginPath(); ctx.moveTo(d.x + k + off, d.y); ctx.lineTo(d.x + k + off - d.h, d.y + d.h); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, d.x, d.y, d.w, d.h, 12);
    ctx.setLineDash([10, 7]);
    ctx.strokeStyle = 'rgba(150,100,190,0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);
    // 禁止画笔图标
    if (d.w >= 50 && d.h >= 50) {
      const cx = d.x + d.w / 2; const cy = d.y + d.h / 2;
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#a678d6'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 10, cy + 10); ctx.lineTo(cx + 10, cy - 10); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#ff6fa8';
      ctx.beginPath(); ctx.moveTo(cx - 6, cy - 2); ctx.lineTo(cx + 2, cy - 10); ctx.stroke();
    }
    ctx.restore();
  }
}
