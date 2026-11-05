// 结算：胜负、存活时间、击杀、等级、进化、带出的武器；星屑币可看广告翻倍 (仅在有激励视频时)；新解锁角色提示。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { CHARACTER_MAP } from '../config/CharacterConfig.js';
import { WEAPONS, EVOLUTIONS } from '../config/WeaponConfig.js';
import { PASSIVES } from '../config/PassiveConfig.js';
import { DifficultyConfig } from '../config/DifficultyConfig.js';
import { COIN_RULES } from '../config/ProgressConfig.js';
import { Button } from '../ui/Button.js';
import { drawBackground, drawText, roundRectPath, drawPanel, drawStar } from '../ui/draw.js';
import { drawIcon } from '../ui/icons.js';
import { fmtTime } from '../core/math.js';

const W = GameConfig.width;
const C = GameConfig.colors;

const WIN_LINES = ['噩梦收工，回去补觉吧。', '撑住了！今晚大家都能睡个好觉。', '太阳出来啦，今天可以睡懒觉。'];
const LOSE_LINES = ['差一点点…下次一定。', '噩梦这次赢了，先记账。', '再来一局，这回别贪宝石。'];

export class ResultScene extends Scene {
  constructor(game) { super(game, 'result'); }

  enter(data = {}) {
    const g = this.game;
    this.sum = data.summary || { won: false, time: 0, kills: 0, level: 1, weapons: [], passives: [], evolutions: [], bossKills: {}, character: 'hikari', difficulty: 'normal' };
    this.coins = data.coins || 0;
    this.shownCoins = 0;
    this.unlocks = data.unlocks || [];
    this.opts = data.opts || { character: this.sum.character, difficulty: this.sum.difficulty };
    this.fps = data.fps;
    this.doubled = false;
    this.toast = null;
    const lines = this.sum.won ? WIN_LINES : LOSE_LINES;
    this.line = lines[Math.floor(Math.random() * lines.length)];
    const mk = (o) => { const b = new Button(o); b.audio = g.audio; return b; };
    this.adBtn = mk({ x: W / 2, y: 718, w: 300, h: 60, label: '看广告 星屑翻倍', style: 'gold', fontSize: 22, tag: '广告', onClick: () => this.doubleCoins() });
    this.retry = mk({ x: W / 2 - 100, y: 810, w: 180, h: 64, label: '再来一局', fontSize: 24, onClick: () => g.scenes.change('game', { ...this.opts }) });
    this.menu = mk({ x: W / 2 + 100, y: 810, w: 180, h: 64, label: '回菜单', style: 'secondary', fontSize: 24, onClick: () => g.scenes.change('menu') });
    // 抖音录屏分享：拿到有效录屏 (share:ready) 才出现；微信：「分享给好友」始终可用。和翻倍按钮并排
    this.shareBtn = mk({ x: W / 2 + 98, y: 718, w: 186, h: 60, label: g.share.label, style: 'secondary', fontSize: 19, visible: false, onClick: () => this.shareVideo() });
    this.buttons = [this.adBtn, this.shareBtn, this.retry, this.menu];
    this.layoutShare();
    this.listen('share:ready', () => this.layoutShare());
    this.listen('ad:availability', () => this.layoutShare());
    if (!this.sum.won) g.bgm.play('menu');
  }

  /** 翻倍按钮只在有激励视频时出现；录屏分享按钮有有效录屏才出现。两个都在时并排，只有一个时居中 */
  layoutShare() {
    const share = this.game.share.canShare;
    const ad = this.game.ads.enabled;
    this.adBtn.visible = ad;
    this.shareBtn.visible = share;
    if (ad && share) { Object.assign(this.adBtn, { x: W / 2 - 98, w: 186, fontSize: 17 }); Object.assign(this.shareBtn, { x: W / 2 + 98, w: 186 }); }
    else { Object.assign(this.adBtn, { x: W / 2, w: 300, fontSize: 22 }); Object.assign(this.shareBtn, { x: W / 2, w: 300 }); }
  }

