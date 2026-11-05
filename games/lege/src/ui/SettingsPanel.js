// 设置面板：总音量 / 背景音乐 / 音效 / 语音 四组 "开关 + 音量滑条" (声道最高 200%)。所有改动即时生效并写入存档 (MixerSystem)。
// 场景打开面板后，把 activeButtons() 指向 panel.widgets 即可 (控件实现与 Button 相同的 handleDown/Move/Up 接口)。
import { GameConfig } from '../config/GameConfig.js';
import { Button, Icons } from './Button.js';
import { drawPanel, drawText, roundRectPath } from './draw.js';
import { CreditsPanel } from './CreditsPanel.js';

class Toggle {
  constructor({ x, y, get, set, audio }) {
    Object.assign(this, { x, y, get, set, audio, w: 74, h: 38 });
    this.k = get() ? 1 : 0;
    this.pressed = false;
  }
  contains(p) { return Math.abs(p.x - this.x) <= this.w / 2 + 6 && Math.abs(p.y - this.y) <= this.h / 2 + 6; }
  handleDown(p) { if (this.contains(p)) { this.pressed = true; return true; } return false; }
  handleMove() {}
  handleUp(p) {
    if (!this.pressed) return false;
    this.pressed = false;
    if (!this.contains(p)) return false;
    const on = !this.get();
    this.set(on);
    if (this.audio) this.audio.play('toggle', { on });
    return true;
  }
  render(ctx, dt) {
    const on = this.get();
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * 14);
    const { x, y, w, h } = this;
    roundRectPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = on ? '#ff7fb6' : '#d9cfe3';
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    const kx = x - w / 2 + h / 2 + this.k * (w - h);
    ctx.save();
    ctx.shadowColor = 'rgba(120,60,140,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(kx, y, h / 2 - 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    drawText(ctx, on ? '开' : '关', x + (on ? -14 : 14), y + 1, { size: 14, color: on ? '#fff' : '#8f7fa3' });
  }
}

class Slider {
  constructor({ x, y, w, get, set, enabled, audio, max = 1 }) {
    Object.assign(this, { x, y, w, h: 30, get, set, enabled, audio, max });
    this.dragging = false;
  }
  contains(p) { return p.x >= this.x - 14 && p.x <= this.x + this.w + 14 && Math.abs(p.y - this.y) <= 20; }
  apply(p) {
    const v = Math.max(0, Math.min(1, (p.x - this.x) / this.w));
    this.set(Math.round(v * this.max * 20) / 20);
  }
  handleDown(p) {
    if (!this.contains(p)) return false;
    this.dragging = true;
    this.apply(p);
    return true;
  }
  handleMove(p) { if (this.dragging) this.apply(p); }
  handleUp() {
    if (!this.dragging) return false;
    this.dragging = false;
    if (this.audio) this.audio.play('tick');
    return true;
  }
  render(ctx) {
    const raw = this.get();
    const v = raw / this.max;
    const on = this.enabled();
    const { x, y, w } = this;
    ctx.save();
    if (!on) ctx.globalAlpha = 0.45;
    roundRectPath(ctx, x, y - 6, w, 12, 6);
    ctx.fillStyle = '#eadff2';
    ctx.fill();
    if (v > 0) {
      roundRectPath(ctx, x, y - 6, Math.max(12, w * v), 12, 6);
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#ffb3d9'); g.addColorStop(1, '#ff5fa2');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.shadowColor = 'rgba(120,60,140,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + w * v, y, this.dragging ? 15 : 13, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3; ctx.strokeStyle = '#ff7fb6'; ctx.stroke();
    ctx.restore();
    if (this.max > 1) {   // 100% 刻度
      ctx.fillStyle = '#c9b6d8';
      ctx.fillRect(x + w / this.max - 1, y + 9, 2, 6);
    }
    drawText(ctx, `${Math.round(raw * 100)}%`, x + w + 36, y + 1, { size: 15, color: GameConfig.colors.text });
  }
}

export class SettingsPanel {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game, onClose) {
    this.game = game;
    this.onClose = onClose;
    this.t = 0;
    const a = game.audio;
    const m = game.mixer;
    const W = GameConfig.width;
    this.w = 460; this.h = 600;
    this.x = (W - this.w) / 2; this.y = 150;
    const row = (ch, label, icon, desc) => ({
      label, icon, desc, max: ch === 'master' ? 1 : 2,
      get: () => m.isOn(ch), set: (on) => m.setOn(ch, on), vol: () => m.get(ch), setVol: (x) => m.set(ch, x),
    });
    const rows = [
      row('master', '总音量', null, () => '关掉就全部静音，右上角喇叭也能切'),
      row('bgm', '背景音乐', '♫', () => (game.music && game.music.trackName) || 'BGM'),
      row('sfx', '音效', '♪', () => '拿牌、消除、道具、心跳'),
      row('voice', '角色语音', '♡', () => '日语台词，字幕照常显示'),
    ];
    this.rows = rows.map((r, i) => {
      const y = this.y + 96 + i * 112;
      return {
        ...r, y,
        toggle: new Toggle({ x: this.x + this.w - 64, y, get: r.get, set: r.set, audio: a }),
        slider: new Slider({ x: this.x + 44, y: y + 48, w: this.w - 150, get: r.vol, set: r.setVol, enabled: r.get, audio: a, max: r.max }),
      };
    });
    this.rows.forEach((r) => { r.toggle.label = `开关:${r.label}`; r.slider.label = `音量:${r.label}`; });
    this.creditsBtn = new Button({ x: W / 2, y: this.y + this.h - 46, w: 200, h: 46, label: '制作人员', fontSize: 19, style: 'mint',
      onClick: () => { this.credits = new CreditsPanel(game, () => { this.credits = null; }); } });
    this.credits = null;
    this.creditsBtn.audio = a;
    this.closeBtn = new Button({ x: W / 2, y: this.y + this.h + 50, w: 240, h: 62, label: '完成', fontSize: 26, onClick: () => this.onClose && this.onClose() });
    this.closeBtn.audio = a;
    this.mainWidgets = [...this.rows.flatMap((r) => [r.toggle, r.slider]), this.creditsBtn, this.closeBtn];
  }

