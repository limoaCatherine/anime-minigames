// 打击感与特效：伤害数字 (对象池，最多 40 个；同屏怪多时只显示暴击)、碎裂粒子 (对象池)、
// 斩击弧光、连锁闪电、冲击波圆环、屏幕震动、受伤红闪、升级 / 进化闪光。只订阅事件，不改战斗数据。
import { ObjectPool } from '../core/ObjectPool.js';
import { GameConfig } from '../config/GameConfig.js';

const CAPS = GameConfig.caps;

export class EffectSystem {
  constructor(scene) {
    this.scene = scene;
    this.numbers = new ObjectPool({ create: () => ({ x: 0, y: 0, v: 0, t: 0, crit: false, vy: 0, heal: false }), prewarm: CAPS.damageNumbers, max: CAPS.damageNumbers });
    this.parts = new ObjectPool({ create: () => ({ x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0, size: 0, color: '#fff', kind: 0, rot: 0 }), prewarm: CAPS.particles, max: CAPS.particles });
    this.arcs = [];      // 斩击
    this.bolts = [];     // 闪电
    this.rings = [];     // 冲击波
    this.shake = 0;
    this.hurtFlash = 0;
    this.whiteFlash = 0;
    this.banner = null;  // 屏幕中央的大字提示 { text, sub, t, color }
    this.toast = null;   // 屏幕上方小提示
    const L = (ev, fn) => scene.listen(ev, fn);
    L('enemy:hit', (e) => this.onHit(e));
    L('enemy:die', (e) => this.burst(e.x, e.y, e.color, e.boss ? 40 : e.elite ? 18 : 5, e.boss ? 260 : e.elite ? 180 : 120, e.r));
    L('slash', (e) => this.arcs.push({ ...e, t: 0, life: 0.22 }));
    L('chain', (e) => this.bolts.push({ pts: jag(e.pts), color: e.color, t: 0, life: 0.16, thick: e.evolved ? 4 : 2.5 }));
    L('meteor:impact', (e) => { this.ring(e.x, e.y, e.r, '#ffb36b', 0.35); this.burst(e.x, e.y, '#ffd28a', e.giant ? 26 : 8, e.giant ? 300 : 160, 6); this.addShake(e.giant ? 12 : 2.5); });
    L('explode', (e) => { this.ring(e.x, e.y, e.r, '#ffffff', 0.25); });
    L('splash', (e) => this.ring(e.x, e.y, e.r, '#ffe680', 0.2));
    L('slam', (e) => { this.ring(e.x, e.y, e.r, '#ff6b6b', 0.35); this.addShake(5); });
    L('blast', (e) => { this.ring(e.x, e.y, e.r, '#ffffff', 0.5); this.whiteFlash = 0.5; this.addShake(8); });
    L('shake', (e) => this.addShake(e.amount || 6));
    L('player:hurt', (e) => { this.hurtFlash = 0.35; this.addShake(4); this.number(e.x, e.y - 20, e.dmg, false, 'hurt'); });
    L('player:heal', (e) => { if (e.amount >= 3) this.number(e.x, e.y - 24, e.amount, false, 'heal'); });
    L('player:block', (e) => this.ring(e.x, e.y, 34, '#ffd28a', 0.3));
    L('player:level', (e) => this.ring(e.x, e.y, 90, '#6fd6ff', 0.45));
    L('weapon:evolve', () => { this.whiteFlash = 0.8; });
    L('boss:die', (e) => { this.whiteFlash = 0.9; this.addShake(14); this.ring(e.x, e.y, 260, '#ffffff', 0.7); });
    L('player:revive', () => { this.whiteFlash = 0.6; });
  }

  addShake(a) { this.shake = Math.min(16, Math.max(this.shake, a) + a * 0.15); }

  onHit(e) {
    const crowd = this.scene.world.enemies.pool.activeCount > CAPS.critOnlyNumbersAbove;
    if (crowd && !e.crit) return;
    this.number(e.x, e.y - 10, e.dmg, e.crit, null);
    if (e.crit || this.parts.activeCount < CAPS.particles * 0.5) this.spark(e.x, e.y, e.crit ? 3 : 1);
  }

  number(x, y, v, crit, kind) {
    let n = this.numbers.get();
    if (!n) { n = this.numbers.active[0]; }   // 满了就复用最老的那个
    n.x = x + (Math.random() - 0.5) * 14; n.y = y; n.v = v; n.t = 0; n.crit = crit; n.kind = kind; n.vy = -60 - (crit ? 30 : 0);
  }

  spark(x, y, n) {
    for (let i = 0; i < n; i++) {
      const p = this.parts.get(); if (!p) return;
      const a = Math.random() * 6.283; const s = 80 + Math.random() * 80;
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.t = 0; p.life = 0.18; p.size = 2.5; p.color = '#ffffff'; p.kind = 1;
    }
  }