  shareVideo() {
    const g = this.game;
    if (this.sharing) return;
    this.sharing = true;
    g.share.shareVideo().then((r) => {
      this.sharing = false;
      if (r.ok) this.toast = g.share.successText ? { text: g.share.successText, t: 0 } : null;   // 微信转发不回传结果，不弹提示
      else if (r.reason === 'cancel') this.toast = { text: '已取消分享', t: 0 };
      else this.toast = { text: '分享没成功，稍后再试试', t: 0 };
    });
  }

  doubleCoins() {
    const g = this.game;
    if (this.doubled || this.adBusy || !g.ads.enabled) return;
    this.adBusy = true;
    g.ads.showRewardedAd('double').then((ok) => {
      this.adBusy = false;
      if (!ok) { if (g.ads.lastReason !== 'error') this.toast = { text: '没看完就没有奖励哦', t: 0 }; return; }
      const extra = Math.floor(this.coins * (COIN_RULES.adDouble - 1));
      g.save.addCoins(extra);
      this.coins += extra;
      this.doubled = true;
      this.adBtn.enabled = false; this.adBtn.label = '已翻倍'; this.adBtn.tag = null;
      g.audio.play('coin');
      this.toast = { text: `多拿了 ${extra} 星屑币`, t: 0 };
    });
  }


  onKeyDown(e) {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') this.game.scenes.change('game', { ...this.opts });
    else if (e.code === 'Escape') this.game.scenes.change('menu');
  }

  update(dt) {
    super.update(dt);
    const g = this.game;
    if (this.shownCoins < this.coins) {
      const before = Math.floor(this.shownCoins);
      this.shownCoins = Math.min(this.coins, this.shownCoins + Math.max(1, this.coins) * dt * 1.2);
      if (Math.floor(this.shownCoins / 10) !== Math.floor(before / 10) && this.time > 0.4) g.audio.play('coin');
    }
    if (this.toast) { this.toast.t += dt; if (this.toast.t > 2.2) this.toast = null; }
  }

  render(ctx, dt) {
    const g = this.game; const s = this.sum;
    const c = CHARACTER_MAP[s.character] || CHARACTER_MAP.hikari;
    drawBackground(ctx, W, g.height, this.time);
    if (s.won) {
      const grd = ctx.createLinearGradient(0, 0, 0, 420);
      grd.addColorStop(0, 'rgba(255,190,120,0.55)'); grd.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, 420);
    }
    // 半身卡
    const card = g.assets.get(c.card);
    if (card) {
      ctx.save();
      if (!s.won) ctx.filter = 'grayscale(0.35) brightness(0.8)';
      ctx.globalAlpha = Math.min(1, this.time * 3);
      const ch = 336; const cw = ch * card.width / card.height;   // 保持原比例
      ctx.drawImage(card, (W - cw) / 2, 6, cw, ch);
      ctx.restore();
      const fade = ctx.createLinearGradient(0, 230, 0, 342);
      fade.addColorStop(0, 'rgba(42,31,92,0)'); fade.addColorStop(1, 'rgba(48,33,98,0.92)');
      ctx.fillStyle = fade; ctx.fillRect(0, 230, W, 112);
      ctx.fillStyle = 'rgba(48,33,98,0.92)'; ctx.fillRect(0, 342, W, 30);
    }
    const pop = Math.min(1, this.time * 2.5);
    ctx.save(); ctx.translate(W / 2, 306); ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
    drawText(ctx, s.won ? '天亮了！' : `倒在了 ${fmtTime(s.time)}`, 0, 0, { size: s.won ? 56 : 46, color: s.won ? '#fff3c0' : '#ffd0e0', stroke: s.won ? '#e09a1a' : '#8a3ab0', strokeWidth: 10 });
    ctx.restore();
    drawText(ctx, this.line, W / 2, 350, { size: 16, color: '#f0e6ff', weight: 'normal' });
    if (s.difficulty !== 'normal') drawText(ctx, DifficultyConfig[s.difficulty].name, W - 40, 60, { size: 16, color: '#d08cff' });

