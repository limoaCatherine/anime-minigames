// 会走路、会扔东西的敌人基类 (加班老板 / 催婚亲戚)。
// 参数全部来自 HazardConfig + 关卡覆盖：入场方式、行走、投掷间隔、抛物线飞行时间、台词气泡。
import Matter from '../lib/matter.js';
import { CAT } from '../config/GameConfig.js';
import { hazardDef } from '../config/HazardConfig.js';
import { ballistic } from '../core/geometry.js';
import { Hazard } from './Hazard.js';
import { Projectile } from './Projectile.js';
import { drawSpeech } from '../ui/draw.js';

const { Bodies, Body } = Matter;

export class Thrower extends Hazard {
  /**
   * @param {object} def  x,y 为脚底位置
   * @param {{projectile:string, imageFacing:number, imageAspect:number}} kind
   */
  constructor(world, def, kind) {
    super(world, def);
    this.kind = kind;
    this.projDef = hazardDef(kind.projectile);
    this.entered = false;
    this.lastThrow = -999;
    this.throwCount = 0;
    this.speech = null;
    this.face = -1;
    this.squash = 0;
    this.retreat = false;
    if (!def.entry || def.entry === 'stand') this.enter(def.x, def.y);
    else if (def.entry === 'walk') {
      this.fromX = def.fromX != null ? def.fromX : (def.x < 270 ? -45 : 585);
      this.enter(this.fromX, def.y);
    }
  }

  enter(x, feetY) {
    const d = this.def;
    const body = Bodies.rectangle(x, feetY - d.bodyH / 2, d.bodyW, d.bodyH, {
      label: this.type,
      chamfer: { radius: 14 },
      density: d.density,
      friction: 0.5,
      frictionStatic: 0.8,
      frictionAir: 0.02,
      restitution: 0,
      collisionFilter: { category: CAT.HAZARD, mask: CAT.TERRAIN | CAT.LINE | CAT.HERO | CAT.HAZARD },
    });
    Body.setInertia(body, Infinity);
    this.addBody(body);
    this.entered = true;
  }

  get x() { return this.body ? this.body.position.x : this.def.x; }
  get feetY() { return this.body ? this.body.position.y + this.def.bodyH / 2 : this.def.y; }

  zone() {
    if (!this.entered || this.def.entry === 'walk' || this.def.entry === 'drop') return null;
    const h = this.def.drawH;
    const w = h * this.kind.imageAspect * 0.85;
    return { x: this.x - w / 2, y: this.feetY - h, w, h };
  }

  harmful() { return this.entered && !this.retreat; }

  onWin() { this.retreat = true; }

  step() {
    const w = this.world;
    const d = this.def;
    this.age += 1 / 60;
    if (this.speech) { this.speech.life += 1 / 60; if (this.speech.life > 1.6) this.speech = null; }
    if (this.squash > 0) this.squash = Math.max(0, this.squash - 1 / 60);
    if (w.state !== 'survive' && !this.retreat) return;
    if (!this.entered) {
      if (d.entry === 'drop' && w.time >= (d.enterAt || 0.3)) {
        this.enter(d.x, -20);
        Body.setVelocity(this.body, { x: 0, y: 2 });
        this.body.frictionAir = 0.004; // 下落时几乎不受空气阻力，落地后恢复
        this.dropping = true;
      }
      return;
    }
    const b = this.body;
    if (this.dropping && Math.abs(b.velocity.y) < 0.2 && this.age > 0.3) {
      this.dropping = false;
      this.body.frictionAir = 0.02;
      this.squash = 0.25;
      w.events.emit('hazard:land', { type: this.type, x: b.position.x, y: this.feetY });
    }
    const h = w.heroine;
    const lookX = d.target ? d.target[0] : h.x;
    this.face = lookX >= b.position.x ? 1 : -1;
    if (this.retreat) return;
    // 行走
    let targetX = null;
    if (d.entry === 'walk' && !this.arrived) {
      targetX = d.stopX != null ? d.stopX : d.x;
      if (Math.abs(targetX - b.position.x) < 6) this.arrived = true;
    } else if (d.walk) targetX = h.x;
    if (targetX != null) {
      const dir = Math.sign(targetX - b.position.x);
      if (dir && Math.abs(b.velocity.x) < d.walkSpeed && Math.abs(b.velocity.y) < 1.5) {
        Body.applyForce(b, b.position, { x: dir * b.mass * d.walkForce, y: 0 });
        // 1.3：被挡停过之后静摩擦会把他「粘」在地上 (推力太小起不了步，只能一点点蹭)——
        // 速度几乎为 0 时直接给一个起步速度；前面真有东西挡着的话，碰撞会把他停住
        if (Math.abs(b.velocity.x) < 0.15 && this.age > 0.3) Body.setVelocity(b, { x: dir * d.walkSpeed * 0.5, y: b.velocity.y });
      }
    }
    // 投掷
    if (d.throwEvery > 0 && w.time >= d.throwDelay && w.time - this.lastThrow >= d.throwEvery && !this.dropping) {
      this.throwAt(h);
    }
  }

