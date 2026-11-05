// 危险物系统：根据关卡 hazards 数据 (type + 参数) 用工厂创建实体，逐步推进、清理、绘制。
// 新增敌人：写一个继承 Hazard 的实体类，在 FACTORY 中注册即可，关卡数据直接用新 type。
import { hazardDef } from '../config/HazardConfig.js';
import { Hive } from '../entities/Hive.js';
import { Boss, Auntie } from '../entities/Thrower.js';
import { RockSpawner } from '../entities/Rock.js';

const FACTORY = {
  hive: Hive,
  boss: Boss,
  auntie: Auntie,
  rockfall: RockSpawner,
  roller: RockSpawner,
};

export class HazardSystem {
  constructor(world, list) {
    this.world = world;
    this.list = [];
    for (const raw of list) {
      const { type, ...rest } = raw;
      const Cls = FACTORY[type];
      if (!Cls) throw new Error(`[HazardSystem] 未注册的危险物类型: ${type}`);
      this.list.push(new Cls(world, hazardDef(type, rest)));
    }
  }

  add(h) { this.list.push(h); }

  zones(margin) {
    const out = [];
    for (const h of this.list) {
      const z = h.zone();
      if (z) out.push({ x: z.x - margin, y: z.y - margin, w: z.w + margin * 2, h: z.h + margin * 2 });
    }
    return out;
  }

  step() {
    for (const h of this.list) h.step();
    if (this.list.some((h) => h.dead)) {
      for (const h of this.list) if (h.dead) h.destroy();
      this.list = this.list.filter((h) => !h.dead);
    }
  }

  /** 最近的有伤害危险物到 (x,y) 的距离 */
  nearest(x, y) {
    let best = Infinity;
    for (const h of this.list) best = Math.min(best, h.distanceTo(x, y));
    return best;
  }

  count(type) { return this.list.filter((h) => h.type === type).length; }

  onWin() { for (const h of this.list) h.onWin(); }

  render(ctx, assets, time, layer) {
    for (const h of this.list) {
      const isBack = h.type === 'hive' || h.type === 'rockfall' || h.type === 'roller';
      if ((layer === 'back') === isBack) h.render(ctx, assets, time);
    }
  }

  destroy() { for (const h of this.list) h.destroy(); this.list = []; }
}
