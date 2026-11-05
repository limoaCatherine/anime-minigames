// 标题 Logo：逐字弹跳的渐变描边大字 + 金色"了个" + 环绕闪光 + 粉色缎带副标题，全部用 Canvas 实时绘制。
import { GameConfig } from '../config/GameConfig.js';
import { drawGlow, drawHeart, roundRectPath } from './draw.js';

const CHARS = [
  { c: '美', size: 66, gold: false },
  { c: '少', size: 62, gold: false },
  { c: '女', size: 62, gold: false },
  { c: '了', size: 46, gold: true },
  { c: '个', size: 46, gold: true },
  { c: '美', size: 70, gold: false },
];

function star4(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.28 : r;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawLogo(ctx, cx, cy, t, scale = 1) {
  const font = GameConfig.fontFamily;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  drawGlow(ctx, 0, 0, 240, 'rgba(255,255,255,0.55)');

  // 量宽度
  const widths = CHARS.map((ch) => { ctx.font = `900 ${ch.size}px ${font}`; return ctx.measureText(ch.c).width; });
  const gap = -2;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (CHARS.length - 1);
  let x = -total / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  CHARS.forEach((ch, i) => {
    const w = widths[i];
    const bob = Math.sin(t * 3 + i * 0.7) * 5;
    const rot = (i % 2 ? 1 : -1) * 0.06 + Math.sin(t * 2 + i) * 0.02;
    const by = ch.gold ? 10 : 22;
    ctx.save();
    ctx.translate(x + w / 2, by + bob);
    ctx.rotate(rot);
    ctx.font = `900 ${ch.size}px ${font}`;
    // 外描边 (深色) → 白描边 → 渐变填充 → 顶部高光
    ctx.strokeStyle = ch.gold ? '#c96a00' : '#b8337a';
    ctx.lineWidth = 17;
    ctx.strokeText(ch.c, 0, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.strokeText(ch.c, 0, 0);
    const g = ctx.createLinearGradient(0, -ch.size * 0.85, 0, ch.size * 0.1);
    if (ch.gold) {
      g.addColorStop(0, '#fff3a6'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#ff9500');
    } else {
      g.addColorStop(0, '#ffb3d9'); g.addColorStop(0.45, '#ff5fa2'); g.addColorStop(1, '#a35cff');
    }
    ctx.fillStyle = g;
    ctx.fillText(ch.c, 0, 0);
    ctx.globalAlpha = 0.55;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w, -ch.size, w * 2, ch.size * 0.42);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch.c, 0, 0);
    ctx.restore();
    ctx.restore();
    x += w + gap;
  });

  // 小爱心点缀在最后一个"美"右上
  ctx.save();
  ctx.translate(total / 2 + 6, -46 + Math.sin(t * 4) * 3);
  ctx.rotate(0.3);
  const hs = 1 + Math.sin(t * 6) * 0.08;
  ctx.scale(hs, hs);
  ctx.fillStyle = '#fff';
  drawHeart(ctx, 0, 0, 15);
  ctx.fillStyle = '#ff4f86';
  drawHeart(ctx, 0, 0, 11);
  ctx.restore();

  // 缎带副标题
  const rw = 300; const rh = 38; const ry = 52;
  ctx.save();
  ctx.fillStyle = '#d9468f';
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    const ex = sgn * (rw / 2 + 4);
    ctx.moveTo(ex, ry + 6);
    ctx.lineTo(ex + sgn * 34, ry + 6);
    ctx.lineTo(ex + sgn * 22, ry + 6 + rh / 2);
    ctx.lineTo(ex + sgn * 34, ry + 6 + rh);
    ctx.lineTo(ex, ry + 6 + rh);
    ctx.closePath();
    ctx.fill();
  }
  const rg = ctx.createLinearGradient(0, ry, 0, ry + rh);
  rg.addColorStop(0, '#ff8fc4');
  rg.addColorStop(1, '#ff5fa2');
  roundRectPath(ctx, -rw / 2, ry, rw, rh, 10);
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.font = `bold 19px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('AnimeStack · 凑三张就消', 0, ry + rh / 2 + 1);
  ctx.restore();

  // 环绕闪光
  const spots = [[-200, -50], [196, -20], [-150, 40], [170, 60], [-40, -78], [90, -82]];
  spots.forEach(([sx, sy], i) => {
    const k = (Math.sin(t * 2.4 + i * 1.7) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * k;
    ctx.fillStyle = i % 2 ? '#fff6a8' : '#ffffff';
    ctx.translate(sx, sy);
    ctx.rotate(t * 0.8 + i);
    star4(ctx, 0, 0, 7 + k * 7);
    ctx.restore();
  });
  ctx.restore();
}
