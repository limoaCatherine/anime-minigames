// 移动平台：运动学刚体 (静态刚体 + 每步手动设置位置与速度)。
// 沿路径点按 pingpong / loop / once 移动，两点之间缓入缓出。只在生存计时阶段运动，画线时保持静止。
// 「站在上面的东西」(主角 / 敌人 / 线 / 木箱：与平台接触且质心高于平台顶面) 每步跟着平台平移同样的位移
// (保持它们自身速度不变)，比依赖 Matter 对静态刚体的摩擦更稳定、可复现。
import Matter from '../../lib/matter.js';
import { CAT } from '../../config/GameConfig.js';
import { Mechanism } from './Mechanism.js';
import { roundRectPath } from '../../ui/draw.js';

const { Bodies, Body } = Matter;
const NO_CARRY = new Set(['bee', 'paper', 'heart']);

export class MovingPlatform extends Mechanism {
  constructor(world, def) {
    super(world, def);
    const cx = def.x + def.w / 2; const cy = def.y + def.h / 2;
    this.home = { x: cx, y: cy };
    this.points = def.path.map(([dx, dy]) => ({ x: cx + dx, y: cy + dy }));
    if (def.mode === 'loop') this.points.push(this.points[0]);
    this.legs = [];
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]; const b = this.points[i];
      this.legs.push({ a, b, T: Math.max(0.05, Math.hypot(b.x - a.x, b.y - a.y) / def.speed) });
    }
    this.cycle = this.legs.reduce((s, l) => s + l.T + def.wait, 0);
    this.t = 0;
    const opts = {
      isStatic: true, label: 'platform', friction: 1, frictionStatic: 2, restitution: 0,
      collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
    };
    const p0 = this.points[0];
    if (def.lips > 0) {
      // 两端的挡边 (电梯轿厢 / 工位挡板)：防止线和主角从平台上滑落
      const lw = 10;
      const parts = [
        Bodies.rectangle(p0.x, p0.y, def.w, def.h, { chamfer: { radius: Math.min(8, def.h / 2.2) } }),
        Bodies.rectangle(p0.x - def.w / 2 + lw / 2, p0.y - def.h / 2 - def.lips / 2 + 2, lw, def.lips + 4, { chamfer: { radius: 4 } }),
        Bodies.rectangle(p0.x + def.w / 2 - lw / 2, p0.y - def.h / 2 - def.lips / 2 + 2, lw, def.lips + 4, { chamfer: { radius: 4 } }),
      ];
      const body = Body.create({ parts, ...opts });
      this.offset = { x: body.position.x - p0.x, y: body.position.y - p0.y }; // 复合体质心与平台中心的偏差
      this.addBody(body);
    } else {
      this.offset = { x: 0, y: 0 };
      this.addBody(Bodies.rectangle(p0.x, p0.y, def.w, def.h, { ...opts, chamfer: { radius: Math.min(10, def.h / 2.2) } }));
    }
  }

  /** 平台中心 (不是复合体质心) */
  get center() { return { x: this.body.position.x - this.offset.x, y: this.body.position.y - this.offset.y }; }

  /** 时间 t (秒，从开始移动算起) 时的位置 */
  posAt(t) {
    const d = this.def;
    if (!this.legs.length) return this.points[0];
    const total = this.cycle;
    let local;
    if (d.mode === 'once') local = Math.min(t, total - d.wait);
    else if (d.mode === 'pingpong') {
      const k = t % (total * 2);
      local = k;
      if (k >= total) return this._along(k - total, true);
    } else local = t % total;
    return this._along(local, false);
  }

  _along(t, reverse) {
    const d = this.def;
    const legs = this.legs;
    if (reverse) {
      // 反向：倒着走同一条路线 (停留时间也对称)
      let acc = 0;
      for (let i = legs.length - 1; i >= 0; i--) {
        const L = legs[i];
        if (t < acc + d.wait) return L.b;
        acc += d.wait;
        if (t < acc + L.T) return lerpP(L.b, L.a, this._ease((t - acc) / L.T));
        acc += L.T;
      }
      return legs[0].a;
    }
    let acc = 0;
    for (const L of legs) {
      if (t < acc + d.wait) return L.a;
      acc += d.wait;
      if (t < acc + L.T) return lerpP(L.a, L.b, this._ease((t - acc) / L.T));
      acc += L.T;
    }
    return legs[legs.length - 1].b;
  }

  _ease(k) { return this.def.ease ? k * k * (3 - 2 * k) : k; }

  /** 当前站在平台上的动态刚体 (含叠在它们上面的东西，最多 3 层；蜜蜂和投射物不算) */
  riders() {
    const plat = this.body;
    const contacts = new Map();
    for (const pair of this.world.physics.engine.pairs.list) {
      if (!pair.isActive) continue;
      const a = pair.bodyA.parent; const b = pair.bodyB.parent;
      if (!contacts.has(a)) contacts.set(a, []);
      if (!contacts.has(b)) contacts.set(b, []);
      contacts.get(a).push(b); contacts.get(b).push(a);
    }
    const out = [];
    let layer = [plat];
    for (let depth = 0; depth < 3 && layer.length; depth++) {
      const next = [];
      for (const base of layer) {
        for (const o of contacts.get(base) || []) {
          if (o.isStatic || out.includes(o) || NO_CARRY.has(o.label)) continue;
          // 1.2：按「质心高于平台顶面」判断 (以前要求整个包围盒高于平台中心，两脚垂到平台外的罩子不会被带着走，会滑落)
          const above = base === plat ? o.position.y < this.center.y - this.def.h / 2 + 2 : o.position.y < base.position.y;
          if (above) { out.push(o); next.push(o); }
        }
      }
      layer = next;
    }
    return out;
  }

  step() {
    const b = this.body;
    if (!this.running) return;
    if (this.world.time >= this.def.startAt) this.t += 1 / 60;
    const p = this.posAt(this.t);
    const c = this.center;
    const dx = p.x - c.x; const dy = p.y - c.y;
    if (!dx && !dy) return;
    const riders = this.riders();
    Body.setPosition(b, { x: b.position.x + dx, y: b.position.y + dy }); // 不写入速度：相对平台静止的东西不会被摩擦拖拽
    for (const r of riders) Body.setPosition(r, { x: r.position.x + dx, y: r.position.y + dy });
  }

  render(ctx, time, theme) {
    const d = this.def;
    // 轨道 (虚线) + 路径点
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -time * 20;
    ctx.strokeStyle = 'rgba(143,124,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    this.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of this.points) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.strokeStyle = 'rgba(143,124,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // 画线阶段：终点处显示半透明「残影」，告诉玩家平台会去哪里
    if (!this.running) {
      const far = this.points[this.points.length - 1] === this.points[0] && this.points.length > 2 ? this.points[Math.floor(this.points.length / 2)] : this.points[this.points.length - 1];
      ctx.globalAlpha = 0.28;
      drawPlatformShape(ctx, far.x, far.y, d, theme, time);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    const p = this.center;
    drawPlatformShape(ctx, p.x, p.y, d, theme, time);
  }
}

function lerpP(a, b, k) { return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }

function drawPlatformShape(ctx, cx, cy, d, theme, time) {
  const x = cx - d.w / 2; const y = cy - d.h / 2;
  ctx.save();
  if (d.lips > 0) {
    for (const lx of [x, x + d.w - 10]) {
      roundRectPath(ctx, lx, y - d.lips - 2, 10, d.lips + 6, 4);
      ctx.fillStyle = d.style === 'wood' ? '#d99c66' : d.style === 'elevator' ? '#c3cdf2' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = d.style === 'wood' ? '#a66e44' : '#8f9bd0'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  if (d.style === 'elevator') {
    // 电梯轿厢底板：金属蓝 + 指示灯
    roundRectPath(ctx, x, y, d.w, d.h, 6);
    const g = ctx.createLinearGradient(0, y, 0, y + d.h);
    g.addColorStop(0, '#eef3ff'); g.addColorStop(1, '#a9b6e6');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#6f7bb3'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - 16 + i * 16, cy + 1, 3, 0, Math.PI * 2); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 5 + i); ctx.fill(); }
  } else if (d.style === 'wood') {
    roundRectPath(ctx, x, y, d.w, d.h, 6);
    ctx.fillStyle = '#e9b783'; ctx.fill();
    ctx.strokeStyle = '#a66e44'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(140,85,50,0.45)'; ctx.lineWidth = 1.5;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + (d.w * k) / 4, y + 3); ctx.lineTo(x + (d.w * k) / 4, y + d.h - 3); ctx.stroke(); }
  } else {
    // 云朵平台
    const top = (theme && theme.platform) || '#ffffff';
    ctx.fillStyle = top;
    ctx.shadowColor = 'rgba(120,90,200,0.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    roundRectPath(ctx, x, y, d.w, d.h, d.h / 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    const n = Math.max(2, Math.round(d.w / 34));
    for (let i = 0; i < n; i++) {
      const bx = x + ((i + 0.5) * d.w) / n;
      ctx.beginPath(); ctx.arc(bx, y + 2, d.h * 0.48, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(160,140,220,0.55)'; ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, d.w, d.h, d.h / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,170,200,0.7)';
    ctx.beginPath(); ctx.arc(x + 14, cy + 2, 3, 0, Math.PI * 2); ctx.arc(x + d.w - 14, cy + 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
