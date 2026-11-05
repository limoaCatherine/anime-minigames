// 角色绘制：立绘图片 (公司角色库) 的摆放 / 裁切 / 剪影 / 全息效果，以及程序绘制的吉祥物「团子社长」。
import { INK, LW, circle, ellipse, poly, line, box, text, fs, rr, groundShadow } from './kit.js';
import { CHARACTERS } from '../config/CharacterConfig.js';
import { Platform } from '../platform/Platform.js';

const tmp = { c: null };
function scratch(w, h) {
  if (!tmp.c) tmp.c = Platform.createCanvas(1, 1);
  const c = tmp.c;
  if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
  return c;
}

/**
 * 立绘：{ a:'img', key, h=300 (高度，单位=逻辑像素), anchor:'bottom'|'center', crop:[top,bottom] (0~1),
 *        silhouette:'#rgba', alpha, shadow:true }
 * 原点 = 底部中心 (anchor bottom) 或 中心
 */
export function img(ctx, L, S) {
  const im = S.img(L.key);
  if (!im) return;
  const iw = im.width; const ih = im.height;
  const [c0, c1] = L.crop || [0, 1];
  const sy = ih * c0; const sh = ih * (c1 - c0);
  const H = (L.h || 300);
  const scale = H / ih;
  const dh = sh * scale; const dw = iw * scale;
  const y0 = L.anchor === 'center' ? -H / 2 + c0 * H : -H + c0 * H;
  if (L.shadow) groundShadow(ctx, 0, L.anchor === 'center' ? H / 2 : 0, dw * 0.32, dw * 0.06, 0.2);
  ctx.save();
  if (L.alpha != null) ctx.globalAlpha *= L.alpha;
  if (L.silhouette) {
    // 剪影：先画到临时画布，再用 source-in 上色
    const cw = Math.ceil(iw * 0.5); const chh = Math.ceil(sh * 0.5);
    const c = scratch(cw, chh); const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(im, 0, sy, iw, sh, 0, 0, cw, chh);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = L.silhouette; g.fillRect(0, 0, cw, chh);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(c, 0, 0, cw, chh, -dw / 2, y0, dw, dh);
  } else {
    ctx.drawImage(im, 0, sy, iw, sh, -dw / 2, y0, dw, dh);
  }
  if (L.holo) {
    // 全息投影：青色扫描线 + 轻微透明
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#45e0ff';
    ctx.fillRect(-dw / 2, y0, dw, dh);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    for (let yy = y0 + ((S.t * 24) % 6); yy < y0 + dh; yy += 6) ctx.fillRect(-dw / 2, yy, dw, 1.5);
  }
  ctx.restore();
}

/** 糯糯：{ a:'nuonuo', pose:'idle'|'smug'|'panic'|'broken', h } */
export function nuonuo(ctx, L, S) {
  const key = CHARACTERS.nuonuo.images[L.pose || 'idle'];
  img(ctx, { ...L, key, h: L.h || 300 }, S);
}

/** 剪影影子 (倒在地上)：{ a:'shadowOf', key, h, skew } */
export function shadowOf(ctx, L, S) {
  ctx.save();
  ctx.transform(1, 0, L.skew ?? -1.1, L.squash ?? 0.32, 0, 0);
  img(ctx, { key: L.key, h: L.h || 300, silhouette: L.color || 'rgba(70,40,90,0.42)' }, S);
  ctx.restore();
}

/** 等身立牌：立绘贴在硬纸板上，带厚度和支架 */
export function standee(ctx, L, S) {
  const H = L.h || 240;
  const im = S.img(L.key);
  const w = im ? (im.width / im.height) * H * 0.98 : H * 0.8;
  // 支架 (背后)
  poly(ctx, [[w * 0.05, -H * 0.4], [w * 0.32, 0], [w * 0.22, 0]], '#c9a27a');
  // 纸板 (按人物轮廓稍微外扩的白边)
  ctx.save();
  ctx.translate(4, 3);
  img(ctx, { key: L.key, h: H, silhouette: '#b88a5c' }, S);
  ctx.restore();
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) {
    ctx.save(); ctx.translate(dx, dy); img(ctx, { key: L.key, h: H, silhouette: '#ffffff' }, S); ctx.restore();
  }
  img(ctx, { key: L.key, h: H }, S);
  // 底座
  box(ctx, -w * 0.32, -10, w * 0.64, 12, '#d8b48c', 3);
  // 价签
  ctx.save(); ctx.translate(w * 0.24, -H * 0.18); ctx.rotate(0.12);
  box(ctx, -26, -11, 52, 22, '#fff6c9', 3, 1.6);
  text(ctx, '等身立牌', 0, 1, 10, '#c0392b');
  ctx.restore();
}

/**
 * 团子社长 (程序绘制的吉祥物)：团子身材的猫 + 领带。
 * { a:'dango', mood:'normal'|'angry'|'happy'|'stamp', badge:'工牌文字', sweat }
 * 原点 = 底部中心，约 110 宽 100 高
 */
