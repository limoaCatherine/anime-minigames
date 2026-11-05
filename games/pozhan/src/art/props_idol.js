// 第三章《偶像大作战》的道具：后台找不同、完美教室、打歌服换装、假预告。
// 原点约定同其他道具文件：多数为底部中心，墙上物件为中心。
import { INK, box, poly, line, circle, ellipse, rr, fs, text, seeded, shine, groundShadow, starPath, shade, cloud } from './kit.js';
import { iconFlag, iconLeek, iconTie, iconCurtain } from './props_common.js';

// ———————————————— 第 10 关：偶像后台 ————————————————
/** 化妆镜 (原点 = 中心)：L.off = 熄灭的灯泡序号 */
export function vanityMirror(ctx, L, S) {
  const w = L.w || 170; const h = L.h || 150;
  box(ctx, -w / 2, -h / 2, w, h, '#ffd6e4', 10);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, '#e9f6ff'); g.addColorStop(1, '#bcd9f2');
  box(ctx, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28, g, 6, 2);
  ctx.save(); ctx.globalAlpha = 0.7;
  poly(ctx, [[-w / 2 + 30, -h / 2 + 14], [-w / 2 + 54, -h / 2 + 14], [-w / 2 + 20, h / 2 - 30], [-w / 2 + 14, h / 2 - 50]], '#ffffff', 0);
  ctx.restore();
  // 镜子上贴的拍立得和爱心贴纸
  ctx.save(); ctx.translate(w / 2 - 34, h / 2 - 40); ctx.rotate(0.12);
  box(ctx, -14, -16, 28, 32, '#ffffff', 2, 1.4); box(ctx, -11, -13, 22, 20, '#ffc4dc', 1, 0);
  ctx.restore();
  ctx.save(); ctx.translate(-w / 2 + 34, -h / 2 + 34); ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ff6f91'; ctx.textAlign = 'center'; ctx.fillText('♥', 0, 6); ctx.restore();
  const bulbs = [];
  for (let i = 0; i < 5; i++) bulbs.push([-60 + i * 30, -h / 2]);
  for (let i = 0; i < 3; i++) bulbs.push([-w / 2, -40 + i * 40]);
  for (let i = 0; i < 3; i++) bulbs.push([w / 2, -40 + i * 40]);
  bulbs.forEach(([x, y], i) => {
    const off = L.off === i;
    if (!off) { ctx.save(); ctx.shadowColor = '#fff2a8'; ctx.shadowBlur = 10; circle(ctx, x, y, 7, '#fff7c2', 1.8); ctx.restore(); }
    else circle(ctx, x, y, 7, '#8a8394', 1.8);
  });
}

/** 星星彩旗串 (原点 = 中心)：L.skip = 缺失的星序号 */
export function starGarland(ctx, L) {
  const w = L.w || 300; const n = L.n || 7;
  const sag = (x) => 10 * (1 - Math.pow((2 * x) / w, 2));
  ctx.beginPath(); ctx.moveTo(-w / 2, 0);
  for (let x = -w / 2; x <= w / 2; x += 10) ctx.lineTo(x, sag(x));
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  const cols = ['#ff6f91', '#ffcf5a', '#7cc3ff', '#b88cff'];
  for (let i = 0; i < n; i++) {
    if (L.skip === i) continue;
    const x = -w / 2 + (i + 0.5) * (w / n); const y = sag(x) + 10;
    starPath(ctx, x, y, 11); fs(ctx, cols[i % cols.length], 1.8);
  }
}

/** 化妆台前沿 (bg 图层：盖住立绘下沿) */
export function vanityFront(ctx, L, S) {
  const { W, H } = S;
  box(ctx, -10, H * 0.66, W + 20, H * 0.08, '#f6d2a5', 0, 0);
  line(ctx, [[-10, H * 0.66], [W + 10, H * 0.66]], INK, 2);
  line(ctx, [[-10, H * 0.74], [W + 10, H * 0.74]], INK, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, H * 0.665, W, 3);
}

