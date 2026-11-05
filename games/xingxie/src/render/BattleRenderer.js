// 战斗画面：只读 BattleWorld 的数据来画，不改任何战斗状态。
// 视野裁剪 (只画屏幕内的东西) + 离屏缓存精灵 (SpriteFactory)，300 只怪同屏也只是 300 次 drawImage。
import { GameConfig } from '../config/GameConfig.js';
import { PICKUPS } from '../config/ProgressConfig.js';
import { SpriteFactory } from './SpriteFactory.js';
import { platform } from '../core/platform/index.js';

const W = GameConfig.width;
const H = GameConfig.height;

export class BattleRenderer {
  constructor(game, world, effects) {
    this.game = game;
    this.world = world;
    this.effects = effects;
    this.sprites = game.sprites || (game.sprites = new SpriteFactory(game.assets));
    this.cam = { x: 0, y: 0 };
    this.tile = makeTile();
    this.pattern = null;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    const p = this.world.p;
    this.cam.x = p.x - W / 2;
    this.cam.y = p.y - H * GameConfig.camera.playerScreenY;
  }

  render(ctx) {
    const w = this.world; const fx = this.effects; const S = this.sprites;
    const sh = fx.shake;
    const ox = sh ? (Math.random() - 0.5) * sh : 0; const oy = sh ? (Math.random() - 0.5) * sh : 0;
    const cx = this.cam.x - ox; const cy = this.cam.y - oy;
    this.drawGround(ctx, cx, cy);

    ctx.save();
    ctx.translate(-cx, -cy);
    const x0 = cx - 60; const y0 = cy - 60; const x1 = cx + W + 60; const y1 = cy + H + 60;
    const inView = (x, y, r = 0) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1;

    // —— 地面区域 ——
    for (const z of w.projectiles.zones) this.drawZone(ctx, z);

    // —— 宝石 / 道具 ——
    for (const g of w.pickups.gems.active) {
      if (!inView(g.x, g.y)) continue;
      const def = PICKUPS.gems[g.type];
      const sp = S.gem(g.type, def.color, Math.round(g.r));
      const bob = Math.sin(g.t * 4 + g.x) * 1.5;
      ctx.drawImage(sp.img, g.x - sp.size / 2, g.y - sp.size / 2 + bob, sp.size, sp.size);
    }
    for (const it of w.pickups.items) {
      if (!inView(it.x, it.y)) continue;
      const sp = S.shot(it.kind, '#ffd23f', it.r);
      const bob = Math.sin(it.t * 3) * 3;
      ctx.drawImage(sp.img, it.x - sp.size / 2, it.y - sp.size / 2 + bob, sp.size, sp.size);
    }

    // —— 怪物 ——
    const list = w.enemies.pool.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const rr = e.r * e.scale;
      if (!inView(e.x, e.y, rr * 1.6)) continue;
      const sp = S.enemy(e.def, rr, e.elite);
      let dx = e.x; let dy = e.y;
      let sx = 1; let sy = 1;
      if (e.def.sprite === 'bat') sy = 0.85 + 0.15 * Math.sin(this.t * 14 + e.phase);
      else if (e.def.sprite === 'slime') { const k = Math.sin(this.t * 6 + e.phase) * 0.06; sx = 1 + k; sy = 1 - k; }
      if (e.state === 1 && e.def.behavior === 'dash') { dx += (Math.random() - 0.5) * 3; dy += (Math.random() - 0.5) * 3; }
      const flip = e.def.sprite !== 'nox' && w.p.x < e.x ? -1 : 1;
      const img = e.flash > 0 ? sp.white : sp.img;
      const size = sp.size;
      if (e.alpha < 1) ctx.globalAlpha = e.alpha;
      if (sx === 1 && sy === 1 && flip === 1) ctx.drawImage(img, dx - size / 2, dy - size / 2, size, size);
      else {
        ctx.save(); ctx.translate(dx, dy + (1 - sy) * size * 0.3); ctx.scale(sx * flip, sy);
        ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore();
      }
      if (e.freeze > 0) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#bdf0ff'; ctx.beginPath(); ctx.arc(dx, dy, rr * 1.05, 0, 6.283); ctx.fill(); }
      else if (e.stun > 0) { ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffe680'; for (let k = 0; k < 3; k++) { const a = this.t * 6 + k * 2.1; ctx.fillRect(dx + Math.cos(a) * rr * 0.6 - 1.5, dy - rr - 4 + Math.sin(a) * 3, 3, 3); } }
      ctx.globalAlpha = 1;
      if (e.state === 1 && e.def.behavior === 'dash') {
        ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dx, dy, rr * 1.3, 0, 6.283); ctx.stroke();
      }
      if (e.elite && e.hp < e.maxHp) this.hpBar(ctx, e.x, e.y - rr * 1.35, rr * 2, e.hp / e.maxHp, '#ffd23f');
    }
    for (const hz of w.enemies.hazards) {
      if (!inView(hz.x, hz.y, 30)) continue;
      const sp = S.enemy(hz.def, hz.r);
      ctx.save(); ctx.translate(hz.x, hz.y + Math.abs(Math.sin(hz.t * 18)) * -4); ctx.scale(hz.vx < 0 ? -1 : 1, 1);
      ctx.drawImage(sp.img, -sp.size / 2, -sp.size / 2, sp.size, sp.size); ctx.restore();
    }

