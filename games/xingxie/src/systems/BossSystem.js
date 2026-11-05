// Boss：2:30 数羊王·咩咩卿 (羊群奔腾 / 催眠泡泡 / 枕头重压，每 3 秒轮流放)，
//       4:00 梦魇女王·诺克丝 (永夜花环弹幕 / 暗影囚笼 / 血量 40% 以下分出两个镜像)。
// 技能参数全部在 EnemyConfig；这里只负责按时间轴执行。
import { ENEMIES, CC_RULES } from '../config/EnemyConfig.js';
import { PICKUPS } from '../config/ProgressConfig.js';
import { GameConfig } from '../config/GameConfig.js';

const TAU = Math.PI * 2;

export class BossSystem {
  constructor(world) {
    this.world = world;
    this.pending = [];        // 延时动作 [{at, fn}]
    this.mirrors = [];
  }

  spawnBoss(type) {
    const W = this.world; const p = W.p; const def = ENEMIES[type];
    if (W.boss && W.boss.alive) this.retreat(W.boss, 'replaced'); // 上一个 Boss 还没打完：让它先撤
    const e = W.enemies.spawn(type, p.x, p.y - W.view.h * GameConfig.camera.playerScreenY - 60);
    if (!e) return null;
    e.spawnAt = W.time;
    e.skillT = 2.0; e.skillIdx = 0; e.air = 0; e.mirrored = false; e.wreathT = 2.5; e.cageT = def.cage ? def.cage.first : 0;
    W.boss = e;
    W.stats.bossSpawnAt[type] = W.time;
    W.events.emit('boss:spawn', { type, name: def.name, line: def.line });
    return e;
  }

  /** 撤退：不掉落、不算击杀，直接离场 */
  retreat(b, reason = 'timeout') {
    const W = this.world;
    b.alive = false;
    W.enemies.dead.push(b);
    if (W.boss === b) W.boss = null;
    for (const m of this.mirrors) if (m.alive) { m.alive = false; W.enemies.dead.push(m); }
    this.mirrors.length = 0;
    this.pending.length = 0;
    W.events.emit('boss:retreat', { type: b.type, name: b.def.name, x: b.x, y: b.y, reason });
  }

  /** 被甩出画面太远：瞬移回屏幕边缘 (不让玩家靠跑图把 Boss 拖死 / 甩掉) */
  leash(b) {
    const W = this.world; const p = W.p;
    const dx = b.x - p.x; const dy = b.y - p.y;
    if (dx * dx + dy * dy < CC_RULES.leash * CC_RULES.leash || b.air > 0) return;
    const pos = W.spawner.spawnPoint();
    b.x = pos.x; b.y = pos.y; b.kvx = 0; b.kvy = 0;
    W.events.emit('boss:blink', { type: b.type, x: b.x, y: b.y });
  }

  later(delay, fn) { this.pending.push({ at: this.world.time + delay, fn }); }

