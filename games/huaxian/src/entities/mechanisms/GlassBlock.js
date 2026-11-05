// 玻璃块：静态方块，被足够快的石头 / 木箱撞到时碎裂 (那一步不发生碰撞，石头直接穿过去)。
// 1.3：breakAt (秒) —— 「裂开的玻璃地板」：倒计时开始后到点自己碎掉 (前 1.2 秒抖动、裂纹变红作为预警)。
import Matter from '../../lib/matter.js';
import { CAT } from '../../config/GameConfig.js';
import { Mechanism } from './Mechanism.js';
import { roundRectPath } from '../../ui/draw.js';

const { Bodies } = Matter;
const BREAKERS = new Set(['rock', 'crate', 'boss', 'auntie']);

export class GlassBlock extends Mechanism {
  constructor(world, def) {
    super(world, def);
    this.addBody(Bodies.rectangle(def.x + def.w / 2, def.y + def.h / 2, def.w, def.h, {
      isStatic: true, label: 'glass', friction: 0.4, restitution: 0.1,
      collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
    }));
    this.broken = false;
    this.shards = [];
    this.breakAge = 0;
  }

  onCollide(other, pair) {
    if (this.broken || !BREAKERS.has(other.label)) return;
    if (other.speed < this.def.breakSpeed) return;
    if (pair) pair.isActive = false;
    this.shatter(other.velocity);
  }

  /** 碎掉 (被撞碎 / 到时间自己碎) */
  shatter(vel = { x: 0, y: 2 }) {
    if (this.broken) return;
    this.broken = true;
    const d = this.def;
    const other = { velocity: vel };
    // 碎片 (纯视觉，固定伪随机，保证可复现)
    let s = Math.floor(d.x * 7 + d.y * 13) || 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const n = Math.max(6, Math.round((d.w * d.h) / 300));
    for (let i = 0; i < n; i++) {
      this.shards.push({
        x: d.x + rnd() * d.w, y: d.y + rnd() * d.h,
        vx: (rnd() - 0.5) * 6 + other.velocity.x * 0.3, vy: (rnd() - 0.8) * 5 + other.velocity.y * 0.3,
        a: rnd() * 6, va: (rnd() - 0.5) * 0.4, s: 5 + rnd() * 9,
      });
    }
    this.world.events.emit('glass:break', { x: d.x + d.w / 2, y: d.y + d.h / 2 });
  }

  /** 距离自己碎掉还有几秒 (没有 breakAt 时为 Infinity) */
  get timeLeft() {
    const w = this.world;
    if (this.def.breakAt == null || w.state === 'draw') return this.def.breakAt == null ? Infinity : this.def.breakAt;
    return this.def.breakAt - w.time;
  }

  step() {
    if (!this.broken && this.def.breakAt != null && this.world.state === 'survive' && this.timeLeft <= 0) this.shatter();
    if (!this.broken) return;
    if (this.bodies.length) this.removeBody(this.body);
    this.breakAge += 1 / 60;
    for (const p of this.shards) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += p.va; }
    if (this.breakAge > 1.6) this.dead = true;
  }

  render(ctx) {
    const d = this.def;
    ctx.save();
    if (!this.broken) {
      const warn = d.breakAt != null ? Math.max(0, 1 - this.timeLeft / 1.2) : 0;
      if (warn > 0) ctx.translate(Math.sin(this.world.time * 70) * 1.8 * warn, 0);
      roundRectPath(ctx, d.x, d.y, d.w, d.h, 4);
      const g = ctx.createLinearGradient(d.x, d.y, d.x + d.w, d.y + d.h);
      g.addColorStop(0, 'rgba(200,235,255,0.75)'); g.addColorStop(1, 'rgba(160,205,255,0.55)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(110,150,210,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
      // 高光斜线
      ctx.save();
      roundRectPath(ctx, d.x, d.y, d.w, d.h, 4); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
      for (let k = 0; k < d.w + d.h; k += 46) {
        ctx.beginPath(); ctx.moveTo(d.x + k, d.y); ctx.lineTo(d.x + k - d.h, d.y + d.h); ctx.stroke();
      }
      ctx.restore();
      if (d.breakAt != null) this.renderCracks(ctx, warn);
    } else {
      ctx.globalAlpha = Math.max(0, 1 - this.breakAge / 1.6);
      ctx.fillStyle = 'rgba(190,230,255,0.85)'; ctx.strokeStyle = 'rgba(110,150,210,0.9)'; ctx.lineWidth = 1.5;
      for (const p of this.shards) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.beginPath(); ctx.moveTo(-p.s / 2, p.s / 3); ctx.lineTo(0, -p.s / 2); ctx.lineTo(p.s / 2, p.s / 2.5); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }

  /** 会自己碎的玻璃：画裂纹 (越接近碎裂越红)；倒计时开始前就能看出它是「裂开的」 */
  renderCracks(ctx, warn) {
    const d = this.def;
    let s = Math.floor(d.x * 3 + d.y * 5) || 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    ctx.save();
    ctx.strokeStyle = warn > 0 ? `rgba(${200 + 55 * warn},${90 - 60 * warn},${110 - 70 * warn},0.95)` : 'rgba(80,110,170,0.9)';
    ctx.lineWidth = 1.6 + warn * 1.2;
    const cx = d.x + d.w / 2; const cy = d.y + d.h / 2;
    for (let k = 0; k < 7; k++) {
      let x = cx + (rnd() - 0.5) * d.w * 0.2; let y = cy;
      const a = (k / 7) * Math.PI * 2 + rnd() * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += Math.cos(a + (rnd() - 0.5) * 0.9) * d.w * 0.09; y += Math.sin(a + (rnd() - 0.5) * 0.9) * d.h * 0.35;
        ctx.lineTo(Math.max(d.x + 2, Math.min(d.x + d.w - 2, x)), Math.max(d.y + 2, Math.min(d.y + d.h - 2, y)));
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
