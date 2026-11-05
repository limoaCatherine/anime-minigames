// 字幕系统：显示语音台词 (日文 + 小字中文翻译) 的气泡，出现在主角头顶附近。
import { GameConfig } from '../config/GameConfig.js';
import { VoiceConfig } from '../config/VoiceConfig.js';
import { roundRectPath } from '../ui/draw.js';

export class SubtitleSystem {
  constructor(events) {
    this.current = null;
    this.off = events.on('voice:line', (e) => this.show(e));
  }

  show({ line, x, y, group }) {
    const color = group === 'lose' ? '#8f7cff' : group === 'scared' ? '#ff8a5c' : GameConfig.colors.primary;
    this.current = { line, x: x != null ? x : GameConfig.width / 2, y: y != null ? y : GameConfig.height * 0.4, color, life: 0, max: VoiceConfig.subtitleTime };
  }

  update(dt) {
    if (!this.current) return;
    this.current.life += dt;
    if (this.current.life >= this.current.max) this.current = null;
  }

  render(ctx) {
    const s = this.current;
    if (!s) return;
    const font = GameConfig.fontFamily;
    ctx.save();
    ctx.font = `bold 20px ${font}`;
    const w1 = ctx.measureText(s.line.text).width;
    ctx.font = `13px ${font}`;
    const w2 = ctx.measureText(s.line.zh).width;
    const w = Math.max(w1, w2) + 32;
    const h = 58;
    const cx = Math.max(w / 2 + 8, Math.min(GameConfig.width - w / 2 - 8, s.x));
    const cy = Math.max(GameConfig.hudHeight + 120, Math.min(GameConfig.height - 60, s.y - 140));
    const k = s.life / s.max;
    const appear = Math.min(1, s.life / 0.18);
    const alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    const scale = 0.7 + 0.3 * (1 - Math.pow(1 - appear, 3));
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy - (1 - appear) * 10);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(120,60,140,0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3;
    ctx.strokeStyle = s.color;
    ctx.stroke();
    const tx = Math.max(-w / 2 + 18, Math.min(w / 2 - 18, s.x - cx));
    ctx.beginPath();
    ctx.moveTo(tx - 8, h / 2 - 1); ctx.lineTo(tx, h / 2 + 10); ctx.lineTo(tx + 8, h / 2 - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 20px ${font}`;
    ctx.fillStyle = '#e2457f';
    ctx.fillText(s.line.text, 0, -9);
    ctx.font = `13px ${font}`;
    ctx.fillStyle = '#8a6d9e';
    ctx.fillText(s.line.zh, 0, 15);
    ctx.restore();
  }

  destroy() {
    this.off();
  }
}