    // —— 玩家 ——
    this.drawPlayer(ctx);

    // —— 护符环 ——
    for (const wp of w.weapons.list) {
      if (wp.def.form !== 'orbit' || !wp.state.orbs) continue;
      const o = wp.state.orbs; const info = w.weapons.info(wp);
      const sp = S.shot('talisman', info.color, wp.st.size * 0.9);
      for (let k = 0; k + 1 < o.length; k += 2) {
        ctx.save(); ctx.translate(o[k], o[k + 1]); ctx.rotate(this.t * 3 + k);
        ctx.drawImage(sp.img, -sp.size / 2, -sp.size / 2, sp.size, sp.size); ctx.restore();
      }
    }

    // —— 子弹 ——
    for (const o of w.projectiles.pool.active) {
      if (!inView(o.x, o.y, 30)) continue;
      const color = o.w ? w.weapons.info(o.w).color : '#fff';
      const sp = S.shot(o.kind, color, Math.max(5, o.r));
      if (o.kind === 'star' && o.r <= 10) { ctx.drawImage(sp.img, o.x - sp.size / 2, o.y - sp.size / 2, sp.size, sp.size); continue; }
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.kind === 'rang' ? this.t * 12 : o.angle);
      ctx.drawImage(sp.img, -sp.size / 2, -sp.size / 2, sp.size, sp.size); ctx.restore();
    }
    for (const b of w.projectiles.bullets.active) {
      if (!inView(b.x, b.y, 20)) continue;
      const sp = S.shot('bullet', b.kind === 'nox' ? '#b048ff' : '#ff8a3c', b.r);
      ctx.drawImage(sp.img, b.x - sp.size / 2, b.y - sp.size / 2, sp.size, sp.size);
    }

    fx.renderWorld(ctx);
    ctx.restore();

    this.drawNight(ctx);
    this.drawBossPointer(ctx, cx, cy);
    fx.renderScreen(ctx, W, H);
  }

  drawPlayer(ctx) {
    const w = this.world; const p = w.p;
    const r = p.r;
    const sp = this.sprites.player(w.char, r);
    const blink = p.invuln > 0 && Math.floor(this.t * 20) % 2 === 0;
    const bob = p.moving ? Math.sin(this.t * 14) * 2 : Math.sin(this.t * 3) * 1;
    // 拾取范围 (很淡)
    ctx.strokeStyle = 'rgba(111,214,255,0.10)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.pickup, 0, 6.283); ctx.stroke();
    const img = p.hurtFlash > 0.15 ? sp.white : sp.img;
    if (blink) ctx.globalAlpha = 0.35;
    ctx.drawImage(img, p.x - sp.size / 2, p.y - sp.size / 2 + bob, sp.size, sp.size);
    ctx.globalAlpha = 1;
    // 朝向小箭头
    const fx = p.facing.x; const fy = p.facing.y;
    ctx.fillStyle = w.char.color;
    ctx.save(); ctx.translate(p.x + fx * (r * 1.7), p.y + fy * (r * 1.7) + bob); ctx.rotate(Math.atan2(fy, fx));
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3, -5); ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(255,190,110,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, r * 1.75 + Math.sin(this.t * 5) * 1.5, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(255,190,110,0.12)'; ctx.fill();
    }
    if (p.slowZone > 0) { ctx.fillStyle = 'rgba(180,140,255,0.3)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.6, 0, 6.283); ctx.fill(); }
  }

  drawZone(ctx, z) {
    const k = z.t / (z.warn || z.duration || 1);
    switch (z.kind) {
      case 'rose': {
        const fade = Math.min(1, z.t / 0.2) * Math.min(1, (z.duration - z.t) / 0.3);
        ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = z.src && z.src.evolved ? '#ff4d6d' : '#ff7aa8';
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.7 * fade; ctx.fillStyle = '#ffd0e0';
        for (let i = 0; i < 7; i++) { const a = i * 0.9 + z.t * 0.8; const rr = z.r * (0.3 + ((i * 37) % 60) / 100); ctx.beginPath(); ctx.ellipse(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, 4, 2.5, a, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 1;
        break;
      }
      case 'meteor': case 'slam': case 'pillow': {
        if (z.done) break;
        const col = z.hostile ? '255,70,90' : '255,180,100';
        ctx.fillStyle = `rgba(${col},${0.12 + 0.12 * k})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.fill();
        ctx.strokeStyle = `rgba(${col},0.85)`; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = `rgba(${col},0.3)`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * Math.min(1, k), 0, 6.283); ctx.fill();
        if (z.kind === 'meteor') {
          const h = (1 - Math.min(1, k)) * 260;
          ctx.fillStyle = '#ffd28a'; ctx.beginPath(); ctx.arc(z.x + h * 0.4, z.y - h, z.giant ? 26 : 9, 0, 6.283); ctx.fill();
          ctx.strokeStyle = 'rgba(255,210,138,0.5)'; ctx.lineWidth = z.giant ? 14 : 5; ctx.beginPath(); ctx.moveTo(z.x + h * 0.4, z.y - h); ctx.lineTo(z.x + h * 0.4 + 30, z.y - h - 70); ctx.stroke();
        }
        break;
      }
      case 'sleep': {
        ctx.fillStyle = 'rgba(170,130,255,0.22)'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(210,190,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `bold 14px ${GameConfig.fontFamily}`; ctx.textAlign = 'center';
        ctx.fillText('Zz', z.x + Math.sin(z.t * 2) * 8, z.y - 6 - (z.t * 10) % 16);
        break;
      }
      case 'cage': {
        const a = Math.min(1, z.t / 0.4) * Math.min(1, (z.duration - z.t) / 0.4);
        ctx.strokeStyle = `rgba(120,40,200,${0.75 * a})`; ctx.lineWidth = 26;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = `rgba(220,180,255,${0.9 * a})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -z.t * 30;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
        break;
      }
      case 'lane': {
        const blink = 0.18 + 0.12 * Math.sin(z.t * 20);
        ctx.fillStyle = `rgba(255,80,100,${blink})`; ctx.fillRect(z.x - z.w / 2, z.y - z.r, z.w, z.r * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `bold 18px ${GameConfig.fontFamily}`; ctx.textAlign = 'center';
        ctx.fillText(z.dir > 0 ? '→ → →' : '← ← ←', z.x, z.y + 6);
        break;
      }
      default: break;
    }
  }

  hpBar(ctx, x, y, w, ratio, color) {
    ctx.fillStyle = 'rgba(30,15,50,0.7)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 4);
  }

  drawGround(ctx, cx, cy) {
    if (!this.pattern) this.pattern = ctx.createPattern(this.tile, 'repeat');
    const T = 256;
    ctx.save();
    ctx.translate(-(((cx % T) + T) % T), -(((cy % T) + T) % T));
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, W + T, H + T);
    ctx.restore();
  }

  /** Boss 在画面外时，屏幕边缘画一个指向它的箭头 */
  drawBossPointer(ctx, cx, cy) {
    const b = this.world.boss;
    if (!b || !b.alive) return;
    const sx = b.x - cx; const sy = b.y - cy; const m = 26;
    if (sx > -m && sx < W + m && sy > -m && sy < H + m) return;
    const ax = W / 2; const ay = H * GameConfig.camera.playerScreenY;
    const dx = sx - ax; const dy = sy - ay;
    const k = Math.min((W / 2 - 30) / Math.abs(dx || 1e-6), (dy < 0 ? ay - 150 : H - ay - 40) / Math.abs(dy || 1e-6));
    const px = ax + dx * k; const py = ay + dy * k;
    const a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(px, py); ctx.rotate(a);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(this.t * 8);
    ctx.fillStyle = '#ff4d6d'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /** 夜色：四周压暗；越接近黎明 (5:00) 画面越亮、偏暖 */
  drawNight(ctx) {
    const ls = this.world.lastStand;
    const dawn = Math.min(1.25, Math.max(0, (this.world.time - 200) / 100) + (ls ? Math.min(0.25, ls.t / 40) : 0));
    const g = ctx.createRadialGradient(W / 2, H * 0.56, H * 0.25, W / 2, H * 0.56, H * 0.72);
    g.addColorStop(0, 'rgba(10,5,30,0)');
    g.addColorStop(1, `rgba(10,5,30,${0.55 - dawn * 0.3})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (dawn > 0) {
      const d = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      d.addColorStop(0, `rgba(255,170,120,${dawn * 0.28})`); d.addColorStop(1, 'rgba(255,170,120,0)');
      ctx.fillStyle = d; ctx.fillRect(0, 0, W, H * 0.5);
    }
  }
}

/** 256×256 无缝地面贴图：夜晚的梦境草地 (深紫底 + 小花 + 星点 + 淡淡的格纹) */
function makeTile() {
  const T = 256;
  const c = platform.createCanvas(T, T);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, T, T);
  grad.addColorStop(0, '#2b2160'); grad.addColorStop(1, '#30245f');
  g.fillStyle = grad; g.fillRect(0, 0, T, T);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // 柔和的大色块
  for (let i = 0; i < 6; i++) {
    const x = rnd() * T; const y = rnd() * T; const r = 40 + rnd() * 50;
    for (const [ox, oy] of [[0, 0], [T, 0], [-T, 0], [0, T], [0, -T]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, i % 2 ? 'rgba(90,70,160,0.25)' : 'rgba(60,40,120,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, T, T);
    }
  }
  // 淡格纹 (像梦里的棋盘地砖)
  g.strokeStyle = 'rgba(160,140,255,0.06)'; g.lineWidth = 1;
  for (let k = 0; k <= T; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, T); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(T, k); g.stroke(); }
  // 草叶
  for (let i = 0; i < 70; i++) {
    const x = rnd() * T; const y = rnd() * T;
    g.strokeStyle = `rgba(${120 + rnd() * 60 | 0},${110 + rnd() * 60 | 0},220,0.25)`; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - 4, x + 1 + rnd() * 3, y - 7); g.stroke();
  }
  // 小花
  const cols = ['#ff8fc7', '#ffd23f', '#9be7ff', '#b48cff'];
  for (let i = 0; i < 14; i++) {
    const x = 8 + rnd() * (T - 16); const y = 8 + rnd() * (T - 16);
    g.fillStyle = cols[i % 4]; g.globalAlpha = 0.55;
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, 6.283); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 1.2, 0, 6.283); g.fill();
  }
  // 星点
  g.globalAlpha = 1;
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.35})`; g.fillRect(rnd() * T, rnd() * T, 1.5, 1.5); }
  return c;
}
