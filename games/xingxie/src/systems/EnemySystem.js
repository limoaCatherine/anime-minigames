// 怪物：对象池 + 空间网格。负责 AI (chase / sine / ranged / dash)、软分离、接触伤害、受击 (暴击 / 击退 / 冻结)、死亡掉落。
// Boss 的移动与技能在 BossSystem；这里只管 Boss 的受击与接触伤害。
import { ObjectPool } from '../core/ObjectPool.js';
import { ENEMIES, ENEMY_RULES, CC_RULES as CC } from '../config/EnemyConfig.js';
import { PICKUPS } from '../config/ProgressConfig.js';

const R = ENEMY_RULES;
const tmp = [];

function makeEnemy() {
  return {
    type: '', def: null, x: 0, y: 0, r: 10, hp: 1, maxHp: 1, speed: 0, dmg: 0, alive: false,
    kvx: 0, kvy: 0, vx: 0, vy: 0, flash: 0, freeze: 0, slow: 0, slowT: 0, stun: 0,
    phase: 0, t: 0, timer: 0, state: 0, sub: 0, dvx: 0, dvy: 0, elite: false, boss: false, hazard: false,
    scale: 1, life: 0, summoned: false, hits: Object.create(null), alpha: 1, expMul: 1, hitCount: 0,
  };
}

export class EnemySystem {
  constructor(world) {
    this.world = world;
    this.pool = new ObjectPool({ create: makeEnemy, prewarm: 320, max: world.caps.enemies + 40 });
    this.hazards = [];                       // 不可被攻击的危险物 (Boss 的小羊)
    this.dead = [];
    this.frame = 0;
    this.normalCount = 0;
  }

  get list() { return this.pool.active; }

  /** 当前时间的血量倍率 */
  hpMul(def) {
    const w = this.world;
    let m = (1 + R.hpGrowth * Math.floor(w.time / 6) / 10) * w.diff.enemyHp;
    const late = w.wave.lateHpMul;
    if (late && w.time >= late.from && !def.elite && !def.boss) m *= late.mul;
    return m;
  }

  spawn(type, x, y, opts = {}) {
    const def = ENEMIES[type];
    if (!def) return null;
    if (def.behavior === 'hazard') return this.spawnHazard(type, x, y, opts);
    const isNormal = !def.elite && !def.boss && type !== 'noxMirror';
    if (isNormal && this.pool.activeCount >= this.world.caps.enemies) return null;
    const e = this.pool.get();
    if (!e) return null;
    const w = this.world;
    e.type = type; e.def = def; e.x = x; e.y = y;
    e.scale = def.scale || 1;
    e.r = def.r;
    e.maxHp = e.hp = Math.max(1, Math.round((opts.hp || def.hp) * (opts.fixedHp ? 1 : this.hpMul(def))));
    e.speed = def.speed * (0.92 + w.rng.next() * 0.16);
    e.dmg = def.dmg;
    e.alive = true; e.kvx = e.kvy = 0; e.vx = e.vy = 0; e.flash = 0; e.freeze = 0; e.slow = 0; e.slowT = 0; e.stun = 0;
    e.phase = w.rng.next() * Math.PI * 2; e.t = 0; e.timer = w.rng.next() * 1.5; e.state = 0; e.sub = 0; e.dvx = e.dvy = 0;
    e.elite = !!def.elite; e.boss = !!def.boss; e.hazard = false; e.summoned = false; e.alpha = def.alpha || 1;
    e.expMul = (w.wave.lateHpMul && w.time >= w.wave.lateHpMul.from) ? w.wave.lateHpMul.expMul : 1;
    e.hitCount = 0;
    for (const k in e.hits) delete e.hits[k];
    if (opts.vx != null) { e.dvx = opts.vx; e.dvy = opts.vy; e.state = 9; e.life = opts.life || 6; }   // 怪潮 / 包围圈的定向移动
    if (e.elite) w.events.emit('elite:spawn', { type, x, y, name: def.name });
    return e;
  }

  spawnHazard(type, x, y, { vx = 0, vy = 0, life = 3 } = {}) {
    const def = ENEMIES[type];
    const h = { type, def, x, y, r: def.r, vx, vy, life, dmg: def.dmg, hazard: true, alive: true, t: 0, scale: 1, flash: 0, freeze: 0, alpha: 1 };
    this.hazards.push(h);
    return h;
  }

