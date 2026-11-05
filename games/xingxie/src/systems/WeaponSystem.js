// 武器：按 form 分派 9 种攻击形态 (直射 / 扇形斩 / 环绕 / 链式 / 回旋 / 地面区域 / 追踪 / 冰棱 / 流星)。
// 面板数值来自 WeaponConfig (等级表或进化形态)，再乘玩家属性 (伤害 / 冷却 / 范围 / 数量 / 持续)。
import { WEAPONS, EVOLUTIONS, MAX_WEAPON_LEVEL } from '../config/WeaponConfig.js';

const tmp = [];
const TAU = Math.PI * 2;
let UID = 1;

export class WeaponSystem {
  constructor(world) {
    this.world = world;
    this.list = [];
  }

  has(id) { return this.list.find((w) => w.id === id); }

  add(id) {
    const ex = this.has(id);
    if (ex) {
      if (!ex.evolved && ex.level < MAX_WEAPON_LEVEL) ex.level++;
      this.refresh();
      return ex;
    }
    const w = { id, uid: UID++, level: 1, evolved: false, evoId: null, timer: 0.3, def: WEAPONS[id], st: {}, state: { orbs: [], orbOn: false, orbT: 0, angle: 0, n: 0, echo: -1, giant: 0, dirX: 0, dirY: -1 } };
    this.list.push(w);
    this.refresh();
    this.world.events.emit('weapon:new', { id });
    return w;
  }

  evolve(id) {
    const w = this.has(id);
    if (!w || w.evolved) return null;
    w.evolved = true;
    w.evoId = w.def.evolve.to;
    w.timer = 0.1;
    this.refresh();
    this.world.player.recalc();      // 八咫结界的减伤
    this.world.evolutions.push({ id: w.evoId, time: this.world.time });
    return w;
  }

  /** 进化形态的减伤 (八咫结界) */
  damageReduce() {
    let r = 0;
    for (const w of this.list) if (w.evolved) r = Math.max(r, EVOLUTIONS[w.evoId].stats.dmgReduce || 0);
    return r;
  }

  info(w) { return w.evolved ? EVOLUTIONS[w.evoId] : w.def; }

  /** 重新计算所有武器的实际数值 */
  refresh() {
    const s = this.world.player.s;
    for (const w of this.list) {
      const base = w.evolved ? EVOLUTIONS[w.evoId].stats : w.def.levels[w.level - 1];
      const st = w.st;
      Object.assign(st, base);
      st.form = this.info(w).form;
      st.dmg = base.dmg * (s.might || 1);
      st.cd = base.cd * (s.cooldown || 1);
      const amount = s.amount || 0;
      if (st.count != null) st.count = base.count + (st.form === 'chain' ? Math.min(1, amount) : amount);
      const area = s.area || 1;
      for (const k of ['radius', 'size', 'range', 'explode', 'giantRadius']) if (base[k] != null) st[k] = base[k] * area;
      if (base.duration != null) st.duration = base.duration * (s.duration || 1);
      if (base.life != null) st.life = base.life * (s.duration || 1);
      if (base.spreadDeg != null && base.spreadDeg < 360) st.spreadDeg = base.spreadDeg * Math.min(1.4, area);
    }
  }

  update(dt) {
    for (const w of this.list) {
      const st = w.st;
      switch (st.form) {
        case 'orbit': this.orbit(w, dt); break;
        default:
          w.timer -= dt;
          if (st.form === 'slash' && w.state.echo >= 0) {
            w.state.echo -= dt;
            if (w.state.echo < 0) this.slash(w, true);
          }
          if (st.form === 'meteor' && st.giantEvery) {
            w.state.giant += dt;
            if (w.state.giant >= st.giantEvery) { w.state.giant = 0; this.giantMeteor(w); }
          }
          if (w.timer <= 0) {
            if (this.fire(w)) w.timer = st.cd;
            else w.timer = 0.15;            // 没目标：稍后再试
          }
      }
    }
  }

  nearest(maxR) {
    const p = this.world.p;
    return this.world.grid.nearest(p.x, p.y, maxR, (e) => e.alive && !e.hazard);
  }

  fire(w) {
    const st = w.st;
    switch (st.form) {
      case 'projectile': return this.projectile(w);
      case 'slash': return this.slash(w, false);
      case 'chain': return this.chain(w);
      case 'boomerang': return this.boomerang(w);
      case 'zone': return this.zone(w);
      case 'homing': return this.homing(w);
      case 'frost': return this.frost(w);
      case 'meteor': return this.meteor(w);
      default: return false;
    }
  }

  aim(maxR) {
    const p = this.world.p;
    const t = this.nearest(maxR);
    if (t) { const a = Math.atan2(t.y - p.y, t.x - p.x); return { a, t }; }
    return null;
  }

  projectile(w) {
    const st = w.st; const p = this.world.p;
    const aim = this.aim(440);
    if (!aim) return false;
    const n = st.count; const sp = (st.spread * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const a = aim.a + (i - (n - 1) / 2) * sp;
      this.world.projectiles.spawn('star', p.x, p.y, Math.cos(a) * st.speed, Math.sin(a) * st.speed, st.size, st.dmg, st.pierce, st.life, w, { splash: st.splash });
    }
    this.world.events.emit('weapon:fire', { form: 'projectile', id: w.id });
    return true;
  }

