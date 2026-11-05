// 消除系统：卡牌进入卡槽后，若同花色达到 3 张 → 立即把这 3 张移出卡槽 (不再占格)，
// 等它们全部落地后播放"弹起-缩小"消除动画，发出 match 事件 (特效 / 音效 / 语音 / 字幕各自响应)。
import { GameConfig } from '../config/GameConfig.js';
import { SlotSystem } from './SlotSystem.js';

export class MatchSystem {
  constructor(events, tweens, slot) {
    this.events = events;
    this.tweens = tweens;
    this.slot = slot;
    this.groups = [];       // { cards, started }
    this.combo = 0;
    this.picksSinceMatch = 99;
    this.totalMatches = 0;
    this.banner = null;     // 连消横幅 { combo, life, max }
  }

  get busy() { return this.groups.length > 0; }

  onPick() { this.picksSinceMatch++; }

  /** card 刚加入卡槽后调用；返回是否凑成三张 */
  check(card) {
    const same = this.slot.cards.filter((c) => c.type === card.type);
    if (same.length < 3) return false;
    const trio = same.slice(0, 3);
    // 新卡的目标位置 = 同组前两张的后一格 (保持视觉上挨在一起)
    const first = this.slot.cards.indexOf(trio[0]);
    trio.forEach((c, k) => {
      if (c.flying) {
        const p = SlotSystem.slotPos(first + k);
        SlotSystem.fly(this.tweens, c, p, c === card, () => this.slot.land(c));
      }
    });
    for (const c of trio) { this.slot.remove(c); c.state = 'clearing'; }
    this.combo = this.picksSinceMatch <= 3 ? this.combo + 1 : 1;
    this.picksSinceMatch = 0;
    this.groups.push({ cards: trio, started: false, combo: this.combo, type: card.type });
    if (this.combo >= 2) this.banner = { combo: this.combo, life: 0, max: 1.1 };
    return true;
  }

  update() {
    for (const g of this.groups) {
      if (g.started || g.cards.some((c) => c.flying)) continue;
      g.started = true;
      this.play(g);
    }
  }

  play(g) {
    const mid = g.cards[1];
    const x = mid.cx;
    const y = mid.cy;
    let done = 0;
    g.cards.forEach((c, i) => {
      this.tweens.to(c, { scale: 1.18 }, {
        duration: 0.1, delay: GameConfig.clearDelay + i * 0.03, ease: 'quadOut',
        onComplete: () => {
          // 两侧的卡向中间聚拢后一起消失
          this.tweens.to(c, { scale: 0, alpha: 0, x: mid.x + (c.x - mid.x) * 0.3 }, {
            duration: GameConfig.clearTime, ease: 'backIn',
            onComplete: () => {
              c.state = 'gone';
              if (++done === 3) this.finish(g);
            },
          });
        },
      });
    });
    this.totalMatches++;
    this.events.emit('match', { type: g.type, x, y, combo: g.combo });
  }

  finish(g) {
    this.groups = this.groups.filter((x) => x !== g);
    this.slot.relayout();
    this.events.emit('match:done', { type: g.type });
  }

  /** 正在消除动画中的卡 (绘制用) */
  get clearingCards() {
    const out = [];
    for (const g of this.groups) out.push(...g.cards);
    return out;
  }
}
