// 章节背景：关卡背景图 + 章节色调 + 程序绘制的主题装饰 (春日花瓣 / 公司夜景 / 过年灯笼烟花 / 星空)。
import { drawImageCover, drawStar, roundRectPath, drawText } from './draw.js';

// 预生成的伪随机装饰位置 (固定种子，保证每帧一致)
function seeded(n, seed) {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return Array.from({ length: n }, () => ({ a: r(), b: r(), c: r(), d: r() }));
}
const PETALS = seeded(14, 11);
const STARS = seeded(46, 23);
const BUILDINGS = seeded(11, 37);
const FIREWORKS = seeded(4, 51);

export function drawBackdrop(ctx, assets, theme, W, H, time) {
  drawImageCover(ctx, assets.getImage('bg_level'), W, H, theme.wash);
  if (theme.tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = theme.tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const fn = PROPS[theme.props];
  if (fn) { ctx.save(); fn(ctx, W, H, time); ctx.restore(); }
}

const PROPS = {
  spring(ctx, W, H, t) {
    // 飘落的樱花瓣
    for (const p of PETALS) {
      const y = ((p.b * H + t * (18 + p.c * 20)) % (H - 140)) + 120;
      const x = p.a * W + Math.sin(t * 0.8 + p.d * 6) * 22;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (0.6 + p.c) + p.d * 6);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffc3dc';
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  },

  office(ctx, W, H, t) {
    // 远处的写字楼夜景 (亮着加班的窗户)
    ctx.globalAlpha = 0.42;
    let x = -10;
    for (const b of BUILDINGS) {
      const w = 40 + b.a * 46; const h = 150 + b.b * 230;
      const top = 600 - h;
      ctx.fillStyle = '#5b63a8';
      ctx.fillRect(x, top, w, h + 40);
      for (let wy = top + 10; wy < 590; wy += 16) {
        for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          const on = ((wx * 13 + wy * 7 + Math.floor(b.c * 50)) % 5) < 2;
          ctx.fillStyle = on ? '#ffe9a8' : '#7c84c6';
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
      x += w + 4;
      if (x > W) break;
    }
    ctx.globalAlpha = 1;
    // 落地窗窗框
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 6;
    for (const fx of [135, 270, 405]) { ctx.beginPath(); ctx.moveTo(fx, 112); ctx.lineTo(fx, 620); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 380); ctx.lineTo(W, 380); ctx.stroke();
    // 挂钟：指针转得飞快 (加班中...)
    const cx = 476; const cy = 228;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#6f86e8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5a3d6e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t * 0.5 - 1.6) * 11, cy + Math.sin(t * 0.5 - 1.6) * 11); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t * 4) * 17, cy + Math.sin(t * 4) * 17); ctx.stroke();
    // 便利贴
    ctx.globalAlpha = 0.7;
    [['#ffe066', 52, 226, -0.1], ['#ff9cc8', 80, 248, 0.12], ['#a8e6a1', 46, 262, 0.05]].forEach(([c, x2, y2, r]) => {
      ctx.save(); ctx.translate(x2, y2); ctx.rotate(r); ctx.fillStyle = c; ctx.fillRect(-12, -12, 24, 24); ctx.restore();
    });
  },

  newyear(ctx, W, H, t) {
    // 烟花 (周期性绽放)
    FIREWORKS.forEach((f, i) => {
      const period = 3.2 + f.a * 1.5;
      const k = ((t + i * 1.1) % period) / period;
      if (k > 0.45) return;
      const cx = 80 + f.b * (W - 160); const cy = 250 + f.c * 160;
      const r = 20 + k * 110;
      ctx.globalAlpha = 0.5 * (1 - k / 0.45);
      const colors = ['#ffd23f', '#ff6f6f', '#ff9cc8', '#ffe9a8'];
      for (let j = 0; j < 14; j++) {
        const a = (j / 14) * Math.PI * 2 + f.d;
        ctx.fillStyle = colors[(j + i) % colors.length];
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r + k * 20, 3, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    // 红灯笼
    for (const [lx, ly, ph] of [[38, 132, 0], [502, 132, 1.3]]) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(Math.sin(t * 1.5 + ph) * 0.08);
      ctx.strokeStyle = '#b8323a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 0); ctx.stroke();
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath(); ctx.ellipse(0, 26, 24, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,120,0.9)'; ctx.lineWidth = 1.5;
      for (const ex of [-12, 0, 12]) { ctx.beginPath(); ctx.ellipse(0, 26, Math.abs(ex) + 2, 22, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-10, 2, 20, 5); ctx.fillRect(-10, 45, 20, 5);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 4, 50); ctx.lineTo(k * 4, 64); ctx.stroke(); }
      ctx.restore();
    }
    // 福字窗花 (倒贴)
    ctx.save();
    ctx.translate(270, 330); ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ff4d4d';
    roundRectPath(ctx, -46, -46, 92, 92, 8); ctx.fill();
    ctx.rotate(-Math.PI / 4 + Math.PI);
    ctx.globalAlpha = 0.35;
    drawText(ctx, '福', 0, 4, { size: 64, color: '#ffd23f' });
    ctx.restore();
  },

  night(ctx, W, H, t) {
    for (const s of STARS) {
      ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * (0.8 + s.c) + s.d * 6));
      ctx.fillStyle = '#ffffff';
      const x = s.a * W; const y = 120 + s.b * 480;
      if (s.c > 0.75) drawStar(ctx, x, y, 5, 2); else { ctx.beginPath(); ctx.arc(x, y, 1.3 + s.d * 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
    // 月亮
    ctx.globalAlpha = 0.85;
    const g = ctx.createRadialGradient(462, 236, 6, 462, 236, 60);
    g.addColorStop(0, 'rgba(255,250,220,0.9)'); g.addColorStop(0.5, 'rgba(255,240,200,0.25)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(462, 236, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(462, 236, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(70,40,140,0.55)'; ctx.beginPath(); ctx.arc(474, 228, 21, 0, Math.PI * 2); ctx.fill();
    // 流星
    const k = (t % 7) / 7;
    if (k < 0.12) {
      const p = k / 0.12;
      ctx.globalAlpha = 0.8 * (1 - p);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      const x = 120 + p * 260; const y = 170 + p * 120;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 50, y - 23); ctx.stroke();
    }
  },
};
