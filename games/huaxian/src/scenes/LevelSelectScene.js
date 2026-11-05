// 选关界面：4 个章节页签 (每章 10 关，5×2 卡片)，章节横幅显示主题背景、简介与本章星数。
// 切换章节：点页签 / 左右箭头 / 在卡片区左右滑动 / 键盘 ← →。
// 关卡通过上一关解锁 (存档在 localStorage)；章节的第一关被解锁后该章即解锁。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { LEVELS } from '../config/LevelConfig.js';
import { CHAPTERS, chapterOf } from '../config/ChapterConfig.js';
import { Button, Icons } from '../ui/Button.js';
import { drawBackdrop } from '../ui/Backdrop.js';
import { drawText, drawStar, roundRectPath } from '../ui/draw.js';

const COLS = 5;
const CW = 88; const CH = 112;
const GRID_Y = 452;            // 第一行卡片中心
const ROW_H = 132;
const TAB_Y = 146; const TAB_W = 120; const TAB_H = 60;
const BANNER = { x: 24, y: 192, w: 492, h: 140 };
const NAV_Y = 676;
const tabX = (i) => 270 + (i - 1.5) * 126;
const cardPos = (k) => ({ x: 270 + ((k % COLS) - 2) * 100, y: GRID_Y + Math.floor(k / COLS) * ROW_H });

/** 简单锁图标 */
function drawLock(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color;
  roundRectPath(ctx, -15, -6, 30, 24, 6); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, -8, 10, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 5, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawArrow(ctx, x, y, dir, enabled, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = enabled ? 1 : 0.35;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-dir * 5, -11); ctx.lineTo(dir * 6, 0); ctx.lineTo(-dir * 5, 11); ctx.stroke();
  ctx.restore();
}

export class LevelSelectScene extends Scene {
  constructor(game) {
    super(game, 'levels');
    this.chapter = 0;
  }

  enter(data = {}) {
    const g = this.game;
    const back = new Button({ x: 40, y: 46, w: 52, h: 52, style: 'icon', icon: Icons.home, onClick: () => g.scenes.change('menu') });
    back.audio = g.audio;
    this.buttons = [back];
    this.pressed = null;
    this.shakeId = -1;
    this.shakeT = 0;
    this.slide = 0;
    this.drag = null;
    // 默认打开：指定章节 > 上次玩的关卡所在章 > 下一个待通关关卡所在章
    const save = g.save;
    const next = this.nextLevel();
    let id = next ? next.id : 1;
    const last = save.get('lastLevel', 0);
    if (last && save.isUnlocked(last)) id = last;
    this.chapter = data.chapter != null ? Math.max(0, Math.min(CHAPTERS.length - 1, data.chapter)) : CHAPTERS.indexOf(chapterOf(id));
  }

  nextLevel() {
    const save = this.game.save;
    return LEVELS.find((l) => !save.isCleared(l.id) && save.isUnlocked(l.id));
  }

  chapterUnlocked(i) { return this.game.save.isUnlocked(CHAPTERS[i].first); }

  chapterStars(i) {
    const c = CHAPTERS[i]; let s = 0;
    for (let id = c.first; id <= c.last; id++) s += this.game.save.stars(id);
    return s;
  }

  /** 切换章节 (测试钩子也会调用) */
  setChapter(i, animate = true) {
    i = Math.max(0, Math.min(CHAPTERS.length - 1, i));
    if (i === this.chapter) return false;
    this.slide = animate ? Math.sign(i - this.chapter) : 0;
    this.chapter = i;
    if (animate) this.game.audio.play('click');
    return true;
  }

  pageLevels() {
    const c = CHAPTERS[this.chapter];
    return LEVELS.filter((l) => l.id >= c.first && l.id <= c.last);
  }

