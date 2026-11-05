// 风车：运动学旋转叶片 (静态复合刚体，每步 setAngle 并写入角速度)，把蜜蜂 / 石头 / 投射物扫开。
// 整个风车圆盘是禁画区。
import Matter from '../../lib/matter.js';
import { CAT } from '../../config/GameConfig.js';
import { Mechanism } from './Mechanism.js';

const { Bodies, Body } = Matter;
const COLORS = ['#ff9cc8', '#8fd3ff', '#ffe066', '#a8e6a1', '#c3a6ff', '#ffb38a'];

export class Windmill extends Mechanism {
  constructor(world, def) {
    super(world, def);
    const parts = [];
    const n = def.blades;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const L = def.r - 8;
      const cx = def.x + Math.cos(a) * (L / 2 + 8); const cy = def.y + Math.sin(a) * (L / 2 + 8);
      parts.push(Bodies.rectangle(cx, cy, L, def.bladeW, { angle: a, chamfer: { radius: def.bladeW / 2.2 } }));
    }
    parts.push(Bodies.circle(def.x, def.y, 12));
    const body = Body.create({ parts, isStatic: true, label: 'windmill', friction: 0.2, restitution: 0.6, collisionFilter: { category: CAT.TERRAIN, mask: 0xffff } });
    // 复合体质心应在轴心；数值误差修正
    Body.setPosition(body, { x: def.x, y: def.y });
    this.addBody(body, false);
    this.angle = 0;
  }

  zone() {
    const r = this.def.r + 4;
    return { x: this.def.x - r, y: this.def.y - r, w: r * 2, h: r * 2 };
  }

  step() {
    const b = this.body;
    if (!this.running) { b.anglePrev = b.angle; b.positionPrev.x = b.position.x; b.positionPrev.y = b.position.y; return; }
    this.angle += this.def.speed / 60;
    Body.setAngle(b, this.angle, true);
    b.positionPrev.x = b.position.x; b.positionPrev.y = b.position.y;
  }

  render(ctx, time) {
    const d = this.def;
    ctx.save();
    if (d.poleTo) {
      ctx.strokeStyle = '#c9b6e8'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.poleTo); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(d.x - 2, d.y + 14); ctx.lineTo(d.x - 2, d.poleTo - 4); ctx.stroke();
    }
    // 扫动范围提示
    ctx.strokeStyle = 'rgba(143,124,255,0.25)'; ctx.setLineDash([5, 7]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.translate(d.x, d.y);
    ctx.rotate(this.body.angle);
    const n = d.blades;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i / n) * Math.PI * 2);
      // 纸风车叶片：一个弯月形三角
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(6, -d.bladeW / 2);
      ctx.quadraticCurveTo(d.r * 0.6, -d.bladeW * 1.6, d.r, -d.bladeW * 0.2);
      ctx.lineTo(d.r - 4, d.bladeW / 2);
      ctx.lineTo(6, d.bladeW / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ff6fa8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
