// 第一章《转角遇到面包》(校园番) 的道具。原点约定：落地物体 = 底部中心；悬挂/漂浮物体 = 中心。
import { INK, LW, box, poly, line, circle, ellipse, rr, fs, text, cloud, blossom, seeded, shine, groundShadow, starPath, shade } from './kit.js';

/** 樱花树开在雪地里 (原点 = 树根) */
export function sakuraSnowTree(ctx, L, S) {
  // 雪堆
  ctx.beginPath(); ctx.moveTo(-95, 6); ctx.quadraticCurveTo(-70, -26, -20, -22); ctx.quadraticCurveTo(30, -34, 70, -16); ctx.quadraticCurveTo(100, -6, 100, 6); ctx.closePath();
  fs(ctx, '#ffffff');
  ctx.fillStyle = '#d7e6ff'; ctx.beginPath(); ctx.ellipse(10, 0, 80, 7, 0, 0, Math.PI * 2); ctx.fill();
  // 小雪人
  circle(ctx, 62, -26, 13, '#ffffff', 2); circle(ctx, 62, -46, 9, '#ffffff', 2);
  circle(ctx, 59, -48, 1.4, INK, 0); circle(ctx, 65, -48, 1.4, INK, 0);
  poly(ctx, [[62, -45], [70, -44], [62, -43]], '#ff9a3c', 1);
  // 树干
  poly(ctx, [[-10, -18], [-6, -120], [-30, -165], [-22, -168], [0, -132], [14, -170], [22, -166], [8, -118], [12, -18]], '#8a5a44');
  // 花团
  const clumps = [[-40, -175, 42], [10, -195, 46], [52, -165, 38], [-62, -140, 30], [30, -140, 30]];
  for (const [x, y, r] of clumps) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fs(ctx, '#ffc6dc', 2.2, '#c46d93'); }
  ctx.fillStyle = '#ffdbe9';
  for (const [x, y, r] of clumps) { ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill(); }
  const rnd = seeded(3);
  for (let i = 0; i < 16; i++) { const c = clumps[i % 5]; blossom(ctx, c[0] + (rnd() - 0.5) * c[2] * 1.3, c[1] + (rnd() - 0.5) * c[2] * 1.2, 5.5); }
  // 枝头积雪
  for (const [x, y] of [[-40, -214], [10, -238], [52, -200]]) { ctx.beginPath(); ctx.ellipse(x, y + 2, 20, 6, 0, Math.PI, 0); fs(ctx, '#ffffff', 1.8); }
  // 雪花
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) { const t = (S.t || 0) * 18 + i * 37; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(-80 + (i * 29) % 170 + Math.sin(t / 30) * 4, -230 + (t % 220), 2.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

/** 电线杆 (原点 = 底部) */
export function utilityPole(ctx) {
  box(ctx, -8, -520, 16, 520, '#b9b0c8', 3);
  box(ctx, -40, -480, 80, 10, '#a79ebb', 3);
  for (const x of [-32, 32]) circle(ctx, x, -485, 4, '#ffffff', 1.6);
  box(ctx, -12, -300, 24, 46, '#fff9e8', 3, 1.8);
  text(ctx, '樱', 0, -287, 12, INK); text(ctx, '町', 0, -269, 12, INK);
}

/** 路边电子钟 (显示 25:70) (原点 = 底部) */
export function streetClock(ctx, L, S) {
  box(ctx, -5, -200, 10, 200, '#9a90b4', 3);
  box(ctx, -52, -262, 104, 62, '#5a4f7e', 10);
  box(ctx, -44, -254, 88, 46, '#1f1d38', 6, 1.6);
  const blink = Math.floor((S.t || 0) * 2) % 2 ? 1 : 0.35;
  text(ctx, '25', -20, -231, 26, '#5dffb0', { weight: '900' });
  ctx.globalAlpha = blink; text(ctx, ':', 0, -233, 24, '#5dffb0', { weight: '900' }); ctx.globalAlpha = 1;
  text(ctx, L.time2 || '70', 20, -231, 26, '#5dffb0', { weight: '900' });
  box(ctx, -18, -212, 36, 10, '#5a4f7e', 2, 0);
}

/** 路牌 (原点 = 底部) */
export function roadSign(ctx, L) {
  box(ctx, -5, -250, 10, 250, '#b1a8c6', 3);
  box(ctx, -78, -320, 156, 78, '#2f6fd1', 8);
  rr(ctx, -72, -314, 144, 66, 6); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  text(ctx, L.line1 || '距离迟到', 0, -296, 17, '#ffffff');
  text(ctx, L.line2 || '还有 -3 分钟', 0, -268, 19, '#ffe14d', { weight: '900' });
}

/** 红绿灯 (三个灯全是绿的) (原点 = 底部) */
export function trafficLight(ctx, L, S) {
  box(ctx, -6, -330, 12, 330, '#9a90b4', 3);
  box(ctx, -24, -470, 48, 140, '#3f3a5c', 10);
  const glow = 0.5 + 0.5 * Math.sin((S.t || 0) * 3);
  for (let i = 0; i < 3; i++) {
    const y = -446 + i * 44;
    ctx.save(); ctx.shadowColor = '#5dff8e'; ctx.shadowBlur = 10 + glow * 8;
    circle(ctx, 0, y, 15, '#4dff88', 2);
    ctx.restore();
    circle(ctx, -4, y - 5, 4, 'rgba(255,255,255,0.75)', 0);
  }
}

/** 法棍 (原点 = 中心，水平放置，长约 190) */
export function baguette(ctx, L) {
  const len = L.len || 190;
  ctx.beginPath(); ctx.ellipse(0, 0, len / 2, 15, 0, 0, Math.PI * 2); fs(ctx, '#e7a65a');
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, len / 2, 15, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#c98336'; ctx.fillRect(-len / 2, 5, len, 12);
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, len / 2, 15, 0, 0, Math.PI * 2); fs(ctx, null);
  for (let i = -3; i <= 3; i++) {
    const x = i * len * 0.12;
    ctx.beginPath(); ctx.moveTo(x - 10, 6); ctx.quadraticCurveTo(x, -9, x + 12, -8);
    ctx.lineWidth = 2; ctx.strokeStyle = '#a8662a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, 4); ctx.quadraticCurveTo(x, -6, x + 9, -6); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd59a'; ctx.stroke();
  }
}

/** 「临期 5 折」小标签 */
export function saleSticker(ctx) {
  ctx.save(); ctx.rotate(-0.2);
  box(ctx, -22, -11, 44, 22, '#ffe14d', 4, 1.6);
  text(ctx, '临期5折', 0, 0.5, 10, '#d62f45', { weight: '900' });
  ctx.restore();
}

/** 电饭煲书包 (原点 = 中心) */
export function riceCookerBag(ctx) {
  // 书包背带
  ctx.beginPath(); ctx.moveTo(-26, -30); ctx.quadraticCurveTo(-40, -70, -6, -78); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#3c64c8'; ctx.stroke();
  // 锅身
  ctx.beginPath(); ctx.moveTo(-44, -26); ctx.quadraticCurveTo(-48, 28, -30, 34); ctx.lineTo(30, 34); ctx.quadraticCurveTo(48, 28, 44, -26); ctx.closePath();
  fs(ctx, '#ffffff');
  ctx.fillStyle = '#e3e6f3'; ctx.fillRect(18, -22, 22, 54);
  ctx.beginPath(); ctx.moveTo(-44, -26); ctx.quadraticCurveTo(-48, 28, -30, 34); ctx.lineTo(30, 34); ctx.quadraticCurveTo(48, 28, 44, -26); ctx.closePath(); fs(ctx, null);
  // 盖子
  ctx.beginPath(); ctx.ellipse(0, -28, 46, 15, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#ff9fb8');
  box(ctx, -10, -50, 20, 10, '#ffffff', 4, 1.8);
  // 面板
  box(ctx, -20, -6, 40, 26, '#4f466e', 5, 1.8);
  text(ctx, '煮饭', 0, 3, 10, '#ffffff');
  circle(ctx, -9, 14, 3, '#ff5d6c', 0); circle(ctx, 0, 14, 3, '#5dffb0', 0); circle(ctx, 9, 14, 3, '#ffd34d', 0);
  // 蒸汽
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
  for (const dx of [-8, 8]) { ctx.beginPath(); ctx.moveTo(dx, -56); ctx.bezierCurveTo(dx - 8, -66, dx + 8, -74, dx, -84); ctx.stroke(); }
}

/** 饭粒 (彩蛋) */
export function riceGrain(ctx) {
  ellipse(ctx, 0, 0, 3.6, 2.4, '#ffffff', 1.2, 0.5);
}

/** 奔跑的速度线 */
export function speedLines(ctx, L, S) {
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineCap = 'round';
  const t = S.t || 0;
  for (let i = 0; i < 7; i++) {
    const y = -120 + i * 34; const off = ((t * 300 + i * 70) % 80);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-30 - off, y); ctx.lineTo(-90 - off, y); ctx.stroke();
  }
}

// ———————— 第 2 关：天台 ————————

/** 第二个太阳 (原点 = 中心) */
export function extraSun(ctx, L, S) {
  const t = S.t || 0;
  ctx.save();
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
  g.addColorStop(0, 'rgba(255,220,150,0.9)'); g.addColorStop(1, 'rgba(255,170,120,0)');
  ctx.fillStyle = g; ctx.fillRect(-70, -70, 140, 140);
  ctx.rotate(t * 0.2);
  ctx.strokeStyle = 'rgba(255,200,120,0.8)'; ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(44, 0); ctx.stroke(); }
  ctx.restore();
  circle(ctx, 0, 0, 26, '#ffb35c', 2.2);
  circle(ctx, -7, -7, 8, 'rgba(255,255,255,0.6)', 0);
}

