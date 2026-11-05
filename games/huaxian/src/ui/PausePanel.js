// 暂停面板：继续 / 重新开始 / 选关 / 音效开关 / 语音开关 / 背景音乐开关 / 音量设置 (总音量 + 各声道滑块)。
import { GameConfig } from '../config/GameConfig.js';
import { Button, Icons } from './Button.js';
import { drawPanel, drawText } from './draw.js';
import { SettingsPanel } from './SettingsPanel.js';

export class PausePanel {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    const g = scene.game;
    const mk = (o) => { const b = new Button(o); b.audio = g.audio; return b; };
    this.sound = mk({ x: 156, y: 650, w: 60, h: 60, style: 'icon', icon: Icons.sound(g.audio.muted), onClick: () => { g.audio.toggleMute(); this.sound.icon = Icons.sound(g.audio.muted); } });
    this.voice = mk({ x: 232, y: 650, w: 60, h: 60, style: 'icon', icon: Icons.voice(g.voice.enabled), onClick: () => { g.voice.toggle(); this.voice.icon = Icons.voice(g.voice.enabled); } });
    this.mainButtons = [
      mk({ x: 270, y: 420, w: 260, h: 64, label: '继续', fontSize: 28, onClick: () => scene.togglePause() }),
      mk({ x: 270, y: 495, w: 260, h: 56, label: '重新开始', style: 'secondary', fontSize: 24, onClick: () => scene.restart() }),
      mk({ x: 270, y: 565, w: 260, h: 56, label: '选择关卡', style: 'secondary', fontSize: 24, onClick: () => scene.toLevels() }),
      this.sound, this.voice,
    ];
    this.music = mk({ x: 308, y: 650, w: 60, h: 60, style: 'icon', icon: Icons.music(g.bgm.enabled), onClick: () => { g.bgm.toggle(); this.music.icon = Icons.music(g.bgm.enabled); } });
    this.volumeBtn = mk({ x: 384, y: 650, w: 60, h: 60, style: 'icon', icon: Icons.mixer, onClick: () => { this.settings.sync(); this.showSettings = true; } });
    this.mainButtons.push(this.music, this.volumeBtn);
    this.settings = new SettingsPanel(g, { top: 255, onClose: () => { this.showSettings = false; } });
    this.showSettings = false;
  }

  get buttons() { return this.showSettings ? this.settings.buttons : this.mainButtons; }

  update(dt) { this.t += dt; }

  render(ctx, dt) {
    const { width: W, height: H } = GameConfig;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.t / 0.2) * 0.45;
    ctx.fillStyle = '#5a3d6e';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawPanel(ctx, 95, 300, 350, 420, 28);
    drawText(ctx, '暂停中', 270, 350, { size: 34, color: GameConfig.colors.primaryDark, stroke: '#fff', strokeWidth: 6 });
    [['音效', 156], ['语音', 232], ['音乐', 308], ['音量', 384]].forEach(([t, x]) => drawText(ctx, t, x, 696, { size: 13, color: GameConfig.colors.text, weight: 'normal' }));
    for (const b of this.mainButtons) b.render(ctx, dt);
    if (this.showSettings) {
      ctx.save(); ctx.fillStyle = 'rgba(90,61,110,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      this.settings.render(ctx, dt);
    }
  }
}
