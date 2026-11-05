// 特效：找到破绽的红圈动画、点错的 ×、闪光粒子、飘字、画面抖动。坐标为画面逻辑坐标。
import { GameConfig } from '../config/GameConfig.js';

export class EffectSystem {
  constructor() {
    this.parts = [];
    this.marks = [];      // × / 问号等短暂标记
    this.floats = [];     // 飘字
    this.shake = 0;
  }

  clear() { this.parts = []; this.marks = []; this.floats = []; this.shake = 0; }

  burst(x, y, { n = 14, colors = ['#ffd34d', '#ff6f91', '#ffffff', '#7cf0ff'], speed = 180, life = 0.7, size = 5 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life, max: life, size: size * (0.6 + Math.random() * 0.8), c: colors[i % colors.length], star: i % 3 === 0, rot: Math.random() * 6 });
    }
  }

  cross(x, y) { this.marks.push({ x, y, t: 0, max: 0.75, kind: 'x' }); this.shake = Math.max(this.shake, 0.18); }
  ping(x, y, color = '#ffffff') { this.marks.push({ x, y, t: 0, max: 0.5, kind: 'ping', color }); }
  float(text, x, y, color = '#fff', size = 22) { this.floats.push({ text, x, y, t: 0, max: 1.1, color, size }); }

  update(dt) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.rot += dt * 6; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const m of this.marks) m.t += dt;
    this.marks = this.marks.filter((m) => m.t < m.max);
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < f.max);
    this.shake = Math.max(0, this.shake - dt);
  }

  get offset() {
    if (this.shake <= 0) return [0, 0];
    const k = this.shake * 30;
    return [(Math.random() - 0.5) * k, (Math.random() - 0.5) * k];
  }

  render(ctx) {
    for (const p of this.parts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
      ctx.fillStyle = p.c;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.star) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? p.size * 0.4 : p.size; const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    for (const m of this.marks) {
      const k = m.t / m.max;
      ctx.save();
      ctx.translate(m.x, m.y);
      if (m.kind === 'x') {
        const s = 16 * (k < 0.15 ? k / 0.15 * 1.3 : 1.3 - 0.3 * Math.min(1, (k - 0.15) * 4));
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(40,20,50,0.6)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke();
        ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 5.5; ctx.stroke();
      } else {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = m.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 10 + k * 40, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    for (const f of this.floats) {
      const k = f.t / f.max;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `900 ${f.size}px ${GameConfig.fontFamily}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const y = f.y - 40 * (1 - Math.pow(1 - k, 3));
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(60,20,60,0.7)'; ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
      ctx.restore();
    }
  }
}