/** 书包 + 朝向太阳的错误影子 (原点 = 底部中心) */
export function bagWrongShadow(ctx) {
  ctx.save(); ctx.transform(1, 0, 1.3, 0.3, 0, 0);
  ctx.fillStyle = 'rgba(60,30,80,0.38)'; rr(ctx, -24, -60, 48, 60, 8); ctx.fill();
  ctx.restore();
  box(ctx, -26, -54, 52, 54, '#3b4f8c', 9);
  box(ctx, -26, -54, 52, 20, '#2f416f', 9);
  box(ctx, -8, -38, 16, 8, '#ffd34d', 2, 1.5);
  ctx.beginPath(); ctx.arc(0, -54, 12, Math.PI, 0); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
}

/** 晾衣架 + 校服背影 (原点 = 底部中心) */
export function uniformOnRack(ctx) {
  // 架子
  box(ctx, -60, -210, 8, 210, '#c7c1d8', 3); box(ctx, 52, -210, 8, 210, '#c7c1d8', 3);
  box(ctx, -66, -214, 132, 8, '#b3abc9', 3);
  box(ctx, -72, -6, 28, 6, '#b3abc9', 2); box(ctx, 44, -6, 28, 6, '#b3abc9', 2);
  // 衣架
  line(ctx, [[0, -206], [0, -196]], INK, 2);
  ctx.beginPath(); ctx.moveTo(-34, -178); ctx.lineTo(0, -196); ctx.lineTo(34, -178); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  // 校服外套 (背面)
  poly(ctx, [[-36, -180], [36, -180], [46, -150], [40, -90], [-40, -90], [-46, -150]], '#2e3f78');
  poly(ctx, [[-36, -180], [-56, -150], [-54, -100], [-44, -100], [-42, -148]], '#2e3f78');
  poly(ctx, [[36, -180], [56, -150], [54, -100], [44, -100], [42, -148]], '#2e3f78');
  line(ctx, [[0, -176], [0, -94]], '#24325f', 2);
  // 领子 (水手领背面)
  poly(ctx, [[-30, -180], [30, -180], [26, -150], [-26, -150]], '#ffffff', 2);
  line(ctx, [[-26, -156], [26, -156]], '#2e3f78', 2);
  // 裤子 (夹子夹着)
  poly(ctx, [[-28, -88], [28, -88], [26, -20], [6, -20], [0, -60], [-6, -20], [-26, -20]], '#3a3a5e');
  for (const x of [-20, 20]) box(ctx, x - 4, -94, 8, 10, '#ff8fb0', 2, 1.4);
  // 假发 (一撮头发顶在衣架上)
  ctx.beginPath(); ctx.ellipse(0, -204, 20, 11, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#3b2a20', 2);
}

/** 天台门 (挂锁在外面) (原点 = 底部中心) */
export function rooftopDoor(ctx) {
  box(ctx, -78, -270, 156, 270, '#d9d4e6', 4);
  ctx.fillStyle = 'rgba(80,60,110,0.12)'; ctx.fillRect(40, -268, 36, 268);
  box(ctx, -52, -232, 104, 232, '#9fb3d9', 4);
  box(ctx, -32, -206, 64, 54, '#dff2ff', 4, 2);
  line(ctx, [[-32, -179], [32, -179]], INK, 1.5);
  // 门把手 + 挂锁
  box(ctx, 26, -126, 10, 30, '#c6c6d6', 3, 2);
  ctx.beginPath(); ctx.arc(31, -94, 11, Math.PI, 0); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#d8d8e4'; ctx.stroke();
  box(ctx, 15, -94, 32, 30, '#ffc83d', 5);
  circle(ctx, 31, -82, 3.5, INK, 0); line(ctx, [[31, -80], [31, -73]], INK, 2.5);
  // 门牌
  box(ctx, -36, -258, 72, 18, '#ffffff', 3, 1.6);
  text(ctx, '天台 · 禁止告白', 0, -248, 10, INK);
}

/** 气球 + 小牌子 (原点 = 气球中心) */
export function balloonSign(ctx, L, S) {
  const sway = Math.sin((S.t || 0) * 1.4) * 4;
  ctx.save(); ctx.translate(sway, 0);
  line(ctx, [[0, 40], [-6, 70], [0, 92]], INK, 1.5);
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 37, 0, 0, Math.PI * 2); fs(ctx, '#ff5d7a');
  poly(ctx, [[-5, 37], [5, 37], [0, 44]], '#ff5d7a', 1.6);
  ellipse(ctx, -10, -14, 7, 11, 'rgba(255,255,255,0.55)', 0, -0.4);
  ctx.save(); ctx.translate(0, 112); ctx.rotate(Math.sin((S.t || 0) * 1.4 + 1) * 0.06);
  box(ctx, -58, -18, 116, 38, '#ffffff', 6, 2);
  text(ctx, '别跳！', 0, -6, 13, '#d62f45', { weight: '900' });
  text(ctx, '期末还没考', 0, 10, 12, INK);
  ctx.restore();
  ctx.restore();
}