  hit(p) {
    for (let i = 0; i < CHAPTERS.length; i++) {
      if (Math.abs(p.x - tabX(i)) <= TAB_W / 2 && Math.abs(p.y - TAB_Y) <= TAB_H / 2) return { kind: 'tab', i };
    }
    if (Math.hypot(p.x - 70, p.y - NAV_Y) <= 30) return { kind: 'prev' };
    if (Math.hypot(p.x - 470, p.y - NAV_Y) <= 30) return { kind: 'next' };
    const lv = this.pageLevels();
    for (let k = 0; k < lv.length; k++) {
      const c = cardPos(k);
      if (Math.abs(p.x - c.x) <= CW / 2 && Math.abs(p.y - c.y) <= CH / 2) return { kind: 'card', id: lv[k].id };
    }
    if (this.continueRect && Math.abs(p.x - 270) <= 150 && Math.abs(p.y - this.continueRect.y) <= 34) return { kind: 'continue', id: this.continueRect.id };
    return null;
  }

  cardAt(p) {
    const h = this.hit(p);
    return h && h.kind === 'card' ? h.id : -1;
  }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    this.pressed = this.hit(p);
    if (p.y > BANNER.y && p.y < 800) this.drag = { x: p.x, y: p.y, dx: 0 };
    return true;
  }

  onPointerMove(p) {
    super.onPointerMove(p);
    if (this.drag) this.drag.dx = p.x - this.drag.x;
    return false;
  }

  onPointerUp(p) {
    if (super.onPointerUp(p)) { this.pressed = null; this.drag = null; return true; }
    const drag = this.drag; this.drag = null;
    if (drag && Math.abs(p.x - drag.x) > 60 && Math.abs(p.x - drag.x) > Math.abs(p.y - drag.y)) {
      this.setChapter(this.chapter + (p.x < drag.x ? 1 : -1));
      this.pressed = null;
      return true;
    }
    const h = this.hit(p); const pr = this.pressed; this.pressed = null;
    if (!h || !pr || h.kind !== pr.kind || h.i !== pr.i || h.id !== pr.id) return false;
    if (h.kind === 'tab') this.setChapter(h.i);
    else if (h.kind === 'prev') this.setChapter(this.chapter - 1);
    else if (h.kind === 'next') this.setChapter(this.chapter + 1);
    else if (h.kind === 'card' || h.kind === 'continue') this.open(h.id);
    return true;
  }

  open(id) {
    if (!this.game.save.isUnlocked(id)) {
      this.shakeId = id; this.shakeT = 0.4;
      this.game.audio.play('blocked');
      return false;
    }
    this.game.audio.play('click');
    this.game.scenes.change('game', { level: id });
    return true;
  }

  onKeyDown(e) {
    if (e.code === 'Escape') this.game.scenes.change('menu');
    else if (e.code === 'ArrowLeft') this.setChapter(this.chapter - 1);
    else if (e.code === 'ArrowRight') this.setChapter(this.chapter + 1);
  }

  update(dt) {
    super.update(dt);
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.slide) { this.slide *= Math.pow(0.0005, dt); if (Math.abs(this.slide) < 0.002) this.slide = 0; }
  }

  render(ctx, dt = 1 / 60) {
    const { width: W } = this.game;
    const C = GameConfig.colors;
    const save = this.game.save;
    const ch = CHAPTERS[this.chapter];
    const th = ch.theme;
    drawBackdrop(ctx, this.game.assets, th, W, this.game.height, this.time);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, W, this.game.height);

    drawText(ctx, '选择关卡', W / 2, 46, { size: 34, color: C.primaryDark, stroke: '#fff', strokeWidth: 8 });
    drawText(ctx, `★ ${save.totalStars} / ${LEVELS.length * 3}`, W / 2, 92, { size: 20, color: '#ff9f1a', stroke: '#fff', strokeWidth: 5 });

    // ---- 章节页签 ----
    CHAPTERS.forEach((c, i) => {
      const x = tabX(i); const sel = i === this.chapter; const un = this.chapterUnlocked(i);
      ctx.save();
      ctx.translate(x, TAB_Y);
      const s = this.pressed && this.pressed.kind === 'tab' && this.pressed.i === i ? 0.94 : 1;
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(90,50,120,0.25)'; ctx.shadowBlur = sel ? 12 : 6; ctx.shadowOffsetY = 3;
      roundRectPath(ctx, -TAB_W / 2, -TAB_H / 2, TAB_W, TAB_H, 18);
      ctx.fillStyle = sel ? c.theme.tab : 'rgba(255,255,255,0.88)';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 3; ctx.strokeStyle = sel ? '#fff' : c.theme.tab; ctx.stroke();
      const col = sel ? '#fff' : un ? c.theme.tab : '#a89bbd';
      drawText(ctx, `第${i + 1}章`, 0, -12, { size: 14, color: col, weight: 'normal' });
      drawText(ctx, c.name, un ? 0 : 8, 10, { size: 19, color: col });
      if (!un) drawLock(ctx, -44, 10, 0.42, col);
      ctx.restore();
    });

    // ---- 页面 (横幅 + 卡片)，切换时左右滑入 ----
    const off = this.slide * W * 0.6 + (this.drag ? Math.max(-80, Math.min(80, this.drag.dx * 0.4)) : 0);
    ctx.save();
    ctx.translate(off, 0);
    ctx.globalAlpha = 1 - Math.min(0.7, Math.abs(this.slide));
    this.renderBanner(ctx, ch, this.chapter);
    this.renderCards(ctx, C, save);
    ctx.restore();

    // ---- 翻页 ----
    drawArrow(ctx, 70, NAV_Y, -1, this.chapter > 0, th.tab);
    drawArrow(ctx, 470, NAV_Y, 1, this.chapter < CHAPTERS.length - 1, th.tab);
    CHAPTERS.forEach((c, i) => {
      ctx.fillStyle = i === this.chapter ? th.tab : 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(270 + (i - 1.5) * 26, NAV_Y, i === this.chapter ? 8 : 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th.tab; ctx.lineWidth = 2; ctx.stroke();
    });

    // ---- 继续按钮 ----
    const next = this.nextLevel();
    this.continueRect = null;
    if (next) {
      this.continueRect = { y: 776, id: next.id };
      const pr = this.pressed && this.pressed.kind === 'continue';
      ctx.save();
      ctx.translate(270, 776);
      const s = pr ? 0.95 : 1 + Math.sin(this.time * 3) * 0.015;
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(200,60,120,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
      roundRectPath(ctx, -150, -32, 300, 64, 32);
      const g = ctx.createLinearGradient(0, -32, 0, 32);
      g.addColorStop(0, '#ff9cc8'); g.addColorStop(1, C.primary);
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      drawText(ctx, `继续 · 第${next.id}关 ${next.name}`, 0, 1, { size: 22, color: '#fff', stroke: C.primaryDark, strokeWidth: 4 });
      ctx.restore();
    }
    drawText(ctx, '通过上一关即可解锁下一关 · 左右滑动切换章节', W / 2, 900, { size: 15, color: C.text, stroke: '#fff', strokeWidth: 4, weight: 'normal' });
    for (const b of this.buttons) b.render(ctx, dt);
  }

  renderBanner(ctx, ch, idx) {
    const { x, y, w, h } = BANNER; const th = ch.theme;
    ctx.save();
    ctx.shadowColor = 'rgba(90,50,120,0.25)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    roundRectPath(ctx, x, y, w, h, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4; ctx.strokeStyle = th.tab; ctx.stroke();
    // 左侧色块：章节号
    ctx.save();
    roundRectPath(ctx, x + 12, y + 12, 96, h - 24, 20); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, th.tab); g.addColorStop(1, th.groundEdge);
    ctx.fillStyle = g; ctx.fillRect(x, y, 130, h);
    for (let k = 0; k < 6; k++) { // 小星星点缀
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      drawStar(ctx, x + 22 + ((k * 37) % 80), y + 22 + ((k * 53) % 96), 5, 2.2);
    }
    ctx.restore();
    drawText(ctx, 'CHAPTER', x + 60, y + 38, { size: 13, color: '#fff' });
    drawText(ctx, String(idx + 1), x + 60, y + 80, { size: 52, color: '#fff', stroke: th.groundEdge, strokeWidth: 4 });
    drawText(ctx, ch.name, x + 130, y + 40, { size: 30, color: th.tab, align: 'left', stroke: '#fff', strokeWidth: 5 });
    drawText(ctx, ch.en, x + 130, y + 70, { size: 14, color: '#9a8db0', align: 'left', weight: 'normal' });
    drawText(ctx, ch.intro, x + 130, y + 98, { size: 14, color: GameConfig.colors.text, align: 'left', weight: 'normal' });
    const st = this.chapterStars(idx);
    ctx.fillStyle = GameConfig.colors.star;
    drawStar(ctx, x + 138, y + 122, 9, 4);
    drawText(ctx, `${st} / ${(ch.last - ch.first + 1) * 3}`, x + 152, y + 123, { size: 15, color: '#ff9f1a', align: 'left' });
    if (!this.chapterUnlocked(idx)) {
      drawLock(ctx, x + w - 40, y + 118, 0.6, '#a89bbd');
      drawText(ctx, `通过第${ch.first - 1}关解锁`, x + w - 64, y + 122, { size: 13, color: '#9a8db0', align: 'right', weight: 'normal' });
    }
    ctx.restore();
  }

  renderCards(ctx, C, save) {
    const lvls = this.pageLevels();
    const next = this.nextLevel();
    const th = CHAPTERS[this.chapter].theme;
    lvls.forEach((lv, k) => {
      const { x, y } = cardPos(k);
      const unlocked = save.isUnlocked(lv.id);
      const stars = save.stars(lv.id);
      const isNext = next && next.id === lv.id;
      ctx.save();
      let ox = 0;
      if (this.shakeId === lv.id && this.shakeT > 0) ox = Math.sin(this.shakeT * 60) * 6;
      const pr = this.pressed && this.pressed.kind === 'card' && this.pressed.id === lv.id;
      const s = pr ? 0.94 : isNext ? 1 + Math.sin(this.time * 4) * 0.03 : 1;
      ctx.translate(x + ox, y);
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(120,60,140,0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      roundRectPath(ctx, -CW / 2, -CH / 2, CW, CH, 20);
      const g = ctx.createLinearGradient(0, -CH / 2, 0, CH / 2);
      if (unlocked) { g.addColorStop(0, '#ffffff'); g.addColorStop(1, isNext ? '#ffd9ea' : '#f4e9ff'); } else { g.addColorStop(0, '#e9e3f0'); g.addColorStop(1, '#d4cbe0'); }
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 3;
      ctx.strokeStyle = unlocked ? (isNext ? C.primary : th.tab) : '#c4b8d4';
      ctx.stroke();
      if (unlocked) {
        drawText(ctx, String(lv.id), 0, -24, { size: 32, color: isNext ? C.primaryDark : C.text, stroke: '#fff', strokeWidth: 5 });
        drawText(ctx, lv.name.length > 5 ? lv.name.slice(0, 5) : lv.name, 0, 8, { size: 13, color: '#8a76a3', weight: 'normal' });
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = j < stars ? C.star : 'rgba(180,170,200,0.55)';
          drawStar(ctx, (j - 1) * 22, 36 - (j === 1 ? 3 : 0), 10, 4.5);
        }
        if (save.isRedesigned(lv.id)) {
          // 旧存档里通过过、但这关已经重新设计：星级清零，角标提示「新」
          ctx.save();
          ctx.translate(CW / 2 - 12, -CH / 2 + 10);
          ctx.rotate(0.35);
          roundRectPath(ctx, -18, -10, 36, 20, 10);
          ctx.fillStyle = C.primary; ctx.fill();
          drawText(ctx, '新', 0, 1, { size: 13, color: '#fff' });
          ctx.restore();
        }
      } else {
        drawLock(ctx, 0, -10, 1, '#a89bbd');
        drawText(ctx, String(lv.id), 0, 32, { size: 15, color: '#9a8db0' });
      }
      ctx.restore();
    });
  }
}
