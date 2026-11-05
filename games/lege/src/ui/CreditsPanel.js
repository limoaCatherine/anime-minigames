// 制作人员 / Credits：出品 (狸猫)、角色语音 (AivisSpeech 各模型的署名；リダ 的规约要求注明名字与频道 URL)、背景音乐、音效与美术说明。
import { GameConfig } from '../config/GameConfig.js';
import { CARDS } from '../config/CardConfig.js';
import { VOICE_CAST, VOICES, VOICE_CREDITS } from '../config/VoiceConfig.js';
import { AudioConfig } from '../config/AudioConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText, roundRectPath } from './draw.js';

export class CreditsPanel {
  constructor(game, onClose) {
    this.game = game;
    this.t = 0;
    this.closeBtn = new Button({ x: game.width / 2, y: 900, w: 200, h: 56, label: '关闭', fontSize: 24, onClick: onClose });
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
    drawPanel(ctx, 22, 70, w - 44, 790, 28, '#fff9fc');
    drawText(ctx, '制作人员', w / 2, 106, { size: 28, color: C.primary });
    drawText(ctx, `出品：${GameConfig.producer}`, w / 2, 140, { size: 15, color: C.text, weight: 'normal' });
    drawText(ctx, '角色语音', w / 2, 176, { size: 17, color: C.primaryDark });
    const sprites = this.game.cardSprites;
    VOICE_CAST.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 46 + col * 236;
      const y = 206 + row * 42;
      const sp = sprites[c.card];
      if (sp) ctx.drawImage(sp.normal, x, y - 16, 30, 33);
      drawText(ctx, CARDS[c.card].name, x + 38, y - 6, { size: 12, color: '#8a6d9e', align: 'left', weight: 'normal' });
      drawText(ctx, `CV: ${VOICES[c.voice].name}`, x + 38, y + 10, { size: 13, color: C.text, align: 'left' });
    });
    // 声线署名
    let yc = 206 + 7 * 42 + 4;
    drawText(ctx, '声线署名', w / 2, yc, { size: 15, color: C.primaryDark });
    let yv = yc + 24;
    VOICE_CREDITS.forEach((v) => {
      drawText(ctx, v.credit, 52, yv - 6, { size: 13, color: C.text, align: 'left' });
      drawText(ctx, `${v.detail}  ·  ${v.license}`, 52, yv + 9, { size: 11, color: '#8a6d9e', align: 'left', weight: 'normal' });
      if (v.note) { drawText(ctx, v.note, 52, yv + 23, { size: 11, color: '#c0607e', align: 'left', weight: 'normal' }); yv += 14; }
      yv += 32;
    });
    const y0 = yv - 2;
    roundRectPath(ctx, 44, y0 - 4, w - 88, 1.5, 1); ctx.fillStyle = '#ecd9ef'; ctx.fill();
    const T = AudioConfig.bgm.tracks;
    const lines = [
      ['背景音乐', `《${T.menu.title}》《${T.game.title}》《${T.hell.title}》 原创 (程序化作曲)`],
      ['音效', 'WebAudio 实时合成'],
      ['美术', '本作原创角色 (立绘由 AI 辅助生成)'],
      ['字体', '系统默认中文字体'],
    ];
    lines.forEach(([k, v], i) => {
      drawText(ctx, k, 60, y0 + 20 + i * 24, { size: 13, color: C.primaryDark, align: 'left' });
      drawText(ctx, v, 140, y0 + 20 + i * 24, { size: 12, color: C.text, align: 'left', weight: 'normal' });
    });
    drawText(ctx, '角色语音由 AivisSpeech 合成，与声优本人及原作无关 · 许可原文见 licenses/', w / 2, y0 + 116, { size: 11, color: '#a08bb4', weight: 'normal' });
    ctx.restore();
    this.closeBtn.render(ctx, dt);
  }
}