export function lipstick(ctx, L) {
  box(ctx, -7, -16, 14, 16, '#3b3550', 2, 1.8);
  box(ctx, -5, -24, 10, 9, '#d8c08a', 2, 1.6);
  poly(ctx, [[-4, -24], [4, -24], [4, -32], [-4, -28]], L.color || '#ff3d7f', 1.6);
}

/** 带吸管的饮料杯 */
export function cupStraw(ctx, L) {
  if (L.straw !== false) { ctx.save(); ctx.rotate(0.18); box(ctx, 2, -48, 5, 26, '#ff8fb0', 2, 1.4); ctx.restore(); }
  poly(ctx, [[-13, -30], [13, -30], [10, 0], [-10, 0]], '#ffffff', 2);
  poly(ctx, [[-12, -22], [12, -22], [10.5, -6], [-10.5, -6]], '#c99a6b', 0);
  box(ctx, -15, -34, 30, 6, '#f2f2f2', 3, 1.6);
  circle(ctx, -3, -14, 2.2, '#3b2a1a', 0); circle(ctx, 4, -12, 2.2, '#3b2a1a', 0);
}

/** 歌单 (立在桌上的小卡片) */
export function setlist(ctx, L) {
  ctx.save(); ctx.rotate(L.tilt ?? -0.06);
  box(ctx, -32, -48, 64, 48, '#ffffff', 3, 1.8);
  text(ctx, 'SETLIST', 0, -40, 8, '#e0466d', { weight: '900' });
  (L.lines || ['1 心动预警', '2 次元破绽', '3 安可']).forEach((s, i) => text(ctx, s, -26, -28 + i * 10, 8, INK, { align: 'left', weight: 'bold' }));
  ctx.restore();
}

/** 立在支架上的手机 */
export function phoneStand(ctx, L) {
  poly(ctx, [[-14, 0], [14, 0], [6, -10], [-6, -10]], '#a9b2c8', 1.6);
  box(ctx, -13, -48, 26, 44, '#2b2738', 5, 1.8);
  if (L.on !== false) {
    box(ctx, -10, -44, 20, 34, '#ffd1e3', 3, 0);
    circle(ctx, 0, -32, 6, '#ff6f91', 0);
    text(ctx, '99+', 0, -17, 7, '#e0466d', { weight: '900' });
  } else box(ctx, -10, -44, 20, 34, '#151320', 3, 0);
}

/** 花瓶：L.n 朵花 */
export function vase(ctx, L) {
  const n = L.n ?? 3;
  const stems = [[-12, -62], [0, -72], [12, -60]].slice(0, n);
  for (const [x, y] of stems) { line(ctx, [[0, -26], [x, y]], '#4f9d5a', 2.2); }
  const cols = ['#ff8fb0', '#ffcf5a', '#ff6f91'];
  stems.forEach(([x, y], i) => { for (let k = 0; k < 5; k++) { const a = k * 1.2566; circle(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4.5, cols[i], 1.2); } circle(ctx, x, y, 3, '#fff3b0', 1); });
  poly(ctx, [[-10, -30], [10, -30], [14, -14], [8, 0], [-8, 0], [-14, -14]], '#9fd3ff');
  shine(ctx, -9, -24, 4, 14);
}

/** 应援棒纸箱 (原点 = 底部中心) */
export function lightstickBox(ctx, L) {
  const c = L.color || '#ff6f91';
  for (const [x, r] of [[-22, -0.25], [-6, -0.08], [10, 0.1], [24, 0.28]]) {
    ctx.save(); ctx.translate(x, -30); ctx.rotate(r);
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 8; box(ctx, -4, -36, 8, 30, c, 4, 1.6); ctx.restore();
    box(ctx, -5, -8, 10, 14, '#ffffff', 2, 1.6);
    ctx.restore();
  }
  box(ctx, -40, -36, 80, 36, '#d9a46b', 3);
  line(ctx, [[-40, -26], [40, -26]], '#b07a4a', 1.5);
  text(ctx, '应援棒', 0, -14, 11, '#7a4b25', { weight: '900' });
}

