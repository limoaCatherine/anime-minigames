// 选角：上方半身卡 + 介绍 (初始武器 / 专属被动 / 属性)，中间 6 个头像，下方难度切换与出发按钮。未解锁的角色显示解锁条件。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { CHARACTERS, CHARACTER_MAP } from '../config/CharacterConfig.js';
import { WEAPONS } from '../config/WeaponConfig.js';
import { DifficultyConfig, DIFFICULTY_ORDER } from '../config/DifficultyConfig.js';
import { Button } from '../ui/Button.js';
import { drawBackground, drawText, roundRectPath, drawPanel } from '../ui/draw.js';
import { drawIcon } from '../ui/icons.js';
import { wrap } from '../ui/BattlePanels.js';

const W = GameConfig.width;
const C = GameConfig.colors;

export class CharacterScene extends Scene {
  constructor(game) { super(game, 'character'); }

  enter() {
    const g = this.game;
    const mk = (o) => { const b = new Button(o); b.audio = g.audio; return b; };
    this.sel = g.save.get('lastChar', 'hikari');
    if (!CHARACTER_MAP[this.sel]) this.sel = 'hikari';
    this.diff = g.save.get('difficulty', 'normal');
    if (!this.diffUnlocked(this.diff)) this.diff = 'normal';
    this.back = mk({ x: 50, y: 40, w: 80, h: 42, label: '返回', style: 'ghost', fontSize: 17, onClick: () => g.scenes.change('menu') });
    this.go = mk({ x: W / 2, y: 900, w: 300, h: 70, label: '出发', fontSize: 30, onClick: () => this.confirm() });
    this.diffBtns = DIFFICULTY_ORDER.map((id, i) => mk({ x: W / 2 - 70 + i * 140, y: 826, w: 124, h: 44, label: DifficultyConfig[id].name, style: 'tab', fontSize: 18, color: id === 'nightmare' ? '#b048ff' : C.primary, onClick: () => this.pickDiff(id) }));
    this.avatars = CHARACTERS.map((c, i) => ({ c, x: 55 + i * 86, y: 735, r: 36 }));
    this.flash = 0;
    this.msg = null;
    this.refresh();
  }

  diffUnlocked(id) { const u = DifficultyConfig[id].unlock; return !u || this.game.save.stats.clears >= u.clears; }

  pickDiff(id) {
    if (!this.diffUnlocked(id)) { this.game.audio.play('deny'); this.msg = { text: '先在普通难度撑到一次天亮', t: 0 }; return; }
    this.diff = id; this.game.save.set('difficulty', id); this.refresh();
  }

  refresh() {
    const s = this.game.save;
    const c = CHARACTER_MAP[this.sel];
    const st = s.unlockState(c);
    this.locked = !st.unlocked;
    if (!this.locked) { this.go.label = '出发'; this.go.style = 'primary'; this.go.enabled = true; this.go.sub = null; }
    else if (st.free) { this.go.label = '免费解锁'; this.go.style = 'green'; this.go.enabled = true; this.go.sub = null; }
    else if (st.cost != null) { this.go.label = `解锁 ${st.cost} 星屑`; this.go.style = 'gold'; this.go.enabled = s.coins >= st.cost; this.go.sub = st.text && c.unlock.type !== 'coins' ? `或：${st.text}` : null; }
    else { this.go.label = '还没解锁'; this.go.style = 'dark'; this.go.enabled = false; this.go.sub = st.text; }
    this.diffBtns.forEach((b, i) => { b.selected = DIFFICULTY_ORDER[i] === this.diff; b.enabled = true; });
  }

  confirm() {
    const g = this.game; const c = CHARACTER_MAP[this.sel];
    if (this.locked) {
      if (g.save.tryUnlock(c)) { g.audio.play('buy'); this.flash = 1; this.msg = { text: `${c.name} 加入了！`, t: 0 }; this.refresh(); }
      else g.audio.play('deny');
      return;
    }
    g.save.set('lastChar', c.id);
    g.scenes.change('game', { character: c.id, difficulty: this.diff });
  }

