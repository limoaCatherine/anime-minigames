// 选关：按章节分组的关卡卡片 (可上下拖动滚动)，显示类型 / 星级 / 锁；顶部为每日一图入口。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { LEVELS, CHAPTERS } from '../config/LevelConfig.js';
import { DailyConfig, todayKey, dailyLevelFor } from '../config/DailyConfig.js';
import { Button, Icons } from '../ui/Button.js';
import { drawBackground, drawText, roundRectPath, drawStar, drawLock } from '../ui/draw.js';
import { drawFace } from '../ui/portrait.js';

const TYPE = { find: ['找不合理', '#ff6f91'], diff: ['找不同', '#7c83ff'], puzzle: ['助她脱困', '#2fb7b0'], word: ['文字拼字', '#f0a23b'], dress: ['换装', '#8b5cf6'] };

export class LevelSelectScene extends Scene {
  constructor(game) { super(game, 'levels'); }

  enter(data = {}) {
    const g = this.game;
    this.scroll = 0; this.vel = 0; this.drag = null; this.toast = null;
    this.justUnlocked = data.unlocked || null;
    this.backBtn = new Button({ x: 40, y: 46, w: 58, h: 58, style: 'icon', icon: Icons.back, onClick: () => g.scenes.change('menu') });
    this.backBtn.audio = g.audio;
    this.buttons = [this.backBtn];
    // 版面
    this.cards = [];
    let y = 200;
    this.headers = [];
    for (const ch of CHAPTERS) {
      this.headers.push({ ch, y });
      y += 50;
      ch.levels.forEach((id, i) => {
        const lv = LEVELS.find((l) => l.id === id);
        const col = i % 3; const row = Math.floor(i / 3);
        this.cards.push({ lv, x: 22 + col * 168, y: y + row * 150, w: 160, h: 140, ch });
      });
      y += Math.ceil(ch.levels.length / 3) * 150 + 16;
    }
    this.contentH = y + 40;
    // 滚动到最新解锁的关卡
    const unlocked = g.save.get('unlocked', 1);
    const cur = this.cards.find((c) => c.lv.index + 1 === unlocked);
    if (cur) this.scroll = Math.max(0, Math.min(this.maxScroll, cur.y - 420));
    if (this.justUnlocked) g.audio.play('unlock');
  }

