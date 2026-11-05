// 画线系统：处理一笔连续的手绘线。
// - 只能画一笔；墨水有限 (按长度消耗)，用完自动截断
// - 不能画进主角/敌人/蜂巢的禁画区，也不能穿过地形 (检测失败时线停住，回到合法位置可继续)
// - 落笔点稍微按进地面里 (≤ 18px) 时从最近的表面开始画 (1.3)
// - 落笔点不合法 (地面里 / 主角身上 / 禁画区) 时不会直接作废：进入「待落笔」状态，
//   手指拖到第一个合法位置时才真正开始画 (手残友好，不用精确点在空白处)
// - 手指稍微按进地面 / 障碍物里 (≤ 18px) 时，笔尖贴着表面走 (nudge)，线不会断在半路
// - 画的过程中手指擦过主角 / 敌人 / 地形的边角时，线会自动沿障碍物外侧绕过去 (detour)，而不是卡死在原地
// - 松手后把折线交给 LevelWorld.commitLine 变成刚体
import Matter from '../lib/matter.js';
import { GameConfig } from '../config/GameConfig.js';
import { dist, segmentHitsRect, pointInRect } from '../core/geometry.js';

const { Query } = Matter;

export class DrawSystem {
  constructor(world) {
    this.world = world;
    this.events = world.events;
    this.cfg = GameConfig.line;
    this.reset();
  }

  reset() {
    this.points = [];
    this.inkUsed = 0;
    this.drawing = false;
    this.armed = false;      // 按下时落点不合法：等拖到合法位置再开始
    this.blocked = null;     // 最近一次被阻挡的位置 (用于提示)
    this.blockedTime = 0;
    this.inkOut = false;
  }

  get inkLimit() { return this.world.level.ink; }
  get inkLeft() { return Math.max(0, this.inkLimit - this.inkUsed); }
  get inkRatio() { return this.inkLeft / this.inkLimit; }

  _zones() {
    return this.world.forbiddenZones();
  }