/** 化妆盘 (装饰) */
export function palette(ctx) {
  box(ctx, -26, -12, 52, 12, '#3b3550', 4, 1.8);
  ['#ffb3c7', '#f7a07a', '#d9a2ff', '#ffe08a'].forEach((c, i) => circle(ctx, -18 + i * 12, -6, 4.5, c, 1));
}

/** 地上的一双鞋 (装饰) */
export function shoes(ctx, L) {
  const c = L.color || '#ff8fb0';
  for (const dx of [-14, 14]) { ellipse(ctx, dx, -6, 12, 7, c, 1.8); ellipse(ctx, dx + 3, -8, 5, 3, '#fff', 0); }
}

// ———————————————— 第 11 关：林栖的完美教室 ————————————————
/** 黑板 (原点 = 中心) */
export function chalkboard(ctx, L) {
  const w = L.w || 230; const h = L.h || 120;
  box(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, '#a0703f', 4);
  box(ctx, -w / 2, -h / 2, w, h, '#2f5d4a', 2, 2);
  ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff';
  ctx.fillRect(-w / 2 + 20, -h / 2 + 30, 60, 3); ctx.fillRect(w / 2 - 90, h / 2 - 22, 70, 3); ctx.restore();
  (L.lines || []).forEach(([s, x, y, size], i) => text(ctx, s, x, y, size || 18, '#f4f7f2', { weight: 'bold' }));
  box(ctx, -w / 2 + 10, h / 2 + 4, w - 20, 6, '#c08a52', 2, 1.4);
  box(ctx, -w / 2 + 30, h / 2, 14, 4, '#ffffff', 1, 1);
}

/** 教室窗户 (原点 = 中心)：L.cloud 是否有云 */
export function classWindow(ctx, L) {
  const w = L.w || 100; const h = L.h || 120;
  box(ctx, -w / 2, -h / 2, w, h, '#a7dcff', 3);
  if (L.cloud) cloud(ctx, -8, -h / 4, 44, '#ffffff', 1.6);
  ctx.save(); ctx.globalAlpha = 0.5; poly(ctx, [[-w / 2 + 10, h / 2], [-w / 2 + 40, -h / 2], [-w / 2 + 52, -h / 2], [-w / 2 + 22, h / 2]], '#ffffff', 0); ctx.restore();
  line(ctx, [[0, -h / 2], [0, h / 2]], INK, 3); line(ctx, [[-w / 2, 0], [w / 2, 0]], INK, 3);
  poly(ctx, [[-w / 2 - 8, -h / 2 - 6], [-w / 2 + 16, -h / 2 - 6], [-w / 2 + 6, h / 2 + 6], [-w / 2 - 10, h / 2 + 6]], '#ffe7a8', 2);
  poly(ctx, [[w / 2 - 16, -h / 2 - 6], [w / 2 + 8, -h / 2 - 6], [w / 2 + 10, h / 2 + 6], [w / 2 - 6, h / 2 + 6]], '#ffe7a8', 2);
  box(ctx, -w / 2 - 10, h / 2 + 4, w + 20, 8, '#e8cfae', 2, 2);
}

/** 讲台 (原点 = 底部中心) */
export function teacherDesk(ctx, L) {
  const w = L.w || 180; const h = L.h || 75;
  box(ctx, -w / 2, -h, w, 12, '#c98f5a', 3);
  box(ctx, -w / 2 + 8, -h + 12, w - 16, h - 12, '#d9a46b', 2);
  box(ctx, -w / 2 + 30, -h + 26, w - 60, h - 40, '#e8b980', 3, 1.6);
  text(ctx, '学生会', 0, -h / 2 + 4, 13, '#7a4b25', { weight: '900' });
}

export function apple(ctx) {
  circle(ctx, 0, -10, 10, '#ff4d5e', 1.8);
  line(ctx, [[0, -19], [2, -26]], '#7a4b25', 2);
  ellipse(ctx, 6, -24, 5, 2.6, '#6fcf7f', 1.2, -0.4);
  ellipse(ctx, -4, -14, 2.4, 3.6, 'rgba(255,255,255,0.7)', 0);
}

