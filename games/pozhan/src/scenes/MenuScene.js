// 主菜单：夕阳背景 + 糯糯立绘 + 标题；开始 / 选关 / 每日一图 / 设置 / 玩法说明。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { LEVELS } from '../config/LevelConfig.js';
import { DailyConfig, todayKey } from '../config/DailyConfig.js';
import { Button, Icons } from '../ui/Button.js';
import { Dialog } from '../ui/Dialog.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { drawImageBackground, drawText, roundRectPath, drawStar, drawGlow } from '../ui/draw.js';
import { img } from '../art/chars.js';
import { Platform } from '../platform/Platform.js';

/** 侧边栏复访礼包：每天从抖音首页侧边栏进入游戏可领一次 (数量在 GameConfig.sidebar) */
const SIDEBAR_STEPS = ['① 点下面的「去首页侧边栏」', '② 在侧边栏「最近使用」里点《次元破绽！》', '③ 回到这里点「立即领奖」'];

const TAGLINES = ['这张图毫无破绽！', '你找不到的，嘿嘿～', '吐槽役，准备好了吗？', '才、才没有不合理！'];

export class MenuScene extends Scene {
  constructor(game) {
    super(game, 'menu');
    // 从侧边栏回来 (热启动) 时，礼包面板如果开着就刷新成「立即领奖」
    game.events.on('app:visible', () => { if (game.scenes.current === this && this.dialog && this.dialog.sidebar) this.showSidebar(); });
  }

  enter() {
    const g = this.game; const w = g.width; const save = g.save;
    this.dialog = null; this.settings = null; this.toast = null;
    const unlocked = Math.min(LEVELS.length, save.get('unlocked', 1));
    const next = LEVELS[unlocked - 1];
    const fresh = !Object.keys(save.data.cleared).length;
    this.next = next;
    const mk = (o) => { const b = new Button(o); b.audio = g.audio; return b; };
    this.startBtn = mk({ x: w / 2, y: 650, w: 330, h: 76, fontSize: 30, label: fresh ? '开始找茬' : `继续 · 第 ${unlocked} 关`, onClick: () => g.scenes.change('game', { levelId: next.id }) });
    this.levelsBtn = mk({ x: w / 2, y: 740, w: 330, h: 60, label: '选择关卡', style: 'secondary', fontSize: 24, onClick: () => g.scenes.change('levels') });
    const dailyOpen = Object.keys(save.data.cleared).length >= DailyConfig.unlockAfter;
    this.dailyBtn = mk({ x: w / 2, y: 815, w: 330, h: 60, label: save.get('dailyCleared') === todayKey() ? '每日一图 ✓' : '每日一图', style: 'gold', fontSize: 24,
      onClick: () => (dailyOpen ? g.scenes.change('game', { daily: true }) : this.showToast(`通关第 ${DailyConfig.unlockAfter} 关后开放`)) });
    this.settingsBtn = mk({ x: w / 2 - 86, y: 890, w: 158, h: 50, label: '设置', style: 'ghost', fontSize: 20, onClick: () => { this.settings = new SettingsPanel(g, () => { this.settings = null; this.syncMute(); }); } });
    this.helpBtn = mk({ x: w / 2 + 86, y: 890, w: 158, h: 50, label: '玩法说明', style: 'ghost', fontSize: 20, onClick: () => this.showHelp() });
    this.muteBtn = mk({ x: w - 40, y: 40, w: 50, h: 50, style: 'icon', icon: Icons.sound(g.mixer.muted), onClick: () => { g.mixer.setMuted(!g.mixer.muted); this.syncMute(); } });
    // 抖音「侧边栏复访」入口：只有 tt.checkScene 返回侧边栏存在时才显示
    this.sidebarBtn = mk({ x: 196, y: 40, w: 124, h: 40, label: '侧边栏礼包', style: 'gold', fontSize: 17, visible: false, onClick: () => this.showSidebar() });
    this.buttons = [this.startBtn, this.levelsBtn, this.dailyBtn, this.settingsBtn, this.helpBtn, this.muteBtn, this.sidebarBtn];
    if (Platform.sidebar) {
      const show = (ok) => { g.sidebarExists = ok; this.sidebarBtn.visible = ok; };
      if (g.sidebarExists !== undefined) show(g.sidebarExists);
      Platform.sidebar.check().then(show, () => show(false));
    }
    this.line = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
    this.poke = 0;
  }

