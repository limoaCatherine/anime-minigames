// 关卡布局生成器 (纯逻辑，无 DOM，可在 Node 中单测)。
//
// 生成步骤 ("反向放置"思路，保证一定有解)：
//  1. 按 LevelConfig 的层模板 + 侧边牌堆算出全部卡位 (x, y, layer, zone)；总数裁成 3 的倍数
//  2. 模拟"把桌面清空"的过程：每次从当前可点击的卡位中随机取走一个，得到一个合法的取牌顺序 order
//  3. 沿 order 依次给卡位分配花色，同时模拟一个虚拟卡槽：
//       - 以概率 pNew "开启新花色" (槽内 +1)，否则把槽里已有的某个花色补到 2/3 张 (满 3 张即消除)
//       - 槽内滞留数永远 ≤ maxHold (≤6)，所以按 order 取牌时 7 格卡槽永远不会填满
//       - 每种花色的总张数都是 3 的倍数 (以"三张一组"为单位分配)
//  4. 结果：order 就是一条参考解 (solution)。maxHold / pNew 越大，参考解越"憋"，玩家越难找到解
import { GameConfig } from '../config/GameConfig.js';
import { buildCoverGraph } from './CoverSystem.js';
import { createRng } from '../core/Random.js';
import { getShape, OFFSET_MODES } from '../config/PatternLibrary.js';

/** 字符串 -> 32 位种子 (散落模式的位置随关卡固定) */
function hashSeed(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * 由关卡定义计算全部卡位。
 * 关卡写法 A (图案库)：{ pattern:'heart', mode:'half', layers:5, shrink:0.08, fill:3 }
 * 关卡写法 B (手绘层)：{ layers:[{ ox, oy, rows:['X.X', ...] }, ...] }
 */
export function buildPositions(level, cfg = GameConfig) {
  const pos = Array.isArray(level.layers) ? buildFromAscii(level, cfg) : buildFromPattern(fitLevel(level, cfg), cfg);
  const size = cfg.card.size;
  for (const p of level.piles || []) {
    for (let i = 0; i < p.count; i++) {
      const x = p.side === 'left'
        ? cfg.pileMarginX + i * cfg.pileStep
        : cfg.width - cfg.pileMarginX - size - i * cfg.pileStep;
      pos.push({ x, y: cfg.pileRowY, layer: 40 + i, zone: 'pile', side: p.side });
    }
  }
  return trimPositions(pos, level, cfg);
}

/**
 * 自动适配张数 (关卡给了 maxCards 时)：
 *  - 没写 shrink：底层保持完整大图案 (scale 默认 1)，自动选择"每层收缩比例"，让上层像金字塔一样往中间收，
 *    使自然生成的张数刚好不少于目标 —— 轮廓完整、几乎不用裁剪
 *  - 写了 shrink 但没写 scale：自动选择整体缩放比例
 */
const fitCache = new WeakMap();
function fitLevel(level, cfg) {
  if (!level.maxCards || level.mode === 'scatter' || level.mode === 'tower') return level;
  if (level.scale != null && level.shrink != null) return level;
  if (fitCache.has(level)) return fitCache.get(level);
  const piles = (level.piles || []).reduce((a, p) => a + p.count, 0);
  const target = level.maxCards - piles;
  const count = (o) => buildFromPattern({ ...level, ...o }, cfg).length;
  let best = null;
  const consider = (o) => {
    const n = count(o);
    if (n >= target && (!best || n < best.n)) best = { ...o, n };
  };
  if (level.shrink == null) {
    const scale = level.scale != null ? level.scale : 1;
    for (let k = 0; k <= 0.5001; k += 0.01) consider({ scale, shrink: Math.round(k * 100) / 100 });
    if (!best || best.n > target * 1.2) for (let sc = 1; sc >= 0.5; sc -= 0.025) consider({ scale: sc, shrink: 0.3 });
  } else {
    for (let sc = 1; sc >= 0.4; sc -= 0.025) consider({ scale: Math.round(sc * 1000) / 1000, shrink: level.shrink });
  }
  const fitted = best ? { ...level, scale: best.scale, shrink: best.shrink } : { ...level, scale: level.scale || 1, shrink: level.shrink || 0 };
  fitCache.set(level, fitted);
  return fitted;
}

function buildFromAscii(level, cfg) {
  const { unit, left, top } = cfg.board;
  const pos = [];
  level.layers.forEach((layer, li) => {
    layer.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== 'X' && row[c] !== 'x') continue;
        pos.push({ x: left + (layer.ox + 2 * c) * unit, y: top + (layer.oy + 2 * r) * unit, layer: li, zone: 'board' });
      }
    });
  });
  return pos;
}