/** 自动售货机 (只卖「勇气」) (原点 = 底部中心) */
export function vendingCourage(ctx) {
  box(ctx, -56, -210, 112, 210, '#ff7a8f', 8);
  box(ctx, -46, -196, 92, 112, '#e9f6ff', 4, 2);
  const items = ['勇气', '勇气', '勇气', '勇气', '勇气', '后悔药'];
  items.forEach((s, i) => {
    const x = -32 + (i % 3) * 32; const y = -176 + Math.floor(i / 3) * 52;
    box(ctx, x - 10, y - 14, 20, 30, i === 5 ? '#b9b3c9' : '#ffd34d', 4, 1.6);
    text(ctx, s, x, y + 26, 8.5, INK, { maxW: 30 });
  });
  text(ctx, '售罄', 32, -112, 8, '#ffffff', { stroke: '#d62f45', sw: 2.5 });
  box(ctx, -46, -76, 60, 22, '#4f466e', 4, 1.8);
  text(ctx, '¥998', -16, -64, 12, '#5dffb0');
  box(ctx, -40, -44, 80, 26, '#3a3150', 4, 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-40, -196, 8, 112);
}

/** 混在樱花里的枫叶 (原点 = 中心) */
export function mapleCluster(ctx) {
  const leaf = (x, y, r, rot, c) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const rad = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); fs(ctx, c, 1.4, '#7a2230');
    ctx.restore();
  };
  for (const [x, y, r, rot] of [[-16, -6, 13, 0.3], [10, -14, 11, -0.5], [4, 10, 12, 0.9]]) blossom(ctx, x + 18, y + 12, 7);
  leaf(-14, -4, 15, 0.2, '#e8473c'); leaf(14, -12, 13, -0.4, '#ff7a35'); leaf(4, 12, 14, 0.7, '#d92f3a');
}

