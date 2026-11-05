// 子弹与区域：玩家子弹 (星弹 / 回旋爱心 / 纸鹤 / 冰棱)、地面区域 (蔷薇花阵 / 流星预警 / 精英与 Boss 的预警圈)、敌方子弹。
import { ObjectPool } from '../core/ObjectPool.js';

const tmp = [];

function makeProj() {
  return { kind: '', x: 0, y: 0, vx: 0, vy: 0, r: 0, dmg: 0, pierce: 0, life: 0, maxLife: 0, w: null, hits: [], opt: null, dist: 0, leg: 0, target: null, angle: 0 };
}
function makeBullet() {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 0, dmg: 0, life: 0, kind: '' };
}

export class ProjectileSystem {
  constructor(world) {
    this.world = world;
    this.pool = new ObjectPool({ create: makeProj, prewarm: 200, max: world.caps.projectiles });
    this.bullets = new ObjectPool({ create: makeBullet, prewarm: 60, max: world.caps.enemyBullets });
    this.zones = [];
    this.dead = [];
  }

  get list() { return this.pool.active; }

  spawn(kind, x, y, vx, vy, r, dmg, pierce, life, w, opt = null) {
    let o = this.pool.get();
    if (!o) {                                         // 满了：顶替最早的那颗
      const oldest = this.pool.active[0];
      this.pool.release(oldest);
      o = this.pool.get();
      if (!o) return null;
    }
    o.kind = kind; o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.r = r; o.dmg = dmg; o.pierce = pierce;
    o.life = o.maxLife = life; o.w = w; o.hits.length = 0; o.opt = opt; o.dist = 0; o.leg = 0; o.target = null;
    o.angle = Math.atan2(vy, vx);
    return o;
  }

  enemyBullet(x, y, vx, vy, r, dmg, life, kind) {
    const b = this.bullets.get();
    if (!b) return null;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.dmg = dmg; b.life = life; b.kind = kind;
    return b;
  }

  clearEnemyBullets() { this.bullets.releaseAll(); }

  addZone(z) {
    if (this.zones.length >= this.world.caps.zones && !z.hostile) return null;
    z.t = 0; z.acc = 0; z.done = false; z.healAcc = 0;
    this.zones.push(z);
    if (z.hostile || z.kind === 'meteor') this.world.events.emit('zone:warn', { kind: z.kind, x: z.x, y: z.y, r: z.r });
    return z;
  }

  update(dt) {
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateBullets(dt);
  }

