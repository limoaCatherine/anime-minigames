// 均匀空间网格 + 圆形碰撞查询 (不用物理引擎)。
// 每帧 clear() 后重新 insert()；格子用 head/next 两个 Int32Array 组成链表，零分配。
// 世界坐标会以玩家为中心滚动，所以网格按「相对原点」取模映射到定长数组 (哈希冲突只会多检查几个对象，不影响正确性)。
export class SpatialGrid {
  constructor(cellSize = 64, maxItems = 1024, buckets = 4096) {
    this.cell = cellSize;
    this.inv = 1 / cellSize;
    this.buckets = buckets;
    this.mask = buckets - 1;              // buckets 必须是 2 的幂
    this.head = new Int32Array(buckets).fill(-1);
    this.next = new Int32Array(maxItems);
    this.items = new Array(maxItems);
    this.count = 0;
    this.touched = new Int32Array(buckets);
    this.touchedCount = 0;
  }

  clear() {
    for (let i = 0; i < this.touchedCount; i++) this.head[this.touched[i]] = -1;
    this.touchedCount = 0;
    this.count = 0;
  }

  key(cx, cy) { return ((cx * 73856093) ^ (cy * 19349663)) & this.mask; }

  /** 按中心点插入 (对象半径小于格子尺寸时足够；查询时会把半径算进搜索范围) */
  insert(obj) {
    if (this.count >= this.items.length) return;
    const id = this.count++;
    this.items[id] = obj;
    const k = this.key(Math.floor(obj.x * this.inv), Math.floor(obj.y * this.inv));
    if (this.head[k] === -1) this.touched[this.touchedCount++] = k;
    this.next[id] = this.head[k];
    this.head[k] = id;
  }

  /** 圆形查询：把与圆 (x,y,r) 相交 (考虑对象半径 obj.r，最大 maxR) 的对象写入 out，返回数量 */
  queryCircle(x, y, r, out, maxObjR = 40) {
    const rr = r + maxObjR;
    const x0 = Math.floor((x - rr) * this.inv); const x1 = Math.floor((x + rr) * this.inv);
    const y0 = Math.floor((y - rr) * this.inv); const y1 = Math.floor((y + rr) * this.inv);
    let n = 0;
    const span = (x1 - x0 + 1) * (y1 - y0 + 1);
    const seenMark = ++this._mark || (this._mark = 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let id = this.head[this.key(cx, cy)];
        while (id !== -1) {
          const o = this.items[id];
          id = this.next[id];
          if (span > 1 && o._qmark === seenMark) continue;   // 哈希冲突导致的重复
          o._qmark = seenMark;
          const dx = o.x - x; const dy = o.y - y; const R = r + (o.r || 0);
          if (dx * dx + dy * dy <= R * R) out[n++] = o;
        }
      }
    }
    return n;
  }

  /** 最近的对象 (maxR 内)；filter 可选 */
  nearest(x, y, maxR, filter = null) {
    let best = null; let bd = maxR * maxR;
    const cells = Math.ceil(maxR * this.inv);
    const ccx = Math.floor(x * this.inv); const ccy = Math.floor(y * this.inv);
    for (let ring = 0; ring <= cells; ring++) {
      for (let cy = ccy - ring; cy <= ccy + ring; cy++) {
        for (let cx = ccx - ring; cx <= ccx + ring; cx++) {
          if (ring > 0 && cy !== ccy - ring && cy !== ccy + ring && cx !== ccx - ring && cx !== ccx + ring) continue;
          let id = this.head[this.key(cx, cy)];
          while (id !== -1) {
            const o = this.items[id];
            id = this.next[id];
            if (filter && !filter(o)) continue;
            const dx = o.x - x; const dy = o.y - y; const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = o; }
          }
        }
      }
      // 已找到且下一圈不可能更近时提前结束
      if (best && (ring * this.cell) * (ring * this.cell) > bd) break;
    }
    return best;
  }

  /** 统计 (x,y) 半径 r 内的对象数量 */
  countCircle(x, y, r) {
    let n = 0;
    const x0 = Math.floor((x - r) * this.inv); const x1 = Math.floor((x + r) * this.inv);
    const y0 = Math.floor((y - r) * this.inv); const y1 = Math.floor((y + r) * this.inv);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      let id = this.head[this.key(cx, cy)];
      while (id !== -1) {
        const o = this.items[id]; id = this.next[id];
        const dx = o.x - x; const dy = o.y - y;
        if (dx * dx + dy * dy <= r2) n++;
      }
    }
    return n;
  }

  /** range 范围内敌人最密集的格子中心 (血蔷薇 / 流星落点用)；没有对象时返回 null */
  densest(x, y, range, out = { x: 0, y: 0, n: 0 }) {
    const c = this.cell * 2;               // 用 2×2 格的块统计
    let best = 0;
    for (let i = 0; i < this.count; i++) {
      const o = this.items[i];
      const dx = o.x - x; const dy = o.y - y;
      if (dx * dx + dy * dy > range * range) continue;
      const n = this.countCircle(o.x, o.y, c * 0.6);
      if (n > best) { best = n; out.x = o.x; out.y = o.y; }
      if (i > 120 && best >= 6) break;     // 足够密集就不再找 (控制开销)
    }
    out.n = best;
    return best > 0 ? out : null;
  }
}
