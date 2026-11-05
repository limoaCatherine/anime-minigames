// 特效系统：粒子、扩散光环、飘字、彩带 (胜利)、屏幕闪光与震屏。全部订阅事件触发。
import { GameConfig } from '../config/GameConfig.js';
import { drawStar, drawText } from '../ui/draw.js';
import { heartPath } from '../entities/Projectile.js';

const RAINBOW = ['#ff6fa8', '#ffb347', '#ffe066', '#7ee08a', '#6cc8ff', '#9d8cff'];

export class EffectSystem {
  constructor(events) {
    this.events = events;
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.confetti = [];
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.lastBounce = 0;
    this.time = 0;
    this.offs = [
      events.on('line:commit', (e) => this.onCommit(e)),
      events.on('bee:bounce', (e) => this.onBounce(e)),
      events.on('hazard:blocked', (e) => this.burst(e.x, e.y, e.type === 'heart' ? '#ff9cc8' : '#ffffff', 8, 120)),
      events.on('hazard:land', (e) => { this.dust(e.x, e.y, 16); this.shake(0.25, 6); }),
      events.on('rock:hit', (e) => { this.dust(e.x, e.y, 8); this.shake(0.15, Math.min(6, e.speed)); }),
      events.on('level:lose', (e) => this.onLose(e)),
      events.on('level:win', (e) => this.onWin(e)),
      events.on('ink:empty', (e) => this.texts.push({ x: e.x, y: e.y - 30, text: '墨水用完啦', life: 0, max: 1.1, color: '#8f7cff', size: 22, vy: -40 })),
      events.on('portal:warp', (e) => { this.burst(e.from.x, e.from.y, e.color, 6, 90); this.burst(e.to.x, e.to.y, e.color, 8, 140); }),
      events.on('spring:launch', (e) => { this.burst(e.x, e.y + 10, '#ffe066', 8, 160); this.shake(0.12, 3); }),
      events.on('glass:break', (e) => { this.burst(e.x, e.y, '#bfe6ff', 16, 220); this.shake(0.2, 5); }),
      events.on('hint:show', () => { this.flash = 0.25; this.flashColor = '#fff0f7'; }),
    ];
  }

  onCommit({ points }) {
    // 沿线爆出彩虹星星，表示线「成形」
    const step = Math.max(1, Math.floor(points.length / 14));
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      this.burst(p.x, p.y, RAINBOW[i % RAINBOW.length], 4, 110);
    }
    const mid = points[Math.floor(points.length / 2)];
    this.rings.push({ x: mid.x, y: mid.y, r0: 10, r1: 90, life: 0, max: 0.45, color: '#ffffff', width: 6 });
    this.flash = 0.18; this.flashColor = '#ffffff';
  }

  onBounce({ x, y }) {
    if (this.time - this.lastBounce < 0.05) return;
    this.lastBounce = this.time;
    this.burst(x, y, '#fff6b0', 3, 90);
  }

  onLose({ x, y }) {
    this.burst(x, y, '#ff4d6d', 22, 260);
    this.burst(x, y, '#ffffff', 10, 200);
    this.rings.push({ x, y, r0: 10, r1: 110, life: 0, max: 0.5, color: '#ff4d6d', width: 8 });
    this.shake(0.5, 12);
    this.flash = 0.35; this.flashColor = '#ff8fa8';
  }

  onWin({ x, y }) {
    const W = GameConfig.width;
    for (let i = 0; i < 90; i++) {
      this.confetti.push({
        x: Math.random() * W, y: -20 - Math.random() * 300,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 120,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
        color: RAINBOW[i % RAINBOW.length], life: 0, max: 3.5 + Math.random() * 1.5, sway: Math.random() * 6,
        heart: i % 7 === 0,
      });
    }
    RAINBOW.forEach((c) => this.burst(x, y + 60, c, 8, 260));
    this.rings.push({ x, y: y + 60, r0: 20, r1: 160, life: 0, max: 0.6, color: '#ffd23f', width: 8 });
    this.flash = 0.4; this.flashColor = '#fff6c9';
  }

  dust(x, y, count) { this.burst(x, y, '#c8bcd6', count, 140); }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.25,
        life: 0,
        max: 0.45 + Math.random() * 0.45,
        size: 2.5 + Math.random() * 5,
        color: Math.random() < 0.25 ? '#ffffff' : color,
        star: Math.random() < 0.5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 10,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  /** 画线时笔尖的小火花 (由场景调用) */
  trail(x, y, color) {
    this.particles.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 50, life: 0, max: 0.4 + Math.random() * 0.3, size: 2 + Math.random() * 3.5, color, star: Math.random() < 0.6, rot: 0, vr: 4 });
  }

  shake(time, mag) {
    this.shakeTime = Math.max(this.shakeTime, time);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  get shakeOffset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const m = this.shakeMag * Math.min(1, this.shakeTime * 4);
    return { x: (Math.random() - 0.5) * 2 * m, y: (Math.random() - 0.5) * 2 * m };
  }

  update(dt) {
    this.time += dt;
    for (const p of this.particles) {
      p.life += dt;
      p.vy += 420 * dt;
      p.vx *= 1 - dt * 1.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.max);
    for (const t of this.texts) { t.life += dt; t.y += t.vy * dt; t.vy *= 1 - dt * 2; }
    this.texts = this.texts.filter((t) => t.life < t.max);
    for (const c of this.confetti) {
      c.life += dt;
      c.x += (c.vx + Math.sin(c.life * 3 + c.sway) * 40) * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
    }
    this.confetti = this.confetti.filter((c) => c.life < c.max && c.y < GameConfig.height + 30);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.shakeTime > 0) this.shakeTime -= dt; else this.shakeMag = 0;
  }

  render(ctx) {
    for (const r of this.rings) {
      if (r.life < 0) continue;
      const k = r.life / r.max;
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of this.particles) {
      const k = p.life / p.max;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size * (1 - k * 0.5);
      if (p.star) drawStar(ctx, 0, 0, s * 1.4, s * 0.6);
      else { ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  renderOverlay(ctx, w, h) {
    for (const c of this.confetti) {
      ctx.save();
      ctx.globalAlpha = c.life > c.max - 0.5 ? (c.max - c.life) / 0.5 : 1;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      if (c.heart) { heartPath(ctx, 6); ctx.fill(); } else ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * (0.6 + 0.4 * Math.abs(Math.sin(c.life * 6))));
      ctx.restore();
    }
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      drawText(ctx, t.text, t.x, t.y, { size: t.size * pop, color: t.color, stroke: t.stroke || '#ffffff', strokeWidth: Math.max(4, t.size * 0.18) });
      ctx.restore();
    }
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  clear() {
    this.particles = []; this.rings = []; this.texts = []; this.confetti = []; this.flash = 0; this.shakeTime = 0;
  }

  destroy() {
    this.offs.forEach((off) => off());
  }
}
