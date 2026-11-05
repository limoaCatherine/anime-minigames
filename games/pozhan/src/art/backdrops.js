// 场景底图 (背景层，无交互物体)。在 540 × H 的逻辑坐标中绘制，赛璐璐平涂 + 统一描边。
import { INK, LW, box, poly, line, circle, ellipse, rr, fs, text, cloud, blossom, seeded, shade, tint, starPath } from './kit.js';

function sky(ctx, W, H, top, bottom, y1 = H) {
  const g = ctx.createLinearGradient(0, 0, 0, y1);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, y1);
}

/** 照片 / 手绘背景图 (cover 裁切)。fx/fy = 取景中心 (0~1) */
export function bg_photo(ctx, L, S) {
  const im = S.img(L.key);
  const { W, H } = S;
  if (!im) { sky(ctx, W, H, '#ffd9c2', '#c9b6ff'); return; }
  const k = Math.max(W / im.width, H / im.height) * (L.zoom || 1);
  const dw = im.width * k; const dh = im.height * k;
  const fx = L.fx ?? 0.5; const fy = L.fy ?? 0.5;
  const x = Math.min(0, Math.max(W - dw, W / 2 - dw * fx));
  const y = Math.min(0, Math.max(H - dh, H / 2 - dh * fy));
  ctx.drawImage(im, x, y, dw, dh);
  if (L.wash) { ctx.fillStyle = L.wash; ctx.fillRect(0, 0, W, H); }
}

/** 第 1 关：早晨的上学路 + 转角 */
export function bg_street(ctx, L, S) {
  const { W, H } = S;
  sky(ctx, W, H, '#9fd8ff', '#e8f6ff', 380);
  cloud(ctx, 120, 90, 150, '#ffffff'); cloud(ctx, 400, 60, 110, '#ffffff', 0, 0.85);
  // 远景房屋 (淡紫剪影)
  ctx.fillStyle = '#cfd3f2';
  const rnd = seeded(7);
  for (let x = -10; x < W; x += 46) {
    const h = 40 + rnd() * 50;
    ctx.fillRect(x, 330 - h, 40, h + 20);
    poly(ctx, [[x - 4, 330 - h], [x + 20, 312 - h], [x + 44, 330 - h]], '#c3c6ea', 0);
  }
  // 电线
  ctx.strokeStyle = 'rgba(74,54,86,0.55)'; ctx.lineWidth = 1.4;
  for (const dy of [0, 10]) { ctx.beginPath(); ctx.moveTo(0, 150 + dy); ctx.quadraticCurveTo(250, 200 + dy, 540, 160 + dy); ctx.stroke(); }
  // 左侧围墙 (砖块)
  box(ctx, -10, 360, 400, 120, '#f1e2cf', 0);
  ctx.strokeStyle = 'rgba(160,120,100,0.35)'; ctx.lineWidth = 1.2;
  for (let y = 380; y < 480; y += 20) {
    ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(390, y); ctx.stroke();
    for (let x = (y / 20) % 2 ? 0 : 30; x < 390; x += 60) { ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x, y); ctx.stroke(); }
  }
  box(ctx, -10, 352, 400, 12, '#e3cdb2', 0);
  line(ctx, [[-10, 360], [390, 360]], INK, 2);
  // 转角的建筑 (右侧)
  box(ctx, 380, 120, 170, 380, '#ffe9d6', 0);
  poly(ctx, [[380, 120], [420, 120], [420, 500], [380, 500]], '#f3d6be', 0);
  line(ctx, [[420, 120], [420, 500]], INK, 2);
  line(ctx, [[380, 120], [380, 500]], INK, 2.4);
  line(ctx, [[380, 120], [550, 120]], INK, 2.4);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
    const x = 438 + c * 52; const y = 150 + r * 82;
    box(ctx, x, y, 38, 50, '#bfe3ff', 3, 2);
    line(ctx, [[x + 19, y], [x + 19, y + 50]], INK, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + 4, y + 4, 6, 20);
  }
  // 人行道
  box(ctx, -10, 478, 560, 70, '#e4e1ee', 0);
  ctx.strokeStyle = 'rgba(120,110,150,0.25)'; ctx.lineWidth = 1.2;
  for (let x = 0; x < 560; x += 48) { ctx.beginPath(); ctx.moveTo(x, 478); ctx.lineTo(x - 18, 548); ctx.stroke(); }
  line(ctx, [[-10, 478], [550, 478]], INK, 2);
  box(ctx, -10, 546, 560, 10, '#cfcbe0', 0);
  line(ctx, [[-10, 548], [550, 548]], INK, 2);
  // 马路
  ctx.fillStyle = '#8f93b5'; ctx.fillRect(0, 556, W, H - 556);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = 20; x < W; x += 70) { rr(ctx, x, 628, 40, 7, 3); ctx.fill(); }
}

