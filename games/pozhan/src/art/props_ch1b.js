// 第一章 第 3~5 关 (助她脱困 / 文字拼字) 的场景物件。
import { INK, LW, box, poly, line, circle, ellipse, rr, fs, text, blossom, seeded, shine, groundShadow, starPath, shade, clipTo } from './kit.js';
import { img } from './chars.js';

// ———————————————— 第 3 关：中二大小姐被困衣柜 ————————————————
/** 衣柜 { state:'closed'|'open'|'burst', handle:bool } (原点 = 底部中心，约 220×330) */
export function wardrobe(ctx, L, S) {
  const W = 220; const H = 330; const st = L.state || 'closed'; const t = S.t || 0;
  groundShadow(ctx, 0, 0, 130, 14, 0.22);
  // 柜顶哥特装饰
  poly(ctx, [[-W / 2 - 8, -H], [W / 2 + 8, -H], [W / 2 - 4, -H - 18], [30, -H - 22], [0, -H - 48], [-30, -H - 22], [-W / 2 + 4, -H - 18]], '#4b3478');
  circle(ctx, 0, -H - 30, 9, '#c9a6ff', 2);
  starPath(ctx, 0, -H - 30, 6, 2.6, 4); ctx.fillStyle = '#ffffff'; ctx.fill();
  box(ctx, -W / 2, -H, W, H - 8, '#5d4192', 6);
  box(ctx, -W / 2 - 6, -12, W + 12, 12, '#4b3478', 3);
  for (const x of [-W / 2 + 14, W / 2 - 14]) box(ctx, x - 7, -6, 14, 8, '#3a2860', 2, 1.6);
  if (st === 'closed') {
    // 两扇门
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -W / 2 + 10 : 3;
      box(ctx, x0, -H + 16, W / 2 - 13, H - 40, '#7a5bb5', 4);
      box(ctx, x0 + 12, -H + 34, W / 2 - 37, 110, '#8d6cc8', 4, 1.8);
      box(ctx, x0 + 12, -H + 160, W / 2 - 37, 110, '#8d6cc8', 4, 1.8);
    }
    // 门缝 + 偷看的眼睛
    ctx.fillStyle = '#1b1030'; ctx.fillRect(-3, -H + 16, 6, H - 40);
    const blink = (t % 4) > 3.85 ? 0.15 : 1;
    ctx.save(); ctx.shadowColor = '#c26bff'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#e8a6ff'; ctx.beginPath(); ctx.ellipse(0, -H * 0.58, 2.6, 5 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 左门：正常把手；右门：把手掉了，只剩一个空槽
    box(ctx, -22, -190, 9, 40, '#ffd34d', 3, 2);
    if (L.handle) {
      ctx.save(); ctx.translate(36, -170); ctx.rotate(0.15); ctx.scale(0.75, 0.75);
      poly(ctx, [[-24, 10], [24, 10], [-24, -20]], '#9fe3ff');
      box(ctx, -10, -6, 22, 18, '#ffd34d', 3, 1.8);
      ctx.restore();
    } else {
      box(ctx, 26, -190, 12, 42, '#2a1b45', 3, 2);
      for (const y of [-196, -142]) circle(ctx, 32, y, 2.2, '#c9b6e6', 1);
    }
    // 封印符
    ctx.save(); ctx.translate(-56, -250); ctx.rotate(-0.08);
    box(ctx, -14, -34, 28, 72, '#fff6c9', 2, 1.6);
    ['封', '印', '中'].forEach((c, i) => text(ctx, c, 0, -18 + i * 20, 15, '#c0392b', { weight: '900' }));
    ctx.restore();
  } else {
    // 打开 / 被撞开：柜内
    box(ctx, -W / 2 + 10, -H + 16, W - 20, H - 40, '#2a1b45', 4);
    line(ctx, [[-W / 2 + 14, -H + 50], [W / 2 - 14, -H + 50]], '#8f86b8', 4);
    const rnd = seeded(5);
    for (let i = 0; i < 5; i++) {
      const x = -70 + i * 34; const c = ['#1e1e2e', '#3b2f5c', '#5a2340', '#1e1e2e', '#6b4fa3'][i];
      line(ctx, [[x, -H + 50], [x, -H + 62]], '#c9c9d9', 2);
      poly(ctx, [[x - 14, -H + 62], [x + 14, -H + 62], [x + 20 + rnd() * 6, -H + 190], [x - 20 - rnd() * 6, -H + 190]], c, 2);
      box(ctx, x - 8, -H + 62, 16, 8, '#ffffff', 2, 1.2);
    }
    if (st === 'open') {
      poly(ctx, [[-W / 2 + 10, -H + 16], [-W / 2 - 40, -H + 30], [-W / 2 - 40, -36], [-W / 2 + 10, -24]], '#7a5bb5');
      poly(ctx, [[W / 2 - 10, -H + 16], [W / 2 + 40, -H + 30], [W / 2 + 40, -36], [W / 2 - 10, -24]], '#7a5bb5');
      ctx.save(); ctx.translate(W / 2 + 26, -180); ctx.rotate(0.15); ctx.scale(0.6, 0.6);
      poly(ctx, [[-24, 10], [24, 10], [-24, -20]], '#9fe3ff'); box(ctx, -10, -6, 22, 18, '#ffd34d', 3, 1.8);
      ctx.restore();
    } else {
      // 门被撞飞
      ctx.save(); ctx.translate(-150, -20); ctx.rotate(-1.35); box(ctx, -50, -140, 100, 280, '#7a5bb5', 4); ctx.restore();
      ctx.save(); ctx.translate(160, -50); ctx.rotate(1.1); box(ctx, -50, -140, 100, 280, '#7a5bb5', 4); ctx.restore();
    }
  }
}

