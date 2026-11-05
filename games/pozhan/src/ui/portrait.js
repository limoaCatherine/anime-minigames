// 角色头像：从立绘裁出圆形头像 (CharacterConfig.face)；团子社长用程序绘制。
import { CHARACTERS } from '../config/CharacterConfig.js';
import { ART } from '../art/index.js';
import { Platform } from '../platform/Platform.js';

const cache = new Map();

/** 预渲染圆形头像 (128px)，缓存 */
function faceCanvas(game, who, pose) {
  const key = `${who}:${pose}`;
  if (cache.has(key)) return cache.get(key);
  const ch = CHARACTERS[who];
  const c = Platform.createCanvas(128, 128);
  const g = c.getContext('2d');
  g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#fff4fa'; g.fillRect(0, 0, 128, 128);
  if (ch.drawn) {
    g.translate(64, 116); g.scale(1.05, 1.05);
    ART[ch.drawn](g, { mood: pose === 'idle' ? 'normal' : pose }, { t: 0, img: () => null });
  } else {
    const imgKey = ch.images[pose] || ch.images.idle;
    const im = game.assets.getImage(imgKey);
    if (!im) return null;
    const f = (ch.face && (ch.face[pose] || ch.face.idle)) || { cx: 0.5, cy: 0.3, r: 0.3 };
    const r = f.r * im.width;
    g.drawImage(im, f.cx * im.width - r, f.cy * im.height - r, r * 2, r * 2, 0, 0, 128, 128);
  }
  cache.set(key, c);
  return c;
}

/** 画圆形头像 (带白边与角色色描边) */
export function drawFace(ctx, game, who, x, y, r, pose = 'idle', ring = true) {
  const ch = CHARACTERS[who];
  const c = faceCanvas(game, who, pose);
  ctx.save();
  if (ring) {
    ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = ch ? ch.color : '#ff6f91'; ctx.stroke();
  }
  if (c) ctx.drawImage(c, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