  slash(w, isEcho) {
    const st = w.st; const W = this.world; const p = W.p; const s = w.state;
    let dir;
    if (!isEcho) {
      // 朝身边的怪挥刀 (以前是朝走路方向：边跑边砍时刀全砍在空地上，樱刃胜率明显偏低)
      const aim = this.aim(st.radius + 80); dir = aim ? aim.a : Math.atan2(p.facing.y, p.facing.x);
      if (!this.nearest(st.radius + 60)) return false;
      s.angle = dir;
      if (st.echo) s.echo = st.echo;
    } else dir = s.angle;
    const half = ((st.angle * Math.PI) / 180) / 2;
    const dirs = st.angle >= 360 ? [dir] : (st.count >= 2 ? [dir, dir + Math.PI] : [dir]);
    s.n++;
    const crit = st.critEvery ? s.n % st.critEvery === 0 : false;
    const n = W.grid.queryCircle(p.x, p.y, st.radius, tmp, 80);
    for (let i = 0; i < n; i++) {
      const e = tmp[i];
      if (!e.alive) continue;
      const dx = e.x - p.x; const dy = e.y - p.y;
      const ea = Math.atan2(dy, dx);
      let ok = st.angle >= 360;
      if (!ok) for (const d of dirs) { let df = ea - d; while (df > Math.PI) df -= TAU; while (df < -Math.PI) df += TAU; if (Math.abs(df) <= half) { ok = true; break; } }
      if (!ok) continue;
      const dd = Math.sqrt(dx * dx + dy * dy) || 1;
      W.enemies.damage(e, st.dmg * (isEcho ? 0.6 : 1), { src: w.id, kx: dx / dd, ky: dy / dd, knock: st.knock, crit });
    }
    for (const d of dirs) W.events.emit('slash', { x: p.x, y: p.y, angle: d, arc: st.angle, radius: st.radius, echo: isEcho, color: this.info(w).color });
    if (!isEcho) W.events.emit('weapon:fire', { form: 'slash', id: w.id });
    return true;
  }

  orbit(w, dt) {
    const st = w.st; const W = this.world; const p = W.p; const s = w.state;
    if (st.permanent) s.orbOn = true;
    else {
      s.orbT -= dt;
      if (s.orbOn && s.orbT <= 0) { s.orbOn = false; s.orbT = st.cd; }
      else if (!s.orbOn && s.orbT <= 0) { s.orbOn = true; s.orbT = st.duration; W.events.emit('weapon:fire', { form: 'orbit', id: w.id }); }
    }
    s.orbs.length = 0;
    if (!s.orbOn) return;
    s.angle += st.spin * dt;
    const n = st.count;
    for (let i = 0; i < n; i++) {
      const a = s.angle + (i / n) * TAU;
      const ox = p.x + Math.cos(a) * st.radius; const oy = p.y + Math.sin(a) * st.radius;
      s.orbs.push(ox, oy);
      const m = W.grid.queryCircle(ox, oy, st.size, tmp, 40);
      for (let j = 0; j < m; j++) {
        const e = tmp[j];
        if (!e.alive) continue;
        const last = e.hits[w.uid];
        if (last != null && W.time - last < st.hitGap) continue;
        e.hits[w.uid] = W.time;
        const dx = e.x - p.x; const dy = e.y - p.y; const dd = Math.sqrt(dx * dx + dy * dy) || 1;
        W.enemies.damage(e, st.dmg, { src: w.id, kx: dx / dd, ky: dy / dd, knock: st.knock });
      }
    }
  }

  chain(w) {
    const st = w.st; const W = this.world; const p = W.p;
    const first = this.nearest(st.reach);
    if (!first) return false;
    const used = new Set();
    for (let c = 0; c < st.count; c++) {
      let cur = c === 0 ? first : null;
      if (!cur) {
        const n = W.grid.queryCircle(p.x, p.y, st.reach, tmp, 40);
        let best = null; let bd = Infinity;
        for (let i = 0; i < n; i++) {
          const e = tmp[i];
          if (!e.alive || used.has(e)) continue;
          const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2 + W.rng.next() * 9000;
          if (d < bd) { bd = d; best = e; }
        }
        cur = best || first;
      }
      const pts = [p.x, p.y];
      const hit = new Set();
      for (let k = 0; k <= st.jumps && cur; k++) {
        hit.add(cur); used.add(cur);
        pts.push(cur.x, cur.y);
        const mul = Math.max(0.2, 1 - st.falloff * k);
        const cx = cur.x; const cy = cur.y;
        W.enemies.damage(cur, st.dmg * mul, { src: w.id, stun: st.stun || 0 });
        const n = W.grid.queryCircle(cx, cy, st.range, tmp, 40);
        let nxt = null; let bd = Infinity;
        for (let i = 0; i < n; i++) {
          const e = tmp[i];
          if (!e.alive || hit.has(e)) continue;
          const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
          if (d < bd) { bd = d; nxt = e; }
        }
        cur = nxt;
      }
      W.events.emit('chain', { pts, color: this.info(w).color, evolved: w.evolved });
    }
    W.events.emit('weapon:fire', { form: 'chain', id: w.id });
    return true;
  }

