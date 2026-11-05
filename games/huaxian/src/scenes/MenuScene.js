// 主菜单：主视觉 + 标题 + 开始游戏 + 音效 / 语音 / 背景音乐开关 + 制作人员。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { LEVEL_COUNT } from '../config/LevelConfig.js';
import { Button, Icons } from '../ui/Button.js';
import { drawImageCover, drawText, roundRectPath } from '../ui/draw.js';
import { CreditsPanel } from '../ui/CreditsPanel.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';

export class MenuScene extends Scene {
  constructor(game) {
    super(game, 'menu');
  }

  enter() {
    const g = this.game;
    const mk = (o) => { const b = new Button(o); b.audio = g.audio; return b; };
    this.start = mk({ x: 270, y: 812, w: 280, h: 74, label: '开始游戏', fontSize: 34, onClick: () => g.scenes.change('levels') });
    this.sound = mk({ x: 470, y: 46, w: 52, h: 52, style: 'icon', icon: Icons.sound(g.audio.muted), onClick: () => { g.audio.toggleMute(); this.sound.icon = Icons.sound(g.audio.muted); } });
    this.voice = mk({ x: 410, y: 46, w: 52, h: 52, style: 'icon', icon: Icons.voice(g.voice.enabled), onClick: () => { g.voice.toggle(); this.voice.icon = Icons.voice(g.voice.enabled); } });
    this.music = mk({ x: 350, y: 46, w: 52, h: 52, style: 'icon', icon: Icons.music(g.bgm.enabled), onClick: () => { g.bgm.toggle(); this.music.icon = Icons.music(g.bgm.enabled); } });
    this.creditsBtn = mk({ x: 270, y: 930, w: 150, h: 40, label: '制作人员', style: 'secondary', fontSize: 17, onClick: () => { this.credits = new CreditsPanel(g, { onClose: () => { this.credits = null; } }); } });
    this.settingsBtn = mk({ x: 40, y: 46, w: 52, h: 52, style: 'icon', icon: Icons.mixer, onClick: () => { this.settings.sync(); this.showSettings = true; } });
    this.settings = new SettingsPanel(g, { top: 250, onClose: () => { this.showSettings = false; } });
    this.showSettings = false;
    this.buttons = [this.start, this.sound, this.voice, this.music, this.settingsBtn, this.creditsBtn];
    this.credits = null;
    this.sidebarBtn = null;
    this.ensureSidebarButton();
  }

  /** 抖音：侧边栏复访入口 (从侧边栏进入每天领一次免广告提示)；tt.checkScene 是异步的，结果回来后再补上按钮 */
  ensureSidebarButton() {
    const g = this.game;
    const plat = g.platform;
    if (this.sidebarBtn || !plat.features.sidebar || !plat.sidebarAvailable) return;
    this.sidebarBtn = new Button({ x: 92, y: 930, w: 150, h: 40, label: '侧边栏奖励', style: 'green', fontSize: 17, onClick: () => plat.sidebarAction() });
    this.sidebarBtn.audio = g.audio;
    this.buttons.push(this.sidebarBtn);
  }

  update(dt) {
    super.update(dt);
    this.ensureSidebarButton();
  }

  activeButtons() { return this.showSettings ? this.settings.buttons : this.credits ? this.credits.buttons : this.buttons; }

  onKeyDown(e) {
    if (this.showSettings) { if (e.code === 'Escape' || e.code === 'Enter') this.showSettings = false; return; }
    if (this.credits) { if (e.code === 'Escape' || e.code === 'Enter') this.credits = null; return; }
    if (e.code === 'Enter' || e.code === 'Space') this.game.scenes.change('levels');
  }

  render(ctx) {
    const { width: W, height: H } = this.game;
    const C = GameConfig.colors;
    drawImageCover(ctx, this.game.assets.getImage('bg_menu'), W, H);
    // 底部渐变，保证按钮可读
    const g = ctx.createLinearGradient(0, H * 0.7, 0, H);
    g.addColorStop(0, 'rgba(255,240,248,0)');
    g.addColorStop(1, 'rgba(255,240,248,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
    // 标题
    const bob = Math.sin(this.time * 2) * 4;
    ctx.save();
    ctx.translate(W / 2, 168 + bob);
    ctx.rotate(-0.03);
    drawText(ctx, '画线守护', 0, -34, { size: 60, color: C.primary, stroke: '#ffffff', strokeWidth: 14, shadow: 'rgba(160,60,120,0.35)' });
    drawText(ctx, '美少女', 0, 36, { size: 64, color: '#ff8a3d', stroke: '#ffffff', strokeWidth: 14, shadow: 'rgba(160,60,120,0.35)' });
    ctx.restore();
    roundRectPath(ctx, W / 2 - 98, 246, 196, 30, 15);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    drawText(ctx, 'AnimeDrawLine', W / 2, 262, { size: 17, color: C.secondary });
    drawText(ctx, `出品：${GameConfig.publisher}`, W / 2, 298, { size: 15, color: C.text, stroke: '#fff', strokeWidth: 4, weight: 'normal' });
    const stars = this.game.save.totalStars;
    drawText(ctx, `画一条线，守护她坚持到最后！   ★ ${stars} / ${LEVEL_COUNT * 3}`, W / 2, 866, { size: 16, color: C.text, stroke: '#fff', strokeWidth: 4, weight: 'normal' });
    drawText(ctx, '左上角调音量 · 右上角开关音乐 / 语音 / 音效', W / 2, 892, { size: 13, color: '#8a6d9e', weight: 'normal' });
    for (const b of this.buttons) b.render(ctx);
    if (this.credits) this.credits.render(ctx);
    if (this.showSettings) {
      ctx.save(); ctx.fillStyle = 'rgba(90,61,110,0.45)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      this.settings.render(ctx, 1 / 60);
    }
  }
}