/** 笔筒 (原点 = 底部)；L.ruler = 是否插着三角尺 */
export function pencilCup(ctx, L) {
  if (L.ruler !== false) {
    ctx.save(); ctx.translate(4, -30); ctx.rotate(0.25);
    poly(ctx, [[-6, 0], [-6, -62], [28, 0]], '#9fe3ff', 2);
    poly(ctx, [[0, -10], [0, -34], [12, -10]], '#ffffff', 1.4);
    ctx.restore();
  }
  for (const [x, c, h] of [[-10, '#ff6f91', 46], [-3, '#7c83ff', 52], [10, '#ffd34d', 42]]) { box(ctx, x - 2.5, -h, 5, h, c, 1.5, 1.4); poly(ctx, [[x - 2.5, -h], [x + 2.5, -h], [x, -h - 7]], '#ffe0b3', 1.2); }
  box(ctx, -16, -34, 32, 34, '#3b2f5c', 5);
  text(ctx, '☠', 0, -16, 14, '#e8dcff');
}

/** 台灯 (原点 = 底部) */
export function deskLamp(ctx) {
  ellipse(ctx, 0, -4, 20, 6, '#3b2f5c');
  line(ctx, [[0, -6], [10, -50], [-8, -76]], INK, 6); line(ctx, [[0, -6], [10, -50], [-8, -76]], '#5d4192', 3.5);
  poly(ctx, [[-26, -70], [6, -92], [16, -72], [-14, -58]], '#5d4192');
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff2a8';
  ctx.beginPath(); ctx.moveTo(-14, -60); ctx.lineTo(-60, 0); ctx.lineTo(10, 0); ctx.lineTo(10, -70); ctx.closePath(); ctx.fill(); ctx.restore();
}