function buildFromPattern(level, cfg) {
  const { unit, left, top, cols, rows } = cfg.board;
  const shape = getShape(level.pattern);
  const mode = OFFSET_MODES[level.mode || 'half'];
  const fill = level.fill || shape.fill || 3;
  const layers = level.layers || 3;
  const shrink = level.shrink || 0;
  const scale = level.scale || 1;      // 整体缩放 (小关卡用较小的图案，保持轮廓完整)
  const hx = cols / 2;
  const hy = rows / 2;
  // 一张卡 (左上角在 gx, gy 半卡单位) 的 4 个采样点有几个落在 (缩放后的) 形状内
  const hits = (gx, gy, s) => {
    let n = 0;
    for (const [dx, dy] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]]) {
      const u = (gx + dx - hx) / hx / s;
      const v = (gy + dy - hy) / hy / s;
      if (shape.inside(u, v)) n++;
    }
    return n;
  };
  const toPx = (gx, gy, L, extra = {}) => ({ x: left + gx * unit, y: top + gy * unit, layer: L, zone: 'board', ...extra });
  const pos = [];

  if (level.mode === 'tower') {
    // 高塔：若干固定塔位，每层在同一塔位上叠一张，并向上错开一点；越靠中心的塔越高
    const step = level.towerStep || 2.6;
    const lift = level.towerLift || 0.24;
    const bases = [];
    for (let gy = rows - 2 - 0.2; gy >= layers * lift; gy -= step + 0.4) {
      for (let gx = 0.2; gx <= cols - 2; gx += step) {
        if (hits(gx, gy, scale) >= fill) bases.push([gx, gy]);
      }
    }
    for (const [gx, gy] of bases) {
      const r = Math.hypot((gx + 1 - hx) / hx, (gy + 1 - hy) / hy);
      const h = Math.max(2, Math.round(layers - r * (level.towerFalloff || 3)));
      for (let L = 0; L < h; L++) pos.push(toPx(gx, gy - L * lift, L));
    }
    return pos;
  }

  if (level.mode === 'scatter') {
    // 随机散落：每层在形状内随机撒卡 (同层互不重叠)，层越高越收缩；位置由关卡 id 决定 (每次相同)
    const rng = createRng(hashSeed(`scatter-${level.id}`));
    for (let L = 0; L < layers; L++) {
      const s = scale * Math.max(0.3, 1 - L * shrink);
      const placed = [];
      const want = level.perLayer || 20;
      for (let tries = 0; tries < 1500 && placed.length < want; tries++) {
        const gx = Math.round(rng.next() * (cols - 2) * 4) / 4;
        const gy = Math.round(rng.next() * (rows - 2) * 4) / 4;
        if (hits(gx, gy, s) < 4) continue;
        if (placed.some(([x, y]) => Math.abs(x - gx) < 2 && Math.abs(y - gy) < 2)) continue;
        placed.push([gx, gy]);
      }
      for (const [gx, gy] of placed) pos.push(toPx(gx, gy, L));
    }
    return pos;
  }

  for (let L = 0; L < layers; L++) {
    const s = scale * Math.max(0.25, 1 - L * shrink);
    const [ox, oy] = mode.offset(L);
    let row = 0;
    for (let gy = oy; gy <= rows - 2 + 1e-9; gy += 2, row++) {
      const shift = mode.brick && row % 2 ? 1 : 0;
      for (let gx = ox + shift; gx <= cols - 2 + 1e-9; gx += 2) {
        if (hits(gx, gy, s) >= fill) pos.push(toPx(gx, gy, L));
      }
    }
  }
  return pos;
}

/**
 * 裁剪到 3 的倍数 (以及关卡的 maxCards)，尽量不破坏图案轮廓：
 *  1) 先去掉"被上层完全盖住"的底层卡 (玩家开局本来就看不见)，从靠中心的开始
 *  2) 不够再从最顶层去掉离中心最远的卡
 */
function trimPositions(pos, level, cfg) {
  let target = pos.length - (pos.length % 3);
  if (level.maxCards) target = Math.min(target, level.maxCards - (level.maxCards % 3));
  if (pos.length <= target) return pos;
  const size = cfg.card.size;
  const cx = cfg.board.left + cfg.board.cols * cfg.board.unit / 2 - size / 2;
  const cy = cfg.board.top + cfg.board.rows * cfg.board.unit / 2 - size / 2;
  const dist = (p) => Math.hypot(p.x - cx, p.y - cy);
  const board = pos.map((p, i) => ({ i, p })).filter((o) => o.p.zone === 'board');
  // 被完全遮住：4 个角附近的采样点都落在某张更高层的卡里
  const inside = (q, x, y) => x > q.x && x < q.x + size && y > q.y && y < q.y + size;
  const hidden = (o) => [[3, 3], [size - 3, 3], [3, size - 3], [size - 3, size - 3], [size / 2, size / 2]]
    .every(([dx, dy]) => board.some((u) => u.p.layer > o.p.layer && inside(u.p, o.p.x + dx, o.p.y + dy)));
  const need = pos.length - target;
  const drop = new Set();
  const covered = board.filter(hidden).sort((a, b) => a.p.layer - b.p.layer || dist(a.p) - dist(b.p));
  for (const o of covered) { if (drop.size >= need) break; drop.add(o.i); }
  if (drop.size < need) {
    const rest = board.filter((o) => !drop.has(o.i)).sort((a, b) => b.p.layer - a.p.layer || dist(b.p) - dist(a.p));
    for (const o of rest) { if (drop.size >= need) break; drop.add(o.i); }
  }
  return pos.filter((_, i) => !drop.has(i));
}

