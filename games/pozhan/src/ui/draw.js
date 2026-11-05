// 通用绘制工具：圆角矩形、描边文字、星形、背景等。
import { GameConfig } from '../config/GameConfig.js';

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function drawText(ctx, str, x, y, {
  size = 24, color = '#fff', align = 'center', baseline = 'middle', weight = 'bold',
  stroke = null, strokeWidth = 4, shadow = null,
} = {}) {
  ctx.save();
  ctx.font = `${weight} ${Math.round(size)}px ${GameConfig.fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(str, x, y);
    ctx.shadowColor = 'transparent';
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function drawStar(ctx, x, y, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawPanel(ctx, x, y, w, h, r = 24, fill = GameConfig.colors.panel) {
  ctx.save();
  ctx.shadowColor = 'rgba(120,60,140,0.25)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

// 背景装饰点 (预生成，避免每帧随机)
const SPARKLES = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 197.3) % GameConfig.width,
  y: (i * 331.7) % GameConfig.height,
  s: 2 + ((i * 7) % 5),
  p: i * 0.7,
  star: i % 3 === 0,
}));

export function drawBackground(ctx, w, h, time) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, GameConfig.colors.bgTop);
  g.addColorStop(1, GameConfig.colors.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  for (const s of SPARKLES) {
    const y = (s.y - time * (6 + s.s * 2)) % h;
    const yy = y < 0 ? y + h : y;
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 1.5 + s.p);
    ctx.fillStyle = '#ffffff';
    if (s.star) drawStar(ctx, s.x, yy, s.s * 1.8, s.s * 0.7);
    else { ctx.beginPath(); ctx.arc(s.x, yy, s.s, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

/** 绘制圆形头像 (图片本身已是圆形透明 PNG) */
export function drawPortrait(ctx, img, x, y, r, alpha = 1) {
  if (!img) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export const easing = {
  backOut: (t, s = 1.70158) => { const u = t - 1; return u * u * ((s + 1) * u + s) + 1; },
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  elasticOut: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

// 飘落的樱花瓣 (预生成参数，避免每帧随机)：三种深度 (远处小而慢、近处大而快)
const PETALS = Array.from({ length: 26 }, (_, i) => {
  const depth = i % 3; // 0 远 1 中 2 近
  return {
    x: (i * 211.7) % GameConfig.width,
    y: (i * 377.3) % GameConfig.height,
    s: [3.5, 5.5, 8][depth] + (i % 4) * 0.6,
    sp: [16, 26, 42][depth] + (i % 5) * 4,
    sway: [10, 18, 30][depth],
    a: [0.45, 0.6, 0.78][depth],
    p: i * 1.3,
    c: ['#ffd1e3', '#ffc0d9', '#ffe4ef'][i % 3],
  };
});

/** 一片樱花瓣 (末端带缺口的水滴形) */
export function drawPetal(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(s * 1.1, s * 0.4, s * 0.9, -s * 0.9, s * 0.25, -s);
  ctx.lineTo(0, -s * 0.72);
  ctx.lineTo(-s * 0.25, -s);
  ctx.bezierCurveTo(-s * 0.9, -s * 0.9, -s * 1.1, s * 0.4, 0, s);
  ctx.closePath();
  ctx.fill();
}

export function drawPetals(ctx, w, h, time, alpha = 1, count = PETALS.length) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const p = PETALS[i];
    const y = (p.y + time * p.sp) % (h + 30) - 15;
    const x = (p.x + Math.sin(time * 0.7 + p.p) * p.sway + time * p.sp * 0.25) % (w + 30) - 15;
    ctx.globalAlpha = p.a * alpha;
    ctx.fillStyle = p.c;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.8 + p.p);
    ctx.scale(Math.sin(time * 1.6 + p.p), 1); // 翻转
    drawPetal(ctx, p.s);
    ctx.restore();
  }
  ctx.restore();
}

/** 樱花天空背景图 (cover) + 飘落花瓣；无图片时退回渐变背景 */
export function drawImageBackground(ctx, img, w, h, time, petals = true) {
  if (!img) { drawBackground(ctx, w, h, time); return; }
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const k = Math.max(w / iw, h / ih);
  const dw = iw * k; const dh = ih * k;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  if (petals) drawPetals(ctx, w, h, time, 1, petals === true ? 16 : petals);
}

/** 柔光 (径向渐变光晕) */
export function drawGlow(ctx, x, y, r, color = 'rgba(255,255,255,0.6)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 爱心 */
export function drawHeart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.8, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.8, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  ctx.closePath();
  ctx.fill();
}

/** 小锁 */
export function drawLock(ctx, x, y, s, color = '#8f7fa3') {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.18;
  ctx.beginPath(); ctx.arc(x, y - s * 0.15, s * 0.36, Math.PI, 0); ctx.stroke();
  roundRectPath(ctx, x - s * 0.55, y - s * 0.15, s * 1.1, s * 0.85, s * 0.18); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y + s * 0.22, s * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
