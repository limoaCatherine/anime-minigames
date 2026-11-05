// 通用弹窗：标题 + 若干行说明 + 纵向排列的按钮，可选显示一张角色卡牌头像。
// 用于暂停、卡槽已满 (复活)、玩法说明等。
import { GameConfig } from '../config/GameConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText } from './draw.js';

export class Dialog {
  /**
   * @param {object} o
   * @param {string} o.title
   * @param {string[]} [o.lines]
   * @param {{label:string, style?:string, onClick:()=>void, fontSize?:number}[]} o.buttons
   * @param {CanvasImageSource} [o.image] 标题上方的角色卡
   * @param {import('../systems/AudioSystem.js').AudioSystem} audio
   */
  constructor(o, audio) {
    this.title = o.title;
    this.lines = o.lines || [];
    this.image = o.image || null;
    this.titleColor = o.titleColor || GameConfig.colors.primaryDark;
    this.lineSize = o.lineSize || 19;
    this.w = o.width || 420;
    const btnH = 62;
    const imgH = this.image ? 84 : 0;
    this.h = 92 + imgH + this.lines.length * (this.lineSize + 11) + o.buttons.length * (btnH + 14) + 14;
    this.x = (GameConfig.width - this.w) / 2;
    this.y = (GameConfig.height - this.h) / 2 - 20;
    this.imgH = imgH;
    let by = this.y + 78 + imgH + this.lines.length * (this.lineSize + 11) + 24 + btnH / 2;
    this.buttons = o.buttons.map((b) => {
      const btn = new Button({ x: GameConfig.width / 2, y: by, w: this.w - 90, h: btnH, label: b.label, style: b.style || 'primary', fontSize: b.fontSize || 26, onClick: b.onClick });
      btn.audio = audio;
      by += btnH + 14;
      return btn;
    });
    this.t = 0;
  }

  update(dt) { this.t += dt; }

  render(ctx, dt) {
    const k = Math.min(1, this.t / 0.22);
    const e = 1 - Math.pow(1 - k, 3);
    ctx.save();
    ctx.fillStyle = `rgba(70,30,80,${0.45 * e})`;
    ctx.fillRect(0, 0, GameConfig.width, GameConfig.height);
    const cx = GameConfig.width / 2;
    const cy = this.y + this.h / 2;
    ctx.translate(cx, cy);
    const s = 0.85 + 0.15 * (k < 1 ? 1 - Math.pow(1 - k, 2) * Math.cos(k * 3) : 1);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = e;
    drawPanel(ctx, this.x, this.y, this.w, this.h, 28, '#fff9fc');
    let y = this.y + 46;
    if (this.image) {
      ctx.drawImage(this.image, cx - 38, this.y + 18, 76, 83.6);
      y += this.imgH;
    }
    drawText(ctx, this.title, cx, y, { size: 32, color: this.titleColor, stroke: '#fff', strokeWidth: 6 });
    y += 46;
    for (const line of this.lines) {
      drawText(ctx, line, cx, y, { size: this.lineSize, color: GameConfig.colors.text, weight: 'normal' });
      y += this.lineSize + 11;
    }
    for (const b of this.buttons) b.render(ctx, dt);
    ctx.restore();
  }
}
