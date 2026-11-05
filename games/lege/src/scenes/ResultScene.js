// 结算场景
//  通关：旋转光芒 + 彩带 + 本关美少女登场展示 + 星级逐颗弹出 (带音效) + 数据面板 + "解锁下一关"缎带
//        地狱 BOSS 关：本关全部美少女环绕旋转、金色大字、持续彩带
//  失败：紫色夜景遮罩 + 落泪的角色 + 清除进度条 + 最佳纪录 + 随机小技巧
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { getLevel, MAX_LEVEL } from '../config/LevelConfig.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { Button } from '../ui/Button.js';
import { drawImageBackground, drawText, drawPanel, drawStar, drawGlow, drawPetals, roundRectPath } from '../ui/draw.js';
import { platform } from '../platform/index.js';

const TIPS = [
  '先拿压着别人最多的那张，下面能翻出一片',
  '槽里到 5 张就收手，凑不成三张的先别碰',
  '「移出」留着救命，别开局就用',
  '撤回只管上一步，手滑了马上按',
  '认准一个人凑齐三张再拿，别东一张西一张',
  '洗牌只换脸不换位置，卡死了再用',
];

export class ResultScene extends Scene {
  constructor(game) {
    super(game, 'result');
  }

  enter(data = {}) {
    this.data = data;
    const g = this.game;
    const w = g.width;
    const level = data.level || getLevel(data.levelId || 1);
    this.level = level;
    this.effects = new EffectSystem(g.events);
    if (data.win) this.effects.onWin({ hell: data.hell });
    if (data.win && data.hell) this.effects.confettiTime = 1e9; // 地狱关通关：彩带一直下
    else if (data.win) this.effects.confettiTime = 4;
    // 本关出场的美少女
    const types = level.types || 3;
    const seedIdx = typeof data.levelId === 'number' ? data.levelId : 7;
    this.cast = data.hell
      ? Array.from({ length: types }, (_, i) => i)
      : [(seedIdx * 3) % types, (seedIdx * 3 + 1) % types, (seedIdx * 3 + 2) % types];
    this.tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.starEvents = [0.75, 1.05, 1.35].map((t, i) => ({ t, i, fired: false }));
    this.unlockFired = false;

    const btns = [];
    const next = typeof data.levelId === 'number' ? data.levelId + 1 : null;
    const toLevels = () => g.scenes.change(data.levelId === 'daily' ? 'menu' : 'levels');
    if (data.win && data.hasNext) {
      const nl = getLevel(next);
      btns.push({ label: `下一关 · 第 ${next} 关${nl.boss ? ' (BOSS)' : ''}`, style: nl.boss ? 'danger' : 'primary', onClick: () => g.scenes.change('game', { level: next }) });
      btns.push({ label: '再来一把', style: 'secondary', onClick: () => g.scenes.change('game', { level: data.levelId }) });
      btns.push({ label: '选择关卡', style: 'ghost', onClick: toLevels });
    } else if (data.win) {
      btns.push({ label: '再来一把', style: 'primary', onClick: () => g.scenes.change('game', { level: data.levelId }) });
      if (data.levelId !== 'daily') btns.push({ label: '每日挑战', style: 'gold', onClick: () => g.scenes.change('game', { level: 'daily' }) });
      else btns.push({ label: '选择关卡', style: 'secondary', onClick: () => g.scenes.change('levels') });
      btns.push({ label: '返回菜单', style: 'ghost', onClick: () => g.scenes.change('menu') });
    } else {
      btns.push({ label: '再来一把', style: 'primary', onClick: () => g.scenes.change('game', { level: data.levelId }) });
      btns.push({ label: data.levelId === 'daily' ? '返回菜单' : '选择关卡', style: 'secondary', onClick: toLevels });
      if (data.levelId !== 'daily') btns.push({ label: '返回菜单', style: 'ghost', onClick: () => g.scenes.change('menu') });
    }
    const top = data.win ? 712 : 704;
    this.buttons = btns.map((b, i) => {
      const btn = new Button({ x: w / 2, y: top + i * 74, w: 340, h: 60, fontSize: 24, ...b });
      btn.audio = g.audio;
      return btn;
    });
    // 小游戏：抖音 = 分享录屏 (开局自动录的这一局) + 分享给好友；微信 = 分享给好友 (转发)
    this.videoPath = null;
    this.toastText = null; this.toastLife = 0;
    if (platform.isMiniGame) {
      if (platform.capabilities.record && data.video) {
        this.videoBtn = new Button({ x: w - 104, y: 46, w: 176, h: 50, label: '录屏处理中…', style: 'gold', fontSize: 19, onClick: () => this.shareVideo() });
        this.videoBtn.enabled = false;
        this.buttons.push(this.videoBtn);
        data.video.then((path) => {
          this.videoPath = path;
          const err = platform.record && platform.record.error;
          const short = platform.recordedSeconds < 3 || /3|short|时长|duration/i.test((err && err.errMsg) || '');
          const ok = !!path && platform.recordedSeconds >= 3;
          this.videoBtn.label = ok ? (data.win ? '分享通关录屏' : '分享录屏') : '录屏失败';
          this.videoBtn.enabled = ok;
          if (!ok) this.showToast(short ? '录屏失败：录屏时长低于 3 秒' : '录屏失败，这局没法分享录屏');
        });
      }
      if (platform.capabilities.share) {
        const sb = new Button({ x: 104, y: 46, w: 176, h: 50, label: '分享给好友', style: 'secondary', fontSize: 19,
          onClick: () => platform.share({ title: data.win ? `我过了「${level.title}」，你行吗？` : undefined }) });
        this.buttons.push(sb);
      }
      this.buttons.forEach((b) => { b.audio = g.audio; });
    }
    this.dt = 1 / 60;
    void MAX_LEVEL;
  }