/** 第 3 关：苏夜绫的卧室 (衣柜在中间) */
export function bg_bedroom(ctx, L, S) {
  const { W, H } = S;
  // 壁纸 (淡紫 + 菱形暗纹)
  ctx.fillStyle = '#efe4ff'; ctx.fillRect(0, 0, W, 520);
  ctx.fillStyle = 'rgba(160,120,220,0.12)';
  for (let y = 20; y < 520; y += 44) for (let x = (y / 44) % 2 ? 22 : 0; x < W; x += 44) {
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
  }
  // 窗户 + 窗帘 (左上)
  box(ctx, 30, 70, 130, 150, '#2f2a5e', 4);
  ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.arc(120, 115, 16, 0, Math.PI * 2); ctx.fill();
  for (const [x, y] of [[60, 100], [80, 170], [140, 190], [55, 150]]) { ctx.fillStyle = '#ffffff'; starPath(ctx, x, y, 4); ctx.fill(); }
  line(ctx, [[95, 70], [95, 220]], INK, 2); line(ctx, [[30, 145], [160, 145]], INK, 2);
  // 踢脚线 + 地板
  box(ctx, -10, 510, 560, 14, '#d8c3f0', 0); line(ctx, [[-10, 510], [550, 510]], INK, 2);
  ctx.fillStyle = '#d9a77a'; ctx.fillRect(0, 524, W, H - 524);
  ctx.strokeStyle = 'rgba(120,70,40,0.25)'; ctx.lineWidth = 1.5;
  for (let y = 548; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  line(ctx, [[-10, 524], [550, 524]], INK, 2);
  // 地毯
  ellipse(ctx, 270, 640, 210, 42, '#c9a8f5', 2);
  ellipse(ctx, 270, 640, 180, 32, null, 1.5);
}

/** 第 4 关：瀑布修行 */
export function bg_waterfall(ctx, L, S) {
  const { W, H } = S;
  sky(ctx, W, H, '#a6e3ff', '#e9fbff', 300);
  // 远山
  poly(ctx, [[-20, 300], [80, 150], [190, 300]], '#b8d9c9', 0);
  poly(ctx, [[340, 300], [470, 130], [580, 300]], '#b8d9c9', 0);
  // 两侧岩壁
  poly(ctx, [[0, 90], [150, 120], [175, 560], [0, 600]], '#8c9bb8');
  poly(ctx, [[540, 70], [390, 110], [370, 560], [540, 600]], '#8c9bb8');
  poly(ctx, [[0, 90], [60, 110], [80, 580], [0, 600]], '#7a88a6', 0);
  poly(ctx, [[540, 70], [480, 95], [470, 580], [540, 600]], '#7a88a6', 0);
  // 苔藓
  for (const [x, y, r] of [[40, 140, 26], [130, 150, 20], [420, 130, 24], [510, 110, 30], [150, 400, 18], [390, 380, 22]]) ellipse(ctx, x, y, r, r * 0.6, '#7cc58a', 2);
  // 瀑布
  const t = S.t || 0;
  box(ctx, 165, 100, 210, 480, '#bfeaff', 0, 0);
  ctx.save(); rr(ctx, 165, 100, 210, 480, 0); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const x = 175 + i * 15; const off = ((t * 220 + i * 53) % 120);
    for (let y = 100 - 120 + off; y < 580; y += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke(); }
  }
  ctx.restore();
  line(ctx, [[165, 100], [175, 580]], INK, 2); line(ctx, [[375, 100], [368, 580]], INK, 2);
  // 水潭
  ctx.fillStyle = '#7fcdf0'; ctx.fillRect(0, 560, W, H - 560);
  line(ctx, [[0, 560], [540, 560]], INK, 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const y = 590 + i * 20; ctx.beginPath(); ctx.ellipse(270, y, 120 + i * 30, 6, 0, 0, Math.PI); ctx.stroke(); }
  // 水花
  for (let i = 0; i < 9; i++) circle(ctx, 180 + i * 22, 566 + Math.sin(t * 6 + i) * 3, 9 + (i % 3) * 3, '#ffffff', 1.6);
}

