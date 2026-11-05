// 战斗中的弹窗：升级三选一、宝箱、复活。都是画布 UI，按钮交给 GameScene 分发输入。
import { GameConfig } from '../config/GameConfig.js';
import { CARD_RULES, RUN_RULES } from '../config/ProgressConfig.js';
import { Button } from './Button.js';
import { drawText, roundRectPath, drawPanel, drawStar } from './draw.js';
import { drawIcon } from './icons.js';

const W = GameConfig.width;
const H = GameConfig.height;
const C = GameConfig.colors;

function dim(ctx, a) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#120828'; ctx.fillRect(0, 0, W, H); ctx.restore(); }

function wrap(ctx, text, maxW, font) {
  ctx.font = font;
  const out = []; let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch;
  }
  if (line) out.push(line);
  return out;
}

/** 三选一卡片 */
class CardButton extends Button {
  constructor(o) { super({ style: 'card', ...o }); this.appear = 0; }
  render(ctx, dt) {
    if (!this.visible || !this.card) return;
    this.appear = Math.min(1, this.appear + dt * 5);
    const target = this.pressed ? 0.96 : this.hover ? 1.03 : 1;
    this.scale += (target - this.scale) * Math.min(1, dt * 18);
    const c = this.card; const { w, h } = this;
    const e = 1 - Math.pow(1 - this.appear, 3);
    ctx.save();
    ctx.translate(this.x + (1 - e) * 80 * (this.index % 2 ? -1 : 1), this.y);
    ctx.globalAlpha = e;
    ctx.scale(this.scale, this.scale);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 18); ctx.fillStyle = '#fffaff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3; ctx.strokeStyle = c.color; ctx.stroke();
    // 左侧图标底
    roundRectPath(ctx, -w / 2 + 12, -h / 2 + 12, 84, h - 24, 14);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#3a2d6e'); g.addColorStop(1, '#5b3a8c');
    ctx.fillStyle = g; ctx.fill();
    drawIcon(ctx, c.icon, -w / 2 + 54, 0, 58, c.color);
    const tx = -w / 2 + 112;
    drawText(ctx, c.name, tx, -h / 2 + 30, { size: 21, color: C.text, align: 'left' });
    ctx.font = `bold 21px ${GameConfig.fontFamily}`;
    const nw = ctx.measureText(c.name).width;
    const tag = c.type === 'filler' ? '' : c.isNew ? '新！' : `Lv.${c.level}`;
    if (tag) {
      const tw = c.isNew ? 40 : 46;
      roundRectPath(ctx, tx + nw + 8, -h / 2 + 19, tw, 22, 11); ctx.fillStyle = c.isNew ? '#ff6fa8' : '#8f7cff'; ctx.fill();
      drawText(ctx, tag, tx + nw + 8 + tw / 2, -h / 2 + 31, { size: 13, color: '#fff' });
    }
    if (c.type === 'passive') drawText(ctx, '被动', w / 2 - 14, -h / 2 + 30, { size: 12, color: '#9a7bb0', align: 'right', weight: 'normal' });
    const lines = wrap(ctx, c.desc, w - 136, `15px ${GameConfig.fontFamily}`);
    lines.slice(0, 2).forEach((l, i) => drawText(ctx, l, tx, -h / 2 + 62 + i * 21, { size: 15, color: '#5a4a6e', align: 'left', weight: 'normal' }));
    if (c.hint) drawText(ctx, c.hint, tx, h / 2 - 16, { size: 11, color: '#c07a20', align: 'left', weight: 'normal' });
    ctx.restore();
  }
}

export class LevelUpPanel {
  constructor(scene) {
    this.scene = scene;
    const g = scene.game;
    const mk = (o, Cls = Button) => { const b = new Cls(o); b.audio = g.audio; return b; };
    this.cards = [0, 1, 2].map((i) => mk({ x: W / 2, y: 300 + i * 150, w: 486, h: 136, index: i, onClick: () => this.pick(i) }, CardButton));
    this.cards.forEach((c) => { c.audio = null; });
    this.refreshBtn = mk({ x: 150, y: 772, w: 210, h: 58, label: '换一批', style: 'secondary', fontSize: 22, onClick: () => this.refresh(false) });
    this.adBtn = mk({ x: 390, y: 772, w: 210, h: 58, label: '换一批', style: 'gold', fontSize: 22, tag: '广告', onClick: () => this.refresh(true) });
    this.skipBtn = mk({ x: W / 2, y: 850, w: 300, h: 46, label: `都不要（+${RUN_RULES.skip.coins} 星屑，回 ${RUN_RULES.skip.heal} HP）`, style: 'ghost', fontSize: 15, onClick: () => this.skip() });
    this.t = 0;
  }

