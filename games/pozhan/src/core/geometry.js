// 热区几何：圆 / 多边形 / 矩形命中检测 (归一化坐标)。
// 坐标约定：x 相对场景宽，y 相对场景高；圆半径 r 相对场景宽 (aspect = 高/宽)。
export function shapeOf(z) {
  if (z.c) return { kind: 'circle', c: z.c, r: z.r };
  if (z.poly) return { kind: 'poly', pts: z.poly };
  if (z.rect) { const [x, y, w, h] = z.rect; return { kind: 'poly', pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] }; }
  return null;
}

/** 点 (nx, ny) 到热区边界的"带符号距离"(以场景宽为单位，负数 = 在内部) */
export function signedDist(z, nx, ny, aspect) {
  const s = shapeOf(z);
  if (!s) return Infinity;
  if (s.kind === 'circle') {
    const dx = nx - s.c[0]; const dy = (ny - s.c[1]) * aspect;
    return Math.hypot(dx, dy) - s.r;
  }
  const pts = s.pts.map(([x, y]) => [x, y * aspect]);
  const px = nx; const py = ny * aspect;
  let inside = false; let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    best = Math.min(best, segDist(px, py, xi, yi, xj, yj));
  }
  return inside ? -best : best;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function contains(z, nx, ny, aspect, pad = 0) { return signedDist(z, nx, ny, aspect) <= pad; }

/** 热区中心 (归一化) */
export function centerOf(z) {
  const s = shapeOf(z);
  if (s.kind === 'circle') return [s.c[0], s.c[1]];
  const n = s.pts.length;
  return [s.pts.reduce((a, p) => a + p[0], 0) / n, s.pts.reduce((a, p) => a + p[1], 0) / n];
}

/** 热区的近似半径 (以场景宽为单位) */
export function radiusOf(z, aspect) {
  const s = shapeOf(z);
  if (s.kind === 'circle') return s.r;
  const [cx, cy] = centerOf(z);
  return Math.max(...s.pts.map(([x, y]) => Math.hypot(x - cx, (y - cy) * aspect)));
}

/** 包围盒 [minx, miny, maxx, maxy] (归一化) */
export function boundsOf(z, aspect) {
  const s = shapeOf(z);
  if (s.kind === 'circle') return [s.c[0] - s.r, s.c[1] - s.r / aspect, s.c[0] + s.r, s.c[1] + s.r / aspect];
  const xs = s.pts.map((p) => p[0]); const ys = s.pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** 两个热区的最小间距 (以场景宽为单位，负数 = 重叠)，采样近似 */
export function gapBetween(a, b, aspect) {
  const sample = (z) => {
    const s = shapeOf(z);
    if (s.kind === 'circle') return Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return [s.c[0] + Math.cos(t) * s.r, s.c[1] + (Math.sin(t) * s.r) / aspect]; }).concat([s.c]);
    const out = [];
    for (let i = 0; i < s.pts.length; i++) {
      const [ax, ay] = s.pts[i]; const [bx, by] = s.pts[(i + 1) % s.pts.length];
      for (let k = 0; k < 12; k++) out.push([ax + ((bx - ax) * k) / 12, ay + ((by - ay) * k) / 12]);
    }
    out.push(centerOf(z));
    return out;
  };
  let best = Infinity;
  for (const [x, y] of sample(a)) best = Math.min(best, signedDist(b, x, y, aspect));
  for (const [x, y] of sample(b)) best = Math.min(best, signedDist(a, x, y, aspect));
  return best;
}