  get maxScroll() { return Math.max(0, this.contentH - GameConfig.height + 20); }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    this.drag = { y0: p.y, s0: this.scroll, moved: false, t: 0, last: p.y };
    return true;
  }

  onPointerMove(p) {
    super.onPointerMove(p);
    if (!this.drag) return;
    const d = p.y - this.drag.y0;
    if (Math.abs(d) > 8) this.drag.moved = true;
    if (this.drag.moved) {
      this.vel = (this.drag.last - p.y) * 60; this.drag.last = p.y;
      this.scroll = Math.max(-60, Math.min(this.maxScroll + 60, this.drag.s0 - d));
    }
  }

  onPointerUp(p) {
    if (super.onPointerUp(p)) return true;
    const d = this.drag; this.drag = null;
    if (!d || d.moved) return true;
    const g = this.game;
    // 每日一图
    if (p.y > 100 && p.y < 186 && p.y - 0 > 100 + -this.scroll * 0) {
      if (this.dailyOpen) g.scenes.change('game', { daily: true }); else this.showToast(`通关第 ${DailyConfig.unlockAfter} 关后开放`);
      g.audio.play('click');
      return true;
    }
    const sy = p.y + this.scroll;
    const c = this.cards.find((k) => p.x >= k.x && p.x <= k.x + k.w && sy >= k.y && sy <= k.y + k.h);
    if (!c) return true;
    if (c.lv.index + 1 > g.save.get('unlocked', 1)) { g.audio.play('deny'); this.showToast('先通关前面的关卡'); return true; }
    g.audio.play('click');
    g.scenes.change('game', { levelId: c.lv.id });
    return true;
  }

  onWheel(e) { this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + e.dy * 0.6)); }

  showToast(text) { this.toast = { text, t: 0 }; }

  get dailyOpen() { return Object.keys(this.game.save.data.cleared).length >= DailyConfig.unlockAfter; }

  update(dt) {
    super.update(dt);
    if (!this.drag) {
      this.scroll += this.vel * dt; this.vel *= Math.pow(0.02, dt);
      const ms = this.maxScroll;
      if (this.scroll < 0) { this.scroll += (0 - this.scroll) * Math.min(1, dt * 12); this.vel = 0; }
      if (this.scroll > ms) { this.scroll += (ms - this.scroll) * Math.min(1, dt * 12); this.vel = 0; }
    }
    if (this.toast) { this.toast.t += dt; if (this.toast.t > 1.8) this.toast = null; }
  }

  render(ctx) {
    const g = this.game; const W = GameConfig.width; const H = GameConfig.height; const C = GameConfig.colors; const save = g.save;
    drawBackground(ctx, W, H, this.time);
    const unlocked = save.get('unlocked', 1);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 190, W, H - 190); ctx.clip();
    ctx.translate(0, -this.scroll);
    for (const hd of this.headers) {
      const y = hd.y;
      roundRectPath(ctx, 22, y, W - 44, 38, 19); ctx.fillStyle = hd.ch.color; ctx.fill();
      drawText(ctx, hd.ch.title, 44, y + 19, { size: 18, color: '#fff', align: 'left' });
      const got = hd.ch.levels.reduce((a, id) => a + save.starsOf(id), 0);
      drawText(ctx, `★ ${got}/${hd.ch.levels.length * 3}`, W - 44, y + 19, { size: 15, color: '#fff', align: 'right' });
    }
    for (const c of this.cards) this.renderCard(ctx, c, unlocked);
    ctx.restore();
    // 顶栏
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(0, 0, W, 96);
    drawText(ctx, '选择关卡', W / 2, 40, { size: 28, color: C.text });
    drawText(ctx, `★ ${save.totalStars} / ${LEVELS.length * 3}   沙雕结局 ${Object.keys(save.data.achievements).filter((k) => k.startsWith('silly')).length}`, W / 2, 74, { size: 14, color: '#a08bb4' });
    this.backBtn.render(ctx, 1 / 60);
    // 每日一图
    const done = save.get('dailyCleared') === todayKey();
    roundRectPath(ctx, 22, 104, W - 44, 80, 20);
    const gr = ctx.createLinearGradient(22, 0, W - 22, 0); gr.addColorStop(0, '#ffcf6b'); gr.addColorStop(1, '#ff9a7a');
    ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    drawFace(ctx, g, 'zero7', 66, 144, 28);
    drawText(ctx, done ? '每日一图 · 今日已完成' : '每日一图', 108, 130, { size: 21, color: '#fff', align: 'left', stroke: '#d9772f', strokeWidth: 4 });
    drawText(ctx, this.dailyOpen ? `今天是「${dailyLevelFor(todayKey(), save).title}」· 限时 ${DailyConfig.timeLimit} 秒` : `通关第 ${DailyConfig.unlockAfter} 关后开放`, 108, 160, { size: 14, color: '#fff', align: 'left' });
    drawText(ctx, '›', W - 50, 144, { size: 40, color: '#fff' });
    if (this.toast) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (1.8 - this.toast.t) / 0.3);
      roundRectPath(ctx, W / 2 - 150, 860, 300, 42, 21); ctx.fillStyle = 'rgba(60,30,70,0.85)'; ctx.fill();
      drawText(ctx, this.toast.text, W / 2, 881, { size: 16, color: '#fff' });
      ctx.restore();
    }
  }

  renderCard(ctx, c, unlocked) {
    const g = this.game; const lv = c.lv; const C = GameConfig.colors;
    const locked = lv.index + 1 > unlocked;
    const isNew = this.justUnlocked && lv.index + 1 === this.justUnlocked;
    ctx.save();
    if (isNew) { const k = Math.min(1, this.time / 0.5); ctx.translate(c.x + c.w / 2, c.y + c.h / 2); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.translate(-c.x - c.w / 2, -c.y - c.h / 2); }
    ctx.shadowColor = 'rgba(120,60,140,0.2)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    roundRectPath(ctx, c.x, c.y, c.w, c.h, 18); ctx.fillStyle = locked ? '#efe8f4' : '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    const [tname, tcolor] = TYPE[lv.kind || lv.type] || TYPE.find;
    // 关卡号
    ctx.beginPath(); ctx.arc(c.x + 26, c.y + 26, 17, 0, Math.PI * 2); ctx.fillStyle = locked ? '#cbbfd6' : c.ch.color; ctx.fill();
    drawText(ctx, String(lv.index + 1), c.x + 26, c.y + 27, { size: 17, color: '#fff' });
    roundRectPath(ctx, c.x + c.w - 80, c.y + 14, 68, 22, 11); ctx.fillStyle = locked ? '#d9cfe3' : tcolor; ctx.fill();
    drawText(ctx, tname, c.x + c.w - 46, c.y + 25.5, { size: 12, color: '#fff' });
    // 标题 (最多两行)
    const title = lv.title;
    const lines = title.length > 7 ? [title.slice(0, Math.ceil(title.length / 2)), title.slice(Math.ceil(title.length / 2))] : [title];
    lines.forEach((s, i) => drawText(ctx, s, c.x + c.w / 2, c.y + 64 + i * 22 - (lines.length - 1) * 11, { size: 18, color: locked ? '#b4a2c4' : C.text }));
    if (locked) drawLock(ctx, c.x + c.w / 2, c.y + 112, 16);
    else {
      const st = g.save.starsOf(lv.id);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < st ? '#ffc93c' : '#eadff2'; drawStar(ctx, c.x + c.w / 2 + (i - 1) * 28, c.y + 114, 11, 5); }
      if (g.save.hasAchievement(`silly_${lv.id}`)) drawText(ctx, '沙雕✓', c.x + c.w - 14, c.y + c.h - 12, { size: 11, color: '#8b5cf6', align: 'right' });
      if (isNew) drawText(ctx, 'NEW', c.x + 18, c.y + c.h - 14, { size: 12, color: C.primary, align: 'left' });
    }
    ctx.restore();
  }
}
