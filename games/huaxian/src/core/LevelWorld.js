// 关卡世界：一关的纯模拟部分 (物理 + 地形 + 主角 + 敌人 + 画线 + 生存判定)，不含任何绘制代码。
// GameScene 负责渲染与界面；自动化测试 (tools/verify_levels.mjs) 直接在 Node 里跑它来验证关卡可解。
// 状态: draw (画线中，物理暂停) -> survive (倒计时) -> won / lost
import { GameConfig } from '../config/GameConfig.js';
import { Random } from './Random.js';
import { simplify } from './geometry.js';
import { PhysicsSystem } from '../systems/PhysicsSystem.js';
import { TerrainSystem } from '../systems/TerrainSystem.js';
import { HazardSystem } from '../systems/HazardSystem.js';
import { MechanismSystem } from '../systems/MechanismSystem.js';
import { DrawSystem } from '../systems/DrawSystem.js';
import { SurvivalSystem, computeStars } from '../systems/SurvivalSystem.js';
import { Heroine } from '../entities/Heroine.js';
import { InkLine } from '../entities/InkLine.js';

export class LevelWorld {
  /**
   * @param {object} level 经过 resolveLevel() 的关卡数据
   * @param {import('./EventBus.js').EventBus} events
   * @param {number} [seed]
   */
  constructor(level, events, seed = 1) {
    this.level = level;
    this.events = events;
    this.rng = new Random(seed * 7919 + level.id * 104729);
    this.state = 'draw';
    this.time = 0;            // 生存计时 (秒)
    this.result = null;
    this.line = null;
    this.scared = false;
    this.scaredSince = 0;
    this.hintUsed = false;    // 本次挑战看过提示 -> 星级封顶 GameConfig.hintMaxStars

    this.physics = new PhysicsSystem(events);
    this.terrain = new TerrainSystem(this.physics, level.terrain);
    this.mechanisms = new MechanismSystem(this, level.mechanisms || []);
    this.heroine = new Heroine(this.physics, level.heroine.x, level.heroine.y);
    this.hazards = new HazardSystem(this, level.hazards);
    this.drawing = new DrawSystem(this);
    this.survival = new SurvivalSystem(this);

    this.physics.onCollision = (pairs, phase) => this.onCollision(pairs, phase);
    this.physics.afterStep = () => this.afterStep();
  }

  /** 禁画区：主角 + 敌人 + 蜂巢 + 机关 (传送门 / 风车 / 禁画区)，已按线宽外扩 */
  forbiddenZones() {
    const c = GameConfig.line;
    const margin = c.zoneMargin + c.thickness / 2;
    return [this.heroine.zone(margin), ...this.hazards.zones(margin), ...this.mechanisms.zones(margin, c.thickness / 2)];
  }

  /** 画线时不能穿过的刚体：地形 + 实体机关 (平台 / 跷跷板 / 木箱 / 玻璃 / 弹簧) */
  solidBodies() {
    return this.terrain.solidBodies.concat(this.mechanisms.solidBodies);
  }

  /** 可以穿过传送门的实体 (有刚体的敌人 / 石头 / 投射物 / 木箱) */
  teleportables() {
    return this.hazards.list.filter((h) => h.teleportable && h.bodies.length).concat(this.mechanisms.teleportables());
  }

  spawn(entity) { this.hazards.add(entity); }

  commitLine(points, inkUsed) {
    if (this.state !== 'draw') return null;
    const simple = simplify(points, GameConfig.line.simplify);
    this.line = new InkLine(this.physics, simple);
    this.inkUsed = inkUsed;
    // 1.3：三星还要求线和她保持一点距离 (不能把线直接贴在她身上当罩子)
    this.clearance = polylineClearance(points, this.heroine.zone(0));
    this.state = 'survive';
    this.time = 0;
    this.events.emit('line:commit', { points: this.line.worldPoints(), length: inkUsed });
    this.events.emit('level:survive', { time: this.level.time });
    return this.line;
  }

