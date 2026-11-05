// 蜜蜂：小圆形刚体，抵消重力悬浮；朝主角周围的目标点做「寻找 + 随机抖动」，撞到线会弹开。
import Matter from '../lib/matter.js';
import { CAT } from '../config/GameConfig.js';
import { Hazard } from './Hazard.js';

const { Bodies, Body } = Matter;

export class Bee extends Hazard {
  constructor(world, def, x, y, vx, vy) {
    super(world, def);
    const rng = world.rng;
    this.addBody(Bodies.circle(x, y, def.radius, {
      label: 'bee',
      density: def.density,
      restitution: def.restitution,
      friction: 0,
      frictionAir: 0,
      collisionFilter: { category: CAT.BEE, mask: CAT.TERRAIN | CAT.LINE | CAT.HERO | CAT.BEE },
    }, 12));
    Body.setVelocity(this.body, { x: vx, y: vy });
    this.orbit = rng.range(0, Math.PI * 2);
    this.orbitSpeed = rng.range(-0.03, 0.03);
    this.spreadR = rng.range(0.2, 1) * def.spread;
    this.speed = def.speed * rng.range(0.85, 1.12);
    this.fleeing = false;
    this.flap = rng.range(0, 10);
    this.face = vx >= 0 ? 1 : -1;
    // 路线：先依次飞向这些点 (例如传送门入口)，走完或被传送后再去找主角
    this.route = (def.route || []).map(([x, y]) => ({ x: x + rng.range(-6, 6), y: y + rng.range(-6, 6) }));
  }

  onWarp() { this.route = []; }

  step() {
    this.age += 1 / 60;
    const w = this.world;
    const b = this.body;
    const g = w.physics.engine.gravity;
    Body.applyForce(b, b.position, { x: 0, y: -b.mass * g.y * g.scale }); // 抵消重力
    const d = this.def;
    let tx; let ty;
    if (this.fleeing) {
      tx = b.position.x + (b.position.x < 270 ? -300 : 300);
      ty = -300;
    } else if (this.recoil && this.recoil.t > 0) {
      this.recoil.t -= 1 / 60;
      tx = b.position.x + this.recoil.x * 120;
      ty = b.position.y + this.recoil.y * 120;
    } else if (this.route.length) {
      tx = this.route[0].x; ty = this.route[0].y;
      if (Math.hypot(tx - b.position.x, ty - b.position.y) < 16) this.route.shift();
    } else {
      this.orbit += this.orbitSpeed;
      const h = w.heroine;
      tx = h.x + Math.cos(this.orbit) * this.spreadR;
      ty = h.y - 10 + Math.sin(this.orbit) * this.spreadR * 0.8;
    }
    const dx = tx - b.position.x; const dy = ty - b.position.y;
    const L = Math.hypot(dx, dy) || 1;
    const v = b.velocity;
    const k = this.fleeing ? 0.12 : this.recoil && this.recoil.t > 0 ? 0.18 : d.steer;
    const r = w.rng;
    let nvx = v.x + (dx / L * this.speed - v.x) * k + (r.next() - 0.5) * 2 * d.jitter;
    let nvy = v.y + (dy / L * this.speed - v.y) * k + (r.next() - 0.5) * 2 * d.jitter;
    const sp = Math.hypot(nvx, nvy);
    const max = this.speed * 1.35;
    if (sp > max) { nvx *= max / sp; nvy *= max / sp; }
    Body.setVelocity(b, { x: nvx, y: nvy });
    if (Math.abs(nvx) > 0.4) this.face = nvx > 0 ? 1 : -1;
    if (this.fleeing && (b.position.y < -80 || b.position.x < -80 || b.position.x > 620)) this.dead = true;
  }

  harmful() { return !this.fleeing; }

  onWin() { this.fleeing = true; }

  /**
   * 撞到画的线：弹开并后退一小会儿 (recoil)，再重新找主角。
   * 以前蜜蜂每一步都朝主角「顶」，一大群蜜蜂会像推土机一样把轻的线推着走 (罩子被推歪 / 推到主角身上)。
   */
  onCollide(other, pair) {
    if (other.label !== 'line' || this.fleeing) return;
    const b = this.body;
    const s = pair && pair.collision && pair.collision.supports && pair.collision.supports[0];
    let nx = s ? b.position.x - s.x : -b.velocity.x; let ny = s ? b.position.y - s.y : -b.velocity.y;
    const L = Math.hypot(nx, ny) || 1;
    this.recoil = { x: nx / L, y: ny / L, t: this.def.recoil };
  }

  render(ctx, assets, time) {
    const img = assets.getImage(this.def.image);
    const b = this.body;
    if (!img || !b) return;
    const w = this.def.drawW;
    const h = w * (img.height / img.width);
    const bob = Math.sin(time * 30 + this.flap) * 1.5;
    ctx.save();
    ctx.translate(b.position.x, b.position.y + bob);
    ctx.scale(-this.face, 1); // 原图朝左
    ctx.rotate(Math.max(-0.4, Math.min(0.4, b.velocity.y * 0.06)) * this.face);
    // 翅膀残影
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(time * 60 + this.flap);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(2, -h * 0.42, w * 0.22, h * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.drawImage(img, -w / 2, -h / 2 - 2, w, h);
    ctx.restore();
  }
}
