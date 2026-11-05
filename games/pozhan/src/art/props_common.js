// 通用道具：道具栏图标 (约 60×60，原点 = 中心) 与通用家具。
import { INK, LW, box, poly, line, circle, ellipse, rr, fs, text, blossom, seeded, shine, groundShadow, starPath, shade } from './kit.js';

// ———————————————— 道具图标 ————————————————
export function iconRuler(ctx) {
  ctx.save(); ctx.rotate(-0.5);
  poly(ctx, [[-26, 14], [26, 14], [-26, -22]], '#9fe3ff');
  poly(ctx, [[-17, 7], [5, 7], [-17, -8]], '#ffffff', 1.6);
  for (let i = 0; i < 6; i++) line(ctx, [[-22 + i * 8, 14], [-22 + i * 8, 9]], INK, 1.4);
  ctx.restore();
}

export function iconTape(ctx) {
  ellipse(ctx, 0, 0, 24, 22, '#ffd34d');
  ellipse(ctx, 0, 0, 11, 10, '#fff8e1', 2);
  ctx.save(); ctx.globalAlpha = 0.5; ellipse(ctx, -8, -10, 7, 4, '#ffffff', 0, -0.5); ctx.restore();
  poly(ctx, [[18, 10], [30, 18], [26, 24], [14, 16]], '#ffe58a', 1.6);
}

/** 临时把手 = 三角尺 + 胶带 */
export function iconHandle(ctx) {
  ctx.save(); ctx.rotate(-0.25);
  poly(ctx, [[-24, 10], [24, 10], [-24, -20]], '#9fe3ff');
  box(ctx, -10, -6, 22, 18, '#ffd34d', 3, 1.8);
  line(ctx, [[-10, 0], [12, 0]], '#e0a800', 1.5); line(ctx, [[-10, 6], [12, 6]], '#e0a800', 1.5);
  ctx.restore();
}

export function iconRoach(ctx) {
  ctx.save(); ctx.rotate(0.3);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(ctx, [[s * 8, -6 + i * 8], [s * 22, -12 + i * 12], [s * 26, -6 + i * 14]], INK, 2);
  ellipse(ctx, 0, 2, 13, 20, '#8a4b2b');
  circle(ctx, 0, -18, 8, '#6b3a22');
  line(ctx, [[-3, -24], [-14, -40]], INK, 1.6); line(ctx, [[3, -24], [14, -40]], INK, 1.6);
  line(ctx, [[0, -6], [0, 20]], '#5a2e18', 1.6);
  ellipse(ctx, -5, -4, 3, 7, 'rgba(255,255,255,0.4)', 0);
  // 玩具标签
  box(ctx, 6, 8, 22, 12, '#ffffff', 2, 1.2); text(ctx, 'TOY', 17, 14.5, 7, '#d62f45');
  ctx.restore();
}

export function iconFilter(ctx) {
  circle(ctx, 0, 0, 24, '#ff8a3d');
  circle(ctx, 0, 0, 18, '#ffd166', 2);
  text(ctx, '燃', 0, 1, 20, '#d62f45', { weight: '900' });
  ellipse(ctx, -8, -10, 6, 3, 'rgba(255,255,255,0.6)', 0, -0.5);
}

export function iconSpeaker(ctx) {
  box(ctx, -18, -26, 36, 52, '#4f466e', 6);
  circle(ctx, 0, -12, 8, '#8f86b8', 2); circle(ctx, 0, 10, 12, '#8f86b8', 2); circle(ctx, 0, 10, 5, INK, 0);
  ctx.strokeStyle = '#ff6f91'; ctx.lineWidth = 2.5;
  for (const r of [26, 32]) { ctx.beginPath(); ctx.arc(10, 0, r, -0.5, 0.5); ctx.stroke(); }
}

export function iconSalt(ctx) {
  box(ctx, -16, -16, 32, 40, '#ffffff', 6);
  box(ctx, -14, -26, 28, 12, '#7cc3ff', 4, 2);
  for (const [x, y] of [[-6, -22], [0, -19], [6, -22]]) circle(ctx, x, y, 1.5, INK, 0);
  text(ctx, '盐', 0, 5, 16, '#2f6fd1', { weight: '900' });
}

