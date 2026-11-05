// 第二章《转生成为工位》(异世界 × 社畜) 的道具。
import { INK, LW, box, poly, line, circle, ellipse, rr, fs, text, blossom, seeded, shine, groundShadow, starPath, shade, cloud } from './kit.js';

// ———————————————— 第 6 关：转生成为工位 ————————————————
/** 王座 (原点 = 底部中心，约 140×210) */
export function throne(ctx) {
  groundShadow(ctx, 0, 0, 90, 12, 0.25);
  poly(ctx, [[-60, 0], [-60, -150], [-46, -200], [-22, -180], [0, -214], [22, -180], [46, -200], [60, -150], [60, 0]], '#d3455b');
  poly(ctx, [[-44, -60], [-44, -160], [0, -186], [44, -160], [44, -60]], '#b23149', 2);
  for (const x of [-46, 0, 46]) { circle(ctx, x, x ? -200 : -214, 6, '#ffcf5a', 1.8); }
  box(ctx, -72, -70, 144, 22, '#ffcf5a', 6);
  box(ctx, -66, -50, 132, 50, '#c43a52', 4);
  box(ctx, -80, -100, 22, 52, '#ffcf5a', 6); box(ctx, 58, -100, 22, 52, '#ffcf5a', 6);
}

/** 王座上的显示器 (Excel) (原点 = 底部中心) */
export function excelMonitor(ctx) {
  box(ctx, -6, -18, 12, 18, '#8f86b8', 2, 1.8);
  box(ctx, -24, -6, 48, 8, '#8f86b8', 3, 1.8);
  box(ctx, -52, -84, 104, 68, '#3b3456', 6);
  box(ctx, -46, -78, 92, 56, '#ffffff', 2, 1.4);
  box(ctx, -46, -78, 92, 10, '#1f8f4e', 2, 0);
  text(ctx, 'X  本季度报表.xlsx', -42, -73, 6, '#ffffff', { align: 'left' });
  ctx.strokeStyle = 'rgba(74,54,86,0.35)'; ctx.lineWidth = 1;
  for (let y = -66; y < -22; y += 8) { ctx.beginPath(); ctx.moveTo(-46, y); ctx.lineTo(46, y); ctx.stroke(); }
  for (let x = -30; x < 46; x += 18) { ctx.beginPath(); ctx.moveTo(x, -68); ctx.lineTo(x, -22); ctx.stroke(); }
  ctx.fillStyle = '#7fd39c'; ctx.fillRect(-12, -58, 18, 8); ctx.fillStyle = '#ffb3c6'; ctx.fillRect(6, -42, 18, 8);
  // 小皇冠
  poly(ctx, [[-14, -84], [-14, -96], [-7, -90], [0, -100], [7, -90], [14, -96], [14, -84]], '#ffcf5a', 1.8);
}

/** 王座扶手上的沙漏 (沙子往上流) (原点 = 底部) */
export function hourglassUp(ctx, L, S) {
  const t = S.t || 0;
  box(ctx, -12, -4, 24, 4, '#c98f5a', 1.5, 1.4); box(ctx, -12, -40, 24, 4, '#c98f5a', 1.5, 1.4);
  ctx.beginPath(); ctx.moveTo(-9, -36); ctx.lineTo(9, -36); ctx.lineTo(1.5, -20); ctx.lineTo(9, -4); ctx.lineTo(-9, -4); ctx.lineTo(-1.5, -20); ctx.closePath(); fs(ctx, 'rgba(220,240,255,0.85)', 1.6);
  // 沙子在上面堆着，下面几乎空了，还在往上流
  poly(ctx, [[-8, -35], [8, -35], [3, -26], [-3, -26]], '#ffcf5a', 0);
  poly(ctx, [[-4, -6], [4, -6], [0, -9]], '#ffcf5a', 0);
  ctx.fillStyle = '#e0a800';
  for (let i = 0; i < 3; i++) { const y = -8 - ((t * 20 + i * 6) % 16); ctx.fillRect(-0.8, y, 1.6, 2.5); }
}

/** 打卡机 (挂在柱子上，原点 = 中心) */
export function punchClock(ctx) {
  box(ctx, -26, -34, 52, 68, '#e9e4f5', 6);
  circle(ctx, 0, -14, 14, '#ffffff', 2);
  line(ctx, [[0, -14], [0, -23]], INK, 2); line(ctx, [[0, -14], [7, -11]], INK, 2);
  box(ctx, -16, 6, 32, 6, '#3b3456', 2, 1.4);
  ctx.save(); ctx.translate(0, 18); ctx.rotate(-0.06);
  box(ctx, -10, -4, 20, 24, '#fffbe8', 2, 1.4); text(ctx, '考勤', 0, 4, 6, '#d62f45');
  ctx.restore();
  text(ctx, '上班打卡', 0, -40, 9, '#ffffff', { stroke: INK, sw: 3 });
}

