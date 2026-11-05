// 精灵工厂：怪物 / 宝石 / 子弹全部用 Canvas 程序化绘制一次，缓存到离屏画布，战斗中只做 drawImage。
// 每个怪物精灵另有一张「纯白剪影」用于受击闪白。精英怪额外缓存一张金色描边版本。
import { drawStar } from '../ui/draw.js';
import { platform } from '../core/platform/index.js';

const RES = 2;     // 离屏画布按 2 倍分辨率绘制

function canvas(w, h) {
  const c = platform.createCanvas(Math.ceil(w * RES), Math.ceil(h * RES));
  const g = c.getContext('2d');
  g.scale(RES, RES);
  return [c, g];
}

function whiteOf(src) {
  const c = platform.createCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function outlineOf(src, color, px = 3) {
  const pad = px * RES * 2;
  const c = platform.createCanvas(src.width + pad, src.height + pad);
  const g = c.getContext('2d');
  const sil = platform.createCanvas(src.width, src.height);
  const sg = sil.getContext('2d'); sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-atop'; sg.fillStyle = color; sg.fillRect(0, 0, sil.width, sil.height);
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    g.drawImage(sil, pad / 2 + Math.cos(ang) * px * RES, pad / 2 + Math.sin(ang) * px * RES);
  }
  g.drawImage(src, pad / 2, pad / 2);
  return c;
}