/** 云彩拼出「BE」(原点 = 中心) */
export function cloudBE(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.95;
  text(ctx, 'BE', 0, 0, 58, '#fff4f2', { weight: '900', stroke: 'rgba(200,140,170,0.5)', sw: 8 });
  for (const [x, y, r] of [[-40, 18, 14], [-10, 22, 12], [24, 20, 15], [44, 10, 10], [-50, -12, 10]]) circle(ctx, x, y, r, 'rgba(255,244,242,0.95)', 0);
  ctx.restore();
}

/** 拿摄像机的乌鸦 (原点 = 脚底) */
export function crowCamera(ctx, L, S) {
  line(ctx, [[-6, 0], [-6, -10]], '#ffb347', 2.5); line(ctx, [[6, 0], [6, -10]], '#ffb347', 2.5);
  ctx.beginPath(); ctx.ellipse(0, -30, 22, 24, 0, 0, Math.PI * 2); fs(ctx, '#2b2840');
  poly(ctx, [[18, -40], [36, -56], [16, -30]], '#2b2840');
  circle(ctx, -8, -46, 14, '#2b2840');
  poly(ctx, [[-20, -46], [-36, -42], [-20, -40]], '#ffb347', 1.6);
  circle(ctx, -11, -49, 3.4, '#ffffff', 0); circle(ctx, -12, -49, 1.6, INK, 0);
  // 摄像机
  box(ctx, -36, -34, 30, 20, '#56506e', 4, 1.8);
  circle(ctx, -40, -24, 7, '#8fb0ff', 1.8);
  const rec = Math.floor((S.t || 0) * 2) % 2;
  if (rec) circle(ctx, -12, -30, 3, '#ff3b5c', 0);
  text(ctx, 'REC', -20, -42, 8, '#ff3b5c', { weight: '900' });
}