  get sidebarCfg() { return GameConfig.sidebar || { tickets: 2 }; }

  showSidebar() {
    const g = this.game; const save = g.save; const n = this.sidebarCfg.tickets;
    const claimed = save.get('sidebarClaimDay') === todayKey();
    const from = Platform.sidebar && Platform.sidebar.fromSidebar();
    const have = save.get('hintTickets', 0);
    const lines = [`每天从抖音首页侧边栏进入游戏，可领 ${n} 张提示券`, '(提示券 = 立即可用的精确提示，不用等冷却)', ...SIDEBAR_STEPS, `当前持有提示券：${have} 张`];
    const buttons = [];
    if (claimed) lines.push('今天已经领过啦，明天再来～');
    else if (from) buttons.push({ label: `立即领奖 (+${n} 提示券)`, style: 'gold', onClick: () => {
      save.set('hintTickets', save.get('hintTickets', 0) + n); save.set('sidebarClaimDay', todayKey());
      this.dialog = null; this.showToast(`领到 ${n} 张提示券！`); g.audio.play('unlock');
    } });
    else buttons.push({ label: '去首页侧边栏', onClick: () => { Platform.sidebar.navigate().then((ok) => { if (!ok) this.showToast('暂时打不开侧边栏，稍后再试'); }); } });
    buttons.push({ label: '关闭', style: 'ghost', onClick: () => { this.dialog = null; } });
    this.dialog = new Dialog({ title: '首页侧边栏礼包', lineSize: 16, lines, buttons }, g.audio);
    this.dialog.sidebar = true;
  }

  syncMute() { this.muteBtn.icon = Icons.sound(this.game.mixer.muted); }
  showToast(text) { this.toast = { text, t: 0 }; }

  activeButtons() {
    if (this.settings) return this.settings.widgets;
    if (this.dialog) return this.dialog.buttons;
    return this.buttons;
  }

