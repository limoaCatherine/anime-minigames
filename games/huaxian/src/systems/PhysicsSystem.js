// 物理系统：封装 Matter.js 引擎，固定时间步长推进，转发碰撞事件。
// 防穿透：Matter.js 没有连续碰撞检测，一步内位移超过 (物体最小半厚 + 挡板半厚) 时，
// 穿透修正会把物体推到挡板另一侧。每步之前按物体自身尺寸限速 (capSpeeds)，保证任何物体都穿不过画的线 / 最薄的地形。
// 每个物理子步之后调用 afterStep(stepIndex)，关卡逻辑 (敌人 AI / 计时) 都在这里按步推进，保证可复现。
import Matter from '../lib/matter.js';
import { GameConfig } from '../config/GameConfig.js';

const { Engine, Composite, Events, Body } = Matter;

export class PhysicsSystem {
  constructor(events) {
    const cfg = GameConfig.physics;
    this.cfg = cfg;
    this.events = events;
    this.engine = Engine.create({
      positionIterations: cfg.positionIterations,
      velocityIterations: cfg.velocityIterations,
      enableSleeping: false,
    });
    this.engine.gravity.y = cfg.gravityY;
    this.world = this.engine.world;
    this.accumulator = 0;
    this.steps = 0;
    this.capped = 0;          // 被限速的次数 (调试/测试)
    this.afterStep = null;
    this.beforeStep = null;   // 每步之前 (限速防穿透)
    this.onCollision = null; // (pairs, phase) => void

    this._start = (e) => this.onCollision && this.onCollision(e.pairs, 'start');
    this._active = (e) => this.onCollision && this.onCollision(e.pairs, 'active');
    Events.on(this.engine, 'collisionStart', this._start);
    Events.on(this.engine, 'collisionActive', this._active);
  }

  /** 每步重力加速度 (像素/步²)，用于抛物线瞄准与抵消重力 */
  get stepGravity() {
    const g = this.engine.gravity;
    return g.y * g.scale * this.cfg.timestep * this.cfg.timestep;
  }

  add(body) { Composite.add(this.world, body); return body; }

  remove(body) { Composite.remove(this.world, body); }

  /** 推进一步 (固定步长) */
  stepOnce() {
    if (this.cfg.antiTunnel) this.capSpeeds();
    if (this.beforeStep) this.beforeStep();
    Engine.update(this.engine, this.cfg.timestep);
    this.steps++;
    if (this.afterStep) this.afterStep(this.steps);
  }

  /** 按真实时间推进，多余时间累积到下一帧 */
  step(dt) {
    const ts = this.cfg.timestep;
    this.accumulator += dt * 1000;
    let n = 0;
    while (this.accumulator >= ts && n < this.cfg.maxSubSteps) {
      this.stepOnce();
      this.accumulator -= ts;
      n++;
    }
    if (n >= this.cfg.maxSubSteps) this.accumulator = 0;
  }

  destroy() {
    Events.off(this.engine, 'collisionStart', this._start);
    Events.off(this.engine, 'collisionActive', this._active);
    Composite.clear(this.world, false);
    Engine.clear(this.engine);
    this.afterStep = null;
    this.beforeStep = null;
    this.onCollision = null;
  }

  /** 刚体最小半厚 (圆 = 半径；多边形 = 中心到最近边的距离；复合刚体取各部件最小值)，结果缓存在 plugin 里 */
  static minHalf(body) {
    if (body.plugin.minHalf != null) return body.plugin.minHalf;
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    let m = Infinity;
    for (const p of parts) {
      if (p.circleRadius) { m = Math.min(m, p.circleRadius); continue; }
      const v = p.vertices;
      for (let i = 0; i < v.length; i++) {
        const a = v[i]; const b = v[(i + 1) % v.length];
        const ex = b.x - a.x; const ey = b.y - a.y; const L = Math.hypot(ex, ey) || 1;
        m = Math.min(m, Math.abs((p.position.x - a.x) * ey - (p.position.y - a.y) * ex) / L);
      }
    }
    body.plugin.minHalf = m;
    return m;
  }

  /** 限速防穿透：|v| ≤ safety × (自身最小半厚 + 可能撞到的最薄挡板的半厚) */
  capSpeeds() {
    const c = this.cfg.antiTunnel;
    for (const b of this.world.bodies) {
      if (b.isStatic || b.isSensor) continue;
      const barrier = b.label === 'line' ? c.lineBarrierHalf : c.barrierHalf;
      const max = Math.min(c.maxSpeed, c.safety * (PhysicsSystem.minHalf(b) + barrier));
      const v = b.velocity; const sp = Math.hypot(v.x, v.y);
      if (sp > max) { Body.setVelocity(b, { x: v.x * max / sp, y: v.y * max / sp }); this.capped++; }
    }
  }
}