    // 数据面板
    drawPanel(ctx, 24, 370, W - 48, 296, 22, 'rgba(255,250,255,0.95)');
    const stat = (label, val, x, y) => {
      drawText(ctx, val, x, y, { size: 24, color: C.primaryDark });
      drawText(ctx, label, x, y + 24, { size: 12, color: '#9a7bb0', weight: 'normal' });
    };
    stat('撑了', fmtTime(s.time), 100, 404);
    stat('击退', `${s.kills}`, 220, 404);
    stat('等级', `Lv${s.level}`, 330, 404);
    const bosses = (s.bossKills.sheepKing || 0) + (s.bossKills.nox || 0);
    stat('Boss', `${bosses}`, 440, 404);
    ctx.strokeStyle = 'rgba(150,120,180,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(44, 448); ctx.lineTo(W - 44, 448); ctx.stroke();
    // 武器 / 被动
    drawText(ctx, '这局带的', 44, 468, { size: 13, color: '#9a7bb0', align: 'left', weight: 'normal' });
    let x = 48;
    for (const w of s.weapons) {
      const def = (w.evolved && EVOLUTIONS[w.evoId]) || WEAPONS[w.id];
      if (!def) continue;
      ctx.fillStyle = w.evolved ? '#7a3cff' : '#3a2d6e'; roundRectPath(ctx, x, 482, 46, 46, 10); ctx.fill();
      if (w.evolved) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke(); }
      drawIcon(ctx, def.icon, x + 23, 505, 32, def.color);
      drawText(ctx, w.evolved ? '进化' : `Lv${w.level}`, x + 23, 538, { size: 11, color: w.evolved ? '#c06000' : C.text });
      x += 54;
    }
    x = Math.max(x + 6, 48);
    for (const p of s.passives) {
      const def = PASSIVES[p.id]; if (!def) continue;
      if (x > W - 80) break;
      ctx.fillStyle = 'rgba(143,124,255,0.18)'; roundRectPath(ctx, x, 488, 36, 36, 18); ctx.fill();
      drawIcon(ctx, def.icon, x + 18, 506, 24, def.color);
      drawText(ctx, `${p.level}`, x + 18, 538, { size: 11, color: C.text });
      x += 42;
    }
    // 进化
    const evos = s.evolutions.map((e) => EVOLUTIONS[e.id] && EVOLUTIONS[e.id].name).filter(Boolean);
    drawText(ctx, evos.length ? `进化：${evos.join('、')}` : '这局没进化，下次凑齐被动开宝箱试试', W / 2, 568, { size: 13, color: evos.length ? '#c06000' : '#9a7bb0', weight: evos.length ? 'bold' : 'normal' });
    // 星屑币
    roundRectPath(ctx, W / 2 - 130, 590, 260, 56, 28); ctx.fillStyle = '#fff4d6'; ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
    drawIcon(ctx, 'coin', W / 2 - 92, 618, 30, C.gold);
    drawText(ctx, `+${Math.floor(this.shownCoins)}`, W / 2 + 10, 619, { size: 28, color: '#d08000' });
    // 新解锁
    if (this.unlocks.length) {
      const names = this.unlocks.map((u) => u.name).join('、');
      const a = 0.75 + 0.25 * Math.sin(this.time * 5);
      ctx.save(); ctx.globalAlpha = a;
      roundRectPath(ctx, 40, 868, W - 80, 40, 20); ctx.fillStyle = 'rgba(255,111,168,0.9)'; ctx.fill();
      drawText(ctx, `新伙伴：${names}`, W / 2, 888, { size: 17, color: '#fff' });
      ctx.restore();
    }
    for (const b of this.buttons) if (b.visible !== false) b.render(ctx, dt);
    if (this.toast) {
      const al = Math.min(1, (2.2 - this.toast.t) / 0.4);
      ctx.save(); ctx.globalAlpha = al;
      roundRectPath(ctx, W / 2 - 140, 650, 280, 40, 20); ctx.fillStyle = 'rgba(20,10,40,0.85)'; ctx.fill();
      drawText(ctx, this.toast.text, W / 2, 670, { size: 16, color: '#ffe680' });
      ctx.restore();
    }
    if (s.won) {
      ctx.save();
      for (let i = 0; i < 14; i++) {
        const px = (i * 83 + this.time * 30) % W; const py = (i * 67 + this.time * (40 + i * 3)) % 380;
        ctx.globalAlpha = 0.5; ctx.fillStyle = i % 2 ? '#fff3c0' : '#ffb3d9';
        drawStar(ctx, px, py, 4, 1.6);
      }
      ctx.restore();
    }
  }
}
