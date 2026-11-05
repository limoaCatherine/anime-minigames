// 制作人员 / Credits：出品、VOICEVOX 角色语音署名 (各角色利用规约要求「VOICEVOX:角色名」)、背景音乐、音效与美术说明。
import { GameConfig } from '../config/GameConfig.js';
import { CHARACTERS } from '../config/CharacterConfig.js';
import { VOICE_CAST } from '../config/VoiceConfig.js';
import { AudioConfig } from '../config/AudioConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText, roundRectPath } from './draw.js';
import { drawFace } from './portrait.js';

export class CreditsPanel {
  constructor(game, onClose) {
    this.game = game;
    this.t = 0;
    this.closeBtn = new Button({ x: game.width / 2, y: 890, w: 200, h: 56, label: '关闭', fontSize: 24, onClick: onClose });
    this.closeBtn.audio = game.audio;
    this.buttons = [this.closeBtn];
  }

  update(dt) { this.t += dt; }

  render(ctx, dt) {
    const w = this.game.width;
    const C = GameConfig.colors;
    const e = 1 - Math.pow(1 - Math.min(1, this.t / 0.2), 3);
    ctx.save();
    ctx.fillStyle = `rgba(60,25,70,${0.55 * e})`;
    ctx.fillRect(0, 0, w, GameConfig.height);
    ctx.globalAlpha = e;
    drawPanel(ctx, 22, 60, w - 44, 790, 28, '#fff9fc');
    drawText(ctx, '制作人员', w / 2, 98, { size: 28, color: C.primary });
    drawText(ctx, `《${GameConfig.title}》 v${GameConfig.version}`, w / 2, 130, { size: 15, color: C.text, weight: 'normal' });
    drawText(ctx, `出品：${GameConfig.publisher}`, w / 2, 154, { size: 15, color: C.text, weight: 'normal' });
    drawText(ctx, '角色语音', w / 2, 192, { size: 17, color: C.primaryDark });
    Object.entries(VOICE_CAST).forEach(([who, c], i) => {
      const y = 232 + i * 54;
      const x = 70;
      drawFace(ctx, this.game, who, x, y, 21);
      drawText(ctx, `${CHARACTERS[who].name}`, x + 34, y - 9, { size: 15, color: CHARACTERS[who].color, align: 'left' });
      drawText(ctx, CHARACTERS[who].title, x + 34, y + 11, { size: 12, color: '#a08bb4', align: 'left', weight: 'normal' });
      drawText(ctx, `VOICEVOX:${c.speaker}`, w - 60, y, { size: 16, color: C.text, align: 'right' });
    });
    const y0 = 232 + 5 * 54;
    roundRectPath(ctx, 44, y0 - 10, w - 88, 1.5, 1); ctx.fillStyle = '#ecd9ef'; ctx.fill();
    const T = AudioConfig.bgm.tracks;
    const lines = [
      ['背景音乐', `《${T.menu.title}》《${T.game.title}》`],
      ['', '本作原创 (程序化作曲)'],
      ['音效', 'WebAudio 实时合成'],
      ['美术', '角色立绘为公司原创角色库；场景与道具为本作绘制'],
      ['策划', '二次元梗图找茬 · 吐槽役养成计划'],
      ['字体', '系统默认中文字体'],
    ];
    lines.forEach(([k, v], i) => {
      drawText(ctx, k, 56, y0 + 18 + i * 30, { size: 14, color: C.primaryDark, align: 'left' });
      drawText(ctx, v, 136, y0 + 18 + i * 30, { size: 13, color: C.text, align: 'left', weight: 'normal' });
    });
    drawText(ctx, '语音由 VOICEVOX 合成 (日语)，按各角色的利用规约署名', w / 2, y0 + 210, { size: 12, color: '#a08bb4', weight: 'normal' });
    drawText(ctx, '本作所有角色与剧情均为虚构，如有雷同纯属吐槽', w / 2, y0 + 232, { size: 12, color: '#a08bb4', weight: 'normal' });
    ctx.restore();
    this.closeBtn.render(ctx, dt);
  }
}