  showHelp() {
    this.dialog = new Dialog({
      title: '玩法说明', lineSize: 17,
      lines: ['找不合理：点出画面里不对劲的地方', '找不同：上下两张图，点出不一样的地方', '助她脱困：点、长按、拖动、划动，道具可以组合',
        '文字拼字：把字拆开、拖动，拼出出路', '点错会扣理智，理智归零就输了', Platform.features.wheel ? '长按画面出放大镜，滚轮 / 双指可缩放' : '长按画面出放大镜，双指可缩放'],
      buttons: [{ label: '懂了', onClick: () => { this.dialog = null; } }],
    }, this.game.audio);
  }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    // 点糯糯：随机说一句
    if (!this.settings && !this.dialog && p.x > 120 && p.x < 420 && p.y > 230 && p.y < 600) {
      this.poke = 1; this.line = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
      this.game.voice.say('nuonuo', Math.random() < 0.5 ? 'gloat' : 'intro', { priority: 2 });
      return true;
    }
    return false;
  }

  update(dt) {
    super.update(dt);
    if (this.settings) this.settings.update(dt);
    if (this.dialog) this.dialog.update(dt);
    if (this.toast) { this.toast.t += dt; if (this.toast.t > 2) this.toast = null; }
    this.poke *= Math.pow(0.05, dt);
    this.game.subtitle.update(dt);
  }

  render(ctx) {
    const g = this.game; const w = g.width; const h = g.height; const C = GameConfig.colors; const dt = 1 / 60; const t = this.time;
    drawImageBackground(ctx, g.assets.getImage('bg_sunset'), w, h, t, 18);
    const grad = ctx.createLinearGradient(0, 520, 0, h);
    grad.addColorStop(0, 'rgba(255,240,247,0)'); grad.addColorStop(0.35, 'rgba(255,240,247,0.85)'); grad.addColorStop(1, 'rgba(255,240,247,0.97)');
    ctx.fillStyle = grad; ctx.fillRect(0, 520, w, h - 520);
    // 糯糯
    drawGlow(ctx, w / 2, 420, 220, 'rgba(255,255,255,0.45)');
    ctx.save(); ctx.translate(w / 2 + 10, 610 + Math.sin(t * 2) * 3 - this.poke * 10);
    ctx.rotate(Math.sin(t * 30) * this.poke * 0.03);
    img(ctx, { key: 'nuonuo_happy', h: 400 }, { t, img: (k) => g.assets.getImage(k) });
    ctx.restore();
    // 标题
    ctx.save(); ctx.translate(w / 2, 104); ctx.rotate(-0.04);
    drawText(ctx, '次元破绽！', 4, 6, { size: 66, color: 'rgba(90,40,110,0.25)' });
    drawText(ctx, '次元破绽！', 0, 0, { size: 66, color: '#fff', stroke: C.primary, strokeWidth: 14 });
    drawText(ctx, '次元破绽！', 0, 0, { size: 66, color: '#fff' });
    ctx.restore();
    roundRectPath(ctx, w / 2 - 128, 150, 256, 34, 17); ctx.fillStyle = 'rgba(124,131,255,0.92)'; ctx.fill();
    drawText(ctx, '二次元梗图找茬 · 吐槽役养成', w / 2, 167, { size: 16, color: '#fff' });
    // 气泡
    ctx.save(); ctx.translate(w / 2 + 120, 252 + Math.sin(t * 2.4) * 2);
    ctx.font = `bold 17px ${GameConfig.fontFamily}`;
    const bw = ctx.measureText(this.line).width + 30;
    roundRectPath(ctx, -bw / 2, -22, bw, 44, 20); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff9cc0'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-bw / 2 + 26, 18); ctx.lineTo(-bw / 2 + 12, 36); ctx.lineTo(-bw / 2 + 44, 20); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    drawText(ctx, this.line, 0, 1, { size: 17, color: C.text });
    ctx.restore();
    // 星星总览
    const stars = g.save.totalStars; const max = LEVELS.length * 3;
    roundRectPath(ctx, 16, 20, 118, 40, 20); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.fillStyle = '#ffc93c'; drawStar(ctx, 40, 40, 12, 5.5);
    drawText(ctx, `${stars}/${max}`, 88, 41, { size: 17, color: C.text });
    for (const b of this.buttons) b.render(ctx, dt);
    if (this.next) drawText(ctx, `「${this.next.title}」 ${this.next.tag || ''}`, w / 2, 608, { size: 15, color: '#8a6d9e' });
    g.subtitle.render(ctx, 560);
    if (this.toast) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (2 - this.toast.t) / 0.3);
      roundRectPath(ctx, w / 2 - 150, 560, 300, 40, 20); ctx.fillStyle = 'rgba(60,30,70,0.85)'; ctx.fill();
      drawText(ctx, this.toast.text, w / 2, 580, { size: 16, color: '#fff' });
      ctx.restore();
    }
    drawText(ctx, `出品：${GameConfig.publisher}`, 12, h - 12, { size: 11, color: '#b4a2c4', align: 'left', weight: 'normal' });
    drawText(ctx, `v${GameConfig.version}`, w - 12, h - 12, { size: 11, color: '#b4a2c4', align: 'right', weight: 'normal' });
    if (this.dialog) this.dialog.render(ctx, dt);
    if (this.settings) this.settings.render(ctx, dt);
  }
}