/** 中二床 (原点 = 底部中心) */
export function chuuniBed(ctx) {
  box(ctx, -95, -150, 16, 150, '#3b2f5c', 3);
  poly(ctx, [[-95, -150], [-87, -176], [-79, -150]], '#3b2f5c');
  box(ctx, -90, -70, 185, 50, '#2e2347', 6);
  box(ctx, -86, -84, 178, 26, '#ffffff', 10);
  ctx.beginPath(); ctx.moveTo(-40, -86); ctx.quadraticCurveTo(10, -104, 92, -84); ctx.lineTo(92, -40); ctx.lineTo(-40, -40); ctx.closePath(); fs(ctx, '#4b2f7a');
  for (const [x, y] of [[0, -70], [40, -60], [70, -78]]) { ctx.fillStyle = '#d9c2ff'; starPath(ctx, x, y, 5, 2.2, 4); ctx.fill(); }
  ellipse(ctx, -64, -96, 24, 12, '#ffd6e4');
  box(ctx, -86, -22, 10, 22, '#2e2347', 2); box(ctx, 82, -22, 10, 22, '#2e2347', 2);
}

/** 胶带卷 (原点 = 底部) */
export function tapeRoll(ctx) {
  ctx.save(); ctx.translate(0, -16); ctx.scale(0.7, 0.7); ctx.translate(0, 0);
  ellipse(ctx, 0, 0, 24, 22, '#ffd34d'); ellipse(ctx, 0, 0, 11, 10, '#fff8e1', 2);
  ctx.restore();
}

/** 骷髅蜡烛 + 书 (搁板装饰，原点 = 底部) */
export function chuuniShelfDeco(ctx, L, S) {
  for (const [x, w, h, c] of [[-40, 12, 44, '#5d4192'], [-27, 10, 38, '#c0392b'], [-16, 13, 46, '#2e2347']]) box(ctx, x, -h, w, h, c, 2, 1.6);
  ellipse(ctx, 26, -14, 14, 13, '#f4f0ff'); circle(ctx, 21, -15, 3.5, INK, 0); circle(ctx, 31, -15, 3.5, INK, 0);
  box(ctx, 20, -4, 12, 6, '#f4f0ff', 2, 1.4);
  box(ctx, 23, -46, 6, 20, '#ffffff', 2, 1.4);
  const f = 1 + 0.15 * Math.sin((S.t || 0) * 9);
  ellipse(ctx, 26, -52, 4 * f, 7 * f, '#ffb347', 1.2);
}

// ———————————————— 第 4 关：修行三秒变强 ————————————————
/** 三脚架摄像机 { filter:bool } (原点 = 底部) */
export function tripodCam(ctx, L, S) {
  line(ctx, [[0, -110], [-30, 0]], INK, 5); line(ctx, [[0, -110], [30, 0]], INK, 5); line(ctx, [[0, -110], [0, 0]], INK, 5);
  line(ctx, [[0, -110], [-30, 0]], '#8f86b8', 3); line(ctx, [[0, -110], [30, 0]], '#8f86b8', 3); line(ctx, [[0, -110], [0, 0]], '#8f86b8', 3);
  box(ctx, -40, -160, 70, 48, '#4f466e', 8);
  box(ctx, 30, -150, 26, 30, '#3b3456', 4);
  circle(ctx, 56, -135, 14, L.filter ? '#ff8a3d' : '#8fb0ff', 2.4);
  if (L.filter) { circle(ctx, 56, -135, 9, '#ffd166', 1.4); text(ctx, '燃', 56, -134, 10, '#d62f45', { weight: '900' }); }
  const rec = Math.floor((S.t || 0) * 2) % 2;
  if (rec) circle(ctx, -30, -150, 4, '#ff3b5c', 0);
  text(ctx, 'REC', -14, -150, 8, '#ff3b5c', { weight: '900' });
  box(ctx, -30, -136, 50, 18, '#1f1d38', 3, 1.4);
  text(ctx, L.filter ? '燃系滤镜' : '原片', -5, -126, 9, '#7ff7ff');
}

