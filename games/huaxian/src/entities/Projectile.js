// 投射物：加班老板的「一叠文件」与催婚亲戚的「爱心相亲照」。
// 抛物线飞行；第一次撞到线/地形后失去伤害并淡出。
import Matter from '../lib/matter.js';
import { CAT } from '../config/GameConfig.js';
import { Hazard } from './Hazard.js';

const { Bodies, Body } = Matter;

export class Projectile extends Hazard {
  constructor(world, def, x, y, v) {
    super(world, def);
    const opts = {
      label: def.type,
      density: def.density,
      frictionAir: 0,
      friction: 0.4,
      restitution: 0.3,
      collisionFilter: { category: CAT.PROJ, mask: CAT.TERRAIN | CAT.LINE | CAT.HERO },
    };
    const body = def.type === 'paper'
      ? Bodies.rectangle(x, y, def.w, def.h, opts)
      : Bodies.circle(x, y, def.radius, opts, 12);
    this.addBody(body);
    Body.setVelocity(body, v);
    Body.setAngularVelocity(body, (world.rng.next() - 0.5) * 0.3);
    this.spent = false;
    this.spentAge = 0;
  }

  harmful() { return !this.spent; }

  onCollide(other) {
    if (this.spent || other.label === 'heroine') return;
    this.spent = true;
    this.world.events.emit('hazard:blocked', { type: this.type, x: this.body.position.x, y: this.body.position.y });
  }

  onWin() { this.spent = true; }

  step() {
    this.age += 1 / 60;
    if (this.spent) this.spentAge += 1 / 60;
    const p = this.body.position;
    if (this.spentAge > 1.1 || this.age > this.def.life || p.y > 1100 || p.x < -100 || p.x > 640) this.dead = true;
  }

  render(ctx) {
    const b = this.body;
    if (!b) return;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = this.spent ? Math.max(0, 1 - this.spentAge / 1.1) : 1;
    if (this.type === 'paper') {
      const { w, h } = this.def;
      for (let i = 2; i >= 0; i--) {
        ctx.fillStyle = i === 0 ? '#ffffff' : '#e9e4f2';
        ctx.strokeStyle = '#8b7fa6';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.rect(-w / 2 + i * 1.5, -h / 2 + i * 2, w, h - i * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = '#b7aecb';
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -h / 2 + 4 + k * 4); ctx.lineTo(w / 2 - 4, -h / 2 + 4 + k * 4); ctx.stroke();
      }
      ctx.fillStyle = '#ff4d6d';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('急', w / 2 - 5, h / 2 - 3);
    } else {
      const r = this.def.radius * 1.15;
      ctx.fillStyle = '#ff6fa8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      heartPath(ctx, r);
      ctx.fill(); ctx.stroke();
      // 中间的小照片
      ctx.fillStyle = '#fff6e8';
      ctx.fillRect(-r * 0.42, -r * 0.45, r * 0.84, r * 0.7);
      ctx.fillStyle = '#6b8bd6';
      ctx.beginPath(); ctx.arc(0, -r * 0.17, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-r * 0.24, -r * 0.02, r * 0.48, r * 0.22);
    }
    ctx.restore();
  }
}

export function heartPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.3, r * 0.1, -r * 0.9, -r * 1.05, 0, -r * 0.4);
  ctx.bezierCurveTo(r * 0.9, -r * 1.05, r * 1.3, r * 0.1, 0, r * 0.95);
  ctx.closePath();
}