  update(dt) {
    const W = this.world;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (W.time >= this.pending[i].at) { const a = this.pending[i]; this.pending.splice(i, 1); a.fn(); }
    }
    const b = W.boss;
    if (b && b.alive && b.def.leaveAfter && W.time - b.spawnAt >= b.def.leaveAfter && !W.lastStand) { this.retreat(b); return; }
    if (b && b.alive) {
      this.leash(b);
      if (b.type === 'sheepKing') this.sheep(b, dt);
      else if (b.type === 'nox') this.nox(b, dt);
    }
    for (let i = this.mirrors.length - 1; i >= 0; i--) {
      const m = this.mirrors[i];
      if (!m.alive) { this.mirrors.splice(i, 1); continue; }
      this.chase(m, dt, 120);
      m.wreathT -= dt;
      if (m.wreathT <= 0) { m.wreathT = ENEMIES.nox.mirror.wreathEvery; this.wreathRound(m, W.rng.next() * TAU, ENEMIES.nox.wreath); }
    }
  }

  chase(e, dt, keep = 0) {
    if (e.freeze > 0 || e.stun > 0) return;
    const p = this.world.p;
    const dx = p.x - e.x; const dy = p.y - e.y; const d = Math.hypot(dx, dy) || 1;
    if (d < keep) return;
    const sp = e.speed * (1 - (e.slow || 0));
    e.x += (dx / d) * sp * dt; e.y += (dy / d) * sp * dt;
  }

  // ---------------- 数羊王 ----------------
  sheep(b, dt) {
    const W = this.world; const def = b.def; const p = W.p;
    if (b.air > 0) { b.air -= dt; return; }        // 跳起中 (枕头重压)
    this.chase(b, dt);
    b.skillT -= dt;
    if (b.skillT > 0) return;
    b.skillT = def.skillGap;
    const skill = def.skills[b.skillIdx % def.skills.length];
    b.skillIdx++;
    W.events.emit('boss:skill', { type: b.type, skill });
    if (skill === 'stampede') {
      const s = def.stampede;
      const dir = W.rng.next() < 0.5 ? 1 : -1;
      for (let l = 0; l < s.lanes; l++) {
        const y = p.y + (l - (s.lanes - 1) / 2) * s.laneGap + (W.rng.next() - 0.5) * 40;
        W.projectiles.addZone({ kind: 'lane', x: p.x, y, r: 26, w: W.view.w + 200, duration: s.warn, hostile: true, dir });
        this.later(s.warn, () => {
          const startX = W.p.x - dir * (W.view.w / 2 + 60);
          for (let k = 0; k < s.sheep; k++) {
            W.enemies.spawnHazard('stampedeSheep', startX - dir * k * 46, y + (W.rng.next() - 0.5) * 18, { vx: dir * s.speed, vy: 0, life: (W.view.w + 200 + k * 46) / s.speed + 0.3 });
          }
          W.events.emit('boss:stampede', { y });
        });
      }
    } else if (skill === 'sleepBubbles') {
      const s = def.sleepBubbles;
      for (let k = 0; k < s.count; k++) {
        const a = W.rng.next() * TAU; const r = k === 0 ? 0 : s.spread * (0.6 + W.rng.next() * 0.6);
        W.projectiles.addZone({ kind: 'sleep', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: s.radius, slow: s.slow, duration: s.duration, hostile: true });
      }
    } else if (skill === 'pillowSlam') {
      const s = def.pillowSlam;
      const tx = p.x; const ty = p.y;
      b.air = s.airTime;
      W.projectiles.addZone({ kind: 'pillow', x: tx, y: ty, r: s.radius, warn: s.warn, dmg: s.dmg, duration: s.warn + 0.25, hostile: true });
      this.later(s.warn, () => { if (b.alive) { b.x = tx; b.y = ty; W.events.emit('shake', { amount: 10 }); } });
    }
  }

  // ---------------- 诺克丝 ----------------
  nox(b, dt) {
    const W = this.world; const def = b.def; const p = W.p;
    this.chase(b, dt, 130);
    b.wreathT -= dt;
    if (b.wreathT <= 0) {
      const wr = def.wreath;
      b.wreathT = wr.every;
      const base = W.rng.next() * TAU;
      for (let r = 0; r < wr.rounds; r++) this.later(r * wr.roundGap, () => { if (b.alive) this.wreathRound(b, base + (r * wr.rotate * Math.PI) / 180, wr); });
      W.events.emit('boss:skill', { type: 'nox', skill: 'wreath' });
    }
    b.cageT -= dt;
    if (b.cageT <= 0) {
      const c = def.cage;
      b.cageT = c.every;
      W.projectiles.addZone({ kind: 'cage', x: p.x, y: p.y, r: c.radius, duration: c.duration, dmg: c.dmg, tickGap: c.tickGap, hostile: true });
      for (let k = 0; k < c.bats; k++) {
        const a = (k / c.bats) * TAU;
        W.enemies.spawn('bat', p.x + Math.cos(a) * (c.radius - 30), p.y + Math.sin(a) * (c.radius - 30));
      }
      W.events.emit('boss:skill', { type: 'nox', skill: 'cage' });
    }
    if (!b.mirrored && b.hp < b.maxHp * def.mirror.below) {
      b.mirrored = true;
      const m = def.mirror;
      for (let k = 0; k < m.count; k++) {
        const a = W.rng.next() * TAU;
        const e = W.enemies.spawn('noxMirror', b.x + Math.cos(a) * 120, b.y + Math.sin(a) * 120, { hp: m.hp, fixedHp: true });
        if (e) { e.wreathT = 1.5 + k; this.mirrors.push(e); }
      }
      const a = W.rng.next() * TAU;
      b.x = p.x + Math.cos(a) * 220; b.y = p.y + Math.sin(a) * 220;
      W.events.emit('boss:skill', { type: 'nox', skill: 'mirror' });
    }
  }

  wreathRound(src, base, wr) {
    const W = this.world; const bl = wr.bullet;
    for (let k = 0; k < wr.dirs; k++) {
      const a = base + (k / wr.dirs) * TAU;
      W.projectiles.enemyBullet(src.x, src.y, Math.cos(a) * bl.speed, Math.sin(a) * bl.speed, bl.r, bl.dmg, bl.life, 'nox');
    }
  }

  onDie(e) {
    const W = this.world;
    if (e.type === 'noxMirror') return;
    const def = e.def;
    W.bossKills[e.type] = (W.bossKills[e.type] || 0) + 1;
    W.stats.bossKillAt[e.type] = W.time;
    if (W.boss === e) W.boss = null;
    for (let k = 0; k < (def.drops.rainbow || 0); k++) {
      const a = (k / def.drops.rainbow) * TAU;
      W.pickups.dropGem(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 'rainbow', PICKUPS.gems.rainbow.exp);
    }
    for (let k = 0; k < (def.drops.chest || 0); k++) W.pickups.drop('chest', e.x, e.y);
    if (e.type === 'nox') for (const m of this.mirrors) if (m.alive) W.enemies.kill(m);
    W.events.emit('boss:die', { type: e.type, name: def.name, x: e.x, y: e.y });
  }
}
