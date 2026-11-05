// 石头 (程序绘制)：落石 / 滚石。速度较快时才有伤害 (静止在旁边的石头不算)。
// RockSpawner 按关卡时间表生成石头，并在掉落前 0.9 秒显示预警。
import Matter from '../lib/matter.js';
import { CAT } from '../config/GameConfig.js';
import { Hazard } from './Hazard.js';

const { Bodies, Body } = Matter;

export class Rock extends Hazard {
  constructor(world, def, x, y, vx = 0, vy = 0) {
    super(world, def);
    const r = def.radius;
    this.addBody(Bodies.polygon(x, y, 10, r, {
      label: 'rock',
      density: def.density,
      friction: 0.6,
      frictionStatic: 0.8,
      frictionAir: 0.002,
      restitution: 0.15,
      collisionFilter: { category: CAT.HAZARD, mask: CAT.TERRAIN | CAT.LINE | CAT.HERO | CAT.HAZARD },
    }));
    Body.setVelocity(this.body, { x: vx, y: vy });
    this.seed = world.rng.next() * 100;
    this.hitCount = 0;
  }

  get speed() { return this.body ? this.body.speed : 0; }

  harmful() { return this.speed > 1.2 || this.age < 0.4; }

  onCollide(other) {
    if (other.label !== 'heroine' && this.speed > 3) this.world.events.emit('rock:hit', { x: this.body.position.x, y: this.body.position.y, speed: this.speed });
  }

  step() {
    this.age += 1 / 60;
    if (this.body.position.y > 1150 || this.body.position.x < -150 || this.body.position.x > 700) this.dead = true;
  }

  render(ctx) {
    const b = this.body;
    if (!b) return;
    const r = this.def.radius;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    const v = b.vertices;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.1);
    g.addColorStop(0, '#d9d2e6');
    g.addColorStop(1, '#8c809f');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#5f5470';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const cs = Math.cos(-b.angle); const sn = Math.sin(-b.angle);
    v.forEach((p, i) => {
      const dx = p.x - b.position.x; const dy = p.y - b.position.y;
      const x = dx * cs - dy * sn; const y = dx * sn + dy * cs;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 裂纹与高光
    ctx.strokeStyle = 'rgba(80,70,95,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.5); ctx.lineTo(r * 0.25, -r * 0.1); ctx.lineTo(r * 0.05, r * 0.25);
    ctx.moveTo(-r * 0.5, r * 0.2); ctx.lineTo(-r * 0.2, r * 0.35);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export class RockSpawner extends Hazard {
  constructor(world, def) {
    super(world, def);
    this.index = 0;
  }

  harmful() { return false; }

  posAt(i) {
    const d = this.def;
    const x = Array.isArray(d.x) ? d.x[i % d.x.length] : d.x;
    const y = Array.isArray(d.y) ? d.y[i % d.y.length] : d.y;
    return { x, y };
  }

  step() {
    const w = this.world;
    if (w.state !== 'survive') return;
    const d = this.def;
    while (this.index < d.times.length && w.time >= d.times[this.index]) {
      const p = this.posAt(this.index);
      const vx = d.type === 'roller' ? (Array.isArray(d.vx) ? d.vx[this.index % d.vx.length] : d.vx) : 0;
      w.spawn(new Rock(w, d, p.x, p.y, vx, d.vy || 0));
      w.events.emit('rock:spawn', { x: p.x, y: p.y, type: d.type });
      this.index++;
    }
  }

  render(ctx, _assets, time) {
    // 预警：即将出现石头的位置闪烁感叹号
    const w = this.world;
    const d = this.def;
    for (let i = this.index; i < d.times.length; i++) {
      const dt = d.times[i] - (w.state === 'survive' ? w.time : 0);
      const pre = w.state !== 'survive' || dt < 0.9;
      if (!pre || dt < 0) continue;
      const p = this.posAt(i);
      const x = Math.max(24, Math.min(516, p.x));
      const y = Math.max(140, p.y);
      ctx.save();
      ctx.globalAlpha = w.state === 'survive' ? 0.6 + 0.4 * Math.sin(time * 18) : 0.35;
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y + 1);
      if (d.type === 'roller') {
        const dir = Math.sign(Array.isArray(d.vx) ? d.vx[i % d.vx.length] : d.vx) || 1;
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath(); ctx.moveTo(x + dir * 20, y - 7); ctx.lineTo(x + dir * 32, y); ctx.lineTo(x + dir * 20, y + 7); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
}
