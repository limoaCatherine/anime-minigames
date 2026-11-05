// 弹簧 / 弹跳垫：静态刚体。石头、木箱、敌人、投射物碰到顶面时，下一步被沿弹射方向弹出 (速度 = power)。
// 主角、画的线、蜜蜂不会被弹射。
import Matter from '../../lib/matter.js';
import { CAT } from '../../config/GameConfig.js';
import { Mechanism } from './Mechanism.js';
import { roundRectPath } from '../../ui/draw.js';

const { Bodies, Body } = Matter;
const SKIP = new Set(['line', 'heroine', 'bee', 'terrain', 'wall', 'spike', 'platform', 'seesaw', 'glass', 'spring', 'windmill']);
const H = 30; // 弹簧总高 (底座到弹跳垫顶面)

export class Spring extends Mechanism {
  constructor(world, def) {
    super(world, def);
    const a = (def.angle * Math.PI) / 180;
    this.n = { x: Math.sin(a), y: -Math.cos(a) };
    this.a = a;
    // 弹跳垫中心：底座中心沿法向抬高 H-7
    const px = def.x + this.n.x * (H - 7); const py = def.y + this.n.y * (H - 7);
    this.addBody(Bodies.rectangle(px, py, def.w, 14, {
      isStatic: true, label: 'spring', angle: a, friction: 0.6, restitution: 0,
      chamfer: { radius: 6 }, collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
    }));
    // 底座 + 弹簧圈 (实体，避免东西从下面穿过)
    this.addBody(Bodies.rectangle(def.x + this.n.x * (H / 2 - 4), def.y + this.n.y * (H / 2 - 4), def.w * 0.5, H - 14, {
      isStatic: true, label: 'terrain', angle: a, collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
    }));
    this.queue = [];
    this.squash = 0;
    this.launches = 0;
  }

  onCollide(other) {
    if (SKIP.has(other.label) || other.isStatic) return;
    // 只有碰到顶面 (相对弹簧在法向一侧) 才弹
    const pad = this.body;
    const rel = (other.position.x - pad.position.x) * this.n.x + (other.position.y - pad.position.y) * this.n.y;
    if (rel > 4 && !this.queue.includes(other)) this.queue.push(other);
  }

  step() {
    if (this.squash > 0) this.squash = Math.max(0, this.squash - 1 / 60);
    if (!this.queue.length) return;
    const d = this.def;
    for (const b of this.queue) {
      const v = b.velocity;
      const tan = { x: -this.n.y, y: this.n.x };
      const vt = (v.x * tan.x + v.y * tan.y) * d.keep;
      Body.setVelocity(b, { x: this.n.x * d.power + tan.x * vt, y: this.n.y * d.power + tan.y * vt });
      this.launches++;
      this.world.events.emit('spring:launch', { x: b.position.x, y: b.position.y });
    }
    this.queue = [];
    this.squash = 0.3;
  }

  render(ctx, time) {
    const d = this.def;
    const k = this.squash > 0 ? Math.sin((this.squash / 0.3) * Math.PI) : 0;
    const top = H - 7 - k * 8 + (this.squash > 0 ? 0 : Math.sin(time * 3) * 0.6);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(this.a);
    // 底座
    roundRectPath(ctx, -d.w * 0.32, -8, d.w * 0.64, 8, 3);
    ctx.fillStyle = '#9b8ad6'; ctx.fill();
    // 弹簧圈
    ctx.strokeStyle = '#ff6fa8'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    const coils = 4; const hgt = top - 14;
    for (let i = 0; i <= coils * 2; i++) {
      const y = -8 - (hgt * i) / (coils * 2);
      const x = (i % 2 ? 1 : -1) * d.w * 0.2;
      if (i === 0) ctx.moveTo(0, -8); else ctx.lineTo(x, y);
    }
    ctx.lineTo(0, -top + 7);
    ctx.stroke();
    // 弹跳垫
    roundRectPath(ctx, -d.w / 2, -top - 7, d.w, 14, 7);
    const g = ctx.createLinearGradient(0, -top - 7, 0, -top + 7);
    g.addColorStop(0, '#fff176'); g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#d9822b'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * d.w * 0.28, -top, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}