/** 悬赏板 (KPI) (原点 = 中心) */
export function questBoard(ctx) {
  box(ctx, -60, -50, 120, 100, '#b98552', 6);
  box(ctx, -52, -42, 104, 84, '#e6c49a', 3, 1.6);
  text(ctx, '悬 赏', 0, -32, 13, '#7a3b16', { weight: '900' });
  ctx.save(); ctx.translate(-22, 2); ctx.rotate(-0.05);
  box(ctx, -24, -20, 48, 46, '#fffbe8', 2, 1.4);
  text(ctx, '本季度', 0, -10, 8, INK); text(ctx, 'KPI', 0, 4, 14, '#d62f45', { weight: '900' }); text(ctx, '史莱姆×300', 0, 18, 6.5, INK);
  ctx.restore();
  ctx.save(); ctx.translate(26, 6); ctx.rotate(0.07);
  box(ctx, -20, -18, 40, 40, '#fff', 2, 1.4); text(ctx, 'OKR', 0, -4, 11, '#2f6fd1', { weight: '900' }); text(ctx, '对齐颗粒度', 0, 10, 6, INK);
  ctx.restore();
  for (const [x, y] of [[-22, -18], [26, -12]]) circle(ctx, x, y, 2.5, '#ff5d6c', 1);
}

/** 送外卖的龙 (原点 = 中心) */
export function deliveryDragon(ctx, L, S) {
  const t = S.t || 0; const flap = Math.sin(t * 6) * 0.3;
  ctx.save(); ctx.translate(0, Math.sin(t * 2) * 3);
  ctx.save(); ctx.rotate(-0.6 + flap); poly(ctx, [[0, -6], [-40, -30], [-30, -6], [-42, 4]], '#8be0b0'); ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 16, -0.1, 0, Math.PI * 2); fs(ctx, '#5cc98f');
  ctx.beginPath(); ctx.moveTo(-26, 4); ctx.quadraticCurveTo(-50, 16, -58, 0); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#5cc98f'; ctx.stroke();
  circle(ctx, 30, -12, 13, '#5cc98f'); poly(ctx, [[28, -24], [24, -36], [34, -26]], '#ffe8a8', 1.6);
  circle(ctx, 34, -14, 2.5, INK, 0);
  ellipse(ctx, 42, -8, 6, 4, '#7fd8a6', 1.6);
  // 外卖箱
  box(ctx, -14, -34, 30, 22, '#ffcc33', 4);
  text(ctx, '饿了喵', 1, -23, 7, '#d62f45', { weight: '900' });
  ctx.save(); ctx.rotate(0.3 + flap); poly(ctx, [[2, -8], [-26, -46], [-8, -12], [-20, -6]], '#8be0b0'); ctx.restore();
  ctx.restore();
}

/** 错别字横幅 (原点 = 中心) */
export function banner(ctx, L, S) {
  const w = L.w || 260;
  line(ctx, [[-w / 2, -20], [-w / 2 - 20, -50]], INK, 2); line(ctx, [[w / 2, -20], [w / 2 + 20, -50]], INK, 2);
  ctx.beginPath(); ctx.moveTo(-w / 2, -20); ctx.lineTo(w / 2, -20); ctx.lineTo(w / 2 - 8, 0); ctx.lineTo(w / 2, 20); ctx.lineTo(-w / 2, 20); ctx.lineTo(-w / 2 + 8, 0); ctx.closePath();
  fs(ctx, L.color || '#ffcf5a');
  text(ctx, L.text || '欢迎勇着大人', 0, 1, L.size || 20, L.ink || '#a3261f', { weight: '900' });
}

/** 插电的火把 (原点 = 墙上支架中心)，L.cord = 电线终点 (局部坐标) */
export function plugTorch(ctx, L, S) {
  const t = S.t || 0;
  const [ex, ey] = L.cord || [50, 160];
  ctx.beginPath(); ctx.moveTo(4, 26); ctx.bezierCurveTo(30, 80, ex - 30, ey - 60, ex, ey - 12);
  ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#f4f4f8'; ctx.stroke();
  box(ctx, ex - 14, ey - 16, 28, 30, '#f4f4f8', 4, 2);
  box(ctx, ex - 7, ey - 22, 14, 14, '#e2e2ea', 2, 1.6);
  for (const dx of [-4, 4]) line(ctx, [[ex + dx, ey - 6], [ex + dx, ey + 2]], INK, 2);
  box(ctx, -20, -4, 40, 10, '#7d7896', 3);
  poly(ctx, [[-8, -6], [8, -6], [5, 30], [-5, 30]], '#8a5a44');
  const f = 1 + 0.12 * Math.sin(t * 10);
  ctx.save(); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(-12, -8); ctx.quadraticCurveTo(-14, -30 * f, 0, -46 * f); ctx.quadraticCurveTo(14, -30 * f, 12, -8); ctx.closePath(); fs(ctx, '#ff9a3c', 1.8);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-6, -22 * f, 0, -30 * f); ctx.quadraticCurveTo(6, -22 * f, 6, -8); ctx.closePath(); ctx.fillStyle = '#ffe27a'; ctx.fill();
}

