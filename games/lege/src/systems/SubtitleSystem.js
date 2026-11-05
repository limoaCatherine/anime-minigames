// 字幕系统：显示语音台词 (日文 + 小字中文翻译) 的字幕条；消除时左侧附带被消除角色的小头像。
// v2：字幕条固定在顶部 HUD 与牌桌之间的空白条 (GameConfig.subtitleY)，不会遮挡任何可点击的卡牌。
// (改编自姊妹项目《美少女合成》的 SubtitleSystem)
import { GameConfig } from '../config/GameConfig.js';
import { VoiceConfig } from '../config/VoiceConfig.js';
import { getCard } from '../config/CardConfig.js';
import { roundRectPath } from '../ui/draw.js';

export class SubtitleSystem {
  /** @param {(type:number)=>any} getSprite 取卡牌贴图 */
  constructor(events, getSprite, y = 600) {
    this.getSprite = getSprite;
    this.y = y;
    this.current = null;
    this.off = events.on('voice:line', (e) => this.show(e));
  }

  show({ line, cardType = null }) {
    if (line.who != null) cardType = line.who;   // 头像 = 说话的角色
    const color = cardType != null ? getCard(cardType).color : GameConfig.colors.primary;
    this.current = { line, cardType, color, life: 0, max: VoiceConfig.subtitleTime };
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
    ctx.font = `bold 17px ${font}`;
    const w1 = ctx.measureText(s.line.text).width;
    ctx.font = `12px ${font}`;
    const w2 = ctx.measureText(s.line.zh).width;
    const hasFace = s.cardType != null;
    const faceW = hasFace ? 46 : 0;
    const w = Math.min(GameConfig.width - 20, Math.max(w1, w2) + 34 + faceW);
    const h = 46;
    const cx = GameConfig.width / 2;
    const cy = this.y;
    const k = s.life / s.max;
    const appear = Math.min(1, s.life / 0.18);
    const alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    const scale = 0.7 + 0.3 * (1 - Math.pow(1 - appear, 3));
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy - (1 - appear) * 12);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(120,60,140,0.3)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3;
    ctx.strokeStyle = s.color;
    ctx.stroke();
    let tx = 0;
    if (hasFace) {
      const sp = this.getSprite(s.cardType);
      const fx = -w / 2 + 8;
      if (sp) ctx.drawImage(sp.normal, fx, -19, 36, 39.6);
      tx = faceW / 2;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 17px ${font}`;
    ctx.fillStyle = '#e2457f';
    ctx.fillText(s.line.text, tx, -7, w - 20 - faceW);
    ctx.font = `12px ${font}`;
    ctx.fillStyle = '#8a6d9e';
    ctx.fillText(s.line.zh, tx, 12, w - 20 - faceW);
    ctx.restore();
  }

  destroy() {
    this.off();
  }
}
