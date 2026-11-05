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

/** 背景图 cover 绘制 (图片已是 9:16 竖版) + 可选白色柔化遮罩 */
export function drawImageCover(ctx, img, w, h, wash = 0) {
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s; const ih = img.height * s;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, GameConfig.colors.bgTop);
    g.addColorStop(1, GameConfig.colors.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (wash > 0) {
    ctx.fillStyle = `rgba(255,246,251,${wash})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/** 敌人头顶的台词气泡 */
export function drawSpeech(ctx, text, x, y, life, color = '#e2457f') {
  const appear = Math.min(1, life / 0.15);
  const alpha = life > 1.3 ? Math.max(0, 1 - (life - 1.3) / 0.3) : 1;
  ctx.save();
  ctx.font = `bold 15px ${GameConfig.fontFamily}`;
  const w = ctx.measureText(text).width + 22;
  const h = 30;
  const cx = Math.max(w / 2 + 6, Math.min(GameConfig.width - w / 2 - 6, x));
  ctx.globalAlpha = alpha;
  ctx.translate(cx, y);
  ctx.scale(0.6 + 0.4 * appear, 0.6 + 0.4 * appear);
  roundRectPath(ctx, -w / 2, -h, w, h, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - cx - 6, -1); ctx.lineTo(x - cx, 9); ctx.lineTo(x - cx + 6, -1);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -h / 2 + 1);
  ctx.restore();
}

/** 虚线折线 (提示线) */
export function drawDashedPolyline(ctx, pts, time, color = '#ff6fa8') {
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([14, 12]);
  ctx.lineDashOffset = -time * 40;
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 12;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.setLineDash([]);
  // 起点标记
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 9 + Math.sin(time * 6) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