const eyes = (g, x, y, gap, r, style = 'dot') => {
  for (const s of [-1, 1]) {
    if (style === 'happy') {
      g.strokeStyle = '#3a2350'; g.lineWidth = r * 0.7; g.lineCap = 'round';
      g.beginPath(); g.arc(x + s * gap, y + r * 0.4, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    } else if (style === 'sleepy') {
      g.strokeStyle = '#3a2350'; g.lineWidth = r * 0.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + s * gap - r, y); g.lineTo(x + s * gap + r, y); g.stroke();
    } else if (style === 'angry') {
      g.fillStyle = '#3a2350'; g.beginPath(); g.arc(x + s * gap, y, r, 0, 7); g.fill();
      g.strokeStyle = '#3a2350'; g.lineWidth = r * 0.6;
      g.beginPath(); g.moveTo(x + s * (gap + r * 1.2), y - r * 1.8); g.lineTo(x + s * (gap - r * 1.2), y - r * 0.9); g.stroke();
    } else {
      g.fillStyle = '#3a2350'; g.beginPath(); g.arc(x + s * gap, y, r, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + s * gap - r * 0.35, y - r * 0.35, r * 0.38, 0, 7); g.fill();
    }
  }
};
const blush = (g, x, y, gap, r) => {
  g.fillStyle = 'rgba(255,120,160,0.45)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * gap, y, r * 1.3, r * 0.7, 0, 0, 7); g.fill(); }
};
const shade = (g, cx, cy, r, color, light = '#ffffff') => {
  const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.05);
  gr.addColorStop(0, light); gr.addColorStop(0.25, color); gr.addColorStop(1, mix(color, '#2a1040', 0.35));
  return gr;
};
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16); const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// 各种怪物的画法：以 (0,0) 为中心，半径 r
const DRAW = {
  slime(g, r, c) {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, r * 0.82, r * 0.9, r * 0.22, 0, 0, 7); g.fill();
    g.fillStyle = shade(g, 0, 0, r, c);
    g.beginPath(); g.moveTo(-r, r * 0.7); g.bezierCurveTo(-r * 1.1, -r * 0.4, -r * 0.5, -r * 1.05, 0, -r * 1.0);
    g.bezierCurveTo(r * 0.5, -r * 1.05, r * 1.1, -r * 0.4, r, r * 0.7); g.quadraticCurveTo(0, r * 0.95, -r, r * 0.7); g.fill();
    eyes(g, 0, -r * 0.05, r * 0.36, r * 0.14); blush(g, 0, r * 0.22, r * 0.55, r * 0.13);
  },
  bat(g, r, c) {
    g.fillStyle = mix(c, '#3a1a50', 0.35);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * r * 0.4, -r * 0.2); g.quadraticCurveTo(s * r * 1.5, -r * 1.0, s * r * 1.65, -r * 0.1);
      g.quadraticCurveTo(s * r * 1.3, r * 0.05, s * r * 1.2, r * 0.35); g.quadraticCurveTo(s * r * 0.9, r * 0.1, s * r * 0.4, r * 0.3); g.fill();
    }
    g.fillStyle = shade(g, 0, 0, r * 0.75, c); g.beginPath(); g.arc(0, 0, r * 0.75, 0, 7); g.fill();
    g.fillStyle = c; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.2, -r * 0.6); g.lineTo(s * r * 0.5, -r * 1.05); g.lineTo(s * r * 0.6, -r * 0.45); g.fill(); }
    eyes(g, 0, -r * 0.05, r * 0.26, r * 0.12, 'happy');
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-r * 0.1, r * 0.25); g.lineTo(0, r * 0.42); g.lineTo(r * 0.1, r * 0.25); g.fill();
  },
  bubble(g, r, c) {
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, c); gr.addColorStop(1, mix(c, '#4a5aa0', 0.4));
    g.globalAlpha = 0.9; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = r * 0.08; g.beginPath(); g.arc(0, 0, r * 0.92, 3.6, 4.6); g.stroke();
    eyes(g, 0, r * 0.05, r * 0.32, r * 0.13, 'sleepy');
    g.fillStyle = '#3a2350'; g.beginPath(); g.arc(0, r * 0.35, r * 0.09, 0, 7); g.fill();
  },
  bubbleMini(g, r, c) { DRAW.bubble(g, r, c); },
  doll(g, r, c) {
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, r * 0.9, r * 0.8, r * 0.2, 0, 0, 7); g.fill();
    g.fillStyle = shade(g, 0, 0, r, c, '#fff0dd');
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.62, -r * 0.62, r * 0.32, 0, 7); g.fill(); }
    g.beginPath(); g.arc(0, 0, r * 0.88, 0, 7); g.fill();
    g.fillStyle = '#f0d9c0'; g.beginPath(); g.ellipse(0, r * 0.3, r * 0.38, r * 0.28, 0, 0, 7); g.fill();
    g.fillStyle = '#3a2350'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.32, -r * 0.12, r * 0.12, 0, 7); g.fill(); }
    g.strokeStyle = '#7a3a4a'; g.lineWidth = r * 0.06;
    g.beginPath(); g.moveTo(-r * 0.5, -r * 0.5); g.lineTo(-r * 0.2, -r * 0.35); g.moveTo(-r * 0.48, -r * 0.3); g.lineTo(-r * 0.22, -r * 0.55); g.stroke(); // 缝线
    g.beginPath(); g.moveTo(-r * 0.12, r * 0.38); g.lineTo(r * 0.12, r * 0.38); g.stroke();
  },
  lantern(g, r, c) {
    g.fillStyle = 'rgba(255,180,100,0.25)'; g.beginPath(); g.arc(0, 0, r * 1.15, 0, 7); g.fill();
    g.fillStyle = shade(g, 0, 0, r, c, '#fff4d0');
    g.beginPath(); g.moveTo(-r * 0.8, -r * 0.5); g.quadraticCurveTo(0, -r * 1.2, r * 0.8, -r * 0.5); g.lineTo(r * 0.85, r * 0.4);
    for (let i = 3; i >= -3; i--) g.lineTo(i * r * 0.28, r * (0.75 + (i % 2 ? 0.15 : 0)));
    g.lineTo(-r * 0.85, r * 0.4); g.closePath(); g.fill();
    g.fillStyle = '#7a3a2a'; g.fillRect(-r * 0.3, -r * 1.05, r * 0.6, r * 0.18);
    eyes(g, 0, -r * 0.05, r * 0.3, r * 0.13);
    g.fillStyle = '#ff7a4a'; g.beginPath(); g.ellipse(0, r * 0.3, r * 0.12, r * 0.16, 0, 0, 7); g.fill();
  },
  clock(g, r, c) {
    g.fillStyle = '#ffd23f'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.6, -r * 0.82, r * 0.3, 0, 7); g.fill(); }
    g.strokeStyle = '#7a3a4a'; g.lineWidth = r * 0.12; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.5, r * 0.8); g.lineTo(s * r * 0.75, r * 1.05); g.stroke(); }
    g.fillStyle = shade(g, 0, 0, r, c); g.beginPath(); g.arc(0, 0, r * 0.95, 0, 7); g.fill();
    g.fillStyle = '#fff8ee'; g.beginPath(); g.arc(0, 0, r * 0.72, 0, 7); g.fill();
    g.fillStyle = '#d0b0c0'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.04, 0, 7); g.fill(); }
    eyes(g, 0, -r * 0.1, r * 0.26, r * 0.11, 'angry');
    g.strokeStyle = '#3a2350'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(0, r * 0.35, r * 0.15, 3.5, 5.9); g.stroke();
  },
  sheep(g, r, c) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; g.beginPath(); g.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.5, r * 0.45, 0, 7); g.fill(); }
    g.fillStyle = '#5a4060'; g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.38, r * 0.32, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(r * 0.68, -r * 0.06, r * 0.07, 0, 7); g.fill();
  },
  sheepKing(g, r, c) {
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, r * 0.9, r, r * 0.2, 0, 0, 7); g.fill();
    g.fillStyle = '#f2e6ff';
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.62, r * 0.36, 0, 7); g.fill(); }
    g.fillStyle = shade(g, 0, 0, r * 0.8, '#fff8f0'); g.beginPath(); g.arc(0, 0, r * 0.78, 0, 7); g.fill();
    g.fillStyle = '#f5d0b0'; g.beginPath(); g.ellipse(0, r * 0.12, r * 0.48, r * 0.4, 0, 0, 7); g.fill();
    g.fillStyle = '#c99060'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.62, -r * 0.05, r * 0.24, r * 0.14, s * 0.5, 0, 7); g.fill(); }
    eyes(g, 0, r * 0.06, r * 0.2, r * 0.07, 'sleepy');
    blush(g, 0, r * 0.25, r * 0.3, r * 0.08);
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.moveTo(-r * 0.4, -r * 0.62); g.lineTo(-r * 0.45, -r * 1.05); g.lineTo(-r * 0.2, -r * 0.82); g.lineTo(0, -r * 1.12); g.lineTo(r * 0.2, -r * 0.82); g.lineTo(r * 0.45, -r * 1.05); g.lineTo(r * 0.4, -r * 0.62); g.closePath(); g.fill();
    g.fillStyle = '#ff6fa8'; g.beginPath(); g.arc(0, -r * 0.78, r * 0.07, 0, 7); g.fill();
    // 睡帽尖
    g.fillStyle = '#8f7cff'; g.beginPath(); g.moveTo(r * 0.5, -r * 0.5); g.quadraticCurveTo(r * 1.1, -r * 0.8, r * 1.0, -r * 0.1); g.lineTo(r * 0.75, -r * 0.35); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(r * 1.0, -r * 0.08, r * 0.1, 0, 7); g.fill();
  },
};

