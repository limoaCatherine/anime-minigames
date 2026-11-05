// 遮挡判定 (Layer Mask)：一张卡只要被"更高层"的任意一张在场卡牌矩形相交 (哪怕只压住一角)，
// 就视为被压住 → 变暗且不可点击。纯函数，不依赖 DOM，生成器 / 求解器 / 场景共用。
//
// 卡牌矩形 = 正面正方形 (x, y, size, size)；底部厚度只是装饰，不参与判定。
// 侧边牌堆、移出暂存区也是普通卡牌，只是层号更高、位置相互错开，所以同一套规则即可处理
// "只有最上面一张可点"。

const EPS = 0.5; // 仅接触边缘 (相邻) 不算遮挡

export function overlaps(a, b, size) {
  return a.x < b.x + size - EPS && b.x < a.x + size - EPS && a.y < b.y + size - EPS && b.y < a.y + size - EPS;
}

/** b 是否压住 a */
export function covers(b, a, size) {
  return b !== a && b.layer > a.layer && overlaps(a, b, size);
}

export class CoverSystem {
  constructor(size) {
    this.size = size;
  }

  /** 重新计算 cards 中每张 (state==='board') 卡的 free 标记；返回可点击的卡 */
  update(cards) {
    // 正在飞回牌桌 / 飞向暂存区的卡按"落点" (home) 计算，否则飞行途中下层卡会被误判为可点
    const live = cards.filter((c) => c.state === 'board')
      .map((c) => ({ c, x: c.flying && c.home ? c.home.x : c.x, y: c.flying && c.home ? c.home.y : c.y, layer: c.layer }));
    const free = [];
    for (const a of live) {
      const c = a.c;
      c.free = true;
      for (const o of live) {
        if (o !== a && covers(o, a, this.size)) { c.free = false; break; }
      }
      if (c.free) free.push(c);
    }
    return free;
  }

  /** 压住 card 的所有卡 (调试/测试用) */
  coveringOf(card, cards) {
    return cards.filter((o) => o.state === 'board' && covers(o, card, this.size));
  }
}

/**
 * 为一组静态位置预计算遮挡关系 (生成器/求解器用，避免每步 O(n²))
 * @returns {{coveredBy:number[][], covering:number[][]}} coveredBy[i] = 压住 i 的下标；covering[j] = j 压住的下标
 */
export function buildCoverGraph(items, size) {
  const n = items.length;
  const coveredBy = Array.from({ length: n }, () => []);
  const covering = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && covers(items[j], items[i], size)) {
        coveredBy[i].push(j);
        covering[j].push(i);
      }
    }
  }
  return { coveredBy, covering };
}
