// 字幕气泡：角色头像 + 名字 + 中文台词。语音台词 (voice:line) 与纯文字台词 (show) 共用。
// 同一时间只显示一条，新台词直接替换旧台词 (与语音"一次一句"一致)。
import { GameConfig } from '../config/GameConfig.js';
import { CHARACTERS } from '../config/CharacterConfig.js';
import { VoiceConfig } from '../config/VoiceConfig.js';
import { drawText, roundRectPath } from './draw.js';
import { drawFace } from './portrait.js';

export class Subtitle {
  constructor(game) {
    this.game = game;
    this.cur = null;
    this.y = GameConfig.layout.subtitleY;
    this.log = [];
    game.events.on('voice:line', ({ line }) => this.show(line.who, line.zh, Math.max(VoiceConfig.subtitleTime, 0.9 + line.zh.length * 0.13)));
  }

  /** 显示一条字幕 (纯文字台词不发声) */
  show(who, zh, time = 0) {
    const t = time || Math.max(2.2, 0.9 + zh.length * 0.16);
    this.cur = { who, zh, t: 0, max: t };
    this.log.push(`${who}:${zh}`);
    if (this.log.length > 60) this.log.shift();
  }

  clear() { this.cur = null; }

  update(dt) {
    if (!this.cur) return;
    this.cur.t += dt;
    if (this.cur.t > this.cur.max) this.cur = null;
  }

  render(ctx, yAt = this.y) {
    const c = this.cur;
    if (!c) return;
    const ch = CHARACTERS[c.who] || { name: '', color: GameConfig.colors.primary };
    const k = Math.min(1, c.t / 0.16);
    const out = c.max - c.t < 0.25 ? (c.max - c.t) / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(k, out));
    ctx.font = `bold 19px ${GameConfig.fontFamily}`;
    const lines = wrap2(ctx, c.zh, 400);
    const tw = Math.min(400, Math.max(...lines.map((l) => ctx.measureText(l).width)));
    const w = Math.max(200, tw + 86); const h = lines.length > 1 ? 74 : 52;
    const x = (GameConfig.width - w) / 2 + 18; const y = yAt - h / 2 + (1 - k) * 8;
    ctx.shadowColor = 'rgba(60,20,70,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2.5; ctx.strokeStyle = ch.color; ctx.stroke();
    drawFace(ctx, this.game, c.who, x + 4, y + h / 2, 26);
    // 名牌
    ctx.font = `bold 12px ${GameConfig.fontFamily}`;
    const nw = ctx.measureText(ch.name).width + 16;
    roundRectPath(ctx, x + 38, y - 10, nw, 20, 10); ctx.fillStyle = ch.color; ctx.fill();
    drawText(ctx, ch.name, x + 38 + nw / 2, y + 0.5, { size: 12, color: '#fff' });
    lines.forEach((ln, i) => {
      ctx.save();
      ctx.font = `bold 19px ${GameConfig.fontFamily}`;
      const scale = Math.min(1, 400 / Math.max(1, ctx.measureText(ln).width));
      const ly = lines.length > 1 ? y + 25 + i * 26 : y + h / 2 + 3;
      ctx.translate(x + 40, ly); ctx.scale(scale, 1);
      drawText(ctx, ln, 0, 0, { size: 19, color: GameConfig.colors.text, align: 'left' });
      ctx.restore();
    });
    ctx.restore();
  }
}

/** 超过一行宽度就拆成两行：优先在中间附近的标点后断开，不再把整句硬挤扁 */
export function wrap2(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return [text];
  const mid = text.length / 2; let cut = -1; let best = Infinity;
  for (let i = 1; i < text.length - 1; i++) {
    if ('，。！？、…—：；」）'.includes(text[i - 1]) && Math.abs(i - mid) < best) { best = Math.abs(i - mid); cut = i; }
  }
  if (cut < 0 || best > text.length * 0.3) cut = Math.ceil(mid);
  return [text.slice(0, cut), text.slice(cut)];
}