  throwAt(h) {
    const w = this.world;
    const d = this.def;
    this.lastThrow = w.time;
    const b = this.body;
    const from = { x: b.position.x + this.face * d.bodyW * 0.55, y: b.position.y - d.bodyH * 0.22 };
    // target: 固定瞄准点 (例如传送门入口)；否则瞄准主角头部
    const to = d.target
      ? { x: d.target[0] + w.rng.range(-6, 6), y: d.target[1] + w.rng.range(-6, 6) }
      : { x: h.x + w.rng.range(-12, 12), y: h.feetY - 80 + w.rng.range(-10, 10) };
    const steps = Math.round(d.flight * 60);
    const v = ballistic(from, to, steps, w.physics.stepGravity);
    w.spawn(new Projectile(w, this.projDef, from.x, from.y, v));
    this.squash = 0.18;
    if (this.throwCount % 2 === 0) this.speech = { text: d.lines[(this.throwCount / 2) % d.lines.length], life: 0 };
    this.throwCount++;
    w.events.emit('hazard:throw', { type: this.type, x: from.x, y: from.y });
  }

  render(ctx, assets, time) {
    const d = this.def;
    if (!this.entered) {
      // 入场预告
      if (d.entry === 'drop') drawDropMarker(ctx, d.x, d.y, time);
      return;
    }
    const img = assets.getImage(d.image);
    const h = d.drawH;
    const wImg = h * this.kind.imageAspect;
    ctx.save();
    ctx.translate(this.x, this.feetY);
    ctx.fillStyle = 'rgba(60,30,70,0.18)';
    ctx.beginPath(); ctx.ellipse(0, -2, wImg * 0.3, 6, 0, 0, Math.PI * 2); ctx.fill();
    const walking = Math.abs(this.body.velocity.x) > 0.3;
    const bob = walking ? Math.abs(Math.sin(time * 10)) * 3 : Math.sin(time * 2.5) * 1;
    const sq = this.squash * 0.6;
    ctx.translate(0, -bob);
    ctx.scale((this.face * this.kind.imageFacing) * (1 + sq), 1 - sq);
    if (this.retreat) ctx.globalAlpha = 0.85;
    if (img) ctx.drawImage(img, -wImg / 2, -h, wImg, h);
    ctx.restore();
    if (this.speech) drawSpeech(ctx, this.speech.text, this.x, this.feetY - h - 14, this.speech.life, this.kind.speechColor);
  }
}

function drawDropMarker(ctx, x, y, time) {
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6);
  ctx.strokeStyle = '#ff6fa8';
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y - 4, 34, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ff6fa8';
  const ay = y - 70 + Math.sin(time * 5) * 6;
  ctx.beginPath(); ctx.moveTo(x - 14, ay); ctx.lineTo(x + 14, ay); ctx.lineTo(x, ay + 18); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export class Boss extends Thrower {
  constructor(world, def) {
    super(world, def, { projectile: 'paper', imageFacing: -1, imageAspect: 359 / 406, speechColor: '#6a7a99' });
  }
}

export class Auntie extends Thrower {
  constructor(world, def) {
    super(world, def, { projectile: 'heart', imageFacing: 1, imageAspect: 367 / 430, speechColor: '#e2457f' });
  }
}
