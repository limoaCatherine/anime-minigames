// 主菜单：动态 Logo、飘落樱花、卡牌扇形；继续游戏 / 选择关卡 / 每日挑战 / 设置 / 玩法说明；星星与进度总览。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { LEVELS, MAX_LEVEL, getLevel, levelTag } from '../config/LevelConfig.js';
import { getShape } from '../config/PatternLibrary.js';
import { dateKey } from '../core/Random.js';
import { Button, Icons } from '../ui/Button.js';
import { Dialog } from '../ui/Dialog.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { drawLogo } from '../ui/Logo.js';
import { drawImageBackground, drawText, drawPanel, drawPetals, drawStar, drawGlow } from '../ui/draw.js';
import { platform } from '../platform/index.js';

export class MenuScene extends Scene {
  constructor(game) {
    super(game, 'menu');
  }

  enter() {
    const g = this.game;
    const w = g.width;
    const save = g.save;
    this.dialog = null;
    this.settings = null;
    this.toasts = [];
    const unlocked = Math.min(MAX_LEVEL, save.get('unlocked', 1));
    const allClear = LEVELS.every((l) => save.isCleared(l.id));
    this.startLevel = unlocked;
    const lv = getLevel(unlocked);
    this.startBtn = new Button({ x: w / 2, y: 600, w: 330, h: 78, fontSize: 30,
      label: allClear ? '再战第 15 关' : unlocked === 1 && !save.isCleared(1) ? '开始游戏' : `继续 · 第 ${unlocked} 关`,
      onClick: () => this.start(unlocked) });
    this.startSub = allClear ? '15 关全过了，服气' : `「${lv.title}」 ${levelTag(lv)} · ${getShape(lv.pattern).name}图案`;
    this.levelsBtn = new Button({ x: w / 2, y: 694, w: 330, h: 62, label: '选择关卡', style: 'secondary', fontSize: 25, onClick: () => g.scenes.change('levels') });
    this.dailyBtn = new Button({ x: w / 2, y: 774, w: 330, h: 62, label: '每日挑战', style: 'gold', fontSize: 25, onClick: () => this.start('daily') });
    this.settingsBtn = new Button({ x: w / 2 - 86, y: 852, w: 158, h: 52, label: '设置', style: 'ghost', fontSize: 21, onClick: () => this.openSettings() });
    this.helpBtn = new Button({ x: w / 2 + 86, y: 852, w: 158, h: 52, label: '玩法说明', style: 'ghost', fontSize: 21, onClick: () => this.showHelp() });
    this.muteBtn = new Button({ x: w - 40, y: 40, w: 50, h: 50, style: 'icon', icon: Icons.sound(g.audio.muted), onClick: () => {
      this.muteBtn.icon = Icons.sound(g.audio.toggleMute());
    } });
    this.buttons = [this.startBtn, this.levelsBtn, this.dailyBtn, this.settingsBtn, this.helpBtn, this.muteBtn];
    this.buttons.forEach((b) => { b.audio = g.audio; });
    // 抖音：侧边栏复访礼包 (宿主支持侧边栏时才显示入口)
    this.sidebarDialog = false;
    if (platform.isDouyin) {
      platform.checkSidebar().then((ok) => {
        if (!ok || this.game.scenes.current !== this || this.giftBtn) return;
        this.giftBtn = new Button({ x: 84, y: 40, w: 140, h: 50, label: '侧边栏礼包', style: 'gold', fontSize: 18, onClick: () => this.openSidebarGift() });
        this.giftBtn.audio = g.audio;
        this.buttons.push(this.giftBtn);
      });
      if (!this.showHooked) {
        this.showHooked = true;
        // 从侧边栏回到游戏会再次触发 onShow：礼包弹窗开着就按最新状态刷新
        platform.onShow(() => { if (this.game.scenes.current === this && this.sidebarDialog) this.openSidebarGift(); });
      }
    }
    this.dt = 1 / 60;
  }

  /** 侧边栏礼包：每天一次，奖励下一局多 1 次「移出」 */
  openSidebarGift() {
    const g = this.game;
    const today = dateKey();
    const close = () => { this.dialog = null; this.sidebarDialog = false; };
    this.sidebarDialog = true;
    if (g.save.get('sidebarClaimed') === today) {
      this.dialog = new Dialog({ title: '今天领过啦', lines: ['明天从侧边栏进来还能领'], buttons: [{ label: '好的', onClick: close }] }, g.audio);
    } else if (platform.launchedFromSidebar()) {
      this.dialog = new Dialog({
        title: '侧边栏礼包', lines: ['欢迎从侧边栏回来！', '奖励：下一局「移出」+1'],
        buttons: [{ label: '领取奖励', style: 'gold', onClick: () => {
          g.save.set('sidebarClaimed', today);
          g.save.set('bonusMoveOut', 1);
          close();
          this.toast('领到了！下一局「移出」+1');
        } }],
      }, g.audio);
    } else {
      this.dialog = new Dialog({
        title: '侧边栏礼包', lines: ['从抖音首页侧边栏进入游戏', '每天可领：下一局「移出」+1'],
        buttons: [
          { label: '去侧边栏', style: 'gold', onClick: () => { close(); platform.navigateToSidebar(); } },
          { label: '下次再说', style: 'ghost', onClick: close },
        ],
      }, g.audio);
    }
  }

  start(level) {
    this.game.scenes.change('game', { level });
  }

  openSettings() {
    this.settings = new SettingsPanel(this.game, () => {
      this.settings = null;
      this.muteBtn.icon = Icons.sound(this.game.audio.muted);
    });
  }

  toast(text) { this.toasts = [{ text, life: 0 }]; }