/** 学生课桌 + 笔袋 (原点 = 底部中心) */
export function studentDesk(ctx, L) {
  const w = L.w || 170; const h = L.h || 70;
  box(ctx, -w / 2, -h, w, 14, '#e2b47a', 4);
  box(ctx, -w / 2 + 12, -h + 14, 10, h - 14, '#9aa3b8', 2, 1.6);
  box(ctx, w / 2 - 22, -h + 14, 10, h - 14, '#9aa3b8', 2, 1.6);
  box(ctx, -40, -h - 14, 54, 18, L.color || '#7cc3ff', 8, 1.8);
  line(ctx, [[-36, -h - 7], [10, -h - 7]], shade(L.color || '#7cc3ff', 0.7), 1.4);
  box(ctx, 26, -h - 6, 40, 6, '#ffffff', 2, 1.4);
}

/** 垃圾桶：L.ball 旁边有纸团 */
export function trashBin(ctx, L) {
  poly(ctx, [[-18, -40], [18, -40], [14, 0], [-14, 0]], '#9fb4d0');
  for (const x of [-8, 0, 8]) line(ctx, [[x, -34], [x * 0.8, -6]], '#7f93b0', 1.5);
  box(ctx, -20, -44, 40, 6, '#7f93b0', 2, 1.8);
  if (L.ball) { circle(ctx, 30, -9, 9, '#ffffff', 1.8); line(ctx, [[25, -12], [33, -6], [29, -2]], '#9aa3b8', 1.2); }
}

/** 叶片数可变的盆栽 */
export function pottedLeaves(ctx, L) {
  const leaves = [[-16, -50, -0.6], [16, -54, 0.6], [0, -70, 0], [-22, -36, -1.1], [22, -38, 1.1]].slice(0, L.n ?? 5);
  for (const [x, y, r] of leaves) ellipse(ctx, x, y, 9, 18, '#6fcf7f', 1.8, r);
  poly(ctx, [[-16, -30], [16, -30], [12, 0], [-12, 0]], '#ffb38a');
  box(ctx, -19, -34, 38, 7, '#f4a173', 2, 1.8);
}

// ———————————————— 第 12 关：打歌服紧急换装 ————————————————
/** 带窗帘的窗 (原点 = 中心)：L.taken 窗帘被拿走 */
export function curtainWindow(ctx, L) {
  const w = 120; const h = 160;
  box(ctx, -w / 2, -h / 2, w, h, '#ffcf9e', 3);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#ffb07a'); g.addColorStop(1, '#ffe2b5');
  box(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, g, 2, 1.6);
  line(ctx, [[0, -h / 2 + 6], [0, h / 2 - 6]], INK, 2.4);
  box(ctx, -w / 2 - 14, -h / 2 - 12, w + 28, 7, '#c9a27a', 3, 1.8);
  if (!L.taken) {
    poly(ctx, [[-w / 2 - 10, -h / 2 - 6], [-w / 2 + 34, -h / 2 - 6], [-w / 2 + 22, h / 2 + 10], [-w / 2 - 14, h / 2 + 10]], '#e04a66');
    for (const x of [-w / 2 + 2, -w / 2 + 14]) line(ctx, [[x, -h / 2], [x - 2, h / 2 + 6]], '#b8324f', 2);
    poly(ctx, [[w / 2 - 34, -h / 2 - 6], [w / 2 + 10, -h / 2 - 6], [w / 2 + 14, h / 2 + 10], [w / 2 - 22, h / 2 + 10]], '#e04a66');
    for (const x of [w / 2 - 14, w / 2 - 2]) line(ctx, [[x, -h / 2], [x + 2, h / 2 + 6]], '#b8324f', 2);
  } else {
    for (let i = 0; i < 6; i++) circle(ctx, -w / 2 - 6 + i * 27, -h / 2 - 8, 3.5, '#d8d8e6', 1.2);
  }
}

/** 墙上挂钩 + 领带 */
export function tieHook(ctx, L) {
  box(ctx, -18, -6, 36, 10, '#c9a27a', 3, 1.8);
  circle(ctx, 0, 0, 3, INK, 0);
  if (!L.taken) { ctx.save(); ctx.translate(0, 34); ctx.scale(1.1, 1.1); iconTie(ctx); ctx.restore(); }
}