  activeButtons() { return [this.back, this.go, ...this.diffBtns]; }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    for (const a of this.avatars) {
      if ((p.x - a.x) ** 2 + (p.y - a.y) ** 2 < (a.r + 6) ** 2) { this.sel = a.c.id; this.game.audio.play('click'); this.refresh(); return true; }
    }
    return false;
  }

  onKeyDown(e) {
    const i = CHARACTERS.findIndex((c) => c.id === this.sel);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.sel = CHARACTERS[(i + 1) % CHARACTERS.length].id; this.refresh(); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.sel = CHARACTERS[(i + CHARACTERS.length - 1) % CHARACTERS.length].id; this.refresh(); }
    else if (e.code === 'Enter' || e.code === 'Space') this.confirm();
    else if (e.code === 'Escape') this.game.scenes.change('menu');
  }

  update(dt) { super.update(dt); if (this.flash > 0) this.flash -= dt * 2; if (this.msg) { this.msg.t += dt; if (this.msg.t > 2) this.msg = null; } }

  render(ctx, dt) {
    const g = this.game; const s = g.save;
    drawBackground(ctx, W, g.height, this.time);
    const c = CHARACTER_MAP[this.sel];
    // 半身卡
    const card = g.assets.get(c.card);
    const ch = 318; const cw = card ? ch * card.width / card.height : 0;   // 保持原比例 (上半身立绘)，不再拉伸成头部特写
    ctx.save();
    const glow = ctx.createRadialGradient(W / 2, 250, 20, W / 2, 250, 300);
    glow.addColorStop(0, c.color + '88'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 60, W, 380);
    if (card) {
      if (this.locked) ctx.filter = 'grayscale(0.8) brightness(0.55)';
      ctx.drawImage(card, (W - cw) / 2, 62 + Math.sin(this.time * 1.5) * 3, cw, ch);
      ctx.filter = 'none';
    } else {
      // 抖音版立绘分包还没下载完：先用头像顶上
      const av = g.assets.get(c.avatar);
      if (av) { ctx.globalAlpha = this.locked ? 0.5 : 1; ctx.drawImage(av, W / 2 - 130, 92 + Math.sin(this.time * 1.5) * 3, 260, 260); }
    }
    ctx.restore();
    drawText(ctx, '选一位魔法少女', W / 2, 40, { size: 20, color: '#fff' });
    roundRectPath(ctx, W - 150, 22, 136, 36, 18); ctx.fillStyle = 'rgba(20,10,40,0.6)'; ctx.fill();
    drawIcon(ctx, 'coin', W - 130, 40, 20, C.gold);
    drawText(ctx, `${s.coins}`, W - 114, 41, { size: 17, color: '#ffe08a', align: 'left' });
    // 名字条
    roundRectPath(ctx, 24, 376, W - 48, 50, 25); ctx.fillStyle = 'rgba(20,10,40,0.75)'; ctx.fill();
    ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.stroke();
    drawText(ctx, c.name, 48, 401, { size: 24, color: '#fff', align: 'left' });
    ctx.font = `bold 24px ${GameConfig.fontFamily}`;
    drawText(ctx, c.title, 56 + ctx.measureText(c.name).width, 403, { size: 14, color: c.color, align: 'left', weight: 'normal' });
    if (this.locked) drawText(ctx, '未解锁', W - 48, 401, { size: 15, color: '#ffb0b0', align: 'right' });
    // 介绍面板
    drawPanel(ctx, 24, 436, W - 48, 236, 20, 'rgba(255,250,255,0.94)');
    const lines = wrap(ctx, c.intro, W - 96, `14px ${GameConfig.fontFamily}`);
    lines.slice(0, 2).forEach((l, i) => drawText(ctx, l, 44, 460 + i * 20, { size: 14, color: '#6a5080', align: 'left', weight: 'normal' }));
    const wdef = WEAPONS[c.weapon];
    const y1 = 516;
    ctx.fillStyle = '#3a2d6e'; roundRectPath(ctx, 40, y1 - 22, 44, 44, 10); ctx.fill();
    drawIcon(ctx, wdef.icon, 62, y1, 34, wdef.color);
    drawText(ctx, `初始武器 · ${wdef.name}`, 96, y1 - 9, { size: 15, color: C.text, align: 'left' });
    drawText(ctx, wdef.desc, 96, y1 + 12, { size: 12, color: '#7a6290', align: 'left', weight: 'normal' });
    const y2 = 574;
    ctx.fillStyle = c.color; roundRectPath(ctx, 40, y2 - 22, 44, 44, 22); ctx.fill();
    drawText(ctx, '专', 62, y2 + 1, { size: 20, color: '#fff' });
    drawText(ctx, `专属被动 · ${c.passive.name}`, 96, y2 - 9, { size: 15, color: C.text, align: 'left' });
    drawText(ctx, c.passive.desc, 96, y2 + 12, { size: 12, color: '#7a6290', align: 'left', weight: 'normal' });
    const stat = (label, v, x) => {
      drawText(ctx, label, x, 638, { size: 12, color: '#9a7bb0', align: 'left', weight: 'normal' });
      const pct = Math.round(v * 100);
      drawText(ctx, `${pct}%`, x + 34, 638, { size: 13, color: pct > 100 ? '#35a866' : pct < 100 ? '#e2457f' : C.text, align: 'left' });
    };
    stat('HP', c.hp, 44); stat('移速', c.speed, 150); stat('拾取', c.pickup, 256);
    if (c.armor) drawText(ctx, `护甲 +${c.armor}`, 362, 638, { size: 13, color: '#35a866', align: 'left' });
    // 头像
    for (const a of this.avatars) {
      const on = a.c.id === this.sel;
      const un = s.isUnlocked(a.c.id);
      const img = g.assets.get(a.c.avatar);
      const r = a.r * (on ? 1.12 : 1);
      ctx.save();
      if (!un) ctx.filter = 'grayscale(1) brightness(0.5)';
      if (img) ctx.drawImage(img, a.x - r, a.y - r, r * 2, r * 2);
      ctx.filter = 'none';
      ctx.restore();
      if (on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, r + 4, 0, 6.283); ctx.stroke(); }
      if (!un) drawText(ctx, '锁', a.x, a.y, { size: 18, color: '#fff', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 4 });
      drawText(ctx, a.c.name.split(' ').pop(), a.x, a.y + a.r + 14, { size: 12, color: on ? '#fff' : '#c8b8ff', weight: on ? 'bold' : 'normal' });
    }
    for (const b of this.diffBtns) b.render(ctx, dt);
    if (!this.diffUnlocked('nightmare')) drawText(ctx, '噩梦：通关一次后开放', W / 2 + 70, 856, { size: 10, color: '#c8b8ff', weight: 'normal' });
    this.back.render(ctx, dt); this.go.render(ctx, dt);
    if (this.msg) {
      const a = Math.min(1, (2 - this.msg.t) / 0.4);
      ctx.save(); ctx.globalAlpha = a;
      roundRectPath(ctx, W / 2 - 150, 300, 300, 44, 22); ctx.fillStyle = 'rgba(20,10,40,0.85)'; ctx.fill();
      drawText(ctx, this.msg.text, W / 2, 322, { size: 17, color: '#ffe680' });
      ctx.restore();
    }
    if (this.flash > 0) { ctx.save(); ctx.globalAlpha = this.flash * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, g.height); ctx.restore(); }
  }
}