export function iconInvoice(ctx) {
  ctx.save(); ctx.rotate(-0.08);
  box(ctx, -18, -24, 36, 48, '#fffbe8', 3);
  text(ctx, '发票', 0, -13, 10, '#d62f45', { weight: '900' });
  ctx.strokeStyle = 'rgba(74,54,86,0.5)'; ctx.lineWidth = 1.2;
  for (let y = -3; y < 18; y += 6) { ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(12, y); ctx.stroke(); }
  circle(ctx, 9, 14, 6, null, 1.4);
  ctx.restore();
}

export function iconStamp(ctx) {
  box(ctx, -18, 6, 36, 14, '#d62f45', 3);
  box(ctx, -7, -18, 14, 26, '#c9a27a', 3);
  ellipse(ctx, 0, -20, 12, 7, '#a87b55');
}

export function iconTissue(ctx) {
  box(ctx, -24, -6, 48, 26, '#bfe9ff', 5);
  blossom(ctx, -10, 8, 5); blossom(ctx, 12, 10, 4);
  ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-14, -26, 0, -24); ctx.quadraticCurveTo(14, -26, 10, -6); ctx.closePath(); fs(ctx, '#ffffff', 1.8);
}

export function iconCurtain(ctx) {
  box(ctx, -24, -26, 48, 6, '#c9a27a', 2);
  poly(ctx, [[-22, -20], [22, -20], [26, 26], [-26, 26]], '#e04a66');
  for (const x of [-12, 0, 12]) line(ctx, [[x, -18], [x * 1.15, 24]], '#b8324f', 2);
}

export function iconCape(ctx) {
  poly(ctx, [[-12, -24], [12, -24], [28, 26], [0, 20], [-28, 26]], '#e04a66');
  line(ctx, [[-6, -18], [-12, 20]], '#b8324f', 2); line(ctx, [[6, -18], [12, 20]], '#b8324f', 2);
  circle(ctx, 0, -22, 5, '#ffd34d', 1.6);
}

export function iconPin(ctx) {
  ctx.save(); ctx.rotate(0.6);
  ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-4, 18); ctx.arc(0, 18, 4, Math.PI, 0, true); ctx.lineTo(4, -14);
  ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#d9d9e8'; ctx.stroke();
  circle(ctx, -4, -24, 6, '#ff6f91', 1.8);
  ctx.restore();
}

export function iconTie(ctx) {
  poly(ctx, [[-8, -26], [8, -26], [5, -18], [-5, -18]], '#2f6fd1', 1.8);
  poly(ctx, [[-5, -18], [5, -18], [11, 16], [0, 26], [-11, 16]], '#2f6fd1', 1.8);
  for (const y of [-8, 4, 14]) line(ctx, [[-6, y], [7, y - 6]], '#ffd34d', 2);
}

export function iconFlag(ctx) {
  line(ctx, [[-14, -26], [-14, 28]], '#8a5a44', 3.5);
  poly(ctx, [[-14, -26], [24, -16], [-14, -2]], '#ff6f91');
  // 翻转的旗子里文字保持正向
  ctx.save(); ctx.translate(1, -14); if (ctx.getTransform().a < 0) ctx.scale(-1, 1);
  text(ctx, '栖', 0, 0, 11, '#ffffff', { weight: '900' });
  ctx.restore();
}

export function iconLeek(ctx) {
  ctx.save(); ctx.rotate(-0.6);
  box(ctx, -5, -6, 10, 34, '#f4fbe9', 4);
  for (const r of [-0.3, 0, 0.3]) { ctx.save(); ctx.translate(0, -6); ctx.rotate(r); box(ctx, -4, -26, 8, 26, '#5fbf5a', 4, 1.8); ctx.restore(); }
  line(ctx, [[-3, 28], [-6, 34]], INK, 1.2); line(ctx, [[0, 28], [0, 35]], INK, 1.2); line(ctx, [[3, 28], [6, 34]], INK, 1.2);
  ctx.restore();
}

// ———————————————— 通用家具 ————————————————
/** 书桌 (原点 = 底部中心)，L.w 宽度 */
export function desk(ctx, L) {
  const w = L.w || 160; const h = L.h || 90;
  box(ctx, -w / 2, -h, w, 14, L.color || '#d9a46b', 4);
  box(ctx, -w / 2 + 8, -h + 14, 12, h - 14, shade(L.color || '#d9a46b', 0.85), 2);
  box(ctx, w / 2 - 20, -h + 14, 12, h - 14, shade(L.color || '#d9a46b', 0.85), 2);
  if (L.drawer !== false) { box(ctx, w / 2 - 70, -h + 14, 50, 28, '#e8b980', 3, 2); circle(ctx, w / 2 - 45, -h + 28, 3, INK, 0); }
}