/** 「慢动作」遥控按钮 (原点 = 中心) */
export function slowmoButton(ctx, L, S) {
  const p = 1 + 0.06 * Math.sin((S.t || 0) * 6);
  box(ctx, -38, -24, 76, 48, '#ffffff', 10);
  ctx.save(); ctx.scale(p, p); circle(ctx, 0, -2, 14, '#ff5d7a', 2.2); ctx.restore();
  text(ctx, '慢动作', 0, 17, 10, INK);
}

/** 灌木 (原点 = 底部) */
export function bush(ctx, L) {
  const c = L.color || '#6fbf73';
  for (const [x, y, r] of [[-30, -22, 24], [0, -34, 30], [30, -22, 24], [-12, -14, 20], [16, -14, 20]]) circle(ctx, x, y, r, c, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (const [x, y] of [[-6, -48], [24, -34]]) { ctx.beginPath(); ctx.ellipse(x, y, 8, 4, -0.4, 0, Math.PI * 2); ctx.fill(); }
  if (L.peek) { // 灌木里露出音箱的一角
    box(ctx, 20, -40, 26, 30, '#4f466e', 4); circle(ctx, 33, -26, 6, '#8f86b8', 1.6);
  }
}

/** 河边石头 (原点 = 底部) */
export function rock(ctx, L) {
  const w = L.w || 80;
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(-w / 2 - 6, -w * 0.4, -w * 0.1, -w * 0.5); ctx.quadraticCurveTo(w * 0.4, -w * 0.55, w / 2, 0); ctx.closePath();
  fs(ctx, L.color || '#a7b1c9');
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-w * 0.15, -w * 0.35, w * 0.16, w * 0.06, -0.3, 0, Math.PI * 2); ctx.fill();
  if (L.item === 'filter') { ctx.save(); ctx.translate(w * 0.1, -w * 0.46); ctx.scale(0.8, 0.8); circle(ctx, 0, -18, 24, '#ff8a3d'); circle(ctx, 0, -18, 18, '#ffd166', 2); text(ctx, '燃', 0, -17, 20, '#d62f45', { weight: '900' }); ctx.restore(); }
  if (L.item === 'speaker') { ctx.save(); ctx.translate(w * 0.05, -w * 0.48); ctx.scale(0.7, 0.7); box(ctx, -18, -52, 36, 52, '#4f466e', 6); circle(ctx, 0, -38, 7, '#8f86b8', 2); circle(ctx, 0, -16, 11, '#8f86b8', 2); ctx.restore(); }
}

/** 燃系滤镜的画面覆盖 (bg 图层) */
export function burnOverlay(ctx, L, S) {
  const { W, H } = S;
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 80, W / 2, H * 0.55, 520);
  g.addColorStop(0, 'rgba(255,170,60,0)'); g.addColorStop(1, 'rgba(255,90,40,0.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const t = S.t || 0;
  for (let i = 0; i < 18; i++) {
    const x = (i * 61) % W; const y = H - ((t * 120 + i * 97) % H);
    ctx.fillStyle = i % 2 ? 'rgba(255,220,120,0.8)' : 'rgba(255,120,60,0.7)';
    ctx.beginPath(); ctx.arc(x + Math.sin(t * 3 + i) * 8, y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

/** 集中线 (bg 图层，L.cx/cy 归一化中心) */
export function focusLines(ctx, L, S) {
  const { W, H } = S; const t = S.t || 0;
  const cx = (L.cx ?? 0.5) * W; const cy = (L.cy ?? 0.5) * H;
  const rnd = seeded(Math.floor(t * 12));
  ctx.fillStyle = L.color || 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + rnd() * 0.04; const w = 0.006 + rnd() * 0.012; const r0 = (L.inner || 170) + rnd() * 60;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a - w) * 800, cy + Math.sin(a - w) * 800); ctx.lineTo(cx + Math.cos(a + w) * 800, cy + Math.sin(a + w) * 800); ctx.closePath(); ctx.fill();
  }
}