/** 宝箱 (装着加班券) (原点 = 底部中心) */
export function overtimeChest(ctx) {
  groundShadow(ctx, 0, 0, 56, 9, 0.2);
  poly(ctx, [[-48, -50], [48, -50], [52, -84], [-52, -84]], '#9a5b2e');
  box(ctx, -50, -52, 100, 52, '#b06a35', 6);
  box(ctx, -50, -52, 100, 10, '#ffcf5a', 3, 1.8);
  box(ctx, -8, -40, 16, 18, '#ffcf5a', 3, 1.8);
  // 一沓券露出来
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate(-20 + i * 20, -58); ctx.rotate(-0.3 + i * 0.3);
    box(ctx, -16, -20, 32, 22, '#fff1f5', 3, 1.4); text(ctx, '加班券', 0, -9, 7, '#d62f45', { weight: '900' });
    ctx.restore();
  }
}

/** 盔甲架 + 工牌 (原点 = 底部中心) */
export function armorStand(ctx) {
  groundShadow(ctx, 0, 0, 44, 8, 0.2);
  box(ctx, -30, -10, 60, 10, '#7d7896', 3);
  box(ctx, -4, -70, 8, 62, '#7d7896', 2);
  poly(ctx, [[-40, -170], [40, -170], [34, -80], [-34, -80]], '#c9cfe0');
  poly(ctx, [[-40, -170], [-62, -158], [-56, -128], [-36, -136]], '#b6bdd2');
  poly(ctx, [[40, -170], [62, -158], [56, -128], [36, -136]], '#b6bdd2');
  line(ctx, [[0, -168], [0, -84]], '#9aa2bb', 2);
  ctx.beginPath(); ctx.ellipse(0, -194, 24, 28, 0, 0, Math.PI * 2); fs(ctx, '#c9cfe0');
  box(ctx, -16, -198, 32, 8, '#3b3456', 3, 1.6);
  poly(ctx, [[-3, -222], [3, -222], [8, -240], [-8, -240]], '#d3455b', 1.6);
  // 工牌挂绳
  ctx.beginPath(); ctx.moveTo(-18, -168); ctx.lineTo(0, -128); ctx.lineTo(18, -168); ctx.lineWidth = 3; ctx.strokeStyle = '#2f6fd1'; ctx.stroke();
  box(ctx, -14, -132, 28, 36, '#ffffff', 3, 1.8);
  box(ctx, -14, -132, 28, 8, '#2f6fd1', 2, 0);
  circle(ctx, 0, -114, 6, '#ffd6e4', 1.2);
  text(ctx, '骑士', 0, -102, 6, INK);
}

/** 地上的二维码魔法阵 (原点 = 中心) */
export function qrCircle(ctx, L, S) {
  const t = S.t || 0;
  ctx.save(); ctx.scale(1, 0.38);
  ctx.save(); ctx.shadowColor = '#7cf0ff'; ctx.shadowBlur = 14;
  ctx.strokeStyle = '#7cf0ff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 76, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.rotate(t * 0.3);
  ctx.fillStyle = '#c9f9ff';
  for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i * Math.PI / 6); ctx.fillRect(78, -2, 10, 4); ctx.restore(); }
  ctx.rotate(-t * 0.3);
  // 中间的二维码
  const rnd = seeded(77);
  ctx.fillStyle = 'rgba(20,40,60,0.85)'; ctx.fillRect(-42, -42, 84, 84);
  ctx.fillStyle = '#c9f9ff';
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (rnd() > 0.5) ctx.fillRect(-40 + x * 9, -40 + y * 9, 8, 8);
  for (const [x, y] of [[-40, -40], [13, -40], [-40, 13]]) { ctx.fillStyle = '#c9f9ff'; ctx.fillRect(x, y, 27, 27); ctx.fillStyle = 'rgba(20,40,60,0.95)'; ctx.fillRect(x + 5, y + 5, 17, 17); ctx.fillStyle = '#c9f9ff'; ctx.fillRect(x + 9, y + 9, 9, 9); }
  ctx.restore();
}

