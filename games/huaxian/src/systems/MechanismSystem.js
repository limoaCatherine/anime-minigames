// 机关系统：根据关卡 mechanisms 数据 (type + 参数) 用工厂创建机关实体，逐步推进、提供禁画区与画线障碍、分层绘制。
// 新增机关：在 MechanismConfig 加默认参数 + 写一个继承 Mechanism 的实体类 + 在 FACTORY 注册。
import { mechanismDef } from '../config/MechanismConfig.js';
import { MovingPlatform } from '../entities/mechanisms/MovingPlatform.js';
import { Seesaw } from '../entities/mechanisms/Seesaw.js';
import { Crate } from '../entities/mechanisms/Crate.js';
import { Portal } from '../entities/mechanisms/Portal.js';
import { Spring } from '../entities/mechanisms/Spring.js';
import { GlassBlock } from '../entities/mechanisms/GlassBlock.js';
import { Windmill } from '../entities/mechanisms/Windmill.js';
import { NoDrawZone } from '../entities/mechanisms/NoDrawZone.js';

export const MECHANISM_FACTORY = {
  platform: MovingPlatform,
  seesaw: Seesaw,
  crate: Crate,
  portal: Portal,
  spring: Spring,
  glass: GlassBlock,
  windmill: Windmill,
  nodraw: NoDrawZone,
};

export class MechanismSystem {
  constructor(world, list = []) {
    this.world = world;
    this.list = [];
    for (const raw of list) {
      const { type, ...rest } = raw;
      const Cls = MECHANISM_FACTORY[type];
      if (!Cls) throw new Error(`[MechanismSystem] 未注册的机关类型: ${type}`);
      this.list.push(new Cls(world, mechanismDef(type, rest)));
    }
  }

  /** 画线时不能穿过的刚体 */
  get solidBodies() {
    const out = [];
    for (const m of this.list) for (const b of m.solid) out.push(b);
    return out;
  }

  /**
   * 禁画区 (已外扩)。
   * @param {number} margin 敌人用的完整安全边距
   * @param {number} lineHalf 线宽的一半 (禁画区只外扩这么多)
   */
  zones(margin, lineHalf) {
    const out = [];
    for (const m of this.list) {
      const zs = m.zones ? m.zones() : [m.zone()];
      const k = m.zoneMode === 'line' ? lineHalf : margin;
      for (const z of zs) if (z) out.push({ x: z.x - k, y: z.y - k, w: z.w + k * 2, h: z.h + k * 2 });
    }
    return out;
  }

  /** 可被传送的机关 (木箱) */
  teleportables() { return this.list.filter((m) => m.teleportable && m.bodies.length); }

  step() {
    for (const m of this.list) m.step();
    if (this.list.some((m) => m.dead)) {
      for (const m of this.list) if (m.dead) m.destroy();
      this.list = this.list.filter((m) => !m.dead);
    }
  }

  count(type) { return this.list.filter((m) => m.type === type).length; }

  find(type) { return this.list.find((m) => m.type === type) || null; }

  onWin() { for (const m of this.list) m.onWin(); }

  render(ctx, time, theme, layer) {
    for (const m of this.list) if (m.layer === layer) m.render(ctx, time, theme);
  }

  destroy() { for (const m of this.list) m.destroy(); this.list = []; }
}
