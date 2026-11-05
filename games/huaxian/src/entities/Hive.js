// 蜂巢 (x, y 为巢体中心)：挂在空中的装饰物 (无碰撞，但禁止在其上画线)。生存计时开始后按间隔放出蜜蜂。
import { hazardDef } from '../config/HazardConfig.js';
import { Hazard } from './Hazard.js';
import { Bee } from './Bee.js';

const HIVE_ASPECT = 322 / 442; // 图片高/宽

export class Hive extends Hazard {
  constructor(world, def) {
    super(world, def);
    this.x = def.x;
    this.y = def.y;
    this.w = def.drawW;
    this.h = def.drawW * HIVE_ASPECT;
    this.spawned = 0;
    this.nextAt = def.delay;
    this.beeDef = hazardDef('bee', { ...(def.bee || {}), ...(def.route ? { route: def.route } : {}) });
    this.pulse = 0;
  }

  get hole() {
    return { x: this.x + this.def.holeX * this.w, y: this.y + this.def.holeY * this.h };
  }

  zone() {
    return { x: this.x - this.w * 0.5, y: this.y - this.h * 0.6, w: this.w, h: this.h };
  }

  harmful() { return false; }

  step() {
    const w = this.world;
    if (this.pulse > 0) this.pulse -= 1 / 60;
    if (w.state !== 'survive') return;
    while (this.spawned < this.def.count && w.time >= this.nextAt) {
      const r = w.rng;
      const hole = this.hole;
      const aim = this.def.route ? { x: this.def.route[0][0], y: this.def.route[0][1] } : w.heroine;
      const a = Math.atan2(aim.y - hole.y, aim.x - hole.x) + r.range(-0.9, 0.9);
      const s = r.range(2, 4);
      w.spawn(new Bee(w, this.beeDef, hole.x + r.range(-6, 6), hole.y + r.range(-4, 4), Math.cos(a) * s, Math.sin(a) * s));
      this.spawned++;
      this.nextAt += this.def.interval;
      this.pulse = 0.12;
      if (this.spawned === 1) w.events.emit('bees:spawn', { x: hole.x, y: hole.y });
    }
  }

  render(ctx, assets, time) {
    const img = assets.getImage(this.def.image);
    if (!img) return;
    const s = 1 + (this.pulse > 0 ? this.pulse : 0) * 0.8;
    const sway = Math.sin(time * 1.6) * 0.03;
    ctx.save();
    ctx.translate(this.x, this.y - this.h * 0.5); // 绕树枝摆动
    ctx.rotate(sway);
    ctx.translate(0, this.h * 0.5);
    ctx.scale(s, s);
    ctx.drawImage(img, -this.w / 2, -this.h * 0.6, this.w, this.h);
    ctx.restore();
  }
}
