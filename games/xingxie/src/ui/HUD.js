// 战斗 HUD：顶部经验条 + 等级、计时 (月亮→太阳)、击杀 / 星屑、武器与被动格子、Boss 血条、大字提示、字幕。
import { GameConfig } from '../config/GameConfig.js';
import { SLOTS } from '../config/ProgressConfig.js';
import { MAX_WEAPON_LEVEL } from '../config/WeaponConfig.js';
import { PASSIVES } from '../config/PassiveConfig.js';
import { ENEMIES } from '../config/EnemyConfig.js';
import { fmtTime } from '../core/math.js';
import { drawText, roundRectPath, drawStar } from './draw.js';
import { drawIcon } from './icons.js';

const W = GameConfig.width;
const C = GameConfig.colors;

export class HUD {
  constructor(scene) {
    this.scene = scene;
    this.expShow = 0;
    this.bossShow = 1;
  }

  render(ctx, dt) {
    const w = this.scene.world; const p = w.p;
    // 经验条
    const ratio = Math.min(1, p.exp / p.expNext);
    this.expShow += (ratio - this.expShow) * Math.min(1, dt * 10);
    if (ratio < this.expShow - 0.3) this.expShow = ratio;
    ctx.fillStyle = 'rgba(15,8,35,0.75)'; ctx.fillRect(0, 0, W, 14);
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#6fd6ff'); g.addColorStop(1, '#b48cff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W * this.expShow, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(0, 0, W * this.expShow, 4);
    drawText(ctx, `Lv.${p.level}`, 8, 26, { size: 15, align: 'left', stroke: 'rgba(20,10,40,0.8)', strokeWidth: 4 });

    // 计时：0:00 → 5:00，进度条从月亮走到太阳
    const t = Math.min(w.time, w.wave.duration);
    if (w.lastStand) {
      const pulse = 0.75 + 0.25 * Math.sin(w.time * 6);
      drawText(ctx, '黎明前最后一搏', W / 2, 34, { size: 22, color: `rgba(255,${Math.round(190 + 40 * pulse)},140,1)`, stroke: 'rgba(60,20,10,0.85)', strokeWidth: 5 });
    } else drawText(ctx, fmtTime(t), W / 2, 36, { size: 28, stroke: 'rgba(20,10,40,0.85)', strokeWidth: 5 });
    const bx = W / 2 - 80; const by = 56; const bw = 160;
    ctx.fillStyle = 'rgba(20,10,40,0.6)'; roundRectPath(ctx, bx, by, bw, 6, 3); ctx.fill();
    const k = t / w.wave.duration;
    const sg = ctx.createLinearGradient(bx, 0, bx + bw, 0); sg.addColorStop(0, '#8f7cff'); sg.addColorStop(1, '#ffb36b');
    ctx.fillStyle = sg; roundRectPath(ctx, bx, by, Math.max(6, bw * k), 6, 3); ctx.fill();
    // 月亮 / 太阳
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(bx - 12, by + 3, 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#2a1f5c'; ctx.beginPath(); ctx.arc(bx - 9, by + 1, 6, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffb36b'; ctx.beginPath(); ctx.arc(bx + bw + 12, by + 3, 6, 0, 6.283); ctx.fill();
    for (const ev of [150, 240]) { ctx.fillStyle = w.time >= ev ? 'rgba(255,255,255,0.4)' : '#ff4d6d'; ctx.fillRect(bx + bw * ev / w.wave.duration - 1, by - 3, 2, 12); }

    // 击杀 / 星屑
    drawIcon(ctx, 'skull', W - 120, 30, 16, '#d8ccff');
    drawText(ctx, `${w.kills}`, W - 108, 30, { size: 15, align: 'left', stroke: 'rgba(20,10,40,0.8)', strokeWidth: 4 });
    drawIcon(ctx, 'coin', W - 120, 52, 16, C.gold);
    drawText(ctx, `${this.scene.coinsEstimate()}`, W - 108, 52, { size: 15, align: 'left', color: '#ffe08a', stroke: 'rgba(20,10,40,0.8)', strokeWidth: 4 });

    // 血条 (左上)
    const hpw = 120;
    ctx.fillStyle = 'rgba(20,10,40,0.7)'; roundRectPath(ctx, 8, 38, hpw, 12, 6); ctx.fill();
    ctx.fillStyle = p.hp / p.maxHp < 0.3 ? '#ff4d6d' : C.hp; roundRectPath(ctx, 8, 38, Math.max(8, hpw * p.hp / p.maxHp), 12, 6); ctx.fill();
    drawText(ctx, `${Math.ceil(p.hp)}/${p.maxHp}`, 8 + hpw / 2, 45, { size: 10, stroke: 'rgba(20,10,40,0.8)', strokeWidth: 3 });
    if (p.shield > 0) drawText(ctx, '护盾', 8 + hpw + 6, 45, { size: 11, align: 'left', color: '#ffd28a' });

    // 武器 / 被动格子
    const sz = 26;
    for (let i = 0; i < SLOTS.weapons; i++) {
      const x = 8 + i * (sz + 4); const y = 62;
      const wp = w.weapons.list[i];
      ctx.fillStyle = 'rgba(20,10,40,0.55)'; roundRectPath(ctx, x, y, sz, sz, 6); ctx.fill();
      if (wp) {
        const info = w.weapons.info(wp);
        if (wp.evolved) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; roundRectPath(ctx, x, y, sz, sz, 6); ctx.stroke(); }
        drawIcon(ctx, info.icon, x + sz / 2, y + sz / 2, sz - 4, info.color);
        drawText(ctx, wp.evolved ? '★' : (wp.level >= MAX_WEAPON_LEVEL ? 'M' : `${wp.level}`), x + sz - 3, y + sz - 4, { size: 9, color: wp.evolved ? '#ffd23f' : '#fff', stroke: '#2a1f5c', strokeWidth: 3 });
      }
    }
    for (let i = 0; i < SLOTS.passives; i++) {
      const x = 8 + i * (sz + 4); const y = 92;
      const pv = w.player.passives[i];
      ctx.fillStyle = 'rgba(20,10,40,0.45)'; roundRectPath(ctx, x, y, sz, sz, 13); ctx.fill();
      if (pv) {
        const def = PASSIVES[pv.id];
        drawIcon(ctx, def.icon, x + sz / 2, y + sz / 2, sz - 6, def.color);
        drawText(ctx, `${pv.level}`, x + sz - 3, y + sz - 4, { size: 9, stroke: '#2a1f5c', strokeWidth: 3 });
      }
    }

    // Boss 血条
    const b = w.boss;
    if (b && b.alive) {
      const r = b.hp / b.maxHp;
      this.bossShow += (r - this.bossShow) * Math.min(1, dt * 6);
      const y = 132; const bw2 = W - 80;
      if (w.lastStand) drawText(ctx, `晨光增伤 ×${w.dmgMul.toFixed(2)}`, W - 40, y + 24, { size: 12, color: '#ffd28a', align: 'right', stroke: 'rgba(20,10,40,0.9)', strokeWidth: 3 });
      drawText(ctx, ENEMIES[b.type].name, W / 2, y - 8, { size: 15, color: '#ffd0f0', stroke: 'rgba(20,10,40,0.9)', strokeWidth: 4 });
      ctx.fillStyle = 'rgba(20,10,40,0.8)'; roundRectPath(ctx, 40, y, bw2, 12, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; roundRectPath(ctx, 40, y, Math.max(6, bw2 * this.bossShow), 12, 6); ctx.fill();
      const bg = ctx.createLinearGradient(40, 0, 40 + bw2, 0); bg.addColorStop(0, '#ff4d6d'); bg.addColorStop(1, '#b048ff');
      ctx.fillStyle = bg; roundRectPath(ctx, 40, y, Math.max(6, bw2 * r), 12, 6); ctx.fill();
    } else this.bossShow = 1;

    this.renderBanner(ctx);
  }

  renderBanner(ctx) {
    const fx = this.scene.effects;
    const bn = fx.banner;
    if (bn) {
      const k = bn.t / bn.life;
      const appear = Math.min(1, bn.t / 0.25);
      const alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      const y = 300;
      ctx.fillStyle = 'rgba(20,8,40,0.6)'; ctx.fillRect(0, y - 44, W, 88);
      ctx.fillStyle = bn.color; ctx.fillRect(0, y - 44, W * appear, 3); ctx.fillRect(W * (1 - appear), y + 41, W, 3);
      drawText(ctx, bn.text, W / 2 + (1 - appear) * 60, y - 8, { size: 34, color: bn.color, stroke: 'rgba(20,10,40,0.9)', strokeWidth: 6 });
      if (bn.sub) drawText(ctx, bn.sub, W / 2, y + 24, { size: 15, color: '#fff', weight: 'normal' });
      ctx.restore();
    }
    const ts = fx.toast;
    if (ts) {
      const alpha = Math.min(1, ts.t / 0.2) * Math.min(1, (ts.life - ts.t) / 0.4);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.font = `bold 16px ${GameConfig.fontFamily}`;
      const tw = ctx.measureText(ts.text).width + 36;
      roundRectPath(ctx, W / 2 - tw / 2, 160, tw, 34, 17); ctx.fillStyle = 'rgba(20,10,40,0.75)'; ctx.fill();
      ctx.strokeStyle = ts.color; ctx.lineWidth = 2; ctx.stroke();
      drawText(ctx, ts.text, W / 2, 177, { size: 16, color: ts.color });
      ctx.restore();
    }
  }
}

/** 虚拟摇杆：按下的位置就是摇杆中心 (单指)，拖动方向即移动方向 */
export class Joystick {
  constructor() {
    this.active = false;
    this.ox = 0; this.oy = 0; this.x = 0; this.y = 0;
    this.radius = 58;
    this.vec = { x: 0, y: 0 };
  }
  down(p) { this.active = true; this.ox = p.x; this.oy = p.y; this.x = p.x; this.y = p.y; this.vec.x = 0; this.vec.y = 0; }
  move(p) {
    if (!this.active) return;
    let dx = p.x - this.ox; let dy = p.y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {           // 拖出圈外时，中心跟着手指走 (不用把手指挪回来)
      const k = (d - this.radius) / d;
      this.ox += dx * k; this.oy += dy * k;
      dx = p.x - this.ox; dy = p.y - this.oy;
    }
    this.x = p.x; this.y = p.y;
    const dd = Math.hypot(dx, dy);
    const dead = 6;
    if (dd < dead) { this.vec.x = 0; this.vec.y = 0; return; }
    const mag = Math.min(1, (dd - dead) / (this.radius * 0.6));
    this.vec.x = (dx / dd) * mag; this.vec.y = (dy / dd) * mag;
  }
  up() { this.active = false; this.vec.x = 0; this.vec.y = 0; }
  render(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.ox, this.oy, this.radius, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.85;
    const kx = this.ox + this.vec.x * this.radius * 0.8; const ky = this.oy + this.vec.y * this.radius * 0.8;
    ctx.fillStyle = '#ff8fc7'; ctx.beginPath(); ctx.arc(kx, ky, 22, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; drawStar(ctx, kx, ky, 10, 4.5);
    ctx.restore();
  }
}
