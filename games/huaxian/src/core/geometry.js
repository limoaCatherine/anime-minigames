// 几何工具：折线长度、道格拉斯-普克简化、线段与矩形相交、抛物线瞄准等。

export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

/** 道格拉斯-普克折线简化 */
export function simplify(pts, eps) {
  if (pts.length <= 2) return pts.slice();
  let maxD = 0; let idx = 0;
  const a = pts[0]; const b = pts[pts.length - 1];
  const dx = b.x - a.x; const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / L;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [a, b];
  const left = simplify(pts.slice(0, idx + 1), eps);
  const right = simplify(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

/** 线段 ab 是否与轴对齐矩形 r{x,y,w,h} 相交 (Liang-Barsky) */
export function segmentHitsRect(a, b, r) {
  let t0 = 0; let t1 = 1;
  const dx = b.x - a.x; const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - r.x, r.x + r.w - a.x, a.y - r.y, r.y + r.h - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

export function pointInRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/**
 * 抛物线瞄准：返回初速度 (像素/物理步)，使物体在 steps 步后到达目标。
 * g 为每步的重力加速度 (像素/步²)。
 */
export function ballistic(from, to, steps, g) {
  return {
    x: (to.x - from.x) / steps,
    y: (to.y - from.y) / steps - 0.5 * g * (steps + 1),
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