/** 地铁换乘指示牌 (原点 = 顶部挂点) */
export function subwaySign(ctx) {
  line(ctx, [[-20, 0], [-20, 20]], INK, 2); line(ctx, [[20, 0], [20, 20]], INK, 2);
  box(ctx, -42, 20, 84, 58, '#2b6fd6', 6);
  circle(ctx, -26, 36, 9, '#ffffff', 1.4); text(ctx, '2', -26, 37, 11, '#2b6fd6', { weight: '900' });
  text(ctx, '号线', 6, 36, 12, '#ffffff', { weight: '900' });
  text(ctx, '换乘 →', 0, 62, 13, '#ffe14d', { weight: '900' });
}

/** USB 剑 (原点 = 剑柄中心，向上) */
export function usbSword(ctx) {
  poly(ctx, [[-7, -20], [7, -20], [6, -150], [0, -168], [-6, -150]], '#e8eefc');
  line(ctx, [[0, -24], [0, -150]], '#bcc7e6', 2);
  box(ctx, -28, -24, 56, 10, '#ffcf5a', 4);
  box(ctx, -6, -14, 12, 34, '#5d4192', 3);
  // 剑柄末端是 USB 插头
  box(ctx, -8, 18, 16, 14, '#c9c9d9', 2, 1.8);
  box(ctx, -5, 32, 10, 12, '#e6e6ee', 1, 1.6);
  ctx.fillStyle = INK; ctx.fillRect(-3, 35, 2, 3); ctx.fillRect(1, 35, 2, 3);
}

// ———————————————— 第 7 关：史莱姆的报销 ————————————————
/** 史莱姆 { size, grab } (原点 = 底部中心) */
export function slime(ctx, L, S) {
  const t = S.t || 0; const s = L.size || 1;
  ctx.save(); ctx.scale(s, s * (1 + Math.sin(t * 2.5) * 0.03));
  ctx.beginPath(); ctx.moveTo(-120, 0); ctx.bezierCurveTo(-140, -60, -100, -170, 0, -175); ctx.bezierCurveTo(100, -170, 140, -60, 120, 0); ctx.closePath();
  ctx.save(); ctx.globalAlpha = 0.86; fs(ctx, L.color || '#6fe0b8'); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-120, 0); ctx.bezierCurveTo(-140, -60, -100, -170, 0, -175); ctx.bezierCurveTo(100, -170, 140, -60, 120, 0); ctx.closePath(); fs(ctx, null);
  ellipse(ctx, -60, -120, 22, 12, 'rgba(255,255,255,0.6)', 0, -0.5);
  // 史莱姆的脸
  if (L.face !== false) {
    circle(ctx, -40, -40, 6, INK, 0); circle(ctx, 40, -40, 6, INK, 0);
    ctx.beginPath(); ctx.arc(0, -36, 10, 0.2, Math.PI - 0.2); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  }
  for (const [x, y] of [[-90, -30], [70, -90], [96, -20]]) circle(ctx, x, y, 5, 'rgba(255,255,255,0.5)', 0);
  ctx.restore();
}

/** 史莱姆的前半层 (包住人物下半身，原点 = 底部中心) */
export function slimeFront(ctx, L, S) {
  const t = S.t || 0; const s = L.size || 1;
  ctx.save(); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-124, 0); ctx.bezierCurveTo(-130, -50, -90, -96, -40, -86 + Math.sin(t * 3) * 3); ctx.quadraticCurveTo(0, -70, 40, -88 + Math.sin(t * 3 + 1) * 3); ctx.bezierCurveTo(90, -96, 130, -50, 124, 0); ctx.closePath();
  ctx.save(); ctx.globalAlpha = 0.9; fs(ctx, L.color || '#6fe0b8'); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-124, 0); ctx.bezierCurveTo(-130, -50, -90, -96, -40, -86 + Math.sin(t * 3) * 3); ctx.quadraticCurveTo(0, -70, 40, -88 + Math.sin(t * 3 + 1) * 3); ctx.bezierCurveTo(90, -96, 130, -50, 124, 0); ctx.closePath(); fs(ctx, null);
  circle(ctx, -50, -40, 6, INK, 0); circle(ctx, 50, -40, 6, INK, 0);
  ctx.beginPath(); ctx.arc(0, -38, 10, 0.2, Math.PI - 0.2); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  ellipse(ctx, -80, -60, 14, 8, 'rgba(255,255,255,0.55)', 0, -0.5);
  ctx.restore();
}