  /** 点是否可以落笔 */
  canPlace(p) {
    const W = GameConfig.width; const H = GameConfig.height;
    const r = this.cfg.thickness / 2;
    if (p.x < r || p.x > W - r || p.y < GameConfig.hudHeight + r || p.y > H - r) return false;
    if (this._zones().some((z) => pointInRect(p, z))) return false;
    const bodies = this.world.solidBodies();
    for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
      if (Query.point(bodies, { x: p.x + ox, y: p.y + oy }).length) return false;
    }
    return true;
  }

  /** 线段是否可以画 */
  canSegment(a, b) {
    if (!this.canPlace(b)) return false;
    if (this._zones().some((z) => segmentHitsRect(a, b, z))) return false;
    if (dist(a, b) > 0.5 && Query.ray(this.world.solidBodies(), a, b, this.cfg.thickness).length) return false;
    return true;
  }

  begin(p) {
    if (this.world.state !== 'draw' || this.drawing) return false;
    this.reset();
    const snapped = this.canPlace(p) ? null : this._snap(p);
    if (snapped) p = snapped;
    if (!this.canPlace(p)) {
      this.blocked = { x: p.x, y: p.y }; this.blockedTime = 0;
      this.events.emit('draw:blocked', p);
      this.armed = true;
      return true;
    }
    this.drawing = true;
    this.points.push({ x: p.x, y: p.y });
    this.events.emit('draw:start', p);
    return true;
  }

  move(p) {
    if (this.armed && this.world.state === 'draw') {
      if (!this.canPlace(p)) {
        const sp = this._snap(p);
        if (!sp) { this.blocked = { x: p.x, y: p.y }; this.blockedTime = 0; return; }
        p = sp;
      }
      this.armed = false;
      this.blocked = null;
      this.drawing = true;
      this.points.push({ x: p.x, y: p.y });
      this.events.emit('draw:start', p);
      return;
    }
    if (!this.drawing || this.inkOut) return;
    const last = this.points[this.points.length - 1];
    let d = dist(last, p);
    if (d < this.cfg.minSegment) return;
    let q = { x: p.x, y: p.y };
    if (d > this.inkLeft) { // 墨水不足：截断到剩余长度
      const k = this.inkLeft / d;
      q = { x: last.x + (p.x - last.x) * k, y: last.y + (p.y - last.y) * k };
      d = this.inkLeft;
    }
    if (!this.canSegment(last, q)) {
      const n = this._nudge(last, q);
      if (n) {
        const dn = dist(last, n);
        if (dn >= this.cfg.minSegment * 0.5 && dn <= this.inkLeft) {
          this.blocked = null;
          this.points.push(n);
          this.inkUsed += dn;
          this.events.emit('draw:ink', { used: this.inkUsed, ratio: this.inkRatio, x: n.x, y: n.y });
          if (this.inkLeft <= 0.5) { this.inkOut = true; this.events.emit('ink:empty', n); }
        }
        return;
      }
      const route = this._detour(last, q);
      if (route) {
        for (const c of route) {
          const dd = dist(this.points[this.points.length - 1], c);
          this.points.push(c);
          this.inkUsed += dd;
        }
        this.blocked = null;
        this.events.emit('draw:ink', { used: this.inkUsed, ratio: this.inkRatio, x: q.x, y: q.y });
        if (this.inkLeft <= 0.5) { this.inkOut = true; this.events.emit('ink:empty', q); }
        return;
      }
      if (!this.blocked || dist(this.blocked, p) > 20) this.events.emit('draw:blocked', p);
      this.blocked = { x: p.x, y: p.y }; this.blockedTime = 0;
      return;
    }
    this.blocked = null;
    this.points.push(q);
    this.inkUsed += d;
    this.events.emit('draw:ink', { used: this.inkUsed, ratio: this.inkRatio, x: q.x, y: q.y });
    if (this.inkLeft <= 0.5) {
      this.inkOut = true;
      this.events.emit('ink:empty', q);
    }
  }

  /** 落笔贴边 (1.3)：落笔点稍微按进地面 / 障碍物里 (≤ 18px) 时，直接从最近的表面开始画 (不用再拖出来才开始) */
  _snap(p) {
    for (const r of [3, 6, 9, 12, 15, 18]) {
      let best = null; let bestD = Infinity;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const c = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
        if (this.canPlace(c) && r < bestD) { best = c; bestD = r; }
      }
      if (best) return best;
    }
    return null;
  }

  /** 笔尖贴边：q 落在障碍物里时，在 q 周围 18px 内找一个离 q 最近、且能从 last 画过去的合法点 */
  _nudge(last, q) {
    if (this.canPlace(q)) return null;           // 落点本身合法 (是线段被挡)：交给 _detour
    let best = null; let bestD = Infinity;
    for (const r of [3, 6, 9, 12, 15, 18]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const c = { x: q.x + Math.cos(a) * r, y: q.y + Math.sin(a) * r };
        const d = dist(c, q);
        if (d < bestD && this.canSegment(last, c)) { best = c; bestD = d; }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * 绕障碍：直线 a->b 被挡住时，试着经过挡路矩形 (禁画区 / 地形包围盒，外扩半个线宽) 的 1~2 个角绕过去。
   * 只在绕路不太远 (≤ 直线距离 × 3 + 40，且 ≤ 220px) 且墨水够用时生效。返回新增的点 (含 b) 或 null。
   */
  _detour(a, b) {
    const d0 = dist(a, b);
    if (d0 > 120) return null;
    const pad = this.cfg.thickness / 2 + 2;
    const rects = this._zones().map((z) => ({ x: z.x - 2, y: z.y - 2, w: z.w + 4, h: z.h + 4 }));
    const mx = Math.min(a.x, b.x) - 160; const Mx = Math.max(a.x, b.x) + 160;
    const my = Math.min(a.y, b.y) - 160; const My = Math.max(a.y, b.y) + 160;
    for (const body of this.world.solidBodies()) {
      const bb = body.bounds;
      if (bb.max.x < mx || bb.min.x > Mx || bb.max.y < my || bb.min.y > My) continue;
      rects.push({ x: bb.min.x - pad, y: bb.min.y - pad, w: bb.max.x - bb.min.x + pad * 2, h: bb.max.y - bb.min.y + pad * 2 });
    }
    const corners = [];
    for (const r of rects) {
      if (r.x > Mx || r.x + r.w < mx || r.y > My || r.y + r.h < my) continue;
      const cs = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
      corners.push(...cs.map((c, i) => ({ ...c, next: cs[(i + 1) % 4], prev: cs[(i + 3) % 4] })));
    }
    const limit = Math.min(220, d0 * 3 + 40, this.inkLeft);
    let best = null; let bestLen = limit;
    const ok = (p, q) => this.canSegment(p, q);
    for (const c of corners) {
      const l1 = dist(a, c);
      if (l1 + dist(c, b) >= bestLen || !ok(a, c)) continue;
      if (ok(c, b)) { best = [c, b]; bestLen = l1 + dist(c, b); continue; }
      for (const c2 of [c.next, c.prev]) {
        const L = l1 + dist(c, c2) + dist(c2, b);
        if (L < bestLen && ok(c, c2) && ok(c2, b)) { best = [c, c2, b]; bestLen = L; }
      }
    }
    return best && best.map((p) => ({ x: p.x, y: p.y }));
  }

  /** 松手：p 为松手位置 (不足一个采样间隔的尾巴也补上，保证线端落在手指处) */
  /** 取消当前这一笔 (暂停 / 切到后台时)：不提交、不扣墨水 */
  cancel() {
    if (!this.drawing && !this.armed) return;
    this.reset();
    this.events.emit('draw:cancel');
  }

  end(p) {
    if (this.armed) { this.armed = false; return null; }
    if (!this.drawing) return null;
    if (p && !this.inkOut) {
      const last = this.points[this.points.length - 1];
      const d = dist(last, p);
      if (d >= 1 && d <= this.inkLeft && this.canSegment(last, p)) {
        this.points.push({ x: p.x, y: p.y });
        this.inkUsed += d;
      }
    }
    this.drawing = false;
    if (this.inkUsed < this.cfg.minLength || this.points.length < 2) {
      this.reset();
      this.events.emit('draw:cancel');
      return null;
    }
    return this.world.commitLine(this.points, this.inkUsed);
  }

  /** 直接用一组点画线 (测试 / 自动演示)：逐点走与玩家相同的检测流程 */
  drawPolyline(pts) {
    if (!this.begin(pts[0])) return { ok: false, reason: 'start-blocked', at: pts[0] };
    const startBlocked = this.armed;
    let rejected = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]; const b = pts[i];
      const n = Math.max(1, Math.ceil(dist(a, b) / (this.cfg.minSegment + 0.5)));
      for (let k = 1; k <= n; k++) {
        const before = this.points.length;
        this.move({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
        if (before > 0 && this.points.length === before && !this.inkOut && dist(this.points[before - 1], { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }) >= this.cfg.minSegment) rejected++;
      }
    }
    const inkUsed = this.inkUsed;
    const inkOut = this.inkOut;
    const line = this.end(pts[pts.length - 1]);
    return { ok: !!line && rejected === 0 && !inkOut && !startBlocked, rejected, inkUsed, inkOut, line, startBlocked };
  }

  update(dt) {
    if (this.blocked) {
      this.blockedTime += dt;
      if (this.blockedTime > 0.6) this.blocked = null;
    }
  }
}
