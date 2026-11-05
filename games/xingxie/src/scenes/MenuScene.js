// 主菜单：主视觉 + 标题 + 开始 / 天赋 / 设置 / 制作人员，右上角音效 / 语音 / 音乐开关。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { Button, Icons } from '../ui/Button.js';
import { drawImageCover, drawText, roundRectPath, drawStar } from '../ui/draw.js';
import { drawIcon } from '../ui/icons.js';
import { CreditsPanel } from '../ui/CreditsPanel.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { SidebarPanel } from '../ui/SidebarPanel.js';
import { fmtTime } from '../core/math.js';

export class MenuScene extends Scene {
  constructor(game) { super(game, 'menu'); }

  enter() {
    const g = this.game;
    const mk = (o) => { const b = new Button(o); b.audio = g.audio; return b; };
    this.start = mk({ x: 270, y: 770, w: 290, h: 76, label: '开始守夜', fontSize: 34, onClick: () => g.scenes.change('character') });
    this.talentBtn = mk({ x: 180, y: 862, w: 160, h: 54, label: '天赋', style: 'gold', fontSize: 22, onClick: () => g.scenes.change('talent') });
    this.creditsBtn = mk({ x: 360, y: 862, w: 160, h: 54, label: '制作人员', style: 'secondary', fontSize: 20, onClick: () => { this.credits = new CreditsPanel(g, { onClose: () => { this.credits = null; } }); } });
    this.sound = mk({ x: 500, y: 40, w: 48, h: 48, style: 'icon', icon: Icons.sound(g.audio.muted), onClick: () => { g.audio.toggleMute(); this.sound.icon = Icons.sound(g.audio.muted); } });
    this.voiceBtn = mk({ x: 446, y: 40, w: 48, h: 48, style: 'icon', icon: Icons.voice(g.voice.enabled), onClick: () => { g.voice.toggle(); this.voiceBtn.icon = Icons.voice(g.voice.enabled); } });
    this.music = mk({ x: 392, y: 40, w: 48, h: 48, style: 'icon', icon: Icons.music(g.bgm.enabled), onClick: () => { g.bgm.toggle(); this.music.icon = Icons.music(g.bgm.enabled); } });
    this.settingsBtn = mk({ x: 338, y: 40, w: 48, h: 48, style: 'icon', icon: Icons.mixer, onClick: () => this.openSettings() });
    this.settings = new SettingsPanel(g, { top: 250, onClose: () => { this.showSettings = false; } });
    this.showSettings = false;
    this.credits = null;
    this.sidebarPanel = null;
    // 抖音侧边栏入口：tt.checkScene 确认支持才显示
    this.sidebarBtn = mk({ x: 76, y: 84, w: 128, h: 38, label: '侧边栏有礼', style: 'gold', fontSize: 17, visible: g.sidebar.supported, onClick: () => this.openSidebar() });
    this.listen('sidebar:check', (ok) => { this.sidebarBtn.visible = ok; });
    this.buttons = [this.start, this.talentBtn, this.creditsBtn, this.sound, this.voiceBtn, this.music, this.settingsBtn, this.sidebarBtn];
    g.bgm.play('menu');
    g.packs.start();      // 抖音版：后台下载分包
  }

  openSettings() { this.settings.sync(); this.showSettings = true; }
  openCredits() { this.credits = new CreditsPanel(this.game, { onClose: () => { this.credits = null; } }); }
  openSidebar() { this.sidebarPanel = new SidebarPanel(this.game, { onClose: () => { this.sidebarPanel = null; } }); }

  activeButtons() { return this.showSettings ? this.settings.buttons : this.credits ? this.credits.buttons : this.sidebarPanel ? this.sidebarPanel.buttons : this.buttons; }

  onKeyDown(e) {
    if (this.showSettings) { if (e.code === 'Escape') this.showSettings = false; return; }
    if (this.credits) { if (e.code === 'Escape' || e.code === 'Enter') this.credits = null; return; }
    if (e.code === 'Enter' || e.code === 'Space') this.game.scenes.change('character');
  }

  render(ctx, dt) {
    const { width: W, height: H } = this.game;
    const C = GameConfig.colors;
    drawImageCover(ctx, this.game.assets.get('bg_menu'), W, H);
    // 飘落的星屑
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x = (i * 97 + Math.sin(this.time * 0.5 + i) * 20) % W;
      const y = (i * 151 + this.time * (18 + (i % 5) * 6)) % H;
      ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(this.time * 2 + i));
      ctx.fillStyle = i % 3 ? '#ffffff' : '#ffe08a';
      drawStar(ctx, x, y, 3 + (i % 3), 1.3);
    }
    ctx.restore();
    // 标题
    const bob = Math.sin(this.time * 1.8) * 4;
    ctx.save(); ctx.translate(W / 2, 150 + bob); ctx.rotate(-0.04);
    drawText(ctx, '星屑轮舞', 0, 0, { size: 70, color: '#fff0fa', stroke: '#9a3ac8', strokeWidth: 12, shadow: 'rgba(255,120,220,0.6)' });
    ctx.restore();
    roundRectPath(ctx, W / 2 - 108, 208, 216, 28, 14); ctx.fillStyle = 'rgba(20,10,40,0.55)'; ctx.fill();
    drawText(ctx, '撑过 5 分钟，等天亮', W / 2, 222, { size: 15, color: '#ffd8f0', weight: 'normal' });
    // 星屑币 / 战绩
    const s = this.game.save;
    roundRectPath(ctx, 12, 20, 150, 40, 20); ctx.fillStyle = 'rgba(20,10,40,0.6)'; ctx.fill();
    drawIcon(ctx, 'coin', 34, 40, 24, C.gold);
    drawText(ctx, `${s.coins}`, 54, 41, { size: 19, color: '#ffe08a', align: 'left' });
    if (s.stats.runs > 0) {
      drawText(ctx, `最久撑了 ${fmtTime(s.stats.bestTime)} · 天亮 ${s.stats.clears} 次`, W / 2, 712, { size: 14, color: '#d8ccff', weight: 'normal' });
    }
    for (const b of this.buttons) if (b.visible !== false) b.render(ctx, dt);
    this.renderPacks(ctx, W);
    drawText(ctx, `出品：${GameConfig.publisher}`, 10, H - 12, { size: 11, color: 'rgba(255,255,255,0.5)', align: 'left', weight: 'normal' });
    drawText(ctx, `v${GameConfig.version}`, W - 10, H - 12, { size: 11, color: 'rgba(255,255,255,0.4)', align: 'right', weight: 'normal' });
    if (this.showSettings) {
      ctx.save(); ctx.fillStyle = 'rgba(18,8,40,0.6)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      this.settings.render(ctx, dt);
    }
    if (this.credits) this.credits.render(ctx, dt);
    if (this.sidebarPanel) this.sidebarPanel.render(ctx, dt);
  }

  /** 抖音版分包下载进度 (下载完就不显示) */
  renderPacks(ctx, W) {
    const pk = this.game.packs;
    if (!pk.loading) return;
    const bw = 220; const x = (W - bw) / 2; const y = 912;
    roundRectPath(ctx, x, y, bw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
    roundRectPath(ctx, x, y, Math.max(8, bw * pk.progress), 8, 4); ctx.fillStyle = '#ff9fd0'; ctx.fill();
    drawText(ctx, `正在下载${pk.label || '资源'} ${Math.round(pk.progress * 100)}%（不影响开玩）`, W / 2, y + 22, { size: 12, color: 'rgba(255,255,255,0.75)', weight: 'normal' });
  }
}
