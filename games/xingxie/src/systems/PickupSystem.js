// 拾取物：经验宝石 (蓝 1 / 绿 3 / 红 10 / 彩虹 50)、糖果 (回血)、磁铁 (吸全屏经验)、宝箱 (精英 / Boss 掉落)。
// 地上宝石超过 caps.gemMergeAt 时，把离玩家最远的一批合并成红宝石 (经验值累加)，保证宝石数量可控。
import { ObjectPool } from '../core/ObjectPool.js';
import { PICKUPS } from '../config/ProgressConfig.js';

const G = PICKUPS.gems;

function makeGem() { return { x: 0, y: 0, type: 'blue', value: 1, r: 6, magnet: false, sp: 0, t: 0 }; }

export class PickupSystem {
  constructor(world) {
    this.world = world;
    this.gems = new ObjectPool({ create: makeGem, prewarm: 400, max: world.caps.gems });
    this.items = [];
    this.mergeTimer = 0;
    this.collected = 0;
  }

  dropGem(x, y, type, value) {
    let g = this.gems.get();
    if (!g) { this.mergeFarthest(40); g = this.gems.get(); if (!g) return; }
    g.x = x + (this.world.rng.next() - 0.5) * 6; g.y = y + (this.world.rng.next() - 0.5) * 6;
    g.type = type; g.value = value; g.r = G[type].r; g.magnet = false; g.sp = 0; g.t = 0;
  }

  drop(kind, x, y) {
    this.items.push({ kind, x, y, r: kind === 'chest' ? PICKUPS.chest.r : 11, magnet: false, sp: 0, t: 0 });
    if (kind === 'chest') this.world.events.emit('chest:drop', { x, y });
  }

  pullAround(x, y, r) {
    const list = this.gems.active; const r2 = r * r;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (g.magnet) continue;
      const dx = g.x - x; const dy = g.y - y;
      if (dx * dx + dy * dy < r2) g.magnet = true;
    }
  }

  magnetAll() {
    for (const g of this.gems.active) g.magnet = true;
    this.world.events.emit('pickup:magnet', {});
  }

  update(dt) {
    const W = this.world; const p = W.p;
    const pr = p.pickup; const pr2 = pr * pr;
    const list = this.gems.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const g = list[i];
      g.t += dt;
      const dx = p.x - g.x; const dy = p.y - g.y; const d2 = dx * dx + dy * dy;
      if (!g.magnet && d2 < pr2) g.magnet = true;
      if (g.magnet) {
        const d = Math.sqrt(d2) || 1;
        g.sp = Math.min(PICKUPS.gemSpeed * 1.8, g.sp + PICKUPS.gemSpeed * 3 * dt + 20);
        const step = Math.min(d, g.sp * dt);
        g.x += (dx / d) * step; g.y += (dy / d) * step;
        if (d < p.r + g.r + 2) {
          W.player.gainExp(g.value);
          this.collected++;
          W.events.emit('gem:pickup', { type: g.type, value: g.value, x: g.x, y: g.y });
          this.gems.release(g);
        }
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const dx = p.x - it.x; const dy = p.y - it.y; const d = Math.hypot(dx, dy) || 1;
      if (!it.magnet && d < pr * 0.8 + it.r) it.magnet = true;
      if (it.magnet) {
        it.sp = Math.min(500, it.sp + 900 * dt);
        const step = Math.min(d, it.sp * dt);
        it.x += (dx / d) * step; it.y += (dy / d) * step;
      }
      if (d < p.r + it.r) {
        this.items.splice(i, 1);
        this.collect(it);
      }
    }
    this.mergeTimer += dt;
    if (this.mergeTimer >= 1) {
      this.mergeTimer = 0;
      const over = this.gems.activeCount - W.caps.gemMergeAt;
      if (over > 0) this.mergeFarthest(over + 20);
    }
  }

  collect(it) {
    const W = this.world;
    switch (it.kind) {
      case 'candy': W.player.heal(PICKUPS.candy.heal); W.events.emit('pickup:candy', { x: it.x, y: it.y }); break;
      case 'magnet': this.magnetAll(); break;
      case 'chest': W.levelup.queueChest(); break;
      default: break;
    }
  }

  /** 把最远的 n 颗宝石合并成一颗红宝石 */
  mergeFarthest(n) {
    const p = this.world.p; const list = this.gems.active;
    if (list.length < 2) return;
    const arr = list.filter((g) => !g.magnet).map((g) => ({ g, d: (g.x - p.x) ** 2 + (g.y - p.y) ** 2 }));
    arr.sort((a, b) => b.d - a.d);
    const take = arr.slice(0, Math.min(n, arr.length));
    if (take.length < 2) return;
    let sum = 0;
    const anchor = take[0].g;
    const ax = anchor.x; const ay = anchor.y;
    for (const { g } of take) { sum += g.value; this.gems.release(g); }
    const g = this.gems.get();
    if (!g) return;
    g.x = ax; g.y = ay; g.type = 'red'; g.value = sum; g.r = G.red.r + 2; g.magnet = false; g.sp = 0; g.t = 0;
  }
}
