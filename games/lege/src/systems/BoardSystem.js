// 牌桌系统：持有所有卡牌实体，负责发牌动画、遮挡刷新、点击拾取、洗牌与绘制。
import { GameConfig } from '../config/GameConfig.js';
import { Card } from '../entities/Card.js';
import { CoverSystem } from './CoverSystem.js';

export class BoardSystem {
  constructor(events, tweens) {
    this.events = events;
    this.tweens = tweens;
    this.cards = [];
    this.cover = new CoverSystem(GameConfig.card.size);
    this.freeCards = [];
    this.hovered = null;
  }

  /** 载入生成器结果并播放发牌动画：按层从上方依次落下 (带回弹)，每落一层发出 card:deal (音效) */
  load(generated, animate = true) {
    this.cards = generated.cards.map((c) => new Card(c));
    if (animate) {
      const boardLayers = [...new Set(this.cards.filter((c) => c.zone === 'board').map((c) => c.layer))].sort((a, b) => a - b);
      const rankOf = (c) => (c.zone === 'board' ? boardLayers.indexOf(c.layer) : boardLayers.length);
      const ranks = boardLayers.length + 1;
      const step = Math.min(0.2, 1.5 / ranks);
      const base = 0.2;
      this.dealTime = base + ranks * step + 0.5;
      for (let r = 0; r < ranks; r++) {
        if (!this.cards.some((c) => rankOf(c) === r)) continue;
        this.tweens.to({ v: 0 }, { v: 1 }, { duration: 0.01, delay: base + r * step, onComplete: () => this.events.emit('card:deal', { layer: r }) });
      }
      this.cards.forEach((c) => {
        c.appear = 0;
        const jitter = ((c.x * 7 + c.y * 13) % 17) / 17 * 0.08;
        this.tweens.to(c, { appear: 1 }, { duration: 0.5, delay: base + rankOf(c) * step + jitter, ease: 'bounceOut' });
      });
    }
    this.refresh();
  }

  /** 场上 (含侧边牌堆、暂存区) 的卡 */
  get onBoard() {
    return this.cards.filter((c) => c.state === 'board');
  }

  get remaining() {
    let n = 0;
    for (const c of this.cards) if (c.state === 'board') n++;
    return n;
  }

  get total() { return this.cards.length; }

  /** 重新计算遮挡 (卡牌离开/回到牌桌后调用) */
  refresh() {
    this.freeCards = this.cover.update(this.cards);
    return this.freeCards;
  }

  /** 点击位置最上层的那张卡 (不论是否被压住) */
  topAt(p) {
    let best = null;
    for (const c of this.cards) {
      if (c.state !== 'board' || !c.contains(p)) continue;
      if (!best || c.layer > best.layer || (c.layer === best.layer && c.y > best.y)) best = c;
    }
    return best;
  }

  updateHover(p) {
    const top = p ? this.topAt(p) : null;
    this.hovered = top && top.free ? top : null;
  }

  update(dt) {
    for (const c of this.cards) if (c.state === 'board') c.update(dt, c === this.hovered);
  }

  /**
   * 洗牌：只改场上卡牌的花色，位置不变 (带翻面动画)。
   * types 给出时按它赋值 (可解洗牌，见 Solver.solvableShuffle)；否则随机打乱。
   * @param {Card[]} live 要改的卡 (默认场上全部)
   */
  shuffle(rng = Math.random, types = null, live = this.onBoard) {
    if (!types) {
      types = live.map((c) => c.type);
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }
    }
    live.forEach((c, i) => {
      c.type = types[i];   // 逻辑上立即生效
      c.scaleX = 1;
      this.tweens.to(c, { scaleX: 0.05 }, {
        duration: 0.13, delay: (i % 10) * 0.012, ease: 'quadOut', keep: true,
        onComplete: () => this.tweens.to(c, { scaleX: 1 }, { duration: 0.15, ease: 'backOut', keep: true }),
      });
    });
    return live.length;
  }

  render(ctx, sprites) {
    const list = this.cards.filter((c) => c.state === 'board' && !c.flying);
    list.sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x);
    for (const c of list) c.render(ctx, sprites[c.type], !c.free);
  }
}
