// 特效系统：消除闪光粒子、扩散光环、飘字、屏幕闪光、震屏、胜利彩带。
// (改编自姊妹项目《美少女合成》的 EffectSystem)
import { GameConfig } from '../config/GameConfig.js';
import { getCard } from '../config/CardConfig.js';
import { drawStar, drawText, drawHeart } from '../ui/draw.js';

const CONFETTI = ['#ff6fa8', '#ffd23f', '#8f7cff', '#36c6e8', '#5ccf8a', '#ffffff', '#ff9f1c'];

export class EffectSystem {
  constructor(events) {
    this.events = events;
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.confettiTime = 0;
    this.offs = [
      events.on('match', (e) => this.onMatch(e)),
      events.on('card:pick', (e) => this.burst(e.x, e.y, '#ffffff', 5, 80, false, 2.5)),
      events.on('level:fail', () => { this.shake(0.5, 9); this.flash = 0.35; this.flashColor = '#ff8fb0'; }),
      events.on('prop:moveOut', (e) => this.onProp('移出！', e)),
      events.on('prop:undo', (e) => this.onProp('撤回！', e)),
      events.on('prop:shuffle', (e) => this.onProp('洗牌！', e)),
      events.on('revive', (e) => { this.onProp('复活！', e); this.flash = 0.5; this.flashColor = '#fff6c9'; }),
      events.on('level:win', (e) => this.onWin(e)),
    ];
  }

  onMatch({ type, x, y, combo = 1 }) {
    const def = getCard(type);
    this.burst(x, y, def.color, 18, 200, true);
    this.burst(x, y, '#ffffff', 10, 150, true);
    this.burst(x, y, '#ffe14d', 6, 120, true);
    this.burst(x, y, '#ff6fa8', 6 + Math.min(8, combo * 2), 190, false, 4, 'heart');
    this.burst(x, y, '#ffffff', 4, 140, false, 3, 'heart');
    this.rings.push({ x, y, r0: 16, r1: 80, life: 0, max: 0.4, color: def.color, width: 6 });
    this.rings.push({ x, y, r0: 10, r1: 55, life: -0.08, max: 0.35, color: '#ffffff', width: 4 });
    const tx = Math.max(70, Math.min(GameConfig.width - 70, x));
    const txt = combo >= 2 ? `连消 ×${combo}` : '消除！';
    this.texts.push({ x: tx, y: y - 46, text: txt, life: 0, max: 0.9, color: combo >= 2 ? '#ff7a00' : '#ff4fa8', size: combo >= 2 ? 28 : 26, vy: -60 });
    if (combo >= 3) this.shake(0.15, 2 + combo);
  }

  onProp(text, { x = GameConfig.width / 2, y = 700 } = {}) {
    this.burst(x, y, '#ffd23f', 14, 180, true);
    this.texts.push({ x, y: y - 40, text, life: 0, max: 1.0, color: '#8f7cff', size: 30, vy: -50 });
  }

  onWin({ hell }) {
    this.flash = hell ? 0.9 : 0.5;
    this.flashColor = '#fff6c9';
    this.confettiTime = hell ? 6 : 2.5;
    const W = GameConfig.width;
    for (let i = 0; i < (hell ? 6 : 3); i++) {
      const x = W * (0.2 + 0.6 * Math.random());
      const y = 220 + Math.random() * 300;
      CONFETTI.forEach((c) => this.burst(x, y, c, 8, 360, true));
      this.rings.push({ x, y, r0: 10, r1: 160, life: -i * 0.15, max: 0.7, color: CONFETTI[i % CONFETTI.length], width: 8 });
    }
    if (hell) this.shake(0.6, 10);
  }

  burst(x, y, color, count, speed, stars = false, size = 4, shape = null) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25,
        life: 0, max: 0.5 + Math.random() * 0.45,
        size: size + Math.random() * 4, color, star: stars && Math.random() < 0.55, heart: shape === 'heart',
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, g: 420,
      });
    }
  }

  shake(time, mag) {
    this.shakeTime = Math.max(this.shakeTime, time);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  get shakeOffset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const m = this.shakeMag * Math.min(1, this.shakeTime / 0.2);
    return { x: (Math.random() - 0.5) * m * 2, y: (Math.random() - 0.5) * m * 2 };
  }

  update(dt) {
    if (this.confettiTime > 0) {
      this.confettiTime -= dt;
      const n = Math.random() < 0.7 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: Math.random() * GameConfig.width, y: -10, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 80,
          life: 0, max: 3.5, size: 4 + Math.random() * 4, color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
          star: Math.random() < 0.3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, g: 20, rect: true,
        });
      }
    }
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.g * dt;
      p.vx *= 1 - dt * 1.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max && p.y < GameConfig.height + 20);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.max);
    for (const t of this.texts) { t.life += dt; t.y += t.vy * dt; t.vy *= 1 - dt * 2; }
    this.texts = this.texts.filter((t) => t.life < t.max);
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
      ctx.globalAlpha = p.rect ? Math.min(1, (1 - k) * 3) : 1 - k * k;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size * (p.rect ? 1 : 1 - k * 0.5);
      if (p.heart) { ctx.rotate(-p.rot); drawHeart(ctx, 0, 0, s * 1.1); } else if (p.star) drawStar(ctx, 0, 0, s * 1.4, s * 0.6);
      else if (p.rect) ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  renderOverlay(ctx, w, h) {
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      drawText(ctx, t.text, t.x, t.y, { size: t.size * pop, color: t.color, stroke: t.stroke || '#ffffff', strokeWidth: Math.max(4, t.size * 0.2) });
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
    this.particles = []; this.rings = []; this.texts = []; this.flash = 0; this.shakeTime = 0; this.confettiTime = 0;
  }

  destroy() {
    this.offs.forEach((off) => off());
  }
}