  burst(x, y, color, n, speed, r = 10) {
    for (let i = 0; i < n; i++) {
      const p = this.parts.get(); if (!p) return;
      const a = Math.random() * 6.283; const s = speed * (0.4 + Math.random() * 0.6);
      p.x = x + Math.cos(a) * r * 0.4; p.y = y + Math.sin(a) * r * 0.4; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 40;
      p.t = 0; p.life = 0.35 + Math.random() * 0.25; p.size = 2.5 + Math.random() * (r > 20 ? 6 : 3.5); p.color = color; p.kind = 0; p.rot = Math.random() * 6;
    }
  }

  ring(x, y, r, color, life) { if (this.rings.length < 40) this.rings.push({ x, y, r, color, t: 0, life }); }

  showBanner(text, sub, color = '#ffffff', time = 2.2) { this.banner = { text, sub, color, t: 0, life: time }; }
  showToast(text, color = '#ffffff') { this.toast = { text, color, t: 0, life: 2.4 }; }

  update(dt) {
    this.shake = Math.max(0, this.shake - GameConfig.camera.shakeDecay * dt * (1 + this.shake * 0.1));
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.whiteFlash > 0) this.whiteFlash -= dt * 1.6;
    const nums = this.numbers.active;
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i]; n.t += dt; n.y += n.vy * dt; n.vy *= 0.9;
      if (n.t > (n.crit ? 0.8 : 0.55)) this.numbers.release(n);
    }
    const ps = this.parts.active;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + 200 * dt; p.rot += dt * 8;
      if (p.t >= p.life) this.parts.release(p);
    }
    for (const list of [this.arcs, this.bolts, this.rings]) {
      for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt; if (list[i].t >= list[i].life) list.splice(i, 1); }
    }
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.toast) { this.toast.t += dt; if (this.toast.t > this.toast.life) this.toast = null; }
  }

  /** 世界坐标层 (已平移相机) */
  renderWorld(ctx) {
    ctx.save();
    for (const a of this.arcs) {
      const k = a.t / a.life;
      ctx.globalAlpha = (1 - k) * (a.echo ? 0.55 : 0.9);
      ctx.strokeStyle = a.color; ctx.lineWidth = 14 * (1 - k) + 2;
      const half = (a.arc * Math.PI / 180) / 2;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.radius * (0.75 + 0.25 * k), a.angle - half, a.angle + half); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.radius * (0.7 + 0.25 * k), a.angle - half * 0.9, a.angle + half * 0.9); ctx.stroke();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const b of this.bolts) {
      const k = b.t / b.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = b.color; ctx.lineWidth = b.thick * 2.4;
      ctx.beginPath(); b.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.thick * 0.8; ctx.stroke();
    }
    for (const r of this.rings) {
      const k = r.t / r.life;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.4 + 0.6 * Math.sqrt(k)), 0, 6.283); ctx.stroke();
    }
    for (const p of this.parts.active) {
      const k = p.t / p.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = p.color;
      if (p.kind === 1) { ctx.fillRect(p.x - 1, p.y - 1, p.size, p.size); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      const s = p.size * (1 - k * 0.5);
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const n of this.numbers.active) {
      const life = n.crit ? 0.8 : 0.55;
      const k = n.t / life;
      const pop = n.t < 0.08 ? 1 + (1 - n.t / 0.08) * 0.6 : 1;
      ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      const size = (n.crit ? 22 : 15) * pop;
      ctx.font = `bold ${size | 0}px ${GameConfig.fontFamily}`;
      const color = n.kind === 'hurt' ? '#ff4d6d' : n.kind === 'heal' ? '#5ccf8a' : n.crit ? '#ffd23f' : '#ffffff';
      const txt = n.kind === 'heal' ? `+${n.v}` : n.kind === 'hurt' ? `-${n.v}` : `${n.v}`;
      ctx.strokeStyle = 'rgba(40,20,60,0.85)'; ctx.lineWidth = 4;
      ctx.strokeText(txt, n.x, n.y); ctx.fillStyle = color; ctx.fillText(txt, n.x, n.y);
    }
    ctx.restore();
  }

  /** 屏幕层 (红闪 / 白闪 / 大字) */
  renderScreen(ctx, W, H) {
    if (this.hurtFlash > 0) {
      ctx.save();
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,40,80,0)'); g.addColorStop(1, `rgba(255,40,80,${Math.min(0.5, this.hurtFlash * 1.4)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (this.whiteFlash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.7, this.whiteFlash); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
}

/** 把闪电折线加一点锯齿 */
function jag(flat) {
  const pts = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0) {
      const q = pts[i - 1];
      for (let k = 1; k < 3; k++) {
        const t = k / 3;
        out.push({ x: q.x + (p.x - q.x) * t + (Math.random() - 0.5) * 14, y: q.y + (p.y - q.y) * t + (Math.random() - 0.5) * 14 });
      }
    }
    out.push({ x: p.x, y: p.y });
  }
  return out;
}