/** 远处大楼的广告屏 (原点 = 底部中心) */
export function billboard(ctx, L, S) {
  box(ctx, -4, -40, 8, 40, '#7d7896', 2, 1.6);
  box(ctx, -62, -86, 124, 50, '#1f1d38', 5, 2);
  const flick = 0.85 + 0.15 * Math.sin((S.t || 0) * 9);
  ctx.globalAlpha = flick;
  text(ctx, L.line1 || '今日告白成功率', 0, -70, 11, '#7ff7ff');
  text(ctx, L.line2 || '3%', 0, -50, 18, '#ff6f91', { weight: '900' });
  ctx.globalAlpha = 1;
}

/** 告白信 = 报销单 (原点 = 中心) */
export function loveLetter(ctx) {
  ctx.save(); ctx.rotate(-0.08);
  box(ctx, -38, -50, 76, 92, '#ffffff', 3);
  box(ctx, -38, -50, 76, 18, '#ffe0ea', 3, 0);
  text(ctx, '报销单', 0, -40, 13, '#d62f45', { weight: '900' });
  ctx.strokeStyle = 'rgba(74,54,86,0.45)'; ctx.lineWidth = 1.2;
  for (let y = -22; y < 34; y += 11) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(30, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 30); ctx.stroke();
  text(ctx, '金额', -15, -16, 8, INK); text(ctx, '¥520', 15, -16, 8, '#d62f45');
  // 信封
  poly(ctx, [[-44, 14], [44, 14], [44, 52], [-44, 52]], '#ffd6e4');
  poly(ctx, [[-44, 14], [0, 36], [44, 14]], '#ffc0d6', 1.8);
  ctx.fillStyle = '#ff5d7a'; ctx.beginPath(); ctx.moveTo(0, 46); ctx.bezierCurveTo(-10, 36, -4, 30, 0, 36); ctx.bezierCurveTo(4, 30, 10, 36, 0, 46); ctx.fill();
  ctx.restore();
}

/** 樱花枝 (前景装饰，原点 = 枝条根部) */
export function sakuraBranch(ctx, L) {
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(60, 20, 130, 10); ctx.lineWidth = 7; ctx.strokeStyle = '#8a5a44'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(60, 14); ctx.quadraticCurveTo(80, 40, 110, 52); ctx.lineWidth = 4; ctx.stroke();
  const rnd = seeded(L.seed || 11);
  for (let i = 0; i < 14; i++) blossom(ctx, 20 + rnd() * 120, -6 + rnd() * 56, 7 + rnd() * 3);
}