/** 上锁的物资柜 (盐) { open } (原点 = 底部中心) */
export function saltCabinet(ctx, L) {
  box(ctx, -60, -150, 120, 150, '#d9c4a0', 6);
  box(ctx, -52, -142, 104, 134, L.open ? '#f7ecd9' : '#cbb38a', 4, 2);
  if (L.open) {
    for (const [x, y] of [[-30, -100], [0, -100], [30, -100], [-30, -40], [30, -40]]) box(ctx, x - 10, y - 16, 20, 30, '#ffffff', 3, 1.6);
    if (!L.taken) { box(ctx, -12, -58, 24, 34, '#ffffff', 4, 2); box(ctx, -10, -66, 20, 10, '#7cc3ff', 3, 1.6); text(ctx, '盐', 0, -40, 12, '#2f6fd1', { weight: '900' }); }
  } else {
    line(ctx, [[0, -142], [0, -8]], INK, 2);
    box(ctx, -12, -86, 24, 24, '#ffc83d', 4, 2);
    ctx.beginPath(); ctx.arc(0, -86, 7, Math.PI, 0); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.save(); ctx.translate(0, -118); ctx.rotate(-0.06);
    box(ctx, -38, -12, 76, 24, '#ffffff', 3, 1.6); text(ctx, '经费审批中', 0, 0, 10, '#d62f45', { weight: '900' });
    ctx.restore();
  }
}

/** 社长的办公桌 (原点 = 底部中心) */
export function bossDesk(ctx, L) {
  box(ctx, -110, -96, 220, 16, '#8a5a44', 4);
  box(ctx, -104, -80, 208, 80, '#a8714f', 4);
  box(ctx, -90, -66, 80, 52, '#b98552', 3, 1.8); box(ctx, 10, -66, 80, 52, '#b98552', 3, 1.8);
  box(ctx, -40, -40, 80, 22, '#ffffff', 3, 1.6); text(ctx, '社长', 0, -29, 12, INK, { weight: '900' });
  if (L.stamp !== false) {
    ctx.save(); ctx.translate(70, -96);
    box(ctx, -16, -10, 32, 10, '#d62f45', 2, 1.6); box(ctx, -6, -30, 12, 22, '#c9a27a', 3, 1.6); ellipse(ctx, 0, -32, 10, 6, '#a87b55', 1.6);
    ctx.restore();
  }
  // 文件堆
  for (let i = 0; i < 4; i++) box(ctx, -96 + i * 2, -104 - i * 8, 50, 8, '#fffbe8', 2, 1.4);
  if (L.approved) { ctx.save(); ctx.translate(-70, -140); ctx.rotate(-0.2); circle(ctx, 0, 0, 20, null, 3); text(ctx, '准', 0, 1, 20, '#d62f45', { weight: '900' }); ctx.restore(); }
}

/** 纸巾盒 (原点 = 底部) */
export function tissueBox(ctx) {
  box(ctx, -26, -26, 52, 26, '#bfe9ff', 5);
  blossom(ctx, -10, -12, 5); blossom(ctx, 12, -10, 4);
  ctx.beginPath(); ctx.moveTo(-10, -26); ctx.quadraticCurveTo(-14, -46, 0, -44); ctx.quadraticCurveTo(14, -46, 10, -26); ctx.closePath(); fs(ctx, '#ffffff', 1.8);
}

/** 小边桌 (原点 = 底部) */
export function sideTable(ctx, L) {
  const w = L.w || 90;
  ellipse(ctx, 0, -60, w / 2, 10, '#c98f5a');
  box(ctx, -5, -56, 10, 52, '#a8714f', 2);
  ellipse(ctx, 0, -4, 24, 6, '#a8714f');
}

/** 文件抽屉柜 (发票) { open } (原点 = 底部) */
export function fileDrawer(ctx, L) {
  box(ctx, -40, -120, 80, 120, '#9aa6c2', 5);
  for (let i = 0; i < 3; i++) {
    const y = -112 + i * 38;
    if (L.open && i === 1) {
      box(ctx, -44, y + 6, 88, 30, '#b4bdd4', 3);
      if (!L.taken) { ctx.save(); ctx.translate(-6, y + 4); ctx.rotate(-0.1); box(ctx, -16, -12, 32, 18, '#fffbe8', 2, 1.4); text(ctx, '发票', 0, -3, 8, '#d62f45', { weight: '900' }); ctx.restore(); }
    } else {
      box(ctx, -34, y, 68, 32, '#b4bdd4', 3, 1.8);
      box(ctx, -12, y + 12, 24, 6, '#ffffff', 2, 1.4);
    }
  }
  text(ctx, '报销', 0, -128, 10, '#ffffff', { stroke: INK, sw: 3 });
}

