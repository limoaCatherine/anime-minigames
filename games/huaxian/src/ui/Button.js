// 画布按钮：支持悬停/按下动画、主/次/绿色三种样式与图标按钮 (可带角标，如「广告」)。
import { GameConfig } from '../config/GameConfig.js';
import { roundRectPath, drawText } from './draw.js';

export class Button {
  /**
   * @param {object} o
   * @param {number} o.x 中心 x
   * @param {number} o.y 中心 y
   * @param {number} o.w
   * @param {number} o.h
   * @param {string} [o.label]
   * @param {'primary'|'secondary'|'icon'|'tab'} [o.style]
   * @param {(ctx:CanvasRenderingContext2D, size:number)=>void} [o.icon]
   * @param {()=>void} o.onClick
   */
  constructor(o) {
    Object.assign(this, { style: 'primary', label: '', fontSize: 28, visible: true, enabled: true }, o);
    this.hover = false;
    this.pressed = false;
    this.scale = 1;
    this.audio = null; // 由场景注入，用于点击音效
  }

  contains(p) {
    return p.x >= this.x - this.w / 2 && p.x <= this.x + this.w / 2 && p.y >= this.y - this.h / 2 && p.y <= this.y + this.h / 2;
  }

  handleDown(p) {
    if (!this.visible || !this.enabled) return false;
    if (this.contains(p)) { this.pressed = true; return true; }
    return false;
  }

  handleMove(p) {
    if (!this.visible) return;
    this.hover = p.type !== 'touch' && this.contains(p);
  }

  handleUp(p) {
    if (!this.pressed) return false;
    this.pressed = false;
    if (this.contains(p)) {
      if (this.audio) this.audio.play('click');
      this.onClick && this.onClick();
      return true;
    }
    return false;
  }

  render(ctx, dt = 1 / 60) {
    if (!this.visible) return;
    const target = this.pressed ? 0.92 : this.hover ? 1.05 : 1;
    this.scale += (target - this.scale) * Math.min(1, dt * 18);
    const { w, h } = this;
    const C = GameConfig.colors;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);

    if (this.style === 'icon') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      roundRectPath(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.32);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,143,199,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (!this.enabled) ctx.globalAlpha = 0.4;
      if (this.icon) this.icon(ctx, Math.min(w, h));
      if (this.label) drawText(ctx, this.label, 0, h * 0.26, { size: this.fontSize, color: C.primaryDark });
      ctx.globalAlpha = 1;
      if (this.tag) drawTag(ctx, this.tag, w / 2 - 2, -h / 2 + 2);
      if (this.badge != null) {
        ctx.fillStyle = this.enabled ? C.primary : '#b9a3c9';
        ctx.beginPath(); ctx.arc(w / 2 - 4, -h / 2 + 4, 11, 0, Math.PI * 2); ctx.fill();
        drawText(ctx, String(this.badge), w / 2 - 4, -h / 2 + 5, { size: 14, color: '#fff' });
      }
      ctx.restore();
      return;
    }

    if (this.style === 'tab') {
      // 选项卡：选中时为主题色实心，否则为白底描边
      const color = this.color || C.primary;
      roundRectPath(ctx, -w / 2, -h / 2 + (this.selected ? 4 : 3), w, h, h / 2);
      ctx.fillStyle = this.selected ? shade(color) : 'rgba(180,150,200,0.35)';
      ctx.fill();
      roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.fillStyle = this.selected ? color : 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.selected ? '#ffffff' : color;
      ctx.stroke();
      drawText(ctx, this.label, 0, 1, { size: this.fontSize, color: this.selected ? '#fff' : color, stroke: this.selected ? shade(color) : null, strokeWidth: 4 });
      ctx.restore();
      return;
    }

    const top = this.style === 'primary' ? C.primary : this.style === 'green' ? C.green : C.secondary;
    const bottom = this.style === 'primary' ? C.primaryDark : this.style === 'green' ? C.greenDark : C.secondaryDark;
    // 底部厚度
    roundRectPath(ctx, -w / 2, -h / 2 + 5, w, h, h / 2);
    ctx.fillStyle = bottom;
    ctx.fill();
    // 主体
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, lighten(top));
    g.addColorStop(1, top);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = g;
    ctx.fill();
    // 高光
    roundRectPath(ctx, -w / 2 + 10, -h / 2 + 5, w - 20, h * 0.35, h * 0.2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
    drawText(ctx, this.label, 0, 1, { size: this.fontSize, color: '#fff', stroke: bottom, strokeWidth: 5 });
    if (this.tag) drawTag(ctx, this.tag, w / 2 - 8, -h / 2 + 2);
    ctx.restore();
  }
}

/** 小角标 (例如「广告」「免费」) */
function drawTag(ctx, text, x, y) {
  ctx.save();
  ctx.font = `bold 11px ${GameConfig.fontFamily}`;
  const w = ctx.measureText(text).width + 10;
  roundRectPath(ctx, x - w / 2, y - 9, w, 18, 9);
  ctx.fillStyle = text === '免费' ? '#5ccf8a' : '#ffb000';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.78));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 40);
  const g = Math.min(255, ((n >> 8) & 255) + 40);
  const b = Math.min(255, (n & 255) + 40);
  return `rgb(${r},${g},${b})`;
}

