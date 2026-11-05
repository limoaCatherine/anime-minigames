// 刷怪：读取 WaveConfig 时间轴 (分段权重 / 速率 / 同屏上限 / 定时事件)，在屏幕外的环带上生成怪物。
// 系统本身不写任何模式分支：难度只体现在 DifficultyConfig.spawnRate，Boss 在场时乘上 Boss 的 spawnRateMul。
import { ENEMY_RULES } from '../config/EnemyConfig.js';
import { GameConfig } from '../config/GameConfig.js';

const SCREEN_Y = GameConfig.camera.playerScreenY;

export class SpawnSystem {
  constructor(world) {
    this.world = world;
    this.acc = 0;
    this.fired = new Set();         // 已触发的事件
    this.tides = [];                // 进行中的怪潮 {enemy, left, rate, acc, side}
    this.segIndex = 0;
  }

  segment() {
    const segs = this.world.wave.segments; const t = this.world.time;
    while (this.segIndex < segs.length - 1 && t >= segs[this.segIndex].to) this.segIndex++;
    return segs[this.segIndex];
  }

  update(dt) {
    const w = this.world;
    const seg = this.segment();
    // 定时事件
    for (const segm of w.wave.segments) {
      if (!segm.events) continue;
      for (const ev of segm.events) {
        if (w.time >= ev.t && !this.fired.has(ev)) { this.fired.add(ev); this.fire(ev); }
      }
    }
    // 持续刷怪
    const k = Math.min(1, Math.max(0, (w.time - seg.from) / (seg.to - seg.from)));
    let rate = (seg.rate[0] + (seg.rate[1] - seg.rate[0]) * k) * w.diff.spawnRate;
    if (w.boss && w.boss.alive) rate *= w.boss.def.spawnRateMul || 1;
    if (w.lastStand) rate *= w.wave.lastStand.spawnMul;
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (w.enemies.normalCount >= seg.cap) { this.acc = 0; break; }
      const type = this.pick(seg.weights);
      const pos = this.spawnPoint();
      if (w.enemies.spawn(type, pos.x, pos.y)) w.enemies.normalCount++;
    }
    // 怪潮
    for (let i = this.tides.length - 1; i >= 0; i--) {
      const td = this.tides[i];
      td.acc += td.rate * dt;
      while (td.acc >= 1 && td.left > 0) {
        td.acc -= 1; td.left--;
        this.spawnFromSide(td.enemy, td.side, 1);
      }
      if (td.left <= 0) this.tides.splice(i, 1);
    }
  }

  pick(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = this.world.rng.next() * total;
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  }

  /** 屏幕外环带上的随机点；60% 概率在玩家移动方向前方 */
  spawnPoint(out = { x: 0, y: 0 }) {
    const w = this.world; const p = w.p; const rng = w.rng;
    let a;
    if (p.moving && rng.next() < ENEMY_RULES.spawnAhead) a = Math.atan2(p.facing.y, p.facing.x) + (rng.next() - 0.5) * 2.1;
    else a = rng.next() * Math.PI * 2;
    const cx = Math.cos(a); const cy = Math.sin(a);
    const hw = w.view.w / 2; const top = w.view.h * SCREEN_Y; const bottom = w.view.h * (1 - SCREEN_Y);
    const tx = cx !== 0 ? hw / Math.abs(cx) : Infinity;
    const ty = cy !== 0 ? (cy < 0 ? top : bottom) / Math.abs(cy) : Infinity;
    const [m0, m1] = ENEMY_RULES.spawnRing;
    const d = Math.min(tx, ty) + m0 + rng.next() * (m1 - m0);
    out.x = p.x + cx * d; out.y = p.y + cy * d;
    return out;
  }

  relocate(e) {
    const pos = this.spawnPoint();
    e.x = pos.x; e.y = pos.y; e.kvx = 0; e.kvy = 0;
  }

  spawnFromSide(type, side, count) {
    const w = this.world; const p = w.p; const rng = w.rng;
    const hw = w.view.w / 2 + 80; const hh = w.view.h / 2 + 80;
    for (let i = 0; i < count; i++) {
      let x; let y; let vx; let vy;
      const sp = 150;
      if (side === 0) { x = p.x - hw; y = p.y + (rng.next() - 0.5) * w.view.h * 0.9; vx = sp; vy = 0; }
      else if (side === 1) { x = p.x + hw; y = p.y + (rng.next() - 0.5) * w.view.h * 0.9; vx = -sp; vy = 0; }
      else if (side === 2) { x = p.x + (rng.next() - 0.5) * w.view.w; y = p.y - hh; vx = 0; vy = sp; }
      else { x = p.x + (rng.next() - 0.5) * w.view.w; y = p.y + hh; vx = 0; vy = -sp; }
      w.enemies.spawn(type, x, y, { vx, vy, life: 5 });
    }
  }

  fire(ev) {
    const w = this.world; const p = w.p;
    switch (ev.type) {
      case 'swarm': {
        const side = w.rng.int(4);
        this.spawnFromSide(ev.enemy, side, ev.count);
        w.events.emit('wave:event', { type: 'swarm', name: ev.text || '一群夜蝠糖飞过来了！' });
        break;
      }
      case 'ring': {
        for (let i = 0; i < ev.count; i++) {
          const a = (i / ev.count) * Math.PI * 2;
          const x = p.x + Math.cos(a) * ev.radius; const y = p.y + Math.sin(a) * ev.radius;
          w.enemies.spawn(ev.enemy, x, y, { vx: -Math.cos(a) * 34, vy: -Math.sin(a) * 34, life: 4 });
        }
        w.events.emit('wave:event', { type: 'ring', name: '玩偶把你围起来了，快找缺口！' });
        break;
      }
      case 'tide':
        this.tides.push({ enemy: ev.enemy, left: ev.count, rate: ev.count / ev.time, acc: 0, side: w.rng.int(4) });
        w.events.emit('wave:event', { type: 'tide', name: '噩梦潮来了！' });
        break;
      case 'elite': {
        const pos = this.spawnPoint();
        w.enemies.spawn(ev.enemy, pos.x, pos.y);
        break;
      }
      case 'boss':
        w.bosses.spawnBoss(ev.enemy);
        break;
      default:
        break;
    }
  }
}
