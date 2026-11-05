// 机关基类：持有若干刚体，提供 step / render / 禁画区 / 碰撞回调等接口 (与 Hazard 的接口保持一致)。
//   solid  : 画线时视为障碍的刚体 (线不能穿过)
//   layer  : 'back' (地形之前，如禁画区/轨道) | 'mid' (地形之后、敌人之前)
export class Mechanism {
  constructor(world, def) {
    this.world = world;
    this.def = def;
    this.type = def.type;
    this.bodies = [];
    this.solid = [];
    this.dead = false;
    this.layer = 'mid';
    this.teleportable = false;
  }

  addBody(body, solid = true) {
    body.plugin.entity = this;
    this.world.physics.add(body);
    this.bodies.push(body);
    if (solid) this.solid.push(body);
    return body;
  }

  removeBody(body) {
    this.world.physics.remove(body);
    this.bodies = this.bodies.filter((b) => b !== body);
    this.solid = this.solid.filter((b) => b !== body);
  }

  get body() { return this.bodies[0]; }

  /** 是否正在计时 (机关只在生存阶段运动) */
  get running() { return this.world.state === 'survive' || this.world.state === 'won' || this.world.state === 'lost'; }

  /** 碰到主角是否算失败 */
  harmful() { return false; }

  /** 禁画区 (轴对齐矩形，未外扩)，没有返回 null */
  zone() { return null; }

  /** 禁画区外扩方式：'full' = 与敌人相同的安全边距；'line' = 只外扩线宽的一半 (区域边缘可紧贴着画) */
  get zoneMode() { return 'full'; }

  /** 碰撞开始 (物理解算之前)。pair.isActive = false 可以让这一步不发生碰撞 */
  onCollide(_other, _pair) {}

  /** 每个物理步 (1/60 秒) */
  step() {}

  /** 关卡结束后的清理/动画 */
  onWin() {}

  render(_ctx, _time, _theme) {}

  destroy() {
    for (const b of this.bodies) this.world.physics.remove(b);
    this.bodies = [];
    this.solid = [];
  }
}