// ---- 常用图标 ----
export const Icons = {
  pause(ctx, s) {
    ctx.fillStyle = GameConfig.colors.primaryDark;
    const bw = s * 0.13; const bh = s * 0.42;
    roundRectPath(ctx, -bw * 1.6, -bh / 2, bw, bh, 2); ctx.fill();
    roundRectPath(ctx, bw * 0.6, -bh / 2, bw, bh, 2); ctx.fill();
  },
  sound(muted) {
    return (ctx, s) => {
      const k = s / 44;
      ctx.fillStyle = GameConfig.colors.primaryDark;
      ctx.strokeStyle = GameConfig.colors.primaryDark;
      ctx.lineWidth = 2.5 * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-11 * k, -5 * k); ctx.lineTo(-5 * k, -5 * k); ctx.lineTo(2 * k, -11 * k);
      ctx.lineTo(2 * k, 11 * k); ctx.lineTo(-5 * k, 5 * k); ctx.lineTo(-11 * k, 5 * k);
      ctx.closePath(); ctx.fill();
      if (muted) {
        ctx.beginPath();
        ctx.moveTo(6 * k, -5 * k); ctx.lineTo(14 * k, 5 * k);
        ctx.moveTo(14 * k, -5 * k); ctx.lineTo(6 * k, 5 * k);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(3 * k, 0, 7 * k, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(3 * k, 0, 12 * k, -0.9, 0.9); ctx.stroke();
      }
    };
  },
  retry(ctx, s) {
    const k = s / 44;
    ctx.strokeStyle = GameConfig.colors.primaryDark;
    ctx.fillStyle = GameConfig.colors.primaryDark;
    ctx.lineWidth = 3.2 * k;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 1 * k, 9 * k, -Math.PI * 0.35, Math.PI * 1.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4 * k, -12 * k); ctx.lineTo(11 * k, -8 * k); ctx.lineTo(3 * k, -3 * k); ctx.closePath(); ctx.fill();
  },
  hint(ctx, s) {
    const k = s / 44;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = GameConfig.colors.primaryDark;
    ctx.lineWidth = 2.2 * k;
    ctx.beginPath(); ctx.arc(0, -4 * k, 9 * k, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(4 * k, 7 * k); ctx.lineTo(-4 * k, 7 * k); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = GameConfig.colors.primaryDark;
    ctx.fillRect(-4 * k, 9 * k, 8 * k, 3 * k);
  },
  grid(ctx, s) {
    const k = s / 44;
    ctx.fillStyle = GameConfig.colors.primaryDark;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      roundRectPath(ctx, (-11 + i * 12) * k, (-11 + j * 12) * k, 9 * k, 9 * k, 2.5 * k); ctx.fill();
    }
  },
  voice(on) {
    return (ctx, s) => {
      const k = s / 44;
      ctx.fillStyle = GameConfig.colors.primaryDark;
      ctx.strokeStyle = GameConfig.colors.primaryDark;
      ctx.lineWidth = 2.6 * k;
      ctx.lineCap = 'round';
      roundRectPath(ctx, -4 * k, -12 * k, 8 * k, 14 * k, 4 * k); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -2 * k, 8 * k, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 6 * k); ctx.lineTo(0, 11 * k); ctx.stroke();
      if (!on) { ctx.strokeStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(-11 * k, -11 * k); ctx.lineTo(11 * k, 11 * k); ctx.stroke(); }
    };
  },
  mixer(ctx, s) {
    const k = s / 44;
    ctx.strokeStyle = GameConfig.colors.primaryDark;
    ctx.fillStyle = GameConfig.colors.primaryDark;
    ctx.lineWidth = 2.4 * k;
    ctx.lineCap = 'round';
    [[-9, 4], [0, -5], [9, 2]].forEach(([dx, ky]) => {
      ctx.beginPath(); ctx.moveTo(dx * k, -11 * k); ctx.lineTo(dx * k, 11 * k); ctx.stroke();
      ctx.beginPath(); ctx.arc(dx * k, ky * k, 3.8 * k, 0, Math.PI * 2); ctx.fill();
    });
  },
  music(on) {
    return (ctx, s) => {
      const k = s / 44;
      ctx.fillStyle = GameConfig.colors.primaryDark;
      ctx.strokeStyle = GameConfig.colors.primaryDark;
      ctx.lineWidth = 2.6 * k;
      ctx.lineCap = 'round';
      // 双八分音符
      ctx.beginPath(); ctx.ellipse(-6 * k, 7 * k, 4.2 * k, 3.2 * k, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7 * k, 4 * k, 4.2 * k, 3.2 * k, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2.5 * k, 6 * k); ctx.lineTo(-2.5 * k, -10 * k); ctx.lineTo(10.5 * k, -13 * k); ctx.lineTo(10.5 * k, 3 * k); ctx.stroke();
      if (!on) { ctx.strokeStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(-11 * k, -11 * k); ctx.lineTo(11 * k, 11 * k); ctx.stroke(); }
    };
  },
  home(ctx, s) {
    const k = s / 44;
    ctx.fillStyle = GameConfig.colors.primaryDark;
    ctx.beginPath();
    ctx.moveTo(0, -12 * k); ctx.lineTo(12 * k, -1 * k); ctx.lineTo(8 * k, -1 * k); ctx.lineTo(8 * k, 11 * k);
    ctx.lineTo(-8 * k, 11 * k); ctx.lineTo(-8 * k, -1 * k); ctx.lineTo(-12 * k, -1 * k);
    ctx.closePath(); ctx.fill();
  },
};