/** 教室 (第 5 关：别困了 / 第 11 关：林栖的完美教室) */
export function bg_classroom(ctx, L, S) {
  const { W, H } = S;
  ctx.fillStyle = '#fff4e6'; ctx.fillRect(0, 0, W, H);
  // 墙裙
  box(ctx, -10, H * 0.62, 560, H * 0.06, '#e8cfae', 0); line(ctx, [[-10, H * 0.62], [550, H * 0.62]], INK, 2);
  // 地板
  ctx.fillStyle = '#d6a873'; ctx.fillRect(0, H * 0.68, W, H * 0.32);
  ctx.strokeStyle = 'rgba(120,70,40,0.22)'; ctx.lineWidth = 1.4;
  for (let x = -200; x < W + 200; x += 46) { ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * 0.55, H * 0.68); ctx.lineTo(x, H); ctx.stroke(); }
  line(ctx, [[-10, H * 0.68], [550, H * 0.68]], INK, 2);
}

/** 异世界王座大厅 (第 6 关) */
export function bg_throne(ctx, L, S) {
  const { W, H } = S;
  ctx.fillStyle = '#5b4a8a'; ctx.fillRect(0, 0, W, H);
  // 石砖墙
  ctx.fillStyle = '#6a58a0'; ctx.fillRect(0, 0, W, 470);
  ctx.strokeStyle = 'rgba(40,20,70,0.35)'; ctx.lineWidth = 1.5;
  for (let y = 0; y < 470; y += 34) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let x = (y / 34) % 2 ? 0 : 40; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 34); ctx.stroke(); }
  }
  // 拱形窗 (中央高处)
  ctx.beginPath(); ctx.moveTo(220, 150); ctx.lineTo(220, 70); ctx.arc(270, 70, 50, Math.PI, 0); ctx.lineTo(320, 150); ctx.closePath();
  fs(ctx, '#ffd9a8');
  line(ctx, [[270, 20], [270, 150]], INK, 2); line(ctx, [[220, 95], [320, 95]], INK, 2);
  // 柱子
  for (const x of [40, 500]) {
    box(ctx, x - 26, 40, 52, 440, '#d8cdf0', 3);
    box(ctx, x - 34, 30, 68, 20, '#c4b6e6', 3);
    box(ctx, x - 34, 470, 68, 20, '#c4b6e6', 3);
    for (const dx of [-12, 0, 12]) line(ctx, [[x + dx, 56], [x + dx, 466]], 'rgba(74,54,86,0.35)', 1.5);
  }
  // 地面 + 红地毯
  ctx.fillStyle = '#8e7cc0'; ctx.fillRect(0, 480, W, H - 480);
  line(ctx, [[0, 480], [540, 480]], INK, 2);
  ctx.strokeStyle = 'rgba(40,20,70,0.3)';
  for (let y = 520; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  poly(ctx, [[220, 480], [320, 480], [400, H + 10], [140, H + 10]], '#d3455b');
  line(ctx, [[232, 480], [158, H + 10]], '#ffcf5a', 3); line(ctx, [[308, 480], [382, H + 10]], '#ffcf5a', 3);
  // 王座台阶
  box(ctx, 160, 440, 220, 26, '#b3a3db', 4); box(ctx, 140, 462, 260, 22, '#a594d0', 4);
}

/** 公会 / 管理局办公室 (第 7 关) */
export function bg_guild(ctx, L, S) {
  const { W, H } = S;
  ctx.fillStyle = '#f7ecd9'; ctx.fillRect(0, 0, W, H);
  // 木墙板
  ctx.fillStyle = '#e6cfa8'; ctx.fillRect(0, 300, W, 200);
  ctx.strokeStyle = 'rgba(120,80,40,0.25)'; ctx.lineWidth = 1.4;
  for (let x = 0; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x, 500); ctx.stroke(); }
  line(ctx, [[0, 300], [540, 300]], INK, 2);
  // 地板 (格子)
  ctx.fillStyle = '#cfd6e8'; ctx.fillRect(0, 500, W, H - 500);
  ctx.strokeStyle = 'rgba(80,80,130,0.2)';
  for (let y = 530; y < H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 500); ctx.lineTo(x, H); ctx.stroke(); }
  line(ctx, [[0, 500], [540, 500]], INK, 2);
  // 窗
  box(ctx, 360, 60, 150, 120, '#c8ecff', 4);
  line(ctx, [[435, 60], [435, 180]], INK, 2); line(ctx, [[360, 120], [510, 120]], INK, 2);
  cloud(ctx, 400, 100, 60, '#ffffff');
}