// ———————————————— 第 8 关：变身咒语拼错了 ————————————————
/** 商店招牌，chars = 单字数组；picked = 已被拿走的字 (留空) (原点 = 中心) */
export function shopSign(ctx, L, S) {
  const chars = L.chars || ['星', '光'];
  const cw = L.cw || 40; const w = chars.length * cw + 24; const h = L.h || 52;
  ctx.save(); ctx.shadowColor = L.glow || '#ff9cc0'; ctx.shadowBlur = 16;
  box(ctx, -w / 2, -h / 2, w, h, L.bgc || '#3d2a6b', 8, 2.6);
  ctx.restore();
  const picked = new Set((L.picked || []).filter((c) => (S.flags || new Set()).has(`w_${c}`)));
  chars.forEach((c, i) => {
    const x = -w / 2 + 12 + cw / 2 + i * cw;
    if (picked.has(c)) { ctx.save(); ctx.globalAlpha = 0.35; rr(ctx, x - cw / 2 + 4, -h / 2 + 8, cw - 8, h - 16, 4); ctx.strokeStyle = '#fff'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); return; }
    text(ctx, c, x, 2, L.size || 28, L.color || '#ffe27a', { weight: '900', stroke: L.ink || '#c2185b', sw: 4 });
  });
}

/** 变电箱 (原点 = 底部) */
export function transformerBox(ctx, L, S) {
  box(ctx, -46, -110, 92, 110, '#8f9bb3', 5);
  box(ctx, -38, -100, 76, 60, '#a3aec4', 3, 1.8);
  poly(ctx, [[0, -94], [14, -70], [-14, -70]], '#ffd34d', 1.8); text(ctx, '⚡', 0, -78, 12, INK);
  const has = (S.flags || new Set()).has('w_变');
  box(ctx, -40, -34, 80, 26, '#ffffff', 3, 1.6);
  if (!has) text(ctx, '变', -22, -21, 16, '#d62f45', { weight: '900' });
  text(ctx, '电箱', 8, -21, 14, '#d62f45', { weight: '900' });
}

/** 咒语栏 (6 个槽位)，L.word = '星光加班变身' (原点 = 中心) */
export function spellBar(ctx, L, S) {
  const word = L.word || '星光加班变身'; const n = word.length; const cw = 52;
  const w = n * cw + 30;
  box(ctx, -w / 2, -36, w, 72, 'rgba(255,255,255,0.92)', 16);
  text(ctx, '变身咒语', -w / 2 + 14, -26, 11, '#8b5cf6', { align: 'left' });
  [...word].forEach((c, i) => {
    const x = -w / 2 + 15 + cw / 2 + i * cw;
    const got = (S.flags || new Set()).has(`w_${c}`);
    rr(ctx, x - 21, -16, 42, 42, 8); ctx.fillStyle = got ? '#fff0f7' : '#f1eaff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = got ? '#ff6f91' : '#c9b6e6'; ctx.setLineDash(got ? [] : [4, 3]); ctx.stroke(); ctx.setLineDash([]);
    if (got) text(ctx, c, x, 6, 28, '#e0466d', { weight: '900' });
    else text(ctx, '?', x, 6, 18, '#c9b6e6');
  });
}

