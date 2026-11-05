// 卡牌实体：位置 (正面左上角)、层号、区域 (board 牌桌 / pile 侧边牌堆 / temp 移出暂存区)、状态与动画属性。
// state: 'board' 在场上 | 'slot' 在卡槽 (含飞行中) | 'clearing' 消除动画中 | 'gone' 已消除
import { GameConfig } from '../config/GameConfig.js';
import { roundRectPath } from '../ui/draw.js';

const SIZE = GameConfig.card.size;
const THICK = GameConfig.card.thickness;

export class Card {
  constructor({ id, type, x, y, layer, zone = 'board', side = null }) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.layer = layer;
    this.zone = zone;
    this.side = side;
    this.home = { x, y, layer, zone };
    this.state = 'board';
    this.free = false;
    this.flying = false;     // 正在飞向卡槽
    this.onLand = null;
    // 动画属性
    this.scale = 1;
    this.scaleX = 1;         // 洗牌翻面
    this.alpha = 1;
    this.rot = 0;
    this.lift = 0;           // 悬停抬起
    this.shake = 0;          // 点到被压住的卡时左右抖动
    this.appear = 1;         // 开局发牌动画 0→1
    this.glow = 0;           // 提示高光
  }

  get size() { return SIZE; }
  get cx() { return this.x + SIZE / 2; }
  get cy() { return this.y + SIZE / 2; }

  /** 点击判定区域 = 正面 + 厚度 */
  contains(p) {
    return p.x >= this.x && p.x <= this.x + SIZE && p.y >= this.y && p.y <= this.y + SIZE + THICK;
  }

  update(dt, hovered) {
    const targetLift = hovered && this.free && this.state === 'board' ? 1 : 0;
    this.lift += (targetLift - this.lift) * Math.min(1, dt * 16);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.glow > 0) this.glow = Math.max(0, this.glow - dt * 0.6);
  }

  /**
   * @param {{normal:CanvasImageSource, dark:CanvasImageSource}} sprite
   * @param {boolean} dim 是否画成被压住的暗色
   */
  render(ctx, sprite, dim) {
    if (this.alpha <= 0 || this.appear <= 0) return;
    const ap = this.appear;
    const s = this.scale * (1 + (1 - Math.min(1, ap)) * 0.25);
    const sx = this.scaleX;
    const shakeX = this.shake > 0 ? Math.sin(this.shake * 60) * 4 * (this.shake / 0.3) : 0;
    const cx = this.cx + shakeX;
    const cy = this.cy - this.lift * 6 - (1 - ap) * 150;
    ctx.save();
    ctx.globalAlpha *= this.alpha * Math.min(1, ap * 4);
    ctx.translate(cx, cy);
    if (this.rot) ctx.rotate(this.rot);
    ctx.scale(s * sx, s);
    // 投影 (悬停抬起时影子更远更淡)
    ctx.fillStyle = dim ? 'rgba(60,30,70,0.18)' : `rgba(110,50,90,${0.24 - this.lift * 0.06})`;
    roundRectPath(ctx, -SIZE / 2 + 1.5, -SIZE / 2 + 4 + this.lift * 6, SIZE, SIZE + THICK, 11);
    ctx.fill();
    // 悬停：粉白光晕
    if (this.lift > 0.02 && !dim) {
      ctx.save();
      ctx.globalAlpha *= this.lift;
      ctx.shadowColor = 'rgba(255,120,190,0.9)';
      ctx.shadowBlur = 16;
      roundRectPath(ctx, -SIZE / 2 - 1, -SIZE / 2 - 1, SIZE + 2, SIZE + THICK + 2, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
    const img = dim ? sprite.dark : sprite.normal;
    ctx.drawImage(img, -SIZE / 2, -SIZE / 2, SIZE, SIZE + THICK);
    if (this.lift > 0.02 && !dim) {
      ctx.save();
      ctx.globalAlpha *= this.lift * 0.9;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      roundRectPath(ctx, -SIZE / 2 + 1, -SIZE / 2 + 1, SIZE - 2, SIZE - 2, 10);
      ctx.stroke();
      ctx.restore();
    }
    if (this.glow > 0) {
      ctx.globalAlpha *= Math.min(1, this.glow) * (0.6 + 0.4 * Math.sin(Date.now() / 90));
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffe14d';
      roundRectPath(ctx, -SIZE / 2 - 2, -SIZE / 2 - 2, SIZE + 4, SIZE + 4, 12);
      ctx.stroke();
    }
    ctx.restore();
  }
}
