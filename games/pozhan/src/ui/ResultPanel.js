// 结算面板：通关 (星级 + 用时 / 失误 / 提示 + 破绽清单) 与 沙雕结局 (收集卡)。
import { GameConfig } from '../config/GameConfig.js';
import { CHARACTERS } from '../config/CharacterConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText, drawStar, roundRectPath } from './draw.js';
import { drawFace } from './portrait.js';

export class ResultPanel {
  /**
   * @param {object} o { kind:'win'|'silly', title, stars, time, mistakes, hints, lines:string[], host, pose, quote, buttons:[{label,style,onClick}] , badge }
   */
  constructor(game, o) {
    this.game = game;
    this.o = o;
    this.t = 0;
    this.starsShown = 0;
    const W = GameConfig.width;
    this.w = 470; this.h = 640; this.x = (W - this.w) / 2; this.y = 150;
    let by = this.y + this.h - 50 - (o.buttons.length - 1) * 66;
    this.buttons = o.buttons.map((b) => {
      const btn = new Button({ x: W / 2, y: by, w: 300, h: 56, label: b.label, style: b.style || 'primary', fontSize: 23, onClick: b.onClick });
      btn.audio = game.audio; by += 66;
      return btn;
    });
  }

  update(dt) {
    this.t += dt;
    const n = this.o.stars || 0;
    const want = Math.min(n, Math.floor((this.t - 0.45) / 0.32) + 1);
    if (this.o.kind === 'win' && want > this.starsShown) {
      this.starsShown = want;
      this.game.audio.play('star', { n: want - 1 });
    }
  }

  render(ctx, dt) {
    const o = this.o; const W = GameConfig.width; const C = GameConfig.colors;
    const e = 1 - Math.pow(1 - Math.min(1, this.t / 0.25), 3);
    ctx.save();
    ctx.fillStyle = `rgba(60,25,70,${0.5 * e})`; ctx.fillRect(0, 0, W, GameConfig.height);
    ctx.globalAlpha = e; ctx.translate(0, (1 - e) * 40);
    drawPanel(ctx, this.x, this.y, this.w, this.h, 30, '#fff9fc');
    // 标题缎带
    const silly = o.kind === 'silly';
    roundRectPath(ctx, W / 2 - 150, this.y - 30, 300, 62, 31);
    ctx.fillStyle = silly ? '#8b5cf6' : C.primary; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
    drawText(ctx, o.title, W / 2, this.y + 1, { size: 30, color: '#fff', stroke: silly ? '#6d3fd6' : C.primaryDark, strokeWidth: 5 });
    let y = this.y + 64;
    if (!silly) {
      for (let i = 0; i < 3; i++) {
        const sx = W / 2 + (i - 1) * 78; const sy = y + 30 + (i === 1 ? -10 : 0);
        const on = i < this.starsShown;
        ctx.fillStyle = on ? '#ffc93c' : '#eadff2';
        ctx.save(); ctx.translate(sx, sy);
        if (on) { const k = Math.min(1, (this.t - 0.45 - i * 0.32) / 0.25); const s = k < 1 ? 0.4 + 0.9 * k : 1; ctx.scale(s, s); }
        ctx.shadowColor = on ? 'rgba(255,170,0,0.5)' : 'transparent'; ctx.shadowBlur = 12;
        drawStar(ctx, 0, 0, 32, 14);
        ctx.restore();
      }
      y += 84;
      const stat = [['用时', fmtTime(o.time)], ['失误', `${o.mistakes} 次`], [o.hintsLabel || '精确提示', `${o.hints} 次`]];
      stat.forEach(([k, v], i) => {
        const x = this.x + 80 + i * 155;
        drawText(ctx, v, x, y, { size: 20, color: C.text });
        drawText(ctx, k, x, y + 24, { size: 13, color: '#a08bb4', weight: 'normal' });
      });
      y += 50;
    } else {
      // 沙雕结局卡
      roundRectPath(ctx, this.x + 40, y, this.w - 80, 92, 18);
      ctx.fillStyle = '#f1eaff'; ctx.fill();
      drawText(ctx, '收集到沙雕结局', W / 2, y + 26, { size: 16, color: '#8b5cf6' });
      drawText(ctx, o.badge || '', W / 2, y + 58, { size: 24, color: '#5b3aa8' });
      y += 112;
    }
    // 角色 + 一句话
    drawFace(ctx, this.game, o.host, this.x + 70, y + 40, 36, o.pose || 'idle');
    roundRectPath(ctx, this.x + 118, y + 8, this.w - 150, 64, 16);
    ctx.fillStyle = '#ffeef5'; ctx.fill();
    drawText(ctx, CHARACTERS[o.host].name, this.x + 132, y + 24, { size: 13, color: CHARACTERS[o.host].color, align: 'left' });
    drawText(ctx, o.quote || '', this.x + 132, y + 48, { size: 16, color: C.text, align: 'left' });
    y += 92;
    // 清单
    if (o.lines && o.lines.length) {
      const cols = o.lines.length > 6 ? 2 : 1;
      const maxRows = Math.ceil(o.lines.length / cols);
      const lh = Math.min(24, (this.y + this.h - 50 - (this.buttons.length - 1) * 66 - 50 - y) / maxRows);
      o.lines.forEach((s, i) => {
        const c = Math.floor(i / maxRows); const r = i % maxRows;
        const x = cols === 1 ? this.x + 60 : this.x + 40 + c * (this.w - 70) / 2;
        drawText(ctx, `✓ ${s}`, x, y + r * lh, { size: lh > 20 ? 15 : 13, color: '#7a6690', align: 'left', weight: 'normal' });
      });
    }
    ctx.restore();
    if (this.t > 0.3) for (const b of this.buttons) b.render(ctx, dt);
  }
}

export function fmtTime(t) {
  const s = Math.floor(t || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