  rebuildGrid() {
    const g = this.world.grid;
    g.clear();
    const list = this.pool.active;
    let normal = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      g.insert(e);
      if (!e.elite && !e.boss) normal++;
    }
    this.normalCount = normal;
  }

  update(dt) {
    const w = this.world; const p = w.p; const list = this.pool.active;
    this.frame++;
    const doSep = (this.frame & 1) === 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      if (e.stun > 0) e.stun -= dt;
      let canMove = true;
      if (e.freeze > 0) { e.freeze -= dt; canMove = false; }
      if (e.stun > 0) canMove = false;
      // 击退速度衰减
      if (e.kvx || e.kvy) {
        e.x += e.kvx * dt; e.y += e.kvy * dt;
        const k = Math.exp(-dt * 10); e.kvx *= k; e.kvy *= k;
        if (Math.abs(e.kvx) + Math.abs(e.kvy) < 4) { e.kvx = 0; e.kvy = 0; }
      }
      const def = e.def;
      if (def.behavior === 'boss' || def.behavior === 'mirror') {
        // 由 BossSystem 移动
      } else if (canMove) {
        this.move(e, def, dt, p);
      }
      if (def.slam) this.eliteSlam(e, def, dt);
      if (def.summon && !e.summoned && e.hp < e.maxHp * def.summon.below) {
        e.summoned = true;
        for (let k = 0; k < def.summon.count; k++) {
          const a = (k / def.summon.count) * Math.PI * 2;
          this.spawn(def.summon.enemy, e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50);
        }
        w.events.emit('elite:summon', { x: e.x, y: e.y });
      }
      // 软分离
      if (doSep && !e.boss) {
        const n = w.grid.queryCircle(e.x, e.y, e.r, tmp, 32);
        let c = 0;
        for (let j = 0; j < n && c < 6; j++) {
          const o = tmp[j];
          if (o === e || !o.alive) continue;
          c++;
          const dx = e.x - o.x; const dy = e.y - o.y;
          const rr = e.r + o.r;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.01 && d2 < rr * rr) {
            const d = Math.sqrt(d2);
            const push = ((rr - d) / d) * R.separation * 0.5;
            const heavy = o.elite || o.boss ? 1.6 : 1;
            e.x += dx * push * heavy; e.y += dy * push * heavy;
          }
        }
      }
      // 太远的普通怪：挪到玩家前方重刷
      if (!e.elite && !e.boss && e.state !== 9) {
        const dx = e.x - p.x; const dy = e.y - p.y;
        if (dx * dx + dy * dy > R.despawnDist * R.despawnDist) w.spawner.relocate(e);
      }
    }
    this.updateHazards(dt);
    this.contact();
  }

  move(e, def, dt, p) {
    const w = this.world;
    const dx = p.x - e.x; const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / d; const ny = dy / d;
    const sp = e.speed * (1 - e.slow);
    if (e.state === 9) {     // 定向移动 (怪潮 / 包围圈)：沿给定方向，到期后改为追击
      e.x += e.dvx * dt * (1 - e.slow); e.y += e.dvy * dt * (1 - e.slow);
      e.life -= dt;
      if (e.life <= 0) e.state = 0;
      return;
    }
    switch (def.behavior) {
      case 'sine': {
        const wv = def.wave;
        const s = Math.sin(e.t * wv.freq + e.phase) * wv.amp;
        e.x += (nx - ny * s) * sp * dt; e.y += (ny + nx * s) * sp * dt;
        break;
      }
      case 'ranged': {
        const rg = def.ranged;
        let mx = 0; let my = 0;
        if (d > rg.keep + 30) { mx = nx; my = ny; } else if (d < rg.keep - 40) { mx = -nx; my = -ny; } else { mx = -ny * 0.5; my = nx * 0.5; }
        e.x += mx * sp * dt; e.y += my * sp * dt;
        e.timer += dt;
        if (e.timer >= rg.every && d < rg.keep + 160) {
          e.timer = 0;
          const b = rg.bullet;
          w.projectiles.enemyBullet(e.x, e.y, nx * b.speed, ny * b.speed, b.r, b.dmg, b.life, 'lantern');
        }
        break;
      }
      case 'dash': {
        const ds = def.dash;
        e.timer += dt;
        if (e.state === 0) {                       // 走路
          e.x += nx * sp * dt; e.y += ny * sp * dt;
          if (e.timer >= ds.every) { e.state = 1; e.timer = 0; e.sub = ds.chain || 1; w.events.emit('enemy:charge', { x: e.x, y: e.y, elite: e.elite }); }
        } else if (e.state === 1) {                // 蓄力 (头顶「!」)
          if (e.timer >= ds.charge) { e.state = 2; e.timer = 0; e.dvx = nx * e.speed * ds.mul; e.dvy = ny * e.speed * ds.mul; }
        } else if (e.state === 2) {                // 冲刺
          e.x += e.dvx * dt * (1 - e.slow); e.y += e.dvy * dt * (1 - e.slow);
          if (e.timer >= ds.time) {
            e.sub--;
            e.timer = 0;
            e.state = e.sub > 0 ? 3 : 0;
          }
        } else if (e.state === 3) {                // 连续冲刺之间的间隔
          if (e.timer >= ds.chainGap) { e.state = 1; e.timer = ds.charge * 0.5; }
        }
        break;
      }
      default:
        e.x += nx * sp * dt; e.y += ny * sp * dt;
    }
  }

  eliteSlam(e, def, dt) {
    if (e.freeze > 0 || e.stun > 0) return;
    e.sub += dt;
    const s = def.slam;
    if (e.sub >= s.every) {
      e.sub = 0;
      this.world.projectiles.addZone({ kind: 'slam', x: e.x, y: e.y, r: s.radius, warn: s.warn, dmg: s.dmg, duration: s.warn + 0.25, hostile: true });
    }
  }

  updateHazards(dt) {
    const p = this.world.p;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt; h.life -= dt;
      h.x += h.vx * dt; h.y += h.vy * dt;
      const dx = h.x - p.x; const dy = h.y - p.y; const rr = h.r + p.r;
      if (dx * dx + dy * dy < rr * rr) this.world.player.hurt(h.dmg, h.type);
      if (h.life <= 0) { this.hazards[i] = this.hazards[this.hazards.length - 1]; this.hazards.pop(); }
    }
  }

  contact() {
    const w = this.world; const p = w.p;
    if (p.invuln > 0 || p.contactCd > 0) return;
    const n = w.grid.queryCircle(p.x, p.y, p.r, tmp, 60);
    let best = 0;
    for (let i = 0; i < n; i++) {
      const e = tmp[i];
      if (!e.alive || e.freeze > 0) continue;
      if (e.dmg > best) best = e.dmg;
    }
    if (best > 0) {
      if (w.player.hurt(best, 'contact')) p.contactCd = R.contactGap;
    }
  }

  /**
   * 对敌人造成伤害。opts: src, kx, ky (击退方向), knock, freezeChance, freezeTime, stun, slow, slowTime, crit (强制暴击), shatter
   * 返回实际伤害
   */
  damage(e, base, opts) {
    if (!e.alive) return 0;
    const w = this.world; const s = w.player.s; const rng = w.rng;
    let dmg = base * w.dmgMul;
    const crit = opts.crit || rng.next() < s.crit;
    if (crit) dmg *= s.critMul;
    const chilled = e.freeze > 0 || e.slow > 0;
    if (chilled && s.chilledBonus) dmg *= 1 + s.chilledBonus;
    if (opts.shatter && e.freeze > 0) { dmg *= 1 + opts.shatter; e.freeze = 0.01; }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.flash = R.hitFlash;
    e.hitCount++;
    w.stats.dmgDealt += Math.min(dmg, e.hp + dmg);
    const kr = 1 - (e.def.knockResist || 0);
    if (opts.knock && kr > 0) { e.kvx += opts.kx * opts.knock * 9 * kr; e.kvy += opts.ky * opts.knock * 9 * kr; }
    if (opts.freezeChance && rng.next() < opts.freezeChance) {
      if (e.boss || e.elite) { e.slow = Math.max(e.slow, 0.5); e.slowT = Math.max(e.slowT, opts.freezeTime); }
      else e.freeze = Math.max(e.freeze, opts.freezeTime);
    }
    if (opts.stun && !e.boss) e.stun = Math.max(e.stun, opts.stun);
    if (opts.slow) { e.slow = Math.max(e.slow, opts.slow); e.slowT = Math.max(e.slowT, opts.slowTime || 0.3); }
    // 控制抗性：Boss / 精英不会被冻住，减速有上限 (CC_RULES)
    if (e.boss) e.slow = Math.min(e.slow, CC.bossSlowMax); else if (e.elite) e.slow = Math.min(e.slow, CC.eliteSlowMax);
    w.events.emit('enemy:hit', { x: e.x, y: e.y, dmg, crit, src: opts.src, boss: e.boss, elite: e.elite });
    if (e.hp <= 0) this.kill(e);
    return dmg;
  }

  kill(e) {
    if (!e.alive) return;
    const w = this.world; const def = e.def;
    e.alive = false;
    this.dead.push(e);
    w.kills++;
    if (def.exp) {
      const g = PICKUPS.gems[def.exp];
      w.pickups.dropGem(e.x, e.y, def.exp, g.exp * e.expMul);
    }
    if (!e.elite && !e.boss) {
      const r = w.rng.next();
      if (r < PICKUPS.candy.chance) w.pickups.drop('candy', e.x, e.y);
      else if (r < PICKUPS.candy.chance + PICKUPS.magnet.chance) w.pickups.drop('magnet', e.x, e.y);
    }
    if (e.elite) w.pickups.drop('chest', e.x, e.y);
    if (def.split) {
      for (let k = 0; k < def.split.count; k++) {
        const a = w.rng.next() * Math.PI * 2;
        this.spawn(def.split.into, e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12);
      }
    }
    w.events.emit('enemy:die', { x: e.x, y: e.y, type: e.type, elite: e.elite, boss: e.boss, color: def.color, r: e.r * e.scale });
    if (e.boss || e.type === 'noxMirror') w.bosses.onDie(e);
  }

  /** 冲击波：伤害 + 击退半径内的怪 (复活时用) */
  blast(x, y, radius, dmg, knock) {
    const n = this.world.grid.queryCircle(x, y, radius, tmp, 400);   // 复活冲击波要推开整圈怪，不能只推 60 只
    for (let i = 0; i < n; i++) {
      const e = tmp[i];
      const dx = e.x - x; const dy = e.y - y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.damage(e, dmg, { src: 'blast', kx: dx / d, ky: dy / d, knock });
    }
    this.world.events.emit('blast', { x, y, r: radius });
  }

  /** 回收已死亡的怪 (每步结束时调用) */
  sweep() {
    for (const e of this.dead) this.pool.release(e);
    this.dead.length = 0;
  }
}