  /**
   * 三星需要的最小间距 (线中心到她的禁画区，px)。关卡可用 clearance 覆盖；
   * 默认：教学关 (1~3) 不要求，其余 = 参考解法间距 × 0.65 (最多 40)
   */
  clearanceNeed() {
    if (this._clearNeed != null) return this._clearNeed;
    const L = this.level;
    if (L.clearance != null) this._clearNeed = L.clearance;
    else if (L.id <= 3) this._clearNeed = 0;
    else this._clearNeed = Math.min(40, Math.floor(polylineClearance(L.solution, this.heroine.zone(0)) * 0.65));
    return this._clearNeed;
  }

  win() {
    if (this.state !== 'survive') return;
    this.state = 'won';
    let raw = computeStars(this.inkUsed, this.level);
    const need = this.clearanceNeed();
    const tooClose = raw >= 3 && need > 0 && this.clearance < need;
    if (tooClose) raw = 2;
    const stars = this.hintUsed ? Math.min(raw, GameConfig.hintMaxStars) : raw;
    this.result = { win: true, stars, inkUsed: this.inkUsed, hintCapped: stars < raw, tooClose };
    this.heroine.setExpression('happy');
    this.hazards.onWin();
    this.mechanisms.onWin();
    this.events.emit('level:win', { stars, hintCapped: stars < raw, tooClose, inkUsed: this.inkUsed, x: this.heroine.x, y: this.heroine.feetY - 120 });
  }

  lose(info) {
    if (this.state !== 'survive') return;
    this.state = 'lost';
    this.result = { win: false, by: info.type };
    this.heroine.setExpression('lose');
    this.heroine.shake = 0.5;
    this.events.emit('level:lose', { ...info, hx: this.heroine.x, hy: this.heroine.feetY - 120 });
  }

  onCollision(pairs, phase) {
    if (phase === 'start') {
      for (const pair of pairs) {
        const a = pair.bodyA.parent; const b = pair.bodyB.parent;
        const ea = a.plugin.entity; const eb = b.plugin.entity;
        if (ea && ea.onCollide) ea.onCollide(b, pair);
        if (eb && eb.onCollide) eb.onCollide(a, pair);
        // 蜜蜂撞线 -> 特效/音效事件
        if ((a.label === 'bee' && b.label === 'line') || (b.label === 'bee' && a.label === 'line')) {
          const s = pair.collision.supports && pair.collision.supports[0];
          if (s) this.events.emit('bee:bounce', { x: s.x, y: s.y });
        }
      }
    }
    this.survival.onPairs(pairs);
  }

  afterStep() {
    this.mechanisms.step();
    if (this.line) this.line.step();
    this.hazards.step();
    this.survival.step();
    // 害怕表情：危险物靠近
    if (this.state === 'survive') {
      const near = this.hazards.nearest(this.heroine.x, this.heroine.y) < GameConfig.heroine.scaredRadius;
      if (near && !this.scared) {
        this.scared = true;
        this.heroine.setExpression('scared');
        this.events.emit('heroine:scared', { x: this.heroine.x, y: this.heroine.feetY - 120 });
      } else if (!near && this.scared && this.heroine.exprTime > 0.8) {
        this.scared = false;
        this.heroine.setExpression('idle');
      }
    }
    // 掉出世界的线
    if (this.line && this.line.body.position.y > GameConfig.physics.killY + 300) {
      this.physics.remove(this.line.body);
    }
  }

  /** 按真实时间推进 (draw 状态下物理暂停) */
  update(dt) {
    this.drawing.update(dt);
    this.heroine.update(dt);
    if (this.line) this.line.update(dt);
    if (this.state === 'draw') return;
    this.physics.step(dt);
  }

  /** 无渲染快速模拟 n 秒 (测试用) */
  simulate(seconds) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) {
      this.physics.stepOnce();
      this.heroine.update(1 / 60);
    }
  }

  destroy() {
    this.hazards.destroy();
    this.mechanisms.destroy();
    this.physics.destroy();
  }
}

/** 折线到矩形的最近距离 (每段取 10 个采样点) */
export function polylineClearance(pts, z) {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[Math.min(i + 1, pts.length - 1)];
    for (let k = 0; k <= 10; k++) {
      const x = a.x + ((b.x - a.x) * k) / 10; const y = a.y + ((b.y - a.y) * k) / 10;
      const dx = Math.max(z.x - x, 0, x - (z.x + z.w)); const dy = Math.max(z.y - y, 0, y - (z.y + z.h));
      m = Math.min(m, Math.hypot(dx, dy));
    }
  }
  return m;
}