// ———————————————— 第 9 关：零七的加班夜 ————————————————
/** 方形月亮 (原点 = 中心) */
export function squareMoon(ctx) {
  ctx.save(); ctx.shadowColor = '#fff4c4'; ctx.shadowBlur = 20;
  box(ctx, -24, -24, 48, 48, '#fff4c4', 4, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(230,210,140,0.6)';
  for (const [x, y, r] of [[-8, -6, 5], [8, 8, 4], [10, -10, 3]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
}

/** 玻璃上的白天倒影 (原点 = 中心) */
export function dayReflection(ctx) {
  ctx.save(); ctx.globalAlpha = 0.42;
  const g = ctx.createLinearGradient(0, -60, 0, 60); g.addColorStop(0, '#7cc8ff'); g.addColorStop(1, 'rgba(159,216,255,0.1)');
  ctx.fillStyle = g; ctx.fillRect(-50, -60, 100, 120);
  ctx.globalAlpha = 0.75;
  ctx.save(); ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 16; circle(ctx, 16, -30, 14, '#ffe14d', 0); ctx.restore();
  ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(16 + Math.cos(a) * 19, -30 + Math.sin(a) * 19); ctx.lineTo(16 + Math.cos(a) * 25, -30 + Math.sin(a) * 25); ctx.stroke(); }
  ctx.globalAlpha = 0.4; cloud(ctx, -14, -6, 46, '#ffffff');
  ctx.restore();
}

/** 13 点的挂钟 (原点 = 中心) */
export function clock13(ctx) {
  circle(ctx, 0, 0, 34, '#ffffff');
  circle(ctx, 0, 0, 30, null, 1.2);
  for (let i = 1; i <= 13; i++) { const a = (i / 13) * Math.PI * 2 - Math.PI / 2; text(ctx, String(i), Math.cos(a) * 22, Math.sin(a) * 22 + 0.5, i > 9 ? 6.5 : 7.5, INK); }
  line(ctx, [[0, 0], [0, -17]], INK, 2.4); line(ctx, [[0, 0], [12, 6]], INK, 2.4);
  circle(ctx, 0, 0, 2.5, '#d62f45', 0);
}

/** 2 月 30 日日历 (原点 = 中心) */
export function calendarFeb30(ctx) {
  box(ctx, -32, -38, 64, 76, '#ffffff', 4);
  box(ctx, -32, -38, 64, 20, '#d62f45', 4, 0);
  text(ctx, '2月', 0, -28, 11, '#ffffff', { weight: '900' });
  text(ctx, '30', 0, 4, 30, INK, { weight: '900' });
  text(ctx, '星期八', 0, 26, 9, '#8a6d9e');
  for (const x of [-16, 16]) circle(ctx, x, -38, 3, '#9aa2bb', 1.2);
}

/** 安全出口标志 (小人往墙里跑) (原点 = 中心) */
export function exitSign(ctx) {
  box(ctx, -44, -18, 88, 36, '#1f9e5a', 4);
  // 小人朝反方向 (往墙里) 跑，箭头也指回来
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(14, -8, 4, 0, Math.PI * 2); ctx.fill();
  line(ctx, [[14, -4], [10, 6]], '#fff', 3); line(ctx, [[12, -1], [20, 2]], '#fff', 2.5); line(ctx, [[12, -1], [5, -4]], '#fff', 2.5);
  line(ctx, [[10, 6], [16, 13]], '#fff', 2.5); line(ctx, [[10, 6], [3, 10]], '#fff', 2.5);
  box(ctx, -38, -12, 18, 24, '#ffffff', 1, 0);
  ctx.fillStyle = '#1f9e5a'; ctx.fillRect(-35, -9, 12, 21);
  text(ctx, '←', 32, 0, 14, '#fff', { weight: '900' });
  text(ctx, '不准走', -6, 12, 6, '#d6ffe6');
}

/** 两面都有画面的显示器 (看到的是背面) (原点 = 底部) */
export function backMonitor(ctx) {
  box(ctx, -6, -20, 12, 20, '#8f86b8', 2, 1.8);
  box(ctx, -24, -6, 48, 8, '#8f86b8', 3, 1.8);
  box(ctx, -58, -96, 116, 76, '#3b3456', 6);
  box(ctx, -52, -90, 104, 64, '#ffffff', 2, 1.4);
  text(ctx, 'PPT 终版(1)(最终)', 0, -80, 6.5, '#d65a2f');
  box(ctx, -40, -70, 80, 34, '#ffe0d1', 2, 1.2);
  text(ctx, '赋能', 0, -53, 14, '#d65a2f', { weight: '900' });
  text(ctx, '(背面)', 0, -12, 7, 'rgba(74,54,86,0.6)');
}

/** 办公桌 (前视图，原点 = 底部中心) */
export function officeDesk(ctx, L) {
  const w = L.w || 320;
  box(ctx, -w / 2, -110, w, 16, '#efe8f7', 4);
  box(ctx, -w / 2 + 8, -94, w - 16, 94, '#d9d0ea', 4);
  line(ctx, [[-w / 2 + 8, -60], [w / 2 - 8, -60]], 'rgba(74,54,86,0.25)', 2);
}

/** 戴耳机的仙人掌 (原点 = 底部) */
export function headphoneCactus(ctx) {
  poly(ctx, [[-14, -22], [14, -22], [10, 0], [-10, 0]], '#ff9a76');
  box(ctx, -16, -26, 32, 7, '#ff8a66', 2, 1.6);
  ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(-10, -58); ctx.arc(0, -58, 10, Math.PI, 0); ctx.lineTo(10, -26); ctx.closePath(); fs(ctx, '#6fcf7f');
  ctx.beginPath(); ctx.moveTo(10, -40); ctx.lineTo(18, -40); ctx.lineTo(18, -52); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#6fcf7f'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -56, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  box(ctx, -18, -58, 8, 14, '#ff6f91', 3, 1.6); box(ctx, 10, -58, 8, 14, '#ff6f91', 3, 1.6);
  for (const [x, y] of [[-4, -46], [4, -36], [-3, -32]]) line(ctx, [[x, y], [x - 3, y - 2]], INK, 1);
}

/** 复印机在复印复印机 (原点 = 底部) */
export function copierCopier(ctx) {
  box(ctx, -56, -100, 112, 100, '#e3e6f3', 6);
  box(ctx, -60, -112, 120, 16, '#c9cde0', 4);
  box(ctx, -40, -80, 46, 24, '#4f466e', 3, 1.6); text(ctx, '复印中', -17, -68, 8, '#7ff7ff');
  circle(ctx, 26, -68, 6, '#5dffb0', 1.4);
  // 出纸：纸上印着一台复印机
  ctx.save(); ctx.translate(70, -76); ctx.rotate(0.12);
  box(ctx, -24, -14, 48, 34, '#ffffff', 2, 1.6);
  box(ctx, -12, -6, 24, 18, null, 2, 1.2); box(ctx, -14, -9, 28, 4, null, 1, 1.2); box(ctx, -8, -2, 10, 5, null, 1, 1);
  ctx.restore();
  box(ctx, 50, -66, 30, 6, '#c9cde0', 2, 1.6);
}

/** 气泡往下沉的饮水机 (原点 = 底部) */
export function waterDispenser(ctx, L, S) {
  const t = S.t || 0;
  box(ctx, -30, -120, 60, 120, '#f4f4f8', 5);
  box(ctx, -18, -96, 14, 10, '#ff5d6c', 2, 1.4); box(ctx, 4, -96, 14, 10, '#5dafff', 2, 1.4);
  ctx.beginPath(); ctx.moveTo(-24, -124); ctx.lineTo(-24, -190); ctx.quadraticCurveTo(0, -200, 24, -190); ctx.lineTo(24, -124); ctx.closePath();
  fs(ctx, 'rgba(159,216,255,0.7)');
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) { const y = -186 + ((t * 30 + i * 11) % 60); circle(ctx, -12 + (i * 9) % 24, y, 2.5 + (i % 2), '#ffffff', 1); }
}

/** 便利贴 (原点 = 中心) */
export function stickyNote(ctx, L) {
  ctx.save(); ctx.rotate(L.tilt || -0.06);
  box(ctx, -30, -24, 60, 48, L.bgc || '#fff27a', 2, 1.6);
  (L.lines || ['今日已加班', '25 小时']).forEach((s, i, a) => text(ctx, s, 0, -8 + i * 16 - (a.length - 2) * 8, L.size || 9, INK, { maxW: 54 }));
  ctx.restore();
}

/** 马克杯 (原点 = 底部) */
export function mug(ctx, L) {
  box(ctx, -12, -26, 24, 26, L.color || '#ffffff', 4);
  ctx.beginPath(); ctx.arc(14, -13, 7, -1.2, 1.2); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  if (L.label) text(ctx, L.label, 0, -13, 7, '#d62f45', { weight: '900' });
}

/** 身上滴下的黏液 (原点 = 中心) */
export function slimeDrips(ctx, L, S) {
  const t = S.t || 0;
  for (const [x, y, r] of [[-60, 0, 14], [40, -40, 11], [70, 30, 12], [-30, 60, 10], [10, -90, 9]]) {
    const d = (t * 14 + x) % 20;
    ctx.save(); ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(x, y + d * 0.3, r * 0.8, r, 0, 0, Math.PI * 2); fs(ctx, '#6fe0b8', 1.6);
    ctx.restore();
  }
}

/** 搁板上的药水瓶 (原点 = 底部) */
export function potions(ctx) {
  for (const [x, c, h] of [[-50, '#ff6f91', 34], [-24, '#7cc3ff', 42], [2, '#8be0b0', 30], [28, '#ffcf5a', 38], [52, '#c9a6ff', 32]]) {
    box(ctx, x - 4, -h - 10, 8, 10, '#e9e4f5', 2, 1.4);
    ctx.beginPath(); ctx.ellipse(x, -h / 2, 11, h / 2, 0, 0, Math.PI * 2); fs(ctx, c);
    ellipse(ctx, x - 4, -h * 0.6, 3, 6, 'rgba(255,255,255,0.6)', 0);
  }
  box(ctx, -40, -18, 30, 12, '#ffffff', 2, 1.2); text(ctx, 'HP', -25, -12, 8, '#d62f45', { weight: '900' });
}

/** 普通挂钟 (原点 = 中心) */
export function wallClock(ctx, L) {
  circle(ctx, 0, 0, 30, '#ffffff');
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; line(ctx, [[Math.cos(a) * 22, Math.sin(a) * 22], [Math.cos(a) * 26, Math.sin(a) * 26]], INK, i % 3 ? 1.2 : 2.4); }
  const hr = ((L && L.hr) ?? 0) / 12 * Math.PI * 2 - Math.PI / 2; const mn = ((L && L.min) ?? 17) / 60 * Math.PI * 2 - Math.PI / 2;
  line(ctx, [[0, 0], [Math.cos(hr) * 14, Math.sin(hr) * 14]], INK, 3); line(ctx, [[0, 0], [Math.cos(mn) * 21, Math.sin(mn) * 21]], INK, 2.2);
  circle(ctx, 0, 0, 2.5, '#d62f45', 0);
}