/** 随机得到一条合法的"清空桌面"顺序 (每一步取的都是当时未被压住的卡) */
export function randomClearOrder(pos, rng, size) {
  const { coveredBy, covering } = buildCoverGraph(pos, size);
  const blockers = coveredBy.map((l) => l.length);
  const free = [];
  for (let i = 0; i < pos.length; i++) if (blockers[i] === 0) free.push(i);
  const order = [];
  while (free.length) {
    const k = rng.int(free.length);
    const i = free[k];
    free[k] = free[free.length - 1];
    free.pop();
    order.push(i);
    for (const j of covering[i]) if (--blockers[j] === 0) free.push(j);
  }
  return order;
}

/** 沿取牌顺序分配花色 (见文件头说明) */
export function assignTypes(order, typeCount, rng, { maxHold = 4, pNew = 0.5 } = {}) {
  const n = order.length;
  const triples = n / 3;
  // 每种花色分到的"组数" (1 组 = 3 张)，尽量平均，多出来的随机分给几种花色
  const pool = new Array(typeCount).fill(Math.floor(triples / typeCount));
  const rest = rng.shuffle([...Array(typeCount).keys()]).slice(0, triples % typeCount);
  for (const t of rest) pool[t]++;
  maxHold = Math.max(1, Math.min(6, maxHold));

  const types = new Array(n);
  const open = new Map(); // type -> 槽内张数 (1|2)
  let hold = 0;
  let peak = 0;
  for (let k = 0; k < n; k++) {
    const remaining = n - k;
    let need = 0;
    for (const c of open.values()) need += 3 - c;
    const candidates = [];
    for (let t = 0; t < typeCount; t++) if (pool[t] > 0 && !open.has(t)) candidates.push(t);
    let hasTwo = false;
    for (const c of open.values()) if (c === 2) hasTwo = true;
    // 槽内滞留数始终 ≤ maxHold；滞留数顶到 maxHold 时，必须保证有一种花色已有 2 张 (下一步可以凑满消除)
    const roomFor1 = hold + 1 < maxHold || (hold + 1 === maxHold && hasTwo);
    const canOpen = candidates.length > 0 && roomFor1 && need + 3 <= remaining;
    const mustOpen = open.size === 0;
    let t;
    if (mustOpen || (canOpen && rng.next() < pNew)) {
      // 开新花色：按剩余组数加权
      const total = candidates.reduce((a, c) => a + pool[c], 0);
      let r = rng.next() * total;
      t = candidates[candidates.length - 1];
      for (const c of candidates) { r -= pool[c]; if (r < 0) { t = c; break; } }
      pool[t]--;
      open.set(t, 1);
      hold++;
    } else {
      // 补已有花色：1→2 张会让滞留数 +1，只有没顶满时才允许；2→3 张直接消除，总是允许
      const keys = [...open.keys()].filter((k) => open.get(k) === 2 || hold + 1 <= maxHold);
      t = keys[rng.int(keys.length)];
      const c = open.get(t) + 1;
      if (c === 3) { open.delete(t); hold -= 2; } else { open.set(t, c); hold++; }
    }
    peak = Math.max(peak, hold);
    types[order[k]] = t;
  }
  return { types, peakHold: peak };
}

/**
 * 生成一个关卡
 * @returns {{cards:{id,type,x,y,layer,zone,side}[], solution:number[], stats:object}}
 */
export function generateLevel(level, seed = Date.now(), cfg = GameConfig) {
  const rng = createRng(seed);
  const size = cfg.card.size;
  const pos = buildPositions(level, cfg);
  const order = randomClearOrder(pos, rng, size);
  if (order.length !== pos.length) throw new Error('[LayoutGenerator] 布局存在循环遮挡，无法清空');
  const { types, peakHold } = assignTypes(order, level.types, rng, level);
  const cards = pos.map((p, i) => ({ id: i, type: types[i], ...p }));
  const counts = new Array(level.types).fill(0);
  for (const t of types) counts[t]++;
  return {
    cards,
    solution: order,
    stats: {
      total: cards.length,
      layers: Math.max(...pos.filter((p) => p.zone === 'board').map((p) => p.layer)) + 1,
      pattern: level.pattern || 'custom',
      board: pos.filter((p) => p.zone === 'board').length,
      piles: pos.filter((p) => p.zone === 'pile').length,
      types: level.types,
      counts,
      peakHold,
      seed,
    },
  };
}
