// 玩家画出的线：松手后变成一个由细长矩形 (+ 关节圆) 组成的复合动态刚体，受重力下落/搁置。
import Matter from '../lib/matter.js';
import { GameConfig, CAT } from '../config/GameConfig.js';
import { dist } from '../core/geometry.js';

const { Bodies, Body } = Matter;

export class InkLine {
  /** @param {{x:number,y:number}[]} points 已简化的折线 (世界坐标) */
  constructor(physics, points) {
    const c = GameConfig.line;
    this.physics = physics;
    this.points = points.map((p) => ({ x: p.x, y: p.y }));
    const T = c.thickness;
    const filter = { category: CAT.LINE, mask: 0xffff };
    const partOpts = { density: c.density, friction: c.friction, frictionStatic: c.frictionStatic, restitution: c.restitution, collisionFilter: filter };
    const parts = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]; const b = points[i];
      const len = dist(a, b);
      if (len < 0.5) continue;
      parts.push(Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len + 1, T, { ...partOpts, angle: Math.atan2(b.y - a.y, b.x - a.x) }));
    }
    // 中间关节处补圆，避免折角处出现缝隙 (两端不加圆，平头更稳，不会像不倒翁一样摇晃)
    for (let i = 1; i < points.length - 1; i++) {
      parts.push(Bodies.circle(points[i].x, points[i].y, T / 2, partOpts, 10));
    }
    this.body = Body.create({
      parts,
      label: 'line',
      friction: c.friction,
      frictionStatic: c.frictionStatic,
      restitution: c.restitution,
      frictionAir: 0.02,
      collisionFilter: filter,
    });
    // Matter.js 计算复合刚体转动惯量时没有加平行轴项 (只把各部件自身惯量相加)，
    // 对细长的线来说惯量会小几十倍，碰撞时角速度暴涨导致线「抖动/走路」。这里手动修正。
    const c0 = this.body.position;
    let inertia = 0;
    for (const part of this.body.parts.slice(1)) {
      const dx = part.position.x - c0.x; const dy = part.position.y - c0.y;
      inertia += part.inertia + part.mass * (dx * dx + dy * dy);
    }
    Body.setInertia(this.body, inertia);
    this.body.plugin.entity = this;
    this.origin = { x: this.body.position.x, y: this.body.position.y };
    this.local = this.points.map((p) => ({ x: p.x - this.origin.x, y: p.y - this.origin.y }));
    physics.add(this.body);
    this.age = 0;
    this.length = 0;
    for (let i = 1; i < points.length; i++) this.length += dist(points[i - 1], points[i]);
  }

  /** 当前世界坐标下的折线 */
  worldPoints() {
    const { position: p, angle } = this.body;
    const cs = Math.cos(angle); const sn = Math.sin(angle);
    return this.local.map((q) => ({ x: p.x + q.x * cs - q.y * sn, y: p.y + q.x * sn + q.y * cs }));
  }

  /** 每个物理步：额外的角速度阻尼，避免线在两个支点上来回摇晃「走路」 */
  step() {
    const b = this.body;
    if (b.angularVelocity !== 0) Body.setAngularVelocity(b, b.angularVelocity * GameConfig.line.angularDamping);
  }

  update(dt) { this.age += dt; }
}
