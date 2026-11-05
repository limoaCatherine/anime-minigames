// 跷跷板：动态木板 + 转动约束 (支点固定在世界坐标)，倾角限制在 ±maxAngle。
// 支架是一个静态三角形，与木板同属一个负碰撞组 (互不碰撞)。
import Matter from '../../lib/matter.js';
import { CAT } from '../../config/GameConfig.js';
import { Mechanism } from './Mechanism.js';
import { roundRectPath } from '../../ui/draw.js';

const { Bodies, Body, Constraint } = Matter;

export class Seesaw extends Mechanism {
  constructor(world, def) {
    super(world, def);
    const a = (def.angle * Math.PI) / 180;
    const group = Body.nextGroup(true);
    const filter = { category: CAT.TERRAIN, mask: 0xffff, group };
    // 木板中心 = 支点 - offset (沿木板方向)
    const cx = def.x - Math.cos(a) * def.offset; const cy = def.y - Math.sin(a) * def.offset;
    this.plank = this.addBody(Bodies.rectangle(cx, cy, def.w, def.h, {
      label: 'seesaw', angle: a, density: def.density, friction: 1, frictionStatic: 1.5,
      frictionAir: 0.01, restitution: 0, chamfer: { radius: 5 }, collisionFilter: filter,
    }));
    this.baseY = def.baseY != null ? def.baseY : def.y + 60;
    const bw = Math.max(36, (this.baseY - def.y) * 0.7);
    this.base = this.addBody(Bodies.fromVertices(def.x, (def.y + 4 + this.baseY) / 2 + (this.baseY - def.y - 4) / 6, [[
      { x: def.x, y: def.y + 4 }, { x: def.x + bw / 2, y: this.baseY }, { x: def.x - bw / 2, y: this.baseY },
    ]], { isStatic: true, label: 'terrain', friction: 1, collisionFilter: filter }));
    // 修正 fromVertices 质心带来的偏移：把三角形顶点放回支点
    const topV = this.base.vertices.reduce((m, v) => (v.y < m.y ? v : m));
    Body.setPosition(this.base, { x: this.base.position.x + def.x - topV.x, y: this.base.position.y + def.y + 4 - topV.y });
    this.pivot = Constraint.create({
      pointA: { x: def.x, y: def.y }, bodyB: this.plank,
      pointB: { x: Math.cos(a) * def.offset, y: Math.sin(a) * def.offset },
      stiffness: 1, length: 0, damping: 0.1,
    });
    world.physics.add(this.pivot);
    this.max = (def.maxAngle * Math.PI) / 180;
  }

  step() {
    const b = this.plank;
    if (b.angle > this.max || b.angle < -this.max) {
      const lim = Math.max(-this.max, Math.min(this.max, b.angle));
      Body.setAngle(b, lim);
      Body.setAngularVelocity(b, 0);
    }
    Body.setAngularVelocity(b, b.angularVelocity * 0.985);
  }

  render(ctx, _time, theme) {
    const d = this.def;
    // 支架
    ctx.save();
    const v = this.base.vertices;
    ctx.beginPath(); v.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = (theme && theme.accent) || '#b9a6ff'; ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,140,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    // 木板
    const b = this.plank;
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    roundRectPath(ctx, -d.w / 2, -d.h / 2, d.w, d.h, 6);
    const g = ctx.createLinearGradient(0, -d.h / 2, 0, d.h / 2);
    g.addColorStop(0, '#ffd9a8'); g.addColorStop(1, '#e8a96c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#a66e44'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(166,110,68,0.4)'; ctx.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) { if (!k) continue; ctx.beginPath(); ctx.moveTo((k * d.w) / 6, -d.h / 2 + 3); ctx.lineTo((k * d.w) / 6, d.h / 2 - 3); ctx.stroke(); }
    ctx.restore();
    // 支点螺丝
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#8f7cff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(d.x, d.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  destroy() {
    this.world.physics.remove(this.pivot);
    super.destroy();
  }
}
