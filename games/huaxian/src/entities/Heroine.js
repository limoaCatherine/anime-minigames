// 主角 (粉色双马尾少女)：不可旋转的动态刚体 + 四种表情立绘 (idle / scared / happy / lose)。
import Matter from '../lib/matter.js';
import { GameConfig, CAT } from '../config/GameConfig.js';

const { Bodies, Body } = Matter;

// 立绘像素尺寸 (tools/process_images.py 输出，四种表情同一比例)。仅用于计算禁画区与绘制。
export const HEROINE_SPRITES = {
  idle: { key: 'heroine_idle', w: 322, h: 428 },
  scared: { key: 'heroine_scared', w: 399, h: 409 },
  happy: { key: 'heroine_happy', w: 441, h: 437 },
  lose: { key: 'heroine_lose', w: 463, h: 430 },
};

export class Heroine {
  /** @param {number} x 脚底中心 x  @param {number} feetY 脚底 y */
  constructor(physics, x, feetY) {
    const c = GameConfig.heroine;
    this.cfg = c;
    this.physics = physics;
    this.body = Bodies.rectangle(x, feetY - c.bodyH / 2, c.bodyW, c.bodyH, {
      label: 'heroine',
      chamfer: { radius: [22, 22, 6, 6] },
      density: c.density,
      friction: c.friction,
      frictionStatic: 2,
      restitution: 0,
      frictionAir: 0.01,
      collisionFilter: { category: CAT.HERO, mask: 0xffff },
    });
    Body.setInertia(this.body, Infinity);
    this.body.plugin.entity = this;
    physics.add(this.body);
    this.expression = 'idle';
    this.scale = c.spriteH / HEROINE_SPRITES.idle.h;
    this.exprTime = 0;
    this.shake = 0;
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  get feetY() { return this.body.position.y + this.cfg.bodyH / 2; }

  /** 禁画区：idle 立绘的包围盒 (外扩 margin) */
  zone(margin = 0) {
    const s = HEROINE_SPRITES.idle;
    const w = s.w * this.scale * 0.92;
    const h = s.h * this.scale;
    return { x: this.x - w / 2 - margin, y: this.feetY - h - margin, w: w + margin * 2, h: h + margin * 2 };
  }

  setExpression(e) {
    if (this.expression === e) return;
    this.expression = e;
    this.exprTime = 0;
  }

  update(dt) {
    this.exprTime += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
  }

  render(ctx, assets, time) {
    const spr = HEROINE_SPRITES[this.expression];
    const img = assets.getImage(spr.key);
    const w = spr.w * this.scale;
    const h = spr.h * this.scale;
    const x = this.x;
    const fy = this.feetY;
    ctx.save();
    // 脚下阴影
    ctx.fillStyle = 'rgba(90,40,110,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, fy - 2, w * 0.32, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x, fy);
    let sx = 1; let sy = 1; let rot = 0; let ox = 0;
    const t = this.exprTime;
    switch (this.expression) {
      case 'idle': sy = 1 + Math.sin(time * 3) * 0.018; sx = 1 - Math.sin(time * 3) * 0.01; break;
      case 'scared': ox = Math.sin(time * 55) * 1.6; sy = 0.98 + Math.sin(time * 9) * 0.01; break;
      case 'happy': {
        const hop = Math.abs(Math.sin(t * 6)) * 14 * Math.max(0.3, 1 - t * 0.25);
        ctx.translate(0, -hop);
        rot = Math.sin(t * 6) * 0.04;
        break;
      }
      case 'lose': {
        const k = Math.min(1, t / 0.25);
        sy = 0.85 + 0.15 * k; sx = 1.12 - 0.12 * k;
        ox = this.shake > 0 ? Math.sin(time * 70) * 3 : 0;
        break;
      }
      default: break;
    }
    ctx.translate(ox, 0);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    if (img) ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
}
