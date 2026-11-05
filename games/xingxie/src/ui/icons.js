// 武器 / 被动 / 天赋图标：全部用 Canvas 路径画 (不依赖图片)，并缓存成离屏画布。
import { drawStar, roundRectPath } from './draw.js';
import { platform } from '../core/platform/index.js';

const cache = new Map();

function paint(ctx, name, s, color) {
  const k = s / 48;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5 * k;
  const P = (fn) => { ctx.beginPath(); fn(); };
  switch (name) {
    case 'star':
      drawStar(ctx, 0, 0, 18 * k, 8 * k); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5 * k, -5 * k, 3 * k, 0, 7); ctx.fill();
      break;
    case 'blade':
      ctx.rotate(-0.7);
      P(() => { ctx.moveTo(-3 * k, 10 * k); ctx.lineTo(-3 * k, -18 * k); ctx.quadraticCurveTo(4 * k, -12 * k, 3 * k, 10 * k); ctx.closePath(); }); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a4b8c'; ctx.fillRect(-9 * k, 9 * k, 18 * k, 4 * k); ctx.fillRect(-2.5 * k, 13 * k, 5 * k, 8 * k);
      break;
    case 'ring':
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 - 1.2;
        ctx.save(); ctx.translate(Math.cos(a) * 11 * k, Math.sin(a) * 11 * k); ctx.rotate(a + 1.57);
        roundRectPath(ctx, -5 * k, -8 * k, 10 * k, 16 * k, 2 * k); ctx.fillStyle = '#fff3d6'; ctx.fill(); ctx.strokeStyle = color; ctx.stroke();
        ctx.fillStyle = color; ctx.fillRect(-2 * k, -4 * k, 4 * k, 8 * k);
        ctx.restore();
      }
      ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, 11 * k, 0, 7); ctx.stroke();
      break;
    case 'bolt':
      P(() => { ctx.moveTo(4 * k, -19 * k); ctx.lineTo(-10 * k, 3 * k); ctx.lineTo(-1 * k, 3 * k); ctx.lineTo(-5 * k, 19 * k); ctx.lineTo(10 * k, -4 * k); ctx.lineTo(1 * k, -4 * k); ctx.closePath(); });
      ctx.fill(); ctx.stroke();
      break;
    case 'heart':
      P(() => { ctx.moveTo(0, 16 * k); ctx.bezierCurveTo(-22 * k, 2 * k, -12 * k, -18 * k, 0, -7 * k); ctx.bezierCurveTo(12 * k, -18 * k, 22 * k, 2 * k, 0, 16 * k); });
      ctx.fill(); ctx.stroke();
      break;
    case 'rose':
      for (let i = 0; i < 5; i++) { const a = i * 1.2566; P(() => ctx.arc(Math.cos(a) * 8 * k, Math.sin(a) * 8 * k, 8 * k, 0, 7)); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; P(() => ctx.arc(0, 0, 5 * k, 0, 7)); ctx.fill();
      break;
    case 'crane':
      P(() => { ctx.moveTo(-18 * k, 4 * k); ctx.lineTo(0, -4 * k); ctx.lineTo(18 * k, -14 * k); ctx.lineTo(6 * k, 4 * k); ctx.lineTo(14 * k, 12 * k); ctx.lineTo(-2 * k, 8 * k); ctx.closePath(); });
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = color === '#ffffff' ? '#8f7cff' : color; ctx.stroke();
      break;
    case 'crystal':
      for (const [dx, h] of [[-8, 14], [0, 20], [8, 12]]) {
        P(() => { ctx.moveTo(dx * k, -h * k); ctx.lineTo((dx + 5) * k, 0); ctx.lineTo(dx * k, 14 * k); ctx.lineTo((dx - 5) * k, 0); ctx.closePath(); });
        ctx.fill(); ctx.stroke();
      }
      break;
    case 'meteor': { // 放大：彗尾占满左上角，星核半径 15 (原 10)，加高光和陨坑，小尺寸下也认得出
      ctx.globalAlpha = 0.35; P(() => { ctx.moveTo(-21 * k, -14 * k); ctx.lineTo(-14 * k, -21 * k); ctx.lineTo(8 * k, -8 * k); ctx.lineTo(-8 * k, 8 * k); ctx.closePath(); }); ctx.fill();
      ctx.globalAlpha = 0.7; P(() => { ctx.moveTo(-19 * k, -19 * k); ctx.lineTo(9 * k, -5 * k); ctx.lineTo(-5 * k, 9 * k); ctx.closePath(); }); ctx.fill();
      ctx.globalAlpha = 1; P(() => ctx.arc(4 * k, 4 * k, 15 * k, 0, 7)); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; P(() => ctx.arc(-1 * k, -1 * k, 5 * k, 0, 7)); ctx.fill();
      ctx.fillStyle = 'rgba(90,40,30,0.35)'; P(() => { ctx.arc(9 * k, 8 * k, 3.2 * k, 0, 7); ctx.moveTo(5 * k, 14 * k); ctx.arc(3 * k, 13 * k, 2 * k, 0, 7); }); ctx.fill();
      break;
    }
    case 'gem':
      P(() => { ctx.moveTo(0, -17 * k); ctx.lineTo(14 * k, -4 * k); ctx.lineTo(0, 17 * k); ctx.lineTo(-14 * k, -4 * k); ctx.closePath(); }); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; P(() => { ctx.moveTo(0, -17 * k); ctx.lineTo(5 * k, -4 * k); ctx.lineTo(-5 * k, -4 * k); ctx.closePath(); }); ctx.fill();
      break;
    case 'watch':
      P(() => ctx.arc(0, 3 * k, 14 * k, 0, 7)); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; P(() => ctx.arc(0, 3 * k, 10 * k, 0, 7)); ctx.fill();
      ctx.strokeStyle = '#5a3d6e'; P(() => { ctx.moveTo(0, 3 * k); ctx.lineTo(0, -4 * k); ctx.moveTo(0, 3 * k); ctx.lineTo(5 * k, 6 * k); }); ctx.stroke();
      ctx.fillStyle = color; P(() => { ctx.ellipse(-7 * k, -15 * k, 3 * k, 7 * k, -0.3, 0, 7); ctx.ellipse(7 * k, -15 * k, 3 * k, 7 * k, 0.3, 0, 7); }); ctx.fill();
      break;
    case 'book':
      roundRectPath(ctx, -14 * k, -16 * k, 28 * k, 32 * k, 4 * k); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; drawStar(ctx, 0, 0, 8 * k, 3.5 * k);
      break;
    case 'pin':
      for (const dx of [-8, 8]) { P(() => ctx.arc(dx * k, 0, 8 * k, 0, 7)); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#fff'; drawStar(ctx, -8 * k, 0, 4 * k, 2 * k); drawStar(ctx, 8 * k, 0, 4 * k, 2 * k);
      break;
    case 'bell':
      P(() => { ctx.moveTo(-14 * k, 10 * k); ctx.quadraticCurveTo(-12 * k, -16 * k, 0, -16 * k); ctx.quadraticCurveTo(12 * k, -16 * k, 14 * k, 10 * k); ctx.closePath(); }); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3d6e'; P(() => ctx.arc(0, 12 * k, 4 * k, 0, 7)); ctx.fill();
      break;
    case 'cake':
      roundRectPath(ctx, -15 * k, -2 * k, 30 * k, 16 * k, 4 * k); ctx.fillStyle = '#fff3d6'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; roundRectPath(ctx, -15 * k, -6 * k, 30 * k, 8 * k, 4 * k); ctx.fill();
      P(() => ctx.arc(0, -12 * k, 6 * k, 0, 7)); ctx.fill(); ctx.stroke();
      break;
    case 'boots':
      P(() => { ctx.moveTo(-6 * k, -16 * k); ctx.lineTo(6 * k, -16 * k); ctx.lineTo(6 * k, 4 * k); ctx.lineTo(16 * k, 8 * k); ctx.lineTo(16 * k, 14 * k); ctx.lineTo(-8 * k, 14 * k); ctx.closePath(); }); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; P(() => { ctx.moveTo(-6 * k, -10 * k); ctx.lineTo(-18 * k, -16 * k); ctx.lineTo(-14 * k, -4 * k); ctx.closePath(); }); ctx.fill();
      break;
    case 'cape':
      P(() => { ctx.moveTo(-6 * k, -16 * k); ctx.lineTo(6 * k, -16 * k); ctx.quadraticCurveTo(18 * k, 4 * k, 16 * k, 16 * k); ctx.lineTo(-16 * k, 16 * k); ctx.quadraticCurveTo(-18 * k, 4 * k, -6 * k, -16 * k); ctx.closePath(); }); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; drawStar(ctx, 0, 2 * k, 6 * k, 2.5 * k);
      break;
    case 'coin':
      P(() => ctx.arc(0, 0, 15 * k, 0, 7)); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; drawStar(ctx, 0, 0, 8 * k, 3.5 * k);
      break;
    case 'reroll':
      ctx.strokeStyle = color; ctx.lineWidth = 5 * k;
      P(() => ctx.arc(0, 0, 12 * k, -0.4, 4.2)); ctx.stroke();
      ctx.fillStyle = color; P(() => { ctx.moveTo(14 * k, -12 * k); ctx.lineTo(16 * k, 2 * k); ctx.lineTo(4 * k, -4 * k); ctx.closePath(); }); ctx.fill();
      break;
    case 'skull':
      P(() => ctx.arc(0, -3 * k, 13 * k, 0, 7)); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a1f5c'; P(() => { ctx.arc(-5 * k, -3 * k, 3.5 * k, 0, 7); ctx.arc(5 * k, -3 * k, 3.5 * k, 0, 7); }); ctx.fill();
      break;
    default:
      P(() => ctx.arc(0, 0, 14 * k, 0, 7)); ctx.fill();
  }
  ctx.restore();
}

/** 画一个图标 (中心 x,y，边长 size) */
export function drawIcon(ctx, name, x, y, size, color = '#ff6fa8') {
  const key = `${name}|${color}|${Math.round(size)}`;
  let c = cache.get(key);
  if (!c) {
    const px = Math.ceil(size * 2);
    c = platform.createCanvas(px, px);
    if (!c) return;
    const g = c.getContext('2d');
    g.translate(px / 2, px / 2); g.scale(2, 2);
    paint(g, name, size, color);
    cache.set(key, c);
  }
  ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
}