  get widgets() { return this.credits ? this.credits.buttons : this.mainWidgets; }

  update(dt) { this.t += dt; if (this.credits) this.credits.update(dt); }

  render(ctx, dt) {
    const k = Math.min(1, this.t / 0.22);
    const e = 1 - Math.pow(1 - k, 3);
    const W = GameConfig.width;
    const C = GameConfig.colors;
    ctx.save();
    ctx.fillStyle = `rgba(70,30,80,${0.5 * e})`;
    ctx.fillRect(0, 0, W, GameConfig.height);
    ctx.globalAlpha = e;
    ctx.translate(0, (1 - e) * 30);
    drawPanel(ctx, this.x, this.y, this.w, this.h, 30, '#fff9fc');
    // 标题缎带
    roundRectPath(ctx, W / 2 - 110, this.y - 26, 220, 54, 27);
    ctx.fillStyle = C.primary; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
    drawText(ctx, '设置', W / 2, this.y + 2, { size: 28, color: '#fff', stroke: C.primaryDark, strokeWidth: 5 });
    for (const r of this.rows) {
      ctx.fillStyle = '#ffe3f0';
      ctx.beginPath(); ctx.arc(this.x + 50, r.y, 22, 0, Math.PI * 2); ctx.fill();
      if (r.icon) drawText(ctx, r.icon, this.x + 50, r.y + 1, { size: 24, color: C.primaryDark });
      else { ctx.save(); ctx.translate(this.x + 50, r.y); Icons.sound(!r.get())(ctx, 36); ctx.restore(); }
      drawText(ctx, r.label, this.x + 84, r.y - 9, { size: 22, color: C.text, align: 'left' });
      drawText(ctx, r.desc(), this.x + 84, r.y + 15, { size: 13, color: '#a08bb4', align: 'left', weight: 'normal' });
      r.toggle.render(ctx, dt);
      r.slider.render(ctx);
      ctx.strokeStyle = 'rgba(220,190,230,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(this.x + 30, r.y + 76); ctx.lineTo(this.x + this.w - 30, r.y + 76); ctx.stroke();
    }
    this.creditsBtn.render(ctx, dt);
    this.closeBtn.render(ctx, dt);
    ctx.restore();
    if (this.credits) this.credits.render(ctx, dt);
  }
}
