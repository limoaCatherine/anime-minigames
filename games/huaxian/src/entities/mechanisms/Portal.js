// 传送门 (一对)：敌人 / 石头 / 投射物 / 木箱 进入一个门，从另一个门飞出。
// 出口速度 = 入口速度按两门朝向旋转 (保持速率)，并保证沿出口朝向至少有 minOut 的速度。
// 画的线和主角不会被传送。门本身没有碰撞体，是禁画区。
import Matter from '../../lib/matter.js';
import { Mechanism } from './Mechanism.js';

const { Body } = Matter;
const COOLDOWN = 24; // 物理步：刚传送过的物体短时间内不会再被传送 (防止来回弹)

export class Portal extends Mechanism {
  constructor(world, def) {
    super(world, def);
    this.layer = 'back';
    const mk = ([x, y, deg]) => {
      const a = (deg * Math.PI) / 180;
      return { x, y, a, nx: Math.cos(a), ny: Math.sin(a), pulse: 0 };
    };
    this.mouths = [mk(def.a), mk(def.b)];
    this.warps = 0;
  }


  /** 两个门各自的禁画区 */
  zones() {
    const r = this.def.r;
    return this.mouths.map((m) => {
      const a1 = r * 0.6; const b1 = r * 1.05;
      const hw = Math.hypot(a1 * m.nx, b1 * m.ny); const hh = Math.hypot(a1 * m.ny, b1 * m.nx);
      return { x: m.x - hw, y: m.y - hh, w: hw * 2, h: hh * 2 };
    });
  }

  step() {
    const w = this.world;
    for (const m of this.mouths) if (m.pulse > 0) m.pulse -= 1 / 60;
    if (w.state === 'draw') return;
    const r = this.def.r;
    for (const ent of w.teleportables()) {
      for (const body of ent.bodies) {
        if (!body || body.isStatic) continue;
        const last = body.plugin.warpStep || -999;
        if (w.physics.steps - last < COOLDOWN) continue;
        for (let i = 0; i < 2; i++) {
          if (i === 1 && !this.def.twoWay) break;
          const m = this.mouths[i];
          const dx = body.position.x - m.x; const dy = body.position.y - m.y;
          // 门是沿朝向的薄椭圆：法向距离 < r*0.55，切向距离 < r
          const along = dx * m.nx + dy * m.ny;
          const side = -dx * m.ny + dy * m.nx;
          if (Math.abs(along) > r * 0.55 || Math.abs(side) > r) continue;
          const v = body.velocity;
          if (v.x * m.nx + v.y * m.ny > 0.3) continue; // 必须是「往门里走」
          this.warp(ent, body, m, this.mouths[1 - i], side);
          break;
        }
      }
    }
  }

  warp(ent, body, from, to, side) {
    const w = this.world;
    const rot = to.a - (from.a + Math.PI);
    const v = body.velocity;
    const cs = Math.cos(rot); const sn = Math.sin(rot);
    let vx = v.x * cs - v.y * sn; let vy = v.x * sn + v.y * cs;
    const out = vx * to.nx + vy * to.ny;
    if (out < this.def.minOut) { vx += to.nx * (this.def.minOut - out); vy += to.ny * (this.def.minOut - out); }
    const ext = Math.max(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / 2;
    const s = -side * 0.5; // 出门时切向位置镜像 (保持左右手感)，并稍微收拢
    const px = to.x + to.nx * (ext + 6) + -to.ny * s;
    const py = to.y + to.ny * (ext + 6) + to.nx * s;
    Body.setPosition(body, { x: px, y: py });
    Body.setVelocity(body, { x: vx, y: vy });
    body.plugin.warpStep = w.physics.steps;
    if (ent.onWarp) ent.onWarp(this);
    from.pulse = 0.35; to.pulse = 0.35;
    this.warps++;
    w.events.emit('portal:warp', { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, color: this.def.color, type: ent.type });
  }

  render(ctx, time) {
    const r = this.def.r;
    const color = this.def.color;
    for (const m of this.mouths) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.a);
      const s = 1 + Math.max(0, m.pulse) * 0.6;
      ctx.scale(s, s);
      // 光晕
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.25);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.45, hexA(color, 0.55));
      g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 1.25, 0, 0, Math.PI * 2); ctx.fill();
      // 旋涡
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.85)' : hexA(color, 0.9);
        ctx.beginPath();
        const ph = time * 4 + k * 2.1;
        ctx.ellipse(0, 0, r * (0.18 + k * 0.1), r * (0.45 + k * 0.2), 0, ph, ph + 3.6);
        ctx.stroke();
      }
      // 门框
      ctx.strokeStyle = color; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.4, r, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.4, r, 0, -1.2, 1.2); ctx.stroke();
      // 出口方向小箭头
      ctx.fillStyle = hexA(color, 0.8);
      const ax = r * 0.62 + Math.sin(time * 5) * 3;
      ctx.beginPath(); ctx.moveTo(ax, -6); ctx.lineTo(ax + 9, 0); ctx.lineTo(ax, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