/** 针插 (原点 = 底部) */
export function pincushion(ctx, L) {
  box(ctx, -18, -8, 36, 8, '#d9a46b', 3, 1.8);
  ellipse(ctx, 0, -16, 18, 12, '#ff8fb0');
  if (!L.taken) {
    line(ctx, [[-4, -20], [-10, -40]], '#a9b2c8', 2); circle(ctx, -10, -42, 4, '#ffcf5a', 1.4);
  }
  line(ctx, [[6, -20], [12, -36]], '#a9b2c8', 2); circle(ctx, 12, -38, 3.5, '#7cc3ff', 1.4);
}

/** 插着应援旗的桶 */
export function flagBucket(ctx, L) {
  if (!L.taken) {
    ctx.save(); ctx.translate(-12, -70); ctx.rotate(-0.15); ctx.scale(-1.3, 1.3); iconFlag(ctx); ctx.restore();
    ctx.save(); ctx.translate(12, -70); ctx.rotate(0.15); ctx.scale(1.3, 1.3); iconFlag(ctx); ctx.restore();
  }
  poly(ctx, [[-24, -40], [24, -40], [18, 0], [-18, 0]], '#7cc3ff');
  box(ctx, -26, -44, 52, 7, '#5aa6e6', 2, 1.8);
  text(ctx, '应援', 0, -20, 11, '#ffffff', { weight: '900' });
}

/** 买菜袋 (插着两根大葱) */
export function leekBag(ctx, L) {
  if (!L.taken) {
    ctx.save(); ctx.translate(-8, -50); ctx.rotate(-0.3); ctx.scale(1.4, 1.4); iconLeek(ctx); ctx.restore();
    ctx.save(); ctx.translate(10, -52); ctx.rotate(0.5); ctx.scale(1.4, 1.4); iconLeek(ctx); ctx.restore();
  }
  poly(ctx, [[-28, -46], [28, -46], [24, 0], [-24, 0]], '#f4ecd8');
  line(ctx, [[-18, -46], [-12, -62], [12, -62], [18, -46]], INK, 2);
  text(ctx, '特价', 0, -22, 12, '#d62f45', { weight: '900' });
}

/**
 * 人台 (原点 = 底部中心，约 440 高)。根据关卡 flag 画装备：
 * cape_on 披风 / tie_on 领带 / L_flag L_leek 左手 / R_flag R_leek 右手
 */
export function mannequin(ctx, L, S) {
  const f = S.flags || new Set();
  groundShadow(ctx, 0, 0, 70, 12, 0.2);
  box(ctx, -50, -14, 100, 14, '#8a5a44', 5);
  box(ctx, -5, -170, 10, 160, '#a9b2c8', 3, 1.8);
  if (f.has('cape_on')) {
    poly(ctx, [[-60, -350], [60, -350], [118, -150], [0, -168], [-118, -150]], '#e04a66');
    for (const x of [-40, 0, 40]) line(ctx, [[x * 0.6, -340], [x * 1.9, -160]], '#b8324f', 2);
  }
  // 手臂
  const arm = (sx) => { ctx.beginPath(); ctx.moveTo(sx * 58, -340); ctx.quadraticCurveTo(sx * 92, -300, sx * 100, -236); ctx.lineWidth = 18; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 13; ctx.strokeStyle = '#f3e3cf'; ctx.stroke(); };
  arm(-1); arm(1);
  // 躯干
  poly(ctx, [[-60, -350], [60, -350], [46, -250], [36, -180], [-36, -180], [-46, -250]], '#f3e3cf');
  poly(ctx, [[-38, -184], [38, -184], [56, -140], [-56, -140]], '#ffffff');
  for (const x of [-30, -10, 10, 30]) line(ctx, [[x * 0.8, -182], [x * 1.4, -142]], '#e7d7ef', 1.6);
  line(ctx, [[-60, -350], [60, -350]], INK, 2.4);
  // 颈 + 头
  box(ctx, -10, -372, 20, 24, '#f3e3cf', 3, 2);
  ellipse(ctx, 0, -400, 26, 32, '#f3e3cf');
  ctx.save(); ctx.globalAlpha = 0.4; ellipse(ctx, -9, -410, 6, 10, '#ffffff', 0); ctx.restore();
  if (f.has('cape_on')) { circle(ctx, 0, -352, 7, '#ffd34d', 1.8); }
  if (f.has('tie_on')) { ctx.save(); ctx.translate(0, -318); ctx.scale(1.2, 1.2); iconTie(ctx); ctx.restore(); }
  // 手
  for (const [sx, side] of [[-1, 'L'], [1, 'R']]) {
    const hx = sx * 100; const hy = -232;
    if (f.has(`${side}_flag`)) { ctx.save(); ctx.translate(hx + sx * 6, hy - 30); ctx.scale(sx * -1.5, 1.5); iconFlag(ctx); ctx.restore(); }
    if (f.has(`${side}_leek`)) { ctx.save(); ctx.translate(hx + sx * 8, hy - 34); ctx.rotate(0.6 + sx * 0.3); ctx.scale(1.6, 1.6); iconLeek(ctx); ctx.restore(); }
    circle(ctx, hx, hy, 11, '#f3e3cf', 2.4);
  }
}