  showHelp() {
    this.dialog = new Dialog({
      title: '玩法说明',
      lineSize: 16,
      width: 480,
      lines: [
        '点亮着的卡，它会飞进下面的卡槽',
        '同一个人凑够 3 张就消掉',
        '卡槽只有 7 格，塞满就输（5 张起能听到心跳）',
        '发暗的卡被压着，点不动',
        '两边的牌堆只能从最上面拿',
        '移出、撤回、洗牌，每关各一次',
        platform.adMode === 'free' ? '塞满时可以再试一次（每关一次）' : '塞满时可以看广告复活一次',
        '★★★ 没用道具也没复活　★★ 没复活　★ 过关',
        '每 5 关有一个 BOSS，量力而行',
      ],
      buttons: [{ label: '懂了', onClick: () => { this.dialog = null; } }],
    }, this.game.audio);
  }

  activeButtons() {
    if (this.settings) return this.settings.widgets;
    return this.dialog ? this.dialog.buttons : this.buttons;
  }

  onKeyDown(e) {
    if (this.settings) { if (e.code === 'Escape') this.settings = null; return; }
    if (this.dialog) { if (['Enter', 'Space', 'Escape'].includes(e.code)) this.dialog = null; return; }
    if (e.code === 'Enter' || e.code === 'Space') this.start(this.startLevel);
  }

  update(dt) {
    super.update(dt);
    this.dt = dt;
    if (this.dialog) this.dialog.update(dt);
    if (this.settings) this.settings.update(dt);
    for (const t of this.toasts) t.life += dt;
    this.toasts = this.toasts.filter((t) => t.life < 1.6);
  }

  render(ctx) {
    const g = this.game;
    const { width: w, height: h } = g;
    const C = GameConfig.colors;
    const save = g.save;
    const sprites = g.cardSprites;
    const t = this.time;
    drawImageBackground(ctx, g.assets.getImage('bg'), w, h, t, false);
    // 柔光 + 远景花瓣
    drawGlow(ctx, w / 2, 250, 330, 'rgba(255,240,250,0.75)');
    drawPetals(ctx, w, h, t, 0.9, 26);

    // 卡牌扇形 (7 张，中间最大) + 背后光芒
    ctx.save();
    ctx.translate(w / 2, 214);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 14; i++) {
      ctx.rotate(Math.PI / 7);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, -300); ctx.lineTo(18, -300); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const fan = [13, 7, 1, 4, 9, 2, 10];
    const order = [0, 6, 1, 5, 2, 4, 3];
    for (const i of order) {
      const sp = sprites[fan[i]];
      if (!sp) continue;
      const k = i - 3;
      const bob = Math.sin(t * 2 + i * 0.9) * 5;
      ctx.save();
      ctx.translate(w / 2 + k * 62, 228 + Math.abs(k) * Math.abs(k) * 7 + bob);
      ctx.rotate(k * 0.14);
      const s = k === 0 ? 1.3 : 1 - Math.abs(k) * 0.06;
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(120,50,100,0.35)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(sp.normal, -45, -50, 90, 99);
      ctx.restore();
    }

    drawLogo(ctx, w / 2, 352, t, 1);

    // 进度面板：星星 / 通关数 / 每日
    const stars = save.totalStars;
    const cleared = LEVELS.filter((l) => save.isCleared(l.id)).length;
    drawPanel(ctx, 48, 462, w - 96, 74, 24, 'rgba(255,255,255,0.88)');
    const cols = [
      { x: w / 2 - 140, top: `${stars}/${LEVELS.length * 3}`, sub: '星星', star: true },
      { x: w / 2, top: `${cleared}/${LEVELS.length}`, sub: '已通关' },
      { x: w / 2 + 140, top: save.get('dailyCleared', '') === dateKey() ? '搞定' : '还没打', sub: '今日份' },
    ];
    for (const c of cols) {
      if (c.star) {
        ctx.fillStyle = C.gold;
        drawStar(ctx, c.x - 44, 488, 12, 5);
      }
      drawText(ctx, c.top, c.x + (c.star ? 8 : 0), 488, { size: 21, color: C.primaryDark });
      drawText(ctx, c.sub, c.x, 516, { size: 14, color: '#9a7bb0', weight: 'normal' });
    }
    ctx.strokeStyle = 'rgba(220,180,220,0.7)'; ctx.lineWidth = 1.5;
    for (const dx of [-70, 70]) { ctx.beginPath(); ctx.moveTo(w / 2 + dx, 476); ctx.lineTo(w / 2 + dx, 522); ctx.stroke(); }

    const active = !this.dialog && !this.settings;
    for (const b of this.buttons) b.render(ctx, active ? this.dt : 0);
    drawText(ctx, this.startSub, w / 2, 646, { size: 14, color: '#fff', stroke: 'rgba(170,70,130,0.7)', strokeWidth: 4 });
    drawText(ctx, `出品：${GameConfig.producer}  ·  v${GameConfig.version}`, w / 2, h - 26, { size: 13, color: '#fff', stroke: 'rgba(120,70,100,0.55)', strokeWidth: 3, weight: 'normal' });

    for (const tt of this.toasts) {
      ctx.save();
      ctx.globalAlpha = tt.life > 1.2 ? (1.6 - tt.life) / 0.4 : 1;
      drawPanel(ctx, w / 2 - 150, 640, 300, 44, 22, 'rgba(90,40,100,0.88)');
      drawText(ctx, tt.text, w / 2, 662, { size: 18, color: '#fff' });
      ctx.restore();
    }
    if (this.dialog) this.dialog.render(ctx, this.dt);
    if (this.settings) this.settings.render(ctx, this.dt);
  }
}

