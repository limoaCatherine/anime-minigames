// 危险物基类：持有若干刚体，提供 update / render / 是否有伤害 / 禁画区 等接口。
export class Hazard {
  constructor(world, def) {
    this.world = world;
    this.def = def;
    this.type = def.type;
    this.dead = false;
    this.bodies = [];
    this.age = 0;
    this.teleportable = true; // 有刚体时可以穿过传送门
  }

  /** 注册刚体并加入物理世界 */
  addBody(body) {
    body.plugin.entity = this;
    this.world.physics.add(body);
    this.bodies.push(body);
    return body;
  }

  get body() { return this.bodies[0]; }

  /** 碰到主角是否算失败 */
  harmful() { return true; }

  /** 禁画区 (轴对齐矩形)，没有则返回 null */
  zone() { return null; }

  /** 与其他物体开始接触 */
  onCollide(_other) {}

  /** 每个物理步调用一次 (1/60 秒) */
  step() {}

  /** 过关：敌人撤退 */
  onWin() {}

  /** 到主角的距离 (用于害怕表情)，无刚体返回 Infinity */
  distanceTo(x, y) {
    const b = this.body;
    if (!b || !this.harmful()) return Infinity;
    return Math.hypot(b.position.x - x, b.position.y - y);
  }

  render(_ctx, _assets, _time) {}

  destroy() {
    for (const b of this.bodies) this.world.physics.remove(b);
    this.bodies = [];
  }
}