  boomerang(w) {
    const st = w.st; const p = this.world.p;
    const aim = this.aim(st.range + 120);
    if (!aim) return false;
    const n = st.count;
    for (let i = 0; i < n; i++) {
      const a = aim.a + (i - (n - 1) / 2) * 0.5;
      this.world.projectiles.spawn('rang', p.x, p.y, Math.cos(a) * st.speed, Math.sin(a) * st.speed, st.size, st.dmg, 9999, 6, w, { range: st.range, knock: st.knock, pullGems: st.pullGems || 0 });
    }
    this.world.events.emit('weapon:fire', { form: 'boomerang', id: w.id });
    return true;
  }

  zone(w) {
    const st = w.st; const W = this.world; const p = W.p;
    if (!this.nearest(st.reach)) return false;
    for (let i = 0; i < st.count; i++) {
      let x; let y;
      const d = i === 0 ? W.grid.densest(p.x, p.y, st.reach) : null;
      if (d) { x = d.x; y = d.y; } else {
        const t = this.randomEnemy(st.reach);
        if (t) { x = t.x + (W.rng.next() - 0.5) * 40; y = t.y + (W.rng.next() - 0.5) * 40; } else { x = p.x; y = p.y; }
      }
      W.projectiles.addZone({ kind: 'rose', x, y, r: st.radius, duration: st.duration, tick: st.tick, dmg: st.dmg, src: w, lifesteal: st.lifesteal || 0, healCap: st.healCap || 0, color: this.info(w).color, evolved: w.evolved });
    }
    W.events.emit('weapon:fire', { form: 'zone', id: w.id });
    return true;
  }

  randomEnemy(reach) {
    const W = this.world; const p = W.p;
    const n = W.grid.queryCircle(p.x, p.y, reach, tmp, 40);
    if (!n) return null;
    for (let tries = 0; tries < 4; tries++) { const e = tmp[W.rng.int(n)]; if (e.alive) return e; }
    return null;
  }

  homing(w) {
    const st = w.st; const W = this.world; const p = W.p;
    if (!this.nearest(420)) return false;
    for (let i = 0; i < st.count; i++) {
      const a = (i / st.count) * TAU + W.rng.next() * 0.5;
      W.projectiles.spawn('crane', p.x, p.y, Math.cos(a) * st.speed, Math.sin(a) * st.speed, st.size, st.dmg, 1, st.life, w, { turn: (st.turn * Math.PI) / 180, explode: st.explode });
    }
    W.events.emit('weapon:fire', { form: 'homing', id: w.id });
    return true;
  }

  frost(w) {
    const st = w.st; const W = this.world; const p = W.p;
    const aim = this.aim(400);
    if (!aim) return false;
    const n = st.count;
    const full = st.spreadDeg >= 360;
    const spread = (st.spreadDeg * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const a = full ? aim.a + (i / n) * TAU : aim.a + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      W.projectiles.spawn('shard', p.x, p.y, Math.cos(a) * st.speed, Math.sin(a) * st.speed, st.size, st.dmg, st.pierce, st.life, w,
        { freezeChance: st.freezeChance, freezeTime: st.freezeTime, shatter: st.shatter || 0 });
    }
    W.events.emit('weapon:fire', { form: 'frost', id: w.id });
    return true;
  }

  meteor(w) {
    const st = w.st; const W = this.world; const p = W.p;
    if (!this.nearest(st.reach)) return false;
    for (let i = 0; i < st.count; i++) {
      let x; let y;
      const d = i === 0 ? W.grid.densest(p.x, p.y, st.reach) : null;
      if (d) { x = d.x; y = d.y; } else {
        const t = this.randomEnemy(st.reach);
        if (t) { x = t.x; y = t.y; } else { x = p.x + (W.rng.next() - 0.5) * 300; y = p.y + (W.rng.next() - 0.5) * 300; }
      }
      W.projectiles.addZone({ kind: 'meteor', x, y, r: st.radius, warn: st.warn + i * 0.08, duration: st.warn + i * 0.08 + 0.3, dmg: st.dmg, src: w, color: this.info(w).color });
    }
    W.events.emit('weapon:fire', { form: 'meteor', id: w.id });
    return true;
  }

  giantMeteor(w) {
    const st = w.st; const W = this.world; const p = W.p;
    const d = W.grid.densest(p.x, p.y, st.reach) || { x: p.x + (W.rng.next() - 0.5) * 200, y: p.y - 160 };
    W.projectiles.addZone({ kind: 'meteor', x: d.x, y: d.y, r: st.giantRadius, warn: 0.9, duration: 1.2, dmg: st.giantDmg * (W.player.s.might || 1), src: w, giant: true, color: '#ffd28a' });
  }
}