/** 对称度评分牌 (原点 = 中心) */
export function symmetryMeter(ctx, L, S) {
  const f = S.flags || new Set();
  let score = 20;
  if (f.has('cape_on')) score += 25;
  if (f.has('tie_on')) score += 15;
  if (f.has('L_flag') && f.has('R_flag')) score = Math.max(score, score + 40);
  else if (f.has('L_flag') || f.has('R_flag')) score += 5;
  score = Math.min(100, score);
  box(ctx, -58, -28, 116, 56, '#ffffff', 10, 2);
  text(ctx, '对称度', 0, -12, 13, '#4f6bd8', { weight: '900' });
  text(ctx, `${score}%`, 0, 12, 22, score >= 100 ? '#2fb76b' : '#e0466d', { weight: '900' });
}

// ———————————————— 第 13 关：下集预告是假的 ————————————————
/** 预告片黑边 (bg 图层，盖在最上面) */
export function letterbox(ctx, L, S) {
  const { W, H } = S;
  ctx.fillStyle = '#0f0d24'; ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34);
  if (L.sub) text(ctx, L.sub, W / 2, H - 17, 14, '#fff6c9', { weight: 'bold' });
}

/** 收音杆话筒 (从画面上沿伸进来) */
export function boomMic(ctx) {
  line(ctx, [[-120, -40], [10, 38]], '#4a4560', 6);
  ctx.save(); ctx.translate(18, 44); ctx.rotate(0.55);
  box(ctx, -12, -6, 50, 26, '#8a8394', 12, 2);
  for (let i = 0; i < 6; i++) line(ctx, [[-4 + i * 7, -4], [-4 + i * 7, 18]], '#6b6478', 1.2);
  ctx.restore();
}

/** 下集预告标题：L.sub 副标题 (刁钻点) */
export function previewTitle(ctx, L, S) {
  const t = S.t || 0;
  ctx.save(); ctx.rotate(-0.04);
  text(ctx, '下集预告', 0, 0, 56, '#ffffff', { weight: '900', stroke: '#e0466d', sw: 10 });
  ctx.restore();
  text(ctx, L.sub || '第13话（全12话）', 0, 52, 17, '#fff27a', { weight: '900', stroke: '#2b1b4a', sw: 5 });
  ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5);
  text(ctx, '★', -150, 4, 22, '#fff27a', { weight: '900' }); text(ctx, '★', 150, 4, 22, '#fff27a', { weight: '900' });
  ctx.restore();
}

/** 倒计时 (负数) */
export function countdown(ctx) {
  box(ctx, -62, -20, 124, 40, '#1d1b4b', 8, 2);
  text(ctx, 'NEXT', -38, -9, 9, '#7cf0ff', { weight: '900' });
  text(ctx, '00:00:-03', 6, 6, 18, '#7cf0ff', { weight: '900' });
}