  updateProjectiles(dt) {
    const W = this.world; const list = this.pool.active; const p = W.p;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      o.life -= dt;
      if (o.kind === 'rang') {
        const sp = Math.hypot(o.vx, o.vy);
        if (o.leg === 0) {
          o.dist += sp * dt;
          if (o.dist >= o.opt.range) { o.leg = 1; o.hits.length = 0; }
        } else {
          const dx = p.x - o.x; const dy = p.y - o.y; const d = Math.hypot(dx, dy) || 1;
          const s2 = sp * 1.02 + 30 * dt;
          o.vx = (dx / d) * s2; o.vy = (dy / d) * s2;
          if (d < 18) o.life = 0;
        }
        o.angle += dt * 14;
        if (o.opt.pullGems) W.pickups.pullAround(o.x, o.y, o.opt.pullGems);
      } else if (o.kind === 'crane') {
        if (!o.target || !o.target.alive) o.target = W.grid.nearest(o.x, o.y, 320, (e) => e.alive);
        if (o.target) {
          const want = Math.atan2(o.target.y - o.y, o.target.x - o.x);
          let df = want - o.angle;
          while (df > Math.PI) df -= Math.PI * 2;
          while (df < -Math.PI) df += Math.PI * 2;
          const maxTurn = o.opt.turn * dt;
          o.angle += Math.max(-maxTurn, Math.min(maxTurn, df));
          const sp = Math.hypot(o.vx, o.vy);
          o.vx = Math.cos(o.angle) * sp; o.vy = Math.sin(o.angle) * sp;
        }
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.kind === 'star' || o.kind === 'shard' || o.kind === 'crane') o.angle = o.kind === 'star' ? o.angle + dt * 8 : Math.atan2(o.vy, o.vx);
      // 碰撞
      const n = W.grid.queryCircle(o.x, o.y, o.r, tmp, 40);
      for (let j = 0; j < n && o.life > 0; j++) {
        const e = tmp[j];
        if (!e.alive || o.hits.indexOf(e) >= 0) continue;
        this.hit(o, e);
      }
      if (o.life <= 0) this.dead.push(o);
    }
    for (const o of this.dead) this.pool.release(o);
    this.dead.length = 0;
  }

  hit(o, e) {
    const W = this.world; const opt = o.opt || {};
    if (o.hits.length > 24) o.hits.shift();
    o.hits.push(e);
    const sp = Math.hypot(o.vx, o.vy) || 1;
    const kx = o.vx / sp; const ky = o.vy / sp;
    if (o.kind === 'crane' && opt.explode) {
      this.explode(o.x, o.y, opt.explode, o.dmg, o.w);
      o.life = 0;
      return;
    }
    W.enemies.damage(e, o.dmg, { src: o.w.id, kx, ky, knock: opt.knock || (o.kind === 'star' ? 3 : 0), freezeChance: opt.freezeChance, freezeTime: opt.freezeTime, shatter: opt.shatter });
    if (opt.splash) {
      const m = W.grid.queryCircle(e.x, e.y, opt.splash.radius, tmp2, 30);
      for (let k = 0; k < m; k++) { const s = tmp2[k]; if (s !== e && s.alive) W.enemies.damage(s, o.dmg * opt.splash.ratio, { src: o.w.id }); }
      W.events.emit('splash', { x: e.x, y: e.y, r: opt.splash.radius });
    }
    if (o.kind === 'rang') return;
    o.pierce--;
    if (o.pierce < 0) o.life = 0;
  }

  explode(x, y, r, dmg, w) {
    const W = this.world;
    const m = W.grid.queryCircle(x, y, r, tmp2, 30);
    for (let k = 0; k < m; k++) { const s = tmp2[k]; if (s.alive) W.enemies.damage(s, dmg, { src: w.id }); }
    W.events.emit('explode', { x, y, r });
  }

  updateZones(dt) {
    const W = this.world; const p = W.p;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      switch (z.kind) {
        case 'rose': {
          z.acc += dt;
          if (z.acc >= z.tick) {
            z.acc -= z.tick;
            const m = W.grid.queryCircle(z.x, z.y, z.r, tmp, 30);
            let dealt = 0;
            for (let k = 0; k < m; k++) { const e = tmp[k]; if (e.alive) dealt += W.enemies.damage(e, z.dmg, { src: z.src.id, slow: 0.2, slowTime: 0.6 }); }
            if (z.lifesteal && dealt > 0) W.player.heal(Math.min(z.healCap * z.tick, dealt * z.lifesteal));
          }
          break;
        }
        case 'meteor':
        case 'slam':
        case 'pillow':
          if (!z.done && z.t >= z.warn) {
            z.done = true;
            if (z.hostile) {
              const dx = p.x - z.x; const dy = p.y - z.y;
              if (dx * dx + dy * dy < (z.r + p.r) * (z.r + p.r)) W.player.hurt(z.dmg, z.kind);
              W.events.emit('slam', { x: z.x, y: z.y, r: z.r, kind: z.kind });
            } else {
              const m = W.grid.queryCircle(z.x, z.y, z.r, tmp, 40);
              for (let k = 0; k < m; k++) {
                const e = tmp[k];
                if (!e.alive) continue;
                const dx = e.x - z.x; const dy = e.y - z.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
                W.enemies.damage(e, z.dmg, { src: z.src ? z.src.id : 'meteor', kx: dx / d, ky: dy / d, knock: z.giant ? 30 : 8 });
              }
              W.events.emit('meteor:impact', { x: z.x, y: z.y, r: z.r, giant: !!z.giant });
            }
          }
          break;
        case 'sleep': {
          const dx = p.x - z.x; const dy = p.y - z.y;
          if (dx * dx + dy * dy < z.r * z.r) p.slowZone = Math.max(p.slowZone, z.slow);
          break;
        }
        case 'cage': {
          const d = Math.hypot(p.x - z.x, p.y - z.y);
          z.acc -= dt;
          if (Math.abs(d - z.r) < 16 && z.acc <= 0) { if (W.player.hurt(z.dmg, 'cage')) z.acc = z.tickGap; }
          break;
        }
        default:
          break;
      }
      if (z.t >= z.duration) { this.zones[i] = this.zones[this.zones.length - 1]; this.zones.pop(); }
    }
  }

  updateBullets(dt) {
    const W = this.world; const p = W.p; const list = this.bullets.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const dx = b.x - p.x; const dy = b.y - p.y; const rr = b.r + p.r;
      if (dx * dx + dy * dy < rr * rr) { if (W.player.hurt(b.dmg, 'bullet') || p.invuln > 0) b.life = 0; }
      if (b.life <= 0) this.bullets.release(b);
    }
  }
}

const tmp2 = [];