  open(cards) {
    this.t = 0;
    this.set(cards);
  }

  set(cards) {
    this.cards.forEach((b, i) => { b.card = cards[i]; b.visible = !!cards[i]; b.appear = 0; b.pressed = false; });
    this.sync();
  }

  sync() {
    const w = this.scene.world;
    this.refreshBtn.enabled = w.refreshFree > 0;
    this.refreshBtn.sub = `免费 ${w.refreshFree} 次`;
    const adLeft = RUN_RULES.adRefresh - w.refreshAdUsed;
    this.adBtn.enabled = adLeft > 0;
    this.adBtn.sub = `还剩 ${adLeft} 次`;
    // 没有可用激励视频：隐藏「看广告换一批」，免费换一批居中
    const ad = this.scene.game.ads.enabled;
    this.adBtn.visible = ad;
    Object.assign(this.refreshBtn, ad ? { x: 150, w: 210 } : { x: W / 2, w: 260 });
  }

  get locked() { return this.t < CARD_RULES.inputLock; }

  get buttons() { return this.locked ? [] : [...this.cards, this.refreshBtn, ...(this.adBtn.visible ? [this.adBtn] : []), this.skipBtn]; }

  pick(i) { this.scene.world.levelup.choose(i); }
  skip() { this.scene.world.levelup.skip(); }

  refresh(viaAd) {
    const sc = this.scene; const w = sc.world;
    if (!viaAd) { if (w.levelup.refresh(false)) this.set(w.levelup.offer); return; }
    if (!sc.game.ads.enabled) return;
    sc.showAd('refresh', (ok) => { if (ok && w.levelup.refresh(true)) this.set(w.levelup.offer); else this.sync(); });
  }

  update(dt) { this.t += dt; }

  render(ctx, dt) {
    dim(ctx, Math.min(0.72, this.t * 4));
    const w = this.scene.world;
    const pop = Math.min(1, this.t / 0.3);
    ctx.save();
    ctx.translate(W / 2, 168); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    // 光芒
    ctx.globalAlpha = 0.35 * pop;
    ctx.fillStyle = '#ffe680';
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillRect(-3, 30, 6, 60 + Math.sin(this.t * 4 + i) * 10); }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawText(ctx, '升级啦', W / 2, 160, { size: 44, color: '#ffe680', stroke: '#8a3ab0', strokeWidth: 8 });
    drawText(ctx, `Lv.${w.p.level}  ·  挑一个带走`, W / 2, 205, { size: 16, color: '#fff', weight: 'normal' });
    for (const c of this.cards) c.render(ctx, dt);
    this.refreshBtn.render(ctx, dt); if (this.adBtn.visible) this.adBtn.render(ctx, dt); this.skipBtn.render(ctx, dt);
  }
}

