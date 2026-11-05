// 木箱：普通动态方块。可以挡东西、被推倒、被弹簧弹飞、穿过传送门；高速砸到主角算失败。
import Matter from '../../lib/matter.js';
import { CAT } from '../../config/GameConfig.js';
import { Mechanism } from './Mechanism.js';
import { roundRectPath } from '../../ui/draw.js';

const { Bodies } = Matter;

export class Crate extends Mechanism {
  constructor(world, def) {
    super(world, def);
    this.teleportable = true;
    this.addBody(Bodies.rectangle(def.x, def.y - def.h / 2, def.w, def.h, {
      label: 'crate', density: def.density, friction: def.friction, frictionStatic: 1.2,
      frictionAir: 0.004, restitution: 0.05, chamfer: { radius: 4 },
      collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
    }));
  }

  harmful() { return this.body && this.body.speed > this.def.harmSpeed; }

  step() {
    const p = this.body.position;
    if (p.y > 1200) this.dead = true;
  }

  render(ctx) {
    const b = this.body;
    if (!b) return;
    const { w, h } = this.def;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 5);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#f6c690'); g.addColorStop(1, '#dc9a5e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#9b5f37'; ctx.lineWidth = 3; ctx.stroke();
    // 木板纹 + 斜撑
    ctx.strokeStyle = 'rgba(155,95,55,0.75)'; ctx.lineWidth = 2.5;
    roundRectPath(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w / 2 + 7, h / 2 - 7); ctx.lineTo(w / 2 - 7, -h / 2 + 7); ctx.stroke();
    // 可爱贴纸
    ctx.fillStyle = '#ff9cc8';
    ctx.beginPath(); ctx.arc(-w * 0.2, -h * 0.18, Math.min(w, h) * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