/** 播出时间标签 */
export function airDate(ctx) {
  ctx.save(); ctx.rotate(0.08);
  box(ctx, -66, -18, 132, 36, '#ffcf5a', 6, 2);
  text(ctx, '下周八 23:30 播出', 0, 1, 14, '#7a2a3a', { weight: '900' });
  ctx.restore();
}

/** 只罩着一个人下的小雨云 */
export function tinyRaincloud(ctx, L, S) {
  const t = S.t || 0;
  cloud(ctx, 0, 0, 70, '#9aa3b8', 2);
  ctx.strokeStyle = '#7cc3ff'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const y = 14 + ((t * 60 + i * 13) % 40); const x = -26 + i * 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 8); ctx.stroke(); }
}

/** 爆炸贴纸 (带价签) */
export function explosionSticker(ctx, L, S) {
  const t = S.t || 0;
  ctx.save(); ctx.rotate(0.1); ctx.scale(1 + 0.03 * Math.sin(t * 9), 1 + 0.03 * Math.sin(t * 9));
  starPath(ctx, 0, 0, 56, 30, 12); fs(ctx, '#ff8a3d', 2.4);
  starPath(ctx, 0, 0, 38, 22, 10); fs(ctx, '#ffe14d', 0);
  text(ctx, '轰！', 0, 2, 22, '#d62f45', { weight: '900', stroke: '#ffffff', sw: 4 });
  ctx.restore();
  // 贴纸卷边 + 价签
  poly(ctx, [[30, 34], [46, 30], [40, 46]], '#ffffff', 1.6);
  ctx.save(); ctx.translate(40, -40); ctx.rotate(0.3);
  box(ctx, -22, -10, 44, 20, '#fff6c9', 3, 1.6); text(ctx, '¥9.9', 0, 1, 11, '#c0392b', { weight: '900' });
  ctx.restore();
}

/** 镜头光晕 = 场务的手电筒 (从右边伸进来) */
export function flashlightFlare(ctx, L, S) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of [[0, 0, 34, 0.5], [-70, 40, 14, 0.35], [-120, 70, 22, 0.25], [-170, 100, 9, 0.35]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,250,200,${a})`); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.translate(30, -6); ctx.rotate(-0.2);
  box(ctx, 0, -9, 40, 18, '#4a4560', 4, 2);
  box(ctx, -8, -12, 10, 24, '#8a8394', 3, 2);
  ellipse(ctx, 56, 4, 22, 13, '#ffd8b8', 2, 0.2);
  ctx.restore();
}

/** 场记板 */
export function clapperboard(ctx) {
  ctx.save(); ctx.rotate(-0.08);
  box(ctx, -40, -50, 80, 50, '#2b2738', 3, 2);
  ctx.save(); ctx.translate(-40, -50); ctx.rotate(-0.28);
  box(ctx, 0, -14, 80, 14, '#ffffff', 2, 2);
  for (let i = 0; i < 4; i++) poly(ctx, [[6 + i * 20, -14], [16 + i * 20, -14], [10 + i * 20, 0], [0 + i * 20, 0]], '#2b2738', 0);
  ctx.restore();
  text(ctx, 'SCENE 13', 0, -34, 10, '#ffffff', { weight: '900' });
  text(ctx, 'TAKE 99', 0, -16, 10, '#ffffff', { weight: '900' });
  ctx.restore();
}

/** 糯糯的死亡 flag 气泡 */
export function flagBubble(ctx, L) {
  rr(ctx, -84, -26, 168, 40, 14); fs(ctx, '#ffffff', 2);
  poly(ctx, [[20, 12], [40, 30], [34, 12]], '#ffffff', 0); line(ctx, [[20, 13], [40, 30], [34, 13]], INK, 2);
  text(ctx, '打完这仗我就回老家结婚', 0, -6, 13, INK, { weight: '900', maxW: 156 });
}

/** 角落台标 (彩蛋) */
export function tvLogo(ctx) {
  ctx.save(); ctx.globalAlpha = 0.55;
  text(ctx, '糯糯TV', 0, 0, 13, '#ffffff', { weight: '900' });
  ctx.restore();
}
