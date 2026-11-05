// 选关地图：15 个关卡节点沿蛇形小路排布 (第 1 关在最下方)，按难度档位着色；
// BOSS 关 (地狱) 更大、带小恶魔角；未解锁显示小锁；已通关显示星级；当前关卡有脉动光圈和跳跳的看板娘。
// 点击节点弹出关卡信息 (图案预览 / 张数 / 层数 / 花色 / 最高星级) → 开始挑战。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { LEVELS, MAX_LEVEL, TIERS, tierOf, levelTag } from '../config/LevelConfig.js';
import { getShape, OFFSET_MODES } from '../config/PatternLibrary.js';
import { buildPositions } from '../systems/LayoutGenerator.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { Button, Icons } from '../ui/Button.js';
import { drawImageBackground, drawText, drawPanel, drawStar, drawLock, roundRectPath, drawGlow } from '../ui/draw.js';

const COL_X = [118, 270, 422];

export function nodePos(id) {
  const i = id - 1;
  const r = Math.floor(i / 3);
  const c = r % 2 === 0 ? i % 3 : 2 - (i % 3);
  return { x: COL_X[c], y: 812 - r * 148 };
}

function lighten(hex, amt = 50) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.min(255, v + amt);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function darken(hex, k = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export class LevelSelectScene extends Scene {
  constructor(game) {
    super(game, 'levels');
  }

  enter() {
    const g = this.game;
    const save = g.save;
    this.unlocked = Math.min(MAX_LEVEL, save.get('unlocked', 1));
    this.nodes = LEVELS.map((l) => ({ level: l, ...nodePos(l.id), r: l.boss ? 46 : 40, hover: 0, pop: 0 }));
    this.info = null;
    this.toasts = [];
    this.pressedNode = null;
    this.hoverNode = null;
    this.effects = new EffectSystem(g.events);
    this.backBtn = new Button({ x: 42, y: 46, w: 52, h: 52, style: 'icon', icon: Icons.back, onClick: () => g.scenes.change('menu') });
    this.buttons = [this.backBtn];
    this.buttons.forEach((b) => { b.audio = g.audio; });
    // 新解锁动画
    const seen = save.get('seenUnlocked', 1);
    this.unlockAnim = this.unlocked > seen ? { id: this.unlocked, t: 0, fired: false } : null;
    if (this.unlockAnim) save.set('seenUnlocked', this.unlocked);
    this.dt = 1 / 60;
  }

  exit() { this.effects.destroy(); }

  isUnlocked(id) {
    if (this.unlockAnim && this.unlockAnim.id === id && !this.unlockAnim.fired) return false;
    return id <= this.unlocked;
  }

  nodeAt(p) {
    return this.nodes.find((n) => Math.hypot(p.x - n.x, p.y - n.y) <= n.r + 8) || null;
  }

  openInfo(level) {
    const g = this.game;
    const W = GameConfig.width;
    const pos = buildPositions(level);
    this.info = {
      level, pos, t: 0,
      startBtn: new Button({ x: W / 2, y: 760, w: 300, h: 66, label: '开打', fontSize: 28, style: level.boss ? 'danger' : 'primary', onClick: () => g.scenes.change('game', { level: level.id }) }),
      closeBtn: new Button({ x: W / 2, y: 840, w: 200, h: 52, label: '返回', style: 'ghost', fontSize: 22, onClick: () => { this.info = null; } }),
    };
    this.info.startBtn.audio = g.audio;
    this.info.closeBtn.audio = g.audio;
  }

  toast(text) { this.toasts = [{ text, life: 0 }]; }

  activeButtons() {
    if (this.info) return [this.info.startBtn, this.info.closeBtn];
    return this.buttons;
  }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    if (this.info) return false;
    this.pressedNode = this.nodeAt(p);
    return !!this.pressedNode;
  }

  onPointerMove(p) {
    super.onPointerMove(p);
    if (this.info || p.type === 'touch') return false;
    const n = this.nodeAt(p);
    if (n && n !== this.hoverNode && this.isUnlocked(n.level.id)) this.game.audio.play('hover');
    this.hoverNode = n;
    return false;
  }

  onPointerUp(p) {
    if (super.onPointerUp(p)) return true;
    const n = this.pressedNode;
    this.pressedNode = null;
    if (!n || this.info || this.nodeAt(p) !== n) return false;
    if (!this.isUnlocked(n.level.id)) {
      this.game.audio.play('deny');
      this.toast(`先过第 ${n.level.id - 1} 关`);
      return true;
    }
    this.game.audio.play('click');
    this.openInfo(n.level);
    return true;
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
      if (this.info) this.info = null;
      else this.game.scenes.change('menu');
    }
  }

  update(dt) {
    super.update(dt);
    this.dt = dt;
    this.effects.update(dt);
    for (const n of this.nodes) {
      const target = (n === this.hoverNode && !this.info) || n === this.pressedNode ? 1 : 0;
      n.hover += (target - n.hover) * Math.min(1, dt * 14);
    }
    if (this.info) this.info.t += dt;
    const ua = this.unlockAnim;
    if (ua) {
      ua.t += dt;
      if (!ua.fired && ua.t > 0.9) {
        ua.fired = true;
        const n = this.nodes[ua.id - 1];
        n.pop = 1;
        this.effects.burst(n.x, n.y, '#ffe14d', 20, 260, true);
        this.effects.burst(n.x, n.y, tierOf(n.level).color, 16, 200, true);
        this.effects.rings.push({ x: n.x, y: n.y, r0: n.r, r1: n.r + 60, life: 0, max: 0.5, color: '#fff', width: 6 });
        this.game.events.emit('level:unlock', { level: ua.id });
      }
    }
    for (const n of this.nodes) if (n.pop > 0) n.pop = Math.max(0, n.pop - dt * 1.6);
    for (const t of this.toasts) t.life += dt;
    this.toasts = this.toasts.filter((t) => t.life < 1.8);
  }

  render(ctx) {
    const g = this.game;
    const { width: W, height: H } = g;
    const C = GameConfig.colors;
    const save = g.save;
    const t = this.time;
    drawImageBackground(ctx, g.assets.getImage('bg'), W, H, t, 20);
    ctx.fillStyle = 'rgba(255,245,252,0.35)';
    ctx.fillRect(0, 0, W, H);

    // 顶部标题
    drawPanel(ctx, 80, 18, W - 160, 58, 29, 'rgba(255,255,255,0.9)');
    drawText(ctx, '选择关卡', W / 2, 47, { size: 30, color: C.primaryDark, stroke: '#fff', strokeWidth: 6 });
    const stars = save.totalStars;
    roundRectPath(ctx, W / 2 - 74, 86, 148, 34, 17);
    ctx.fillStyle = 'rgba(90,40,100,0.6)'; ctx.fill();
    ctx.fillStyle = C.gold; drawStar(ctx, W / 2 - 46, 103, 12, 5);
    drawText(ctx, `${stars} / ${LEVELS.length * 3}`, W / 2 + 10, 104, { size: 19, color: '#fff' });

    // 小路
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const a = this.nodes[i]; const b = this.nodes[i + 1];
      const done = save.isCleared(a.level.id);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 16]);
      ctx.lineDashOffset = done ? -t * 20 : 0;
      ctx.lineWidth = 10;
      ctx.strokeStyle = done ? 'rgba(255,111,168,0.95)' : 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      if (Math.abs(a.y - b.y) < 1) ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + (i % 2 ? -22 : 22), b.x, b.y);
      else ctx.bezierCurveTo(a.x + (a.x > W / 2 ? 90 : -90), a.y, b.x + (b.x > W / 2 ? 90 : -90), b.y, b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    // 节点
    const current = this.unlocked;
    for (const n of this.nodes) this.renderNode(ctx, n, current, t);

    // 图例
    const legend = ['easy', 'normal', 'hard', 'nightmare', 'hell'];
    drawPanel(ctx, 30, H - 52, W - 60, 38, 19, 'rgba(255,255,255,0.86)');
    legend.forEach((k, i) => {
      const x = 62 + i * 98;
      ctx.fillStyle = TIERS[k].color;
      ctx.beginPath(); ctx.arc(x, H - 33, 8, 0, Math.PI * 2); ctx.fill();
      drawText(ctx, TIERS[k].name, x + 14, H - 32, { size: 15, color: C.text, align: 'left' });
    });

    this.effects.render(ctx);
    for (const b of this.buttons) b.render(ctx, this.info ? 0 : this.dt);
    this.effects.renderOverlay(ctx, W, H);

    for (const tt of this.toasts) {
      ctx.save();
      ctx.globalAlpha = tt.life > 1.4 ? (1.8 - tt.life) / 0.4 : 1;
      drawPanel(ctx, W / 2 - 170, 470, 340, 46, 23, 'rgba(90,40,100,0.9)');
      drawText(ctx, tt.text, W / 2, 493, { size: 18, color: '#fff' });
      ctx.restore();
    }
    if (this.info) this.renderInfo(ctx);
  }

  renderNode(ctx, n, current, t) {
    const l = n.level;
    const C = GameConfig.colors;
    const save = this.game.save;
    const unlocked = this.isUnlocked(l.id);
    const tier = tierOf(l);
    const isCur = l.id === current && unlocked;
    const s = 1 + n.hover * 0.08 + n.pop * 0.3 + (isCur ? Math.sin(t * 4) * 0.03 : 0);
    const r = n.r;
    ctx.save();
    ctx.translate(n.x, n.y);
    if (isCur) {
      drawGlow(ctx, 0, 0, r + 40, 'rgba(255,240,150,0.85)');
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 4)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, r + 12 + Math.sin(t * 4) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.scale(s, s);
    // 小恶魔角 (BOSS)
    if (l.boss) {
      ctx.fillStyle = unlocked ? '#b5172f' : '#9c8fae';
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sg * r * 0.42, -r * 0.82);
        ctx.quadraticCurveTo(sg * r * 0.9, -r * 1.15, sg * r * 0.92, -r * 1.3);
        ctx.quadraticCurveTo(sg * r * 0.55, -r * 1.0, sg * r * 0.12, -r * 0.95);
        ctx.closePath();
        ctx.fill();
      }
    }
    // 底座阴影 + 厚度
    ctx.fillStyle = 'rgba(90,40,100,0.25)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 0.9, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    const base = unlocked ? tier.color : '#b9aec6';
    ctx.fillStyle = darken(base);
    ctx.beginPath(); ctx.arc(0, 5, r, 0, Math.PI * 2); ctx.fill();
    const gr = ctx.createLinearGradient(0, -r, 0, r);
    gr.addColorStop(0, lighten(base, 70));
    gr.addColorStop(1, base);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.45, r * 0.45, r * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    if (unlocked) {
      drawText(ctx, String(l.id), 0, l.boss ? -4 : 2, { size: l.boss ? 38 : 34, color: '#fff', stroke: darken(base, 0.6), strokeWidth: 6 });
      if (l.boss) drawText(ctx, 'BOSS', 0, r * 0.55, { size: 13, color: '#fff', stroke: darken(base, 0.6), strokeWidth: 3 });
    } else {
      const ua = this.unlockAnim;
      const shake = ua && ua.id === l.id && !ua.fired ? Math.sin(ua.t * 50) * 4 * Math.min(1, ua.t * 2) : 0;
      drawLock(ctx, shake, -4, l.boss ? 34 : 28, '#ffffff');
      drawText(ctx, String(l.id), 0, r * 0.62, { size: 13, color: '#fff' });
    }
    ctx.restore();
    // 星星
    const got = save.starsOf(l.id);
    for (let i = 0; i < 3; i++) {
      const sx = n.x + (i - 1) * 22;
      const sy = n.y + r + 14 + (i === 1 ? 4 : 0);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      drawStar(ctx, sx, sy, 11, 5);
      ctx.fillStyle = i < got ? C.gold : 'rgba(200,185,215,0.9)';
      drawStar(ctx, sx, sy, 8.5, 3.8);
    }
    drawText(ctx, l.title, n.x, n.y + r + 38, { size: 15, color: '#fff', stroke: unlocked ? darken(tier.color, 0.65) : '#8f7fa3', strokeWidth: 4 });
    // 当前关卡：看板娘在节点上方跳
    if (isCur) {
      const sp = this.game.cardSprites[(l.id * 5) % this.game.cardSprites.length];
      if (sp) {
        const hop = Math.abs(Math.sin(t * 3.2)) * 14;
        ctx.save();
        ctx.translate(n.x + r * 0.9, n.y - r * 0.9 - hop);
        ctx.rotate(0.15);
        ctx.shadowColor = 'rgba(90,40,100,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
        ctx.drawImage(sp.normal, -22, -24, 44, 48.4);
        ctx.restore();
      }
    }
  }

  renderInfo(ctx) {
    const info = this.info;
    const l = info.level;
    const W = GameConfig.width;
    const C = GameConfig.colors;
    const tier = tierOf(l);
    const k = Math.min(1, info.t / 0.22);
    const e = 1 - Math.pow(1 - k, 3);
    ctx.save();
    ctx.fillStyle = `rgba(70,30,80,${0.5 * e})`;
    ctx.fillRect(0, 0, W, GameConfig.height);
    ctx.globalAlpha = e;
    ctx.translate(0, (1 - e) * 40);
    const px = 40; const py = 150; const pw = W - 80; const ph = 730;
    drawPanel(ctx, px, py, pw, ph, 30, '#fff9fc');
    // 标题缎带
    roundRectPath(ctx, W / 2 - 150, py - 24, 300, 56, 28);
    ctx.fillStyle = tier.color; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
    drawText(ctx, `第 ${l.id} 关 · ${l.title}`, W / 2, py + 4, { size: 26, color: '#fff', stroke: darken(tier.color, 0.6), strokeWidth: 5 });
    // 档位标签
    const tag = levelTag(l);
    ctx.font = `bold 16px ${GameConfig.fontFamily}`;
    const tw = ctx.measureText(tag).width + 26;
    roundRectPath(ctx, W / 2 - tw / 2, py + 44, tw, 28, 14);
    ctx.fillStyle = tier.color; ctx.fill();
    drawText(ctx, tag, W / 2, py + 58, { size: 16, color: '#fff' });

    // 图案预览
    const b = GameConfig.board;
    const bw = b.cols * b.unit + 62; // 含牌堆宽度
    const scale = 0.5;
    const ox = W / 2 - (GameConfig.width * scale) / 2;
    const oy = py + 90;
    roundRectPath(ctx, W / 2 - 150, oy - 8, 300, 290, 20);
    ctx.fillStyle = 'rgba(255,228,240,0.7)'; ctx.fill();
    const list = [...info.pos].sort((a, c) => a.layer - c.layer);
    const maxL = Math.max(...list.filter((q) => q.zone === 'board').map((q) => q.layer));
    const reveal = Math.min(1, info.t / 0.8);
    list.forEach((q, i) => {
      if (i / list.length > reveal) return;
      const x = ox + q.x * scale;
      const y = oy + (q.y - b.top + 6) * scale;
      const isPile = q.zone === 'pile';
      const lk = isPile ? 0.3 : q.layer / Math.max(1, maxL);
      ctx.fillStyle = isPile ? '#c9b8da' : `hsl(${(330 + lk * 60) % 360},${70 + lk * 20}%,${86 - lk * 26}%)`;
      roundRectPath(ctx, x, y, 62 * scale - 1, 62 * scale - 1, 4);
      ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    });
    void bw;

    // 数据
    const total = info.pos.length;
    const piles = info.pos.filter((q) => q.zone === 'pile').length;
    const rows = [
      ['图案', `${getShape(l.pattern).name} · ${OFFSET_MODES[l.mode || 'half'].name}`],
      ['卡牌', piles ? `${total} 张 (含牌堆 ${piles} 张)` : `${total} 张`],
      ['层数 / 花色', `${maxL + 1} 层 / ${l.types} 个人`],
      ['最高评价', ''],
    ];
    rows.forEach(([a, v], i) => {
      const y = py + 400 + i * 36;
      drawText(ctx, a, px + 50, y, { size: 18, color: '#a08bb4', align: 'left', weight: 'normal' });
      if (v) drawText(ctx, v, W - px - 50, y, { size: 19, color: C.text, align: 'right' });
    });
    const got = this.game.save.starsOf(l.id);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < got ? C.gold : '#e3d7ec';
      drawStar(ctx, W - px - 62 - (2 - i) * 32, py + 400 + 3 * 36, 13, 5.5);
    }
    if (l.boss) drawText(ctx, 'BOSS 关：道具省着点用', W / 2, py + 548, { size: 15, color: '#e63946' });
    else drawText(ctx, '★★★ 不用道具　★★ 不复活　★ 过关', W / 2, py + 548, { size: 14, color: '#a08bb4', weight: 'normal' });
    info.startBtn.render(ctx, this.dt);
    info.closeBtn.render(ctx, this.dt);
    ctx.restore();
  }
}