/** 夜晚街道 (第 8 关：魔法少女变身) */
export function bg_nightstreet(ctx, L, S) {
  const { W, H } = S;
  sky(ctx, W, H, '#2c2a6b', '#7a5bb5', 420);
  const rnd = seeded(31);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W; const y = rnd() * 300; const r = 1 + rnd() * 1.8;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin((S.t || 0) * 2 + i);
    circle(ctx, x, y, r, '#ffffff', 0);
  }
  ctx.globalAlpha = 1;
  circle(ctx, 450, 70, 30, '#fff4c4', 0);
  circle(ctx, 462, 62, 26, '#2f2c6e', 0);
  // 楼房剪影
  ctx.fillStyle = '#3d3878';
  for (const [x, w, h] of [[0, 90, 230], [80, 70, 180], [440, 110, 250], [370, 80, 170]]) ctx.fillRect(x, 420 - h, w, h + 20);
  ctx.fillStyle = '#ffe27a';
  for (const [x, w, h] of [[0, 90, 230], [440, 110, 250]]) for (let yy = 440 - h; yy < 400; yy += 34) for (let xx = x + 12; xx < x + w - 12; xx += 26) if ((xx + yy) % 3) ctx.fillRect(xx, yy, 10, 14);
  // 人行道 + 马路
  ctx.fillStyle = '#5c568f'; ctx.fillRect(0, 420, W, 90);
  line(ctx, [[0, 420], [540, 420]], INK, 2);
  ctx.fillStyle = '#433e75'; ctx.fillRect(0, 510, W, H - 510);
  line(ctx, [[0, 510], [540, 510]], INK, 2);
}

/** 深夜办公室 (第 9 关：零七的加班夜) */
export function bg_office(ctx, L, S) {
  const { W, H } = S;
  ctx.fillStyle = '#d9dcef'; ctx.fillRect(0, 0, W, H);
  // 大落地窗 (夜景)
  box(ctx, 20, 30, 500, 300, '#26244f', 4);
  const rnd = seeded(5);
  ctx.fillStyle = '#3a3870';
  for (let x = 20; x < 520; x += 38) { const h = 60 + rnd() * 140; ctx.fillRect(x, 330 - h, 34, h); }
  ctx.fillStyle = '#ffd966';
  for (let i = 0; i < 70; i++) { const x = 26 + rnd() * 488; const y = 200 + rnd() * 120; ctx.fillRect(x, y, 4, 5); }
  for (const x of [145, 270, 395]) line(ctx, [[x, 30], [x, 330]], INK, 3);
  box(ctx, 20, 30, 500, 300, null, 4, 3);
  // 地毯
  ctx.fillStyle = '#9aa0c8'; ctx.fillRect(0, 470, W, H - 470);
  line(ctx, [[0, 470], [540, 470]], INK, 2);
}

/** 偶像后台化妆间 (第 10 关：找不同) */
export function bg_backstage(ctx, L, S) {
  const { W, H } = S;
  ctx.fillStyle = '#ffe3ec'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,170,200,0.25)';
  for (let x = 0; x < W; x += 30) ctx.fillRect(x, 0, 14, H * 0.66);
  // 化妆台
  box(ctx, -10, H * 0.66, 560, H * 0.08, '#f6d2a5', 0); line(ctx, [[-10, H * 0.66], [550, H * 0.66]], INK, 2);
  ctx.fillStyle = '#e7b98a'; ctx.fillRect(0, H * 0.74, W, H * 0.26); line(ctx, [[-10, H * 0.74], [550, H * 0.74]], INK, 2);
}

/** 预告片画面 (第 13 关：下集预告是假的) */
export function bg_preview(ctx, L, S) {
  const { W, H } = S;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1d1b4b'); g.addColorStop(0.55, '#5b2a86'); g.addColorStop(1, '#ff6f91');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 集中线
  ctx.save(); ctx.translate(W / 2, H * 0.42);
  const rnd = seeded(9);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + rnd() * 0.05; const w = 0.012 + rnd() * 0.02;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.lineTo(Math.cos(a - w) * 700, Math.sin(a - w) * 700); ctx.lineTo(Math.cos(a + w) * 700, Math.sin(a + w) * 700); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // 电影黑边
  ctx.fillStyle = '#0f0d24'; ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34);
}