export class ChestPanel {
  constructor(scene) {
    this.scene = scene;
    this.okBtn = new Button({ x: W / 2, y: 720, w: 240, h: 64, label: '收下', style: 'gold', fontSize: 26, onClick: () => scene.world.levelup.closeChest() });
    this.okBtn.audio = scene.game.audio;
    this.t = 0;
    this.result = null;
  }
  open(result) { this.result = result; this.t = 0; }
  get buttons() { return this.t < 0.9 ? [] : [this.okBtn]; }
  update(dt) { this.t += dt; }
  render(ctx, dt) {
    dim(ctx, Math.min(0.75, this.t * 3));
    const r = this.result; if (!r) return;
    const evo = r.type === 'evolve';
    const open = Math.min(1, this.t / 0.6);
    // 光
    ctx.save(); ctx.translate(W / 2, 400);
    ctx.globalAlpha = open * 0.5; ctx.fillStyle = evo ? '#ffe680' : '#ffffff';
    for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8 + this.t * 0.02); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, 260); ctx.lineTo(14, 260); ctx.fill(); }
    ctx.restore();
    if (this.t < 0.6) {
      const sp = this.scene.renderer.sprites.shot('chest', '#ffd23f', 40);
      const s = 1 + Math.sin(this.t * 40) * 0.05;
      ctx.drawImage(sp.img, W / 2 - sp.size * s / 2, 400 - sp.size * s / 2, sp.size * s, sp.size * s);
      return;
    }
    const k = Math.min(1, (this.t - 0.6) / 0.3);
    drawPanel(ctx, 50, 250, W - 100, 400, 28, 'rgba(255,250,255,0.96)');
    drawText(ctx, evo ? '武器进化！' : '宝箱', W / 2, 296, { size: 32, color: evo ? '#e09a1a' : C.primaryDark, stroke: '#fff', strokeWidth: 6 });
    const icon = evo ? r.icon : r.card.icon; const color = evo ? r.color : r.card.color;
    ctx.save(); ctx.translate(W / 2, 400); ctx.scale(k, k);
    ctx.fillStyle = '#3a2d6e'; ctx.beginPath(); ctx.arc(0, 0, 58, 0, 6.283); ctx.fill();
    if (evo) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.stroke(); }
    drawIcon(ctx, icon, 0, 0, 76, color);
    ctx.restore();
    if (evo) {
      drawText(ctx, r.name, W / 2, 492, { size: 26, color: C.text });
      const lines = wrap(ctx, r.desc, W - 160, `16px ${GameConfig.fontFamily}`);
      lines.forEach((l, i) => drawText(ctx, l, W / 2, 530 + i * 24, { size: 16, color: '#5a4a6e', weight: 'normal' }));
    } else {
      const c = r.card;
      drawText(ctx, `${c.name}${c.type === 'filler' ? '' : c.isNew ? '（新）' : ` Lv.${c.level}`}`, W / 2, 492, { size: 24, color: C.text });
      drawText(ctx, c.desc, W / 2, 530, { size: 16, color: '#5a4a6e', weight: 'normal' });
      drawText(ctx, '没有能进化的武器，送你一次免费升级', W / 2, 600, { size: 13, color: '#9a7bb0', weight: 'normal' });
    }
    this.okBtn.render(ctx, dt);
  }
}

export class RevivePanel {
  constructor(scene) {
    this.scene = scene;
    const g = scene.game;
    this.adBtn = new Button({ x: W / 2, y: 560, w: 300, h: 70, label: '看广告复活', style: 'gold', fontSize: 26, tag: '广告', onClick: () => scene.tryRevive() });
    this.syncMode();
    this.giveUp = new Button({ x: W / 2, y: 650, w: 220, h: 52, label: '不了，去结算', style: 'ghost', fontSize: 18, onClick: () => scene.finish(false) });
    [this.adBtn, this.giveUp].forEach((b) => { b.audio = g.audio; });
    this.t = 0;
  }
  /** 有激励视频 → 「看广告复活」；没有 → 每局免费一次「再试一次」 */
  syncMode() {
    const ad = this.scene.game.ads.enabled;
    Object.assign(this.adBtn, ad ? { label: '看广告复活', tag: '广告' } : { label: '再试一次', tag: null });
    this.free = !ad;
  }
  open() { this.t = 0; this.syncMode(); }
  get buttons() { return this.t < 0.6 ? [] : [this.adBtn, this.giveUp]; }
  update(dt) { this.t += dt; }
  render(ctx, dt) {
    dim(ctx, Math.min(0.7, this.t * 2));
    const w = this.scene.world;
    drawPanel(ctx, 50, 300, W - 100, 420, 28, 'rgba(255,250,255,0.96)');
    drawText(ctx, '倒下了……', W / 2, 360, { size: 34, color: C.primaryDark });
    const left = Math.max(0, w.wave.duration - w.time);
    drawText(ctx, `离天亮还有 ${Math.floor(left / 60)} 分 ${Math.floor(left % 60)} 秒`, W / 2, 410, { size: 18, color: C.text, weight: 'normal' });
    drawText(ctx, `复活后回一半血，并把身边的怪震开`, W / 2, 470, { size: 15, color: '#8a6d9e', weight: 'normal' });
    drawText(ctx, this.free ? `每局可免费再试 ${RUN_RULES.revive.adPerRun} 次` : `每局只能复活 ${RUN_RULES.revive.adPerRun} 次`, W / 2, 495, { size: 13, color: '#9a7bb0', weight: 'normal' });
    this.adBtn.render(ctx, dt); this.giveUp.render(ctx, dt);
  }
}

export { wrap, dim };
