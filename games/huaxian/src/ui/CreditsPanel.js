// 制作人员 / Credits 面板：游戏信息、AivisSpeech 角色语音署名 (模型作者要求的「リダ」+ URL)、背景音乐、开源库、
// 第三方许可全文的位置 (docs/licenses/，打包后在程序目录 licenses/)。
import { GameConfig } from '../config/GameConfig.js';
import { VOICE_SPEAKER } from '../config/VoiceConfig.js';
import { AudioConfig } from '../config/AudioConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText } from './draw.js';

export class CreditsPanel {
  constructor(game, { onClose }) {
    this.game = game;
    this.t = 0;
    this.closeBtn = new Button({ x: game.width / 2, y: 742, w: 200, h: 54, label: '关闭', fontSize: 22, onClick: onClose });
    this.closeBtn.audio = game.audio;
    this.buttons = [this.closeBtn];
  }

  render(ctx, dt = 1 / 60) {
    this.t += dt;
    const w = this.game.width;
    const C = GameConfig.colors;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.t / 0.2) * 0.45;
    ctx.fillStyle = '#5a3d6e';
    ctx.fillRect(0, 0, w, this.game.height);
    ctx.restore();
    drawPanel(ctx, 40, 250, w - 80, 540, 28);
    drawText(ctx, '制作人员 / Credits', w / 2, 292, { size: 26, color: C.primaryDark, stroke: '#fff', strokeWidth: 5 });
    drawText(ctx, `出品：${GameConfig.publisher}`, w / 2, 334, { size: 15, color: C.text, weight: 'normal' });
    const dy = !!(this.game.platform && this.game.platform.minigame);   // 抖音 / 微信小游戏
    const rows = [
      ['主角语音', VOICE_SPEAKER.credit],
      ['', VOICE_SPEAKER.detail],
      ['', VOICE_SPEAKER.urlShort],
      ['', `${VOICE_SPEAKER.engine} 合成`],
      ['许可', VOICE_SPEAKER.licenseShort],
      ['', dy ? '许可全文随游戏包附带（licenses/ 目录）' : '许可全文：游戏目录 licenses/（源码 docs/licenses/）'],
      ['背景音乐', `《${AudioConfig.bgm.title.split(' (')[0]}》`],
      ['', '原创 · 程序化作曲'],
      ['音效', dy ? '原创合成音效（预渲染）' : 'WebAudio 实时合成（原创）'],
      ['角色立绘', '原创二次元形象'],
      ['物理引擎', 'Matter.js（MIT License）'],
    ];
    rows.forEach(([k, v], i) => {
      const y = 372 + i * 29;
      if (k) drawText(ctx, k, 92, y, { size: 16, color: C.secondary || C.primary, align: 'left' });
      drawText(ctx, v, w - 92, y, { size: k ? 17 : (v.length > 40 ? 12 : 13), color: k ? '#6a4f80' : '#9a7bb0', align: 'right', weight: k ? 'bold' : 'normal' });
    });
    drawText(ctx, `v${GameConfig.version} · 语音为 AI 合成，并非 リダ 本人录音`, w / 2, 696, { size: 12, color: '#9a7bb0', weight: 'normal' });
    this.closeBtn.render(ctx, dt);
  }
}