export class SpriteFactory {
  constructor(assets) {
    this.assets = assets;
    this.cache = new Map();
  }

  /** 怪物精灵：返回 {img, white, size}（size 为绘制边长，逻辑像素） */
  enemy(def, r, elite = false) {
    const key = `${def.sprite}|${Math.round(r)}|${elite ? 1 : 0}|${def.color}`;
    let s = this.cache.get(key);
    if (s) return s;
    const size = r * 2.9;
    let img;
    if (def.sprite === 'nox') img = this.noxSprite(r);
    else {
      const [c, g] = canvas(size, size);
      g.translate(size / 2, size / 2);
      (DRAW[def.sprite] || DRAW.slime)(g, r, def.color);
      img = c;
    }
    if (elite) img = outlineOf(img, '#ffd23f', 3);
    const extra = elite ? 6 : 0;
    s = { img, white: whiteOf(img), size: size + extra };
    this.cache.set(key, s);
    return s;
  }

  noxSprite(r) {
    const size = r * 2.9;
    const [c, g] = canvas(size, size);
    g.translate(size / 2, size / 2);
    // 背后的钟盘光环 + 蝙蝠翅膀
    g.strokeStyle = 'rgba(200,170,255,0.8)'; g.lineWidth = r * 0.06;
    g.beginPath(); g.arc(0, 0, r * 1.25, 0, 7); g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); g.lineTo(Math.cos(a) * r * 1.33, Math.sin(a) * r * 1.33); g.stroke(); }
    g.fillStyle = '#3a1a5c';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * r * 0.5, -r * 0.2);
      g.quadraticCurveTo(s * r * 1.4, -r * 1.3, s * r * 1.42, -r * 0.2);
      g.quadraticCurveTo(s * r * 1.2, -r * 0.2, s * r * 1.25, r * 0.3);
      g.quadraticCurveTo(s * r * 0.95, r * 0.05, s * r * 0.9, r * 0.5);
      g.quadraticCurveTo(s * r * 0.7, r * 0.2, s * r * 0.5, r * 0.4); g.fill();
    }
    const img = this.assets.get('boss_nox');
    if (img) {
      g.save(); g.beginPath(); g.arc(0, 0, r * 0.95, 0, 7); g.clip();
      g.drawImage(img, -r * 0.95, -r * 0.95, r * 1.9, r * 1.9); g.restore();
    } else { g.fillStyle = '#7a3cff'; g.beginPath(); g.arc(0, 0, r * 0.95, 0, 7); g.fill(); }
    g.strokeStyle = '#b48cff'; g.lineWidth = r * 0.08; g.beginPath(); g.arc(0, 0, r * 0.95, 0, 7); g.stroke();
    return c;
  }

  /** 玩家：圆形头像 + 彩色描边 */
  player(charDef, r) {
    const key = `player|${charDef.id}|${r}`;
    let s = this.cache.get(key);
    if (s) return s;
    const size = r * 3;
    const [c, g] = canvas(size, size);
    g.translate(size / 2, size / 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, r * 1.3, r * 1.0, r * 0.28, 0, 0, 7); g.fill();
    const img = this.assets.get(charDef.avatar);
    if (img) g.drawImage(img, -r * 1.35, -r * 1.35, r * 2.7, r * 2.7);
    else { g.fillStyle = charDef.color; g.beginPath(); g.arc(0, 0, r * 1.3, 0, 7); g.fill(); }
    s = { img: c, white: whiteOf(c), size };
    this.cache.set(key, s);
    return s;
  }

  gem(type, color, r) {
    const key = `gem|${type}|${r}`;
    let s = this.cache.get(key);
    if (s) return s;
    const size = r * 3.2;
    const [c, g] = canvas(size, size);
    g.translate(size / 2, size / 2);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
    const col = type === 'rainbow' ? '#ffffff' : color;
    glow.addColorStop(0, col); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 0.45; g.fillStyle = glow; g.beginPath(); g.arc(0, 0, r * 1.6, 0, 7); g.fill(); g.globalAlpha = 1;
    if (type === 'rainbow') {
      const gr = g.createLinearGradient(-r, -r, r, r);
      ['#ff6fa8', '#ffd23f', '#5ccf8a', '#6fd6ff', '#b48cff'].forEach((cc, i) => gr.addColorStop(i / 4, cc));
      g.fillStyle = gr;
    } else g.fillStyle = color;
    g.beginPath(); g.moveTo(0, -r * 1.15); g.lineTo(r * 0.8, -r * 0.2); g.lineTo(0, r * 1.15); g.lineTo(-r * 0.8, -r * 0.2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(0, -r * 1.15); g.lineTo(r * 0.3, -r * 0.2); g.lineTo(-r * 0.3, -r * 0.2); g.closePath(); g.fill();
    s = { img: c, size };
    this.cache.set(key, s);
    return s;
  }

  /** 子弹 / 召唤物 / 道具 */
  shot(kind, color, r) {
    const key = `shot|${kind}|${color}|${Math.round(r)}`;
    let s = this.cache.get(key);
    if (s) return s;
    const size = r * 3.4;
    const [c, g] = canvas(size, size);
    g.translate(size / 2, size / 2);
    const glow = (col, rr, a = 0.5) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill(); g.globalAlpha = 1; };
    switch (kind) {
      case 'star':
        glow(color, r * 1.7); g.fillStyle = color; drawStar(g, 0, 0, r, r * 0.45); g.fillStyle = '#fff'; drawStar(g, 0, 0, r * 0.5, r * 0.22); break;
      case 'shard':
        glow(color, r * 1.5, 0.4); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(r * 1.3, 0); g.lineTo(0, r * 0.45); g.lineTo(-r * 0.9, 0); g.lineTo(0, -r * 0.45); g.closePath(); g.fill();
        g.strokeStyle = color; g.lineWidth = 1.5; g.stroke(); break;
      case 'rang':
        glow(color, r * 1.5, 0.35); g.fillStyle = color; g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, r * 0.85); g.bezierCurveTo(-r * 1.3, 0, -r * 0.7, -r * 1.1, 0, -r * 0.4); g.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.3, 0, 0, r * 0.85); g.fill(); g.stroke(); break;
      case 'crane':
        g.fillStyle = '#ffffff'; g.strokeStyle = color === '#ffffff' ? '#b48cff' : color; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(r * 1.2, 0); g.lineTo(-r * 0.2, -r * 0.3); g.lineTo(-r * 1.0, -r * 1.0); g.lineTo(-r * 0.5, 0); g.lineTo(-r * 1.0, r * 1.0); g.lineTo(-r * 0.2, r * 0.3); g.closePath(); g.fill(); g.stroke(); break;
      case 'talisman':
        g.fillStyle = '#fff3d6'; g.strokeStyle = color; g.lineWidth = 2;
        g.fillRect(-r * 0.55, -r, r * 1.1, r * 2); g.strokeRect(-r * 0.55, -r, r * 1.1, r * 2);
        g.fillStyle = color; g.fillRect(-r * 0.2, -r * 0.7, r * 0.4, r * 1.4); break;
      case 'bullet':
        glow(color, r * 1.8, 0.6); g.fillStyle = color; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r * 0.45, 0, 7); g.fill(); break;
      case 'candy':
        g.fillStyle = '#ff8fc7'; g.beginPath(); g.arc(0, 0, r * 0.8, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 0.45, 0, 4.5); g.stroke();
        g.fillStyle = '#ff8fc7'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * r * 0.7, 0); g.lineTo(sx * r * 1.3, -r * 0.5); g.lineTo(sx * r * 1.3, r * 0.5); g.fill(); } break;
      case 'magnet':
        g.strokeStyle = '#ff4d6d'; g.lineWidth = r * 0.5; g.beginPath(); g.arc(0, -r * 0.1, r * 0.65, Math.PI, 0); g.stroke();
        g.fillStyle = '#ff4d6d'; g.fillRect(-r * 0.9, -r * 0.1, r * 0.5, r * 0.8); g.fillRect(r * 0.4, -r * 0.1, r * 0.5, r * 0.8);
        g.fillStyle = '#fff'; g.fillRect(-r * 0.9, r * 0.45, r * 0.5, r * 0.3); g.fillRect(r * 0.4, r * 0.45, r * 0.5, r * 0.3); break;
      case 'chest':
        glow('#ffd23f', r * 1.6, 0.5);
        g.fillStyle = '#c0703a'; g.fillRect(-r, -r * 0.3, r * 2, r * 1.2);
        g.fillStyle = '#e09040'; g.beginPath(); g.moveTo(-r, -r * 0.3); g.quadraticCurveTo(0, -r * 1.2, r, -r * 0.3); g.closePath(); g.fill();
        g.fillStyle = '#ffd23f'; g.fillRect(-r, -r * 0.35, r * 2, r * 0.18); g.fillRect(-r * 0.15, -r * 0.4, r * 0.3, r * 0.6);
        g.strokeStyle = '#7a3a2a'; g.lineWidth = 1.5; g.strokeRect(-r, -r * 0.3, r * 2, r * 1.2); break;
      default:
        glow(color, r * 1.5); g.fillStyle = color; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    }
    s = { img: c, size };
    this.cache.set(key, s);
    return s;
  }
}
