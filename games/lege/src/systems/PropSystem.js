// 道具系统：移出 / 撤回 / 洗牌 (每关各 1 次) + 复活 (每关 1 次，需观看激励视频)。
//  - 移出：把卡槽最左边最多 3 张卡移到卡槽上方的"暂存区"，暂存区的卡可以再次点击
//          (若暂存区已有卡，新移出的卡叠在上面并压住旧卡)
//  - 撤回：把上一张放入卡槽的卡放回原位 (若那一步刚好凑成三张已消除，则不能撤回)
//  - 洗牌：重新分配场上剩余卡牌的花色，位置不变；保证洗完后 (连同卡槽里的卡) 仍然有解
//  - 复活：卡槽填满时，看广告后执行一次"移出 3 张"并继续游戏
import { GameConfig } from '../config/GameConfig.js';
import { solvableShuffle } from './Solver.js';
import { createRng } from '../core/Random.js';

export const PROP_DEFS = [
  { key: 'moveOut', label: '移出', desc: '把槽里最左边 3 张挪到上面' },
  { key: 'undo', label: '撤回', desc: '撤回上一步' },
  { key: 'shuffle', label: '洗牌', desc: '只换脸，不换位置' },
];

export class PropSystem {
  constructor(scene, uses = { moveOut: 1, undo: 1, shuffle: 1, revive: 1 }) {
    this.scene = scene;
    this.events = scene.game.events;
    this.uses = { ...uses };
    this.initial = { ...uses };   // 开局次数 (侧边栏礼包可能多给)，用来算"用了几次"
    this.tempLevel = 0;     // 暂存区已叠放的批次
    this.lastMove = null;   // { card, home }
  }

  remaining(key) { return this.uses[key] || 0; }
  used(key) { return Math.max(0, (this.initial[key] || 0) - this.remaining(key)); }

  recordPick(card) {
    this.lastMove = { card, home: { ...card.home } };
  }

  invalidateUndo() { this.lastMove = null; }

  deny(key, reason) {
    this.events.emit('prop:denied', { key, reason });
    this.scene.toast(reason);
    return false;
  }

  use(key) {
    if (this.remaining(key) <= 0) return this.deny(key, '这关用过了');
    let ok = false;
    if (key === 'moveOut') ok = this.moveOut(3, 'prop');
    else if (key === 'undo') ok = this.undo();
    else if (key === 'shuffle') ok = this.shuffle();
    if (ok) this.uses[key]--;
    return ok;
  }

  /** 暂存区第 i 格的位置 */
  tempPos(i, level) {
    const size = GameConfig.card.size;
    const { slots, gap, stackOffsetY } = GameConfig.tempRow;
    const total = slots * size + (slots - 1) * gap;
    return { x: (GameConfig.width - total) / 2 + i * (size + gap), y: GameConfig.pileRowY - level * stackOffsetY };
  }

  moveOut(n = 3, source = 'prop') {
    const { slot, board, tweens } = this.scene;
    const picks = slot.cards.filter((c) => !c.flying).slice(0, n);
    if (!picks.length) return this.deny('moveOut', slot.count ? '等卡落进槽里再用' : '槽里是空的');
    // 暂存区 3 格：若暂存区还有卡，新的一批叠到"现有最高一层"的上面 (压住下面的卡)
    const temps = board.cards.filter((c) => c.state === 'board' && c.zone === 'temp');
    const level = temps.length ? Math.max(...temps.map((c) => c.home.layer - 100)) + 1 : 0;
    this.tempLevel = level;
    picks.forEach((c, i) => {
      slot.remove(c);
      const p = this.tempPos(i, level);
      c.state = 'board';
      c.zone = 'temp';
      c.layer = 100 + level;
      c.home = { x: p.x, y: p.y, layer: c.layer, zone: 'temp' };
      c.flying = true; // 动画期间不参与绘制排序/点击
      tweens.to(c, { x: p.x, y: p.y, scale: 1 }, {
        duration: 0.3, delay: i * 0.05, ease: 'backOut',
        onComplete: () => { c.flying = false; },
      });
    });
    slot.relayout();
    board.refresh();
    this.invalidateUndo();
    this.events.emit(source === 'revive' ? 'revive' : 'prop:moveOut', { x: GameConfig.width / 2, y: GameConfig.pileRowY, count: picks.length });
    return true;
  }

  undo() {
    const m = this.lastMove;
    const { slot, board, tweens } = this.scene;
    if (!m) return this.deny('undo', '还没什么可撤回的');
    const c = m.card;
    if (c.state !== 'slot') return this.deny('undo', '刚消掉的撤不回来');
    slot.remove(c);
    slot.relayout();
    c.state = 'board';
    c.flying = true;
    c.onLand = null;
    c.layer = m.home.layer;
    c.zone = m.home.zone;
    c.home = { ...m.home };
    tweens.to(c, { x: m.home.x, y: m.home.y, scale: 1 }, {
      duration: 0.28, ease: 'cubicOut', arc: 20,
      onComplete: () => { c.flying = false; },
    });
    board.refresh();
    this.lastMove = null;
    this.events.emit('prop:undo', { x: m.home.x + 31, y: m.home.y + 31 });
    return true;
  }

  shuffle() {
    const { board, slot, level } = this.scene;
    if (board.remaining < 2) return this.deny('shuffle', '没剩几张了，不用洗');
    const live = board.onBoard;
    // 用"归位"坐标计算遮挡 (撤回 / 移出途中的卡以落点为准)
    const geo = live.map((c) => ({ x: c.home.x, y: c.home.y, layer: c.home.layer, type: c.type }));
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const res = solvableShuffle(geo, slot.types, createRng(seed), { maxHold: level.maxHold || 5 });
    if (res) {
      board.shuffle(Math.random, res.types, live);
      this.lastShuffle = { ok: true, tries: res.tries, order: res.order.map((i) => live[i].id) };
    } else {
      // 当前局面已无任何解 (例如卡槽里 6 张各不相同)：仍然洗，但如实提示
      board.shuffle(Math.random, null, live);
      this.lastShuffle = { ok: false, tries: 0, order: null };
      this.scene.toast('这局有点悬了…');
    }
    board.refresh();
    this.invalidateUndo();
    this.events.emit('prop:shuffle', { x: GameConfig.width / 2, y: 360 });
    return true;
  }
}