/** 可以划动的「速度线」提示区 (原点 = 中心) */
export function swipeHint(ctx, L, S) {
  const t = S.t || 0;
  ctx.save(); ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([2, 12]);
  for (let i = 0; i < 3; i++) { const y = -30 + i * 30; ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.moveTo(-70, y); ctx.lineTo(70, y); ctx.stroke(); }
  ctx.restore();
}

// ———————————————— 第 5 关：别困了！(文字拼字) ————————————————
/** 毛笔字 (原点 = 中心) { ch, size, color } */
export function glyph(ctx, L) {
  const size = L.size || 120;
  text(ctx, L.ch, 3, 5, size, 'rgba(60,30,80,0.18)', { weight: '900' });
  text(ctx, L.ch, 0, 0, size, L.color || '#3b2f5c', { weight: '900', stroke: L.stroke || '#ffffff', sw: L.sw ?? 8 });
  text(ctx, L.ch, 0, 0, size, L.color || '#3b2f5c', { weight: '900' });
}

/** 「囗」字框 (困 / 囚 的外框)：粗笔画方框 (原点 = 中心) */
export function boxGlyph(ctx, L) {
  const s = L.size || 230; const w = s * 0.11;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(60,30,80,0.18)'; ctx.lineWidth = w; ctx.strokeRect(-s / 2 + w / 2 + 4, -s / 2 + w / 2 + 6, s - w, s - w);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w + 10; ctx.strokeRect(-s / 2 + w / 2, -s / 2 + w / 2, s - w, s - w);
  ctx.strokeStyle = L.color || '#3b2f5c'; ctx.lineWidth = w; ctx.strokeRect(-s / 2 + w / 2, -s / 2 + w / 2, s - w, s - w);
  // 起笔的顿笔
  ctx.fillStyle = L.color || '#3b2f5c';
  ctx.beginPath(); ctx.arc(-s / 2 + w / 2, -s / 2 + w / 2, w * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 黑板 (原点 = 中心) */
export function blackboard(ctx, L) {
  const w = L.w || 500; const h = L.h || 300;
  box(ctx, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, '#c98f5a', 6);
  box(ctx, -w / 2, -h / 2, w, h, '#2f5d50', 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + i * 90, -h / 2, 40, h);
  box(ctx, -w / 2, h / 2 + 2, w, 10, '#b07a4a', 2);
  for (const [x, c] of [[-150, '#ffffff'], [-130, '#ffd34d'], [120, '#ff9cc0']]) box(ctx, x, h / 2 - 4, 14, 6, c, 2, 1.2);
  (L.lines || []).forEach((s, i) => text(ctx, s, -w / 2 + 20, -h / 2 + 26 + i * 26, 16, 'rgba(255,255,255,0.85)', { align: 'left', weight: 'normal' }));
}

/** 小人糯糯 (拼字用的「人」，原点 = 底部中心) { pose, h } */
export function miniNuonuo(ctx, L, S) {
  const H = L.h || 120;
  img(ctx, { key: L.pose === 'smug' ? 'nuonuo_happy' : L.pose === 'broken' ? 'nuonuo_lose' : L.pose === 'idle' ? 'nuonuo_idle' : 'nuonuo_scared', h: H }, S);
  if (L.tag) { box(ctx, -16, -H - 26, 32, 24, '#ffffff', 6, 1.6); text(ctx, L.tag, 0, -H - 14, 16, '#e0466d', { weight: '900' }); }
}

/** 汗珠 / 漫画符号 (原点 = 中心) */
export function sweatDrop(ctx) {
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(10, 2, 0, 8); ctx.quadraticCurveTo(-10, 2, 0, -14); fs(ctx, '#bfe9ff', 2);
}

/** 黑板上的「现在的处境」卡 (原点 = 中心) */
export function wordCard(ctx, L) {
  box(ctx, -70, -34, 140, 68, '#fffaf0', 10);
  text(ctx, L.label || '现在：', -30, 0, 15, '#8a6d9e');
  text(ctx, L.ch, 30, 1, 42, L.color || '#e0466d', { weight: '900' });
}