  shareVideo() {
    if (!this.videoPath) return;
    platform.shareVideo(this.videoPath, this.data.win ? `我清空了「${this.level.title}」！` : undefined).then((ok) => {
      this.showToast(ok ? '分享成功，谢谢！' : '没有分享出去');
    });
  }

  showToast(text) { this.toastText = text; this.toastLife = 2; }

  exit() {
    this.effects.destroy();
  }

  update(dt) {
    super.update(dt);
    this.dt = dt;
    this.effects.update(dt);
    const d = this.data;
    if (d.win) {
      for (const e of this.starEvents) {
        if (!e.fired && this.time >= e.t) {
          e.fired = true;
          if (e.i < d.stars) {
            this.game.events.emit('ui:star', { index: e.i });
            const x = this.game.width / 2 + (e.i - 1) * 78;
            this.effects.burst(x, 478, '#ffd23f', 14, 220, true);
            this.effects.burst(x, 478, '#ffffff', 8, 160, true);
          }
        }
      }
      if (d.unlockedLevel && !this.unlockFired && this.time > 1.8) {
        this.unlockFired = true;
        this.game.events.emit('level:unlock', { level: d.unlockedLevel });
      }
    }
  }

  render(ctx) {
    const g = this.game;
    const { width: w, height: h } = g;
    const d = this.data;
    if (d.snapshot) ctx.drawImage(d.snapshot, 0, 0, w, h);
    else drawImageBackground(ctx, g.assets.getImage('bg'), w, h, this.time);
    if (d.win) this.renderWin(ctx, w, h);
    else this.renderFail(ctx, w, h);
    this.effects.render(ctx);
    for (const b of this.buttons) b.render(ctx, this.dt);
    this.effects.renderOverlay(ctx, w, h);
    if (this.toastText && this.toastLife > 0) {
      this.toastLife -= this.dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastLife / 0.3);
      roundRectPath(ctx, w / 2 - 170, 96, 340, 44, 22);
      ctx.fillStyle = 'rgba(60,25,70,0.82)';
      ctx.fill();
      drawText(ctx, this.toastText, w / 2, 118, { size: 17, color: '#fff', weight: 'normal' });
      ctx.restore();
    }
  }

  renderWin(ctx, w, h) {
    const g = this.game;
    const C = GameConfig.colors;
    const d = this.data;
    const t = this.time;
    const sprites = g.cardSprites;
    const k = Math.min(1, t / 0.35);
    ctx.fillStyle = `rgba(255,232,246,${0.78 * k})`;
    ctx.fillRect(0, 0, w, h);
    // 旋转光芒
    ctx.save();
    ctx.translate(w / 2, 250);
    ctx.rotate(t * 0.25);
    ctx.globalAlpha = 0.45 * k;
    ctx.fillStyle = d.hell ? '#ffe9a0' : '#ffffff';
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-34, -520); ctx.lineTo(34, -520); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    drawGlow(ctx, w / 2, 250, 220, d.hell ? 'rgba(255,230,140,0.9)' : 'rgba(255,255,255,0.9)');
    drawPetals(ctx, w, h, t, 0.8, 18);

    const pop = (delay, dur = 0.45) => {
      const x = Math.max(0, Math.min(1, (t - delay) / dur));
      const s = 1.70158 * 1.4;
      const u = x - 1;
      return x <= 0 ? 0 : u * u * ((s + 1) * u + s) + 1;
    };

    if (d.hell) {
      // 本关全部美少女环绕
      const n = this.cast.length;
      this.cast.forEach((type, i) => {
        const sp = sprites[type];
        if (!sp) return;
        const a = (i / n) * Math.PI * 2 + t * 0.45;
        const r = 170 * pop(0.1 + i * 0.03);
        const z = (Math.sin(a) + 1) / 2;
        const s = 0.75 + z * 0.35;
        ctx.save();
        ctx.translate(w / 2 + Math.cos(a) * r, 250 + Math.sin(a) * r * 0.55);
        ctx.scale(s, s);
        ctx.drawImage(sp.normal, -32, -35, 64, 70.4);
        ctx.restore();
      });
      const ts = pop(0.2, 0.5);
      ctx.save();
      ctx.translate(w / 2, 240);
      ctx.scale(ts, ts);
      drawText(ctx, 'BOSS 倒下了', 0, -34, { size: 30, color: '#e63946', stroke: '#fff', strokeWidth: 8 });
      drawText(ctx, '居然过了', 0, 18, { size: 60, color: C.gold, stroke: '#b8337a', strokeWidth: 14 });
      drawText(ctx, '居然过了', 0, 18, { size: 60, color: '#fff3a6', stroke: '#fff', strokeWidth: 4 });
      ctx.restore();
    } else {
      // 三位美少女登场
      const slots = [{ dx: -128, dy: 30, s: 0.8, r: -0.18, delay: 0.15 }, { dx: 128, dy: 30, s: 0.8, r: 0.18, delay: 0.25 }, { dx: 0, dy: 0, s: 1.15, r: 0, delay: 0.05 }];
      const order = [this.cast[1], this.cast[2], this.cast[0]];
      slots.forEach((sl, i) => {
        const sp = sprites[order[i]];
        if (!sp) return;
        const p = pop(sl.delay);
        const bob = Math.sin(t * 2.5 + i) * 5;
        ctx.save();
        ctx.translate(w / 2 + sl.dx, 240 + sl.dy + bob + (1 - p) * 60);
        ctx.rotate(sl.r + Math.sin(t * 1.8 + i) * 0.04);
        ctx.scale(sl.s * p, sl.s * p);
        ctx.shadowColor = 'rgba(150,60,120,0.4)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
        ctx.drawImage(sp.normal, -64, -70, 128, 140.8);
        ctx.restore();
      });
    }

    // 标题
    const ts = pop(0.3, 0.4);
    if (!d.hell) {
      ctx.save();
      ctx.translate(w / 2, 384);
      ctx.scale(ts, ts);
      const title = d.levelId === 'daily' ? '今日份搞定' : '过关！';
      drawText(ctx, title, 0, 0, { size: 52, color: '#ff5fa2', stroke: '#b8337a', strokeWidth: 14 });
      drawText(ctx, title, 0, 0, { size: 52, color: '#ff8fc4', stroke: '#fff', strokeWidth: 5 });
      ctx.restore();
    }
    const lvName = d.levelId === 'daily' ? '每日挑战' : `第 ${d.levelId} 关 · ${this.level.title}`;
    drawText(ctx, lvName, w / 2, 434, { size: 18, color: C.text, stroke: '#fff', strokeWidth: 5 });

    // 星星
    for (let i = 0; i < 3; i++) {
      const ev = this.starEvents[i];
      const x = w / 2 + (i - 1) * 78;
      const y = 478 + (i === 1 ? -8 : 0);
      const big = i === 1 ? 1.15 : 1;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      drawStar(ctx, x, y, 33 * big, 15 * big);
      ctx.fillStyle = '#e8dcef';
      drawStar(ctx, x, y, 27 * big, 12 * big);
      if (i < d.stars) {
        const p = pop(ev.t - 0.05, 0.35);
        if (p > 0) {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(p, p);
          ctx.rotate((1 - Math.min(1, p)) * 1.5);
          ctx.fillStyle = C.gold;
          drawStar(ctx, 0, 0, 28 * big, 12.5 * big);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          drawStar(ctx, -4, -6, 9 * big, 4 * big);
          ctx.restore();
        }
      }
    }

    // 数据面板
    const pk = pop(0.5, 0.4);
    ctx.save();
    ctx.globalAlpha = Math.min(1, pk);
    drawPanel(ctx, 60, 520, w - 120, 96, 24);
    const cols = [
      ['用时', fmt(d.time)],
      ['消除', `${d.total} 张`],
      ['道具', d.revived ? '复活了' : `${d.propsUsed || 0} 次`],
    ];
    cols.forEach(([a, b], i) => {
      const x = w / 2 + (i - 1) * 130;
      drawText(ctx, b, x, 556, { size: 24, color: C.primaryDark });
      drawText(ctx, a, x, 588, { size: 14, color: '#9a7bb0', weight: 'normal' });
    });
    ctx.restore();
    // 解锁缎带
    if (d.unlockedLevel) {
      const uk = pop(1.7, 0.4);
      if (uk > 0) {
        const nl = getLevel(d.unlockedLevel);
        ctx.save();
        ctx.translate(w / 2, 650);
        ctx.scale(uk, uk);
        roundRectPath(ctx, -170, -20, 340, 40, 20);
        ctx.fillStyle = nl.boss ? '#e63946' : '#8f7cff';
        ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        drawText(ctx, `第 ${nl.id} 关「${nl.title}」开了`, 0, 1, { size: 17, color: '#fff' });
        ctx.restore();
      }
    } else if (d.stars > (d.prevStars || 0) && d.prevStars) {
      drawText(ctx, '星星变多了', w / 2, 650, { size: 18, color: C.primaryDark, stroke: '#fff', strokeWidth: 5 });
    } else if (d.stars < 3) {
      drawText(ctx, d.stars === 2 ? '不用道具能拿 ★★★' : '不复活能拿 ★★', w / 2, 650, { size: 15, color: '#9a7bb0', stroke: '#fff', strokeWidth: 4 });
    }
  }

  renderFail(ctx, w, h) {
    const g = this.game;
    const C = GameConfig.colors;
    const d = this.data;
    const t = this.time;
    const k = Math.min(1, t / 0.4);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, `rgba(60,40,110,${0.72 * k})`);
    bg.addColorStop(1, `rgba(120,60,130,${0.6 * k})`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // 小雨滴
    ctx.save();
    ctx.strokeStyle = 'rgba(200,210,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = (i * 97 + t * 40) % w;
      const y = (i * 151 + t * 260) % h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); ctx.stroke();
    }
    ctx.restore();
    const e = 1 - Math.pow(1 - k, 3);
    ctx.save();
    ctx.translate(0, (1 - e) * 40);
    ctx.globalAlpha = e;
    drawPanel(ctx, 50, 170, w - 100, 480, 32, '#fbf6ff');
    // 角色 + 眼泪
    const sp = g.cardSprites[this.cast[0]];
    const bob = Math.sin(t * 1.6) * 3;
    if (sp) {
      ctx.save();
      ctx.translate(w / 2, 270 + bob);
      ctx.rotate(-0.06);
      ctx.drawImage(sp.normal, -60, -66, 120, 132);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(sp.dark, -60, -66, 120, 132);
      ctx.restore();
      // 头顶的小乌云
      ctx.save();
      ctx.translate(w / 2 + 50, 196 + Math.sin(t * 2) * 3);
      ctx.fillStyle = '#9aa3c7';
      for (const [cx, cy, r] of [[-14, 4, 12], [0, -4, 15], [15, 4, 11], [0, 8, 12]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      for (let i = 0; i < 2; i++) {
        const tt = (t * 0.9 + i * 0.5) % 1;
        ctx.save();
        ctx.globalAlpha = (1 - tt) * 0.9;
        ctx.fillStyle = '#4aa8ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        const tx = w / 2 + (i ? 22 : -22);
        const ty = 262 + tt * 46;
        ctx.beginPath(); ctx.moveTo(tx, ty - 12); ctx.quadraticCurveTo(tx + 8, ty, tx, ty + 7); ctx.quadraticCurveTo(tx - 8, ty, tx, ty - 12); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    drawText(ctx, '塞满了…', w / 2, 384, { size: 44, color: '#8a6d9e', stroke: '#fff', strokeWidth: 10 });
    const lvName = d.levelId === 'daily' ? '每日挑战' : `第 ${d.levelId} 关 · ${this.level.title}`;
    drawText(ctx, lvName, w / 2, 424, { size: 17, color: '#9a7bb0' });
    // 进度条
    const bx = 100; const bw = w - 200; const by = 456;
    roundRectPath(ctx, bx, by, bw, 22, 11);
    ctx.fillStyle = '#eee4f4'; ctx.fill();
    const pv = d.progress * Math.min(1, t / 0.9);
    if (pv > 0) {
      roundRectPath(ctx, bx, by, Math.max(22, bw * pv), 22, 11);
      const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      gr.addColorStop(0, '#b9a3ff'); gr.addColorStop(1, '#ff7fb6');
      ctx.fillStyle = gr; ctx.fill();
    }
    const best = g.save.bestProgress(d.levelId);
    if (best > 0) {
      const mx = bx + bw * best;
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.moveTo(mx, by - 2); ctx.lineTo(mx - 7, by - 12); ctx.lineTo(mx + 7, by - 12); ctx.closePath(); ctx.fill();
    }
    drawText(ctx, `这次消了 ${Math.floor(d.progress * 100)}%（${d.cleared}/${d.total}）`, w / 2, 504, { size: 19, color: C.text });
    drawText(ctx, d.isNewBest ? '新纪录' : `最好成绩 ${Math.floor(best * 100)}%`, w / 2, 538, { size: 17, color: d.isNewBest ? C.primaryDark : '#9a7bb0' });
    roundRectPath(ctx, 80, 566, w - 160, 56, 16);
    ctx.fillStyle = '#fff3d6'; ctx.fill();
    drawText(ctx, '下次试试', w / 2, 582, { size: 13, color: '#d08a1a' });
    drawText(ctx, this.tip, w / 2, 604, { size: 15, color: '#8a6d4e', weight: 'normal' });
    ctx.restore();
  }
}

function fmt(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