export function dango(ctx, L, S) {
  const mood = L.mood || 'normal';
  const bob = Math.sin((S.t || 0) * 2.4 + (L.x || 0) * 10) * 1.5;
  groundShadow(ctx, 0, 0, 50, 9, 0.18);
  ctx.save();
  ctx.translate(0, bob * 0.3);
  // 尾巴
  ctx.beginPath(); ctx.moveTo(40, -24); ctx.bezierCurveTo(70, -30, 72, -62, 54, -66);
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = '#fff3df'; ctx.stroke();
  // 耳朵
  poly(ctx, [[-40, -70], [-36, -104], [-12, -84]], '#fff3df');
  poly(ctx, [[40, -70], [36, -104], [12, -84]], '#fff3df');
  poly(ctx, [[-34, -77], [-33, -96], [-19, -84]], '#ffb3c6', 0);
  poly(ctx, [[34, -77], [33, -96], [19, -84]], '#ffb3c6', 0);
  // 团子身体
  ctx.beginPath(); ctx.ellipse(0, -46, 54, 46, 0, 0, Math.PI * 2); fs(ctx, '#fff3df');
  // 腹部阴影 (硬阴影)
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, -46, 54, 46, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#f3dcc0'; ctx.beginPath(); ctx.ellipse(10, -6, 60, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, -46, 54, 46, 0, 0, Math.PI * 2); fs(ctx, null);
  // 花纹 (头顶两道)
  line(ctx, [[-8, -91], [-6, -80]], '#f0a23b', 4); line(ctx, [[6, -91], [5, -81]], '#f0a23b', 4);
  // 脸
  if (mood === 'angry') {
    line(ctx, [[-26, -62], [-14, -56], [-26, -51]], INK, 3);
    line(ctx, [[26, -62], [14, -56], [26, -51]], INK, 3);
  } else if (mood === 'happy') {
    ctx.beginPath(); ctx.arc(-19, -56, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(19, -56, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  } else {
    circle(ctx, -19, -57, 5.5, INK, 0); circle(ctx, 19, -57, 5.5, INK, 0);
    circle(ctx, -17.5, -59, 1.8, '#fff', 0); circle(ctx, 20.5, -59, 1.8, '#fff', 0);
  }
  ctx.fillStyle = 'rgba(255,140,170,0.45)';
  ctx.beginPath(); ctx.ellipse(-30, -46, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(30, -46, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  // ω 嘴
  ctx.beginPath(); ctx.moveTo(-8, -48); ctx.quadraticCurveTo(-4, -43, 0, -48); ctx.quadraticCurveTo(4, -43, 8, -48);
  ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  if (mood === 'angry') { ctx.beginPath(); ctx.ellipse(0, -42, 5, 4, 0, 0, Math.PI * 2); fs(ctx, '#ff7b8f', 1.8); }
  // 胡须
  for (const s of [-1, 1]) {
    line(ctx, [[s * 36, -50], [s * 52, -54]], INK, 1.6);
    line(ctx, [[s * 36, -46], [s * 53, -45]], INK, 1.6);
  }
  // 领带
  poly(ctx, [[-7, -25], [7, -25], [4, -19], [-4, -19]], '#e24a5a', 1.8);
  poly(ctx, [[-4, -19], [4, -19], [8, 2], [0, 9], [-8, 2]], '#e24a5a', 1.8);
  line(ctx, [[-5, -10], [6, -4]], '#ffd2d8', 1.5);
  // 小爪子
  ellipse(ctx, -24, -4, 11, 7, '#fff3df');
  ellipse(ctx, 24, -4, 11, 7, '#fff3df');
  if (L.badge) {
    line(ctx, [[-14, -26], [-24, 6]], '#4a69bd', 2);
    ctx.save(); ctx.translate(-26, 12); ctx.rotate(0.08);
    box(ctx, -17, -12, 34, 26, '#ffffff', 3, 1.8);
    box(ctx, -17, -12, 34, 7, '#4a69bd', 2, 0);
    text(ctx, L.badge, 0, 5, 13, INK);
    ctx.restore();
  }
  if (L.sweat) {
    ctx.beginPath(); ctx.moveTo(46, -86); ctx.quadraticCurveTo(54, -74, 46, -70); ctx.quadraticCurveTo(38, -74, 46, -86);
    fs(ctx, '#bfe9ff', 1.6);
  }
  ctx.restore();
}

/** 零七：全息系统娘 (girl_14) + 工牌写「07」 */
export function zero7(ctx, L, S) {
  const H = L.h || 220;
  img(ctx, { key: 'girl_14', h: H, holo: L.holo !== false, crop: L.crop, alpha: L.alpha }, S);
  // 工牌位置 (按立绘比例)
  const im = S.img('girl_14');
  if (!im) return;
  const k = H / im.height;
  const bx = (-im.width / 2 + im.width * 0.485) * k; const by = -H + im.height * 0.935 * k;
  ctx.save(); ctx.translate(bx, by);
  text(ctx, '07', 0, 0, 22 * k * 2.1, '#2b5876', { weight: '900' });
  ctx.restore();
}