/** 墙上搁板 (原点 = 中心) */
export function shelf(ctx, L) {
  const w = L.w || 130;
  box(ctx, -w / 2, -6, w, 12, '#c98f5a', 3);
  poly(ctx, [[-w / 2 + 14, 6], [-w / 2 + 14, 26], [-w / 2 + 34, 6]], '#b07a4a', 1.8);
  poly(ctx, [[w / 2 - 14, 6], [w / 2 - 14, 26], [w / 2 - 34, 6]], '#b07a4a', 1.8);
}

/** 盆栽 (原点 = 底部) */
export function plant(ctx, L) {
  const c = L.leaf || '#6fcf7f';
  for (const [x, y, r] of [[-14, -46, 16], [12, -52, 18], [0, -66, 16], [-4, -40, 14]]) ellipse(ctx, x, y, r, r * 0.75, c, 2);
  poly(ctx, [[-18, -32], [18, -32], [13, 0], [-13, 0]], L.pot || '#ff9a76');
  box(ctx, -21, -36, 42, 8, shade(L.pot || '#ff9a76', 0.9), 2, 2);
}

/** 墙上的海报 / 告示 (原点 = 中心) */
export function poster(ctx, L) {
  const w = L.w || 80; const h = L.h || 100;
  ctx.save(); ctx.rotate(L.tilt || 0);
  box(ctx, -w / 2, -h / 2, w, h, L.bgc || '#ffffff', 3);
  if (L.band) box(ctx, -w / 2, -h / 2, w, h * 0.28, L.band, 3, 0);
  (L.lines || []).forEach((s, i) => text(ctx, s, 0, -h / 2 + (L.band ? h * 0.14 : 14) + i * (L.lh || 18), (L.sizes && L.sizes[i]) || 13, (L.colors && L.colors[i]) || INK, { weight: '900', maxW: w - 8 }));
  circle(ctx, 0, -h / 2 + 3, 3, '#ff5d6c', 1.2);
  ctx.restore();
}

/** 发光提示圈 (交互区可见反馈；原点 = 中心) */
export function glowRing(ctx, L, S) {
  const t = S.t || 0;
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4);
  ctx.strokeStyle = L.color || '#ffe14d'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20;
  ctx.beginPath(); ctx.ellipse(0, 0, L.rx || 30, L.ry || L.rx || 30, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** 漫画效果字 (原点 = 中心) */
export function sfxText(ctx, L, S) {
  const t = S.t || 0;
  ctx.save(); ctx.rotate(L.tilt || -0.12);
  const k = 1 + 0.04 * Math.sin(t * 8);
  ctx.scale(k, k);
  text(ctx, L.text || '！', 0, 0, L.size || 34, L.color || '#ffffff', { weight: '900', stroke: L.stroke || '#e0466d', sw: L.sw || 7 });
  ctx.restore();
}

/** 对话框式小气泡 (原点 = 尾巴尖) */
export function bubble(ctx, L) {
  const w = L.w || 120; const h = L.h || 40;
  ctx.save();
  rr(ctx, -w / 2 + (L.dx || 0), -h - 14, w, h, 14); fs(ctx, '#ffffff', 2);
  poly(ctx, [[-8 + (L.dx || 0) * 0.3, -16], [0, 0], [8 + (L.dx || 0) * 0.3, -16]], '#ffffff', 0);
  line(ctx, [[-8 + (L.dx || 0) * 0.3, -15], [0, 0], [8 + (L.dx || 0) * 0.3, -15]], INK, 2);
  text(ctx, L.text || '', L.dx || 0, -h / 2 - 14, L.size || 14, L.color || INK, { maxW: w - 12 });
  ctx.restore();
}

/** 音符 (飘动) */
export function notes(ctx, L, S) {
  const t = S.t || 0;
  for (let i = 0; i < (L.n || 4); i++) {
    const k = ((t * 0.6 + i / (L.n || 4)) % 1);
    ctx.save(); ctx.globalAlpha = 1 - k;
    ctx.translate(Math.sin(k * 6 + i) * 14 + i * 16 - 24, -k * 90);
    text(ctx, i % 2 ? '♪' : '♫', 0, 0, 24, L.color || '#ff6f91', { weight: '900', stroke: '#ffffff', sw: 4 });
    ctx.restore();
  }
}
