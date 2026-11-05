// 卡槽系统：底部 7 格卡槽。新卡插入到同花色卡的后面 (同花色总是挨在一起)，其余卡左右让位。
// 卡槽里只保存"未在消除中"的卡；凑满 3 张的那组会被 MatchSystem 立即移出 (不再占格)。
import { GameConfig } from '../config/GameConfig.js';

const SIZE = GameConfig.card.size;

export class SlotSystem {
  constructor(events, tweens) {
    this.events = events;
    this.tweens = tweens;
    this.cards = [];
    this.capacity = GameConfig.slot.capacity;
  }

  get count() { return this.cards.length; }
  get isFull() { return this.cards.length >= this.capacity; }
  get types() { return this.cards.map((c) => c.type); }
  get anyFlying() { return this.cards.some((c) => c.flying); }

  countOf(type) {
    let n = 0;
    for (const c of this.cards) if (c.type === type) n++;
    return n;
  }

  /** 第 i 格卡牌左上角坐标 */
  static slotPos(i) {
    const { capacity, gap, y } = GameConfig.slot;
    const total = capacity * SIZE + (capacity - 1) * gap;
    const x0 = (GameConfig.width - total) / 2;
    return { x: x0 + i * (SIZE + gap), y };
  }

  insertIndex(type) {
    let last = -1;
    this.cards.forEach((c, i) => { if (c.type === type) last = i; });
    return last >= 0 ? last + 1 : this.cards.length;
  }

  /** 卡牌进入卡槽 (开始飞行)。返回插入下标 */
  add(card) {
    const idx = this.insertIndex(card.type);
    this.cards.splice(idx, 0, card);
    card.state = 'slot';
    card.flying = true;
    card.lift = 0;
    card.rot = 0;
    card.appear = 1;      // 万一发牌动画被打断，进槽后也要完整显示
    card.scaleX = 1;
    this.relayout(card);
    return idx;
  }

  remove(card) {
    const i = this.cards.indexOf(card);
    if (i >= 0) this.cards.splice(i, 1);
    return i >= 0;
  }

  /** 让所有卡移动到各自格子；正在飞行的卡保持飞行时长并在落地时回调 */
  relayout(newcomer = null) {
    this.cards.forEach((c, i) => {
      const p = SlotSystem.slotPos(i);
      if (c.flying) {
        const fresh = c === newcomer;
        SlotSystem.fly(this.tweens, c, p, fresh, () => this.land(c));
      } else if (Math.abs(c.x - p.x) > 0.5 || Math.abs(c.y - p.y) > 0.5) {
        this.tweens.to(c, { x: p.x, y: p.y }, { duration: GameConfig.slotShiftTime, ease: 'cubicOut' });
      }
    });
  }

  /**
   * 飞向卡槽的弧线补间：抛物线 + 中途放大、轻微旋转，落地时回正
   * @param {boolean} fresh 是否刚被点击的卡 (完整弧线)；否则为飞行途中的改道 (短弧线)
   */
  static fly(tweens, c, p, fresh, onComplete) {
    const dir = p.x > c.x ? 1 : -1;
    const s0 = c.scale;
    tweens.to(c, { x: p.x, y: p.y }, {
      duration: fresh ? GameConfig.flyTime : GameConfig.flyTime * 0.6,
      ease: 'cubicInOut',
      arc: fresh ? Math.min(90, 40 + Math.abs(p.y - c.y) * 0.12) : 16,
      onUpdate: (t) => {
        const bump = Math.sin(Math.PI * t);
        c.scale = s0 + (1 - s0) * t + bump * (fresh ? 0.16 : 0.06);
        c.rot = bump * 0.22 * dir * (fresh ? 1 : 0.4);
      },
      onComplete: () => { c.scale = 1; c.rot = 0; onComplete(); },
    });
  }

  land(card) {
    if (!card.flying) return;
    card.flying = false;
    this.events.emit('card:land', { card });
    if (card.onLand) { const f = card.onLand; card.onLand = null; f(); }
  }

  clear() { this.cards = []; }
}
