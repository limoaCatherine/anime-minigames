// 制作人员面板：出品、角色语音署名 (VOICEVOX 利用规约要求标注「VOICEVOX:角色名」)、背景音乐、音效、立绘。
import { GameConfig } from '../config/GameConfig.js';
import { VOICE_CAST, VOICE_CREDITS } from '../config/VoiceConfig.js';
import { CHARACTER_MAP } from '../config/CharacterConfig.js';
import { ENEMIES } from '../config/EnemyConfig.js';
import { AudioConfig } from '../config/AudioConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText } from './draw.js';

export class CreditsPanel {
  constructor(game, { onClose }) {
    this.game = game;
    this.t = 0;
    this.closeBtn = new Button({ x: game.width / 2, y: 850, w: 200, h: 54, label: '关闭', fontSize: 22, onClick: onClose });
    this.closeBtn.audio = game.audio;
    this.buttons = [this.closeBtn];
  }

  render(ctx, dt = 1 / 60) {
    this.t += dt;
    const w = this.game.width;
    const C = GameConfig.colors;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.t / 0.2) * 0.6;
    ctx.fillStyle = '#120828';
    ctx.fillRect(0, 0, w, this.game.height);
    ctx.restore();
    drawPanel(ctx, 30, 110, w - 60, 790, 28, 'rgba(255,250,255,0.985)');
    drawText(ctx, '制作人员', w / 2, 152, { size: 28, color: C.primaryDark, stroke: '#fff', strokeWidth: 5 });
    drawText(ctx, `《${GameConfig.title}》 v${GameConfig.version}`, w / 2, 186, { size: 15, color: C.text, weight: 'normal' });
    drawText(ctx, `出品：${GameConfig.publisher}`, w / 2, 210, { size: 14, color: C.text, weight: 'normal' });

    drawText(ctx, '角色语音', 60, 252, { size: 17, color: C.secondary, align: 'left' });
    let y = 284;
    for (const [who, cast] of Object.entries(VOICE_CAST)) {
      const name = CHARACTER_MAP[who] ? CHARACTER_MAP[who].name : ENEMIES[who] ? ENEMIES[who].name : who;
      drawText(ctx, name, 70, y, { size: 14, color: '#6a4f80', align: 'left', weight: 'normal' });
      drawText(ctx, `VOICEVOX:${cast.speaker}`, w - 62, y, { size: 15, color: '#5a3d6e', align: 'right' });
      y += 27;
    }
    drawText(ctx, `（VOICEVOX 合成，共 ${VOICE_CREDITS.length} 位，依各角色利用规约署名）`, w / 2, y + 2, { size: 12, color: '#9a7bb0', weight: 'normal' });
    y += 40;
    const rows = [
      ['背景音乐', Object.values(AudioConfig.bgm.tracks).map((t) => `《${t.title}》`).join(' ')],
      ['', '原创 · 程序化作曲'],
      ['音效', 'WebAudio 实时合成（原创）'],
      ['角色立绘', '原创二次元形象'],
      ['程序 / 美术 / 关卡', GameConfig.publisher],
    ];
    for (const [k, v] of rows) {
      if (k) drawText(ctx, k, 60, y, { size: 16, color: C.secondary, align: 'left' });
      drawText(ctx, v, w - 62, y, { size: k ? 14 : 12, color: k ? '#6a4f80' : '#9a7bb0', align: 'right', weight: k ? 'bold' : 'normal' });
      y += k ? 34 : 26;
    }
    drawText(ctx, '谢谢你陪她们守到天亮', w / 2, 800, { size: 14, color: '#b08ac8', weight: 'normal' });
    this.closeBtn.render(ctx, dt);
  }
}
