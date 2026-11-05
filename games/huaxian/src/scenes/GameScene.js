// 关卡场景：组合 LevelWorld (模拟) 与各渲染/界面系统。
// 状态 (StateMachine): draw 画线 -> survive 坚持倒计时 -> won / lost，任意游戏中状态可进入 paused。
import { Scene } from '../core/Scene.js';
import { StateMachine } from '../core/StateMachine.js';
import { LevelWorld } from '../core/LevelWorld.js';
import { GameConfig } from '../config/GameConfig.js';
import { getLevel, LEVEL_COUNT } from '../config/LevelConfig.js';
import { chapterOf } from '../config/ChapterConfig.js';
import { AudioConfig } from '../config/AudioConfig.js';
import { drawBackdrop } from '../ui/Backdrop.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { SubtitleSystem } from '../systems/SubtitleSystem.js';
import { HUD } from '../ui/HUD.js';
import { ResultPanel } from '../ui/ResultPanel.js';
import { PausePanel } from '../ui/PausePanel.js';
import { drawCountdownRing } from '../ui/CountdownRing.js';
import { drawInkLine, drawPenTip, drawBlocked } from '../ui/LineRenderer.js';
import { drawText, drawDashedPolyline, roundRectPath } from '../ui/draw.js';

export class GameScene extends Scene {
  constructor(game) {
    super(game, 'game');
    this.levelCount = LEVEL_COUNT;
    this.hints = game.hints;
  }

  enter(data = {}) {
    const g = this.game;
    this.enterToken = (this.enterToken || 0) + 1;
    this.level = getLevel(data.level || 1);
    this.chapter = chapterOf(this.level.id);
    this.theme = this.chapter.theme;
    this.seed = data.seed != null ? data.seed : Math.floor(Math.random() * 1e6);
    g.save.set('lastLevel', this.level.id);
    g.save.set('plays', (g.save.get('plays', 0) || 0) + 1);
    this.world = new LevelWorld(this.level, g.events, this.seed);
    this.effects = new EffectSystem(g.events);
    this.subtitles = new SubtitleSystem(g.events);
    this.hud = new HUD(this);
    this.hints.setLevel(this.level);
    if (data.showHint && this.hints.available) { this.hints.show(); this.world.hintUsed = true; }
    this.panel = null;
    this.pausePanel = null;
    this.result = null;
    this.tipAlpha = 1;

    this.fsm = new StateMachine(this);
    this.fsm
      .add('draw', {})
      .add('survive', {})
      .add('won', { enter() { this.resultDelay = 1.5; } })
      .add('lost', { enter() { this.resultDelay = 1.6; } })
      .add('paused', {
        enter() { this.pausePanel = new PausePanel(this); },
        exit() { this.pausePanel = null; },
      });
    this.fsm.change('draw');

    this.listen('line:commit', () => { this.fsm.change('survive'); this.hints.hide(); });
    this.listen('level:win', (e) => {
      const rec = g.save.submit(this.level.id, e.stars, e.inkUsed);
      this.result = { win: true, stars: e.stars, hintCapped: e.hintCapped, tooClose: e.tooClose, hintUsed: this.world.hintUsed, inkUsed: e.inkUsed, ...rec };
      this.fsm.change('won');
    });
    this.listen('level:lose', (e) => {
      this.result = { win: false, by: e.type };
      this.fsm.change('lost');
    });
    this.listen('hint:show', () => { if (this.world.state === 'draw') this.world.hintUsed = true; });
    this.listen('ink:empty', () => { this.hud.inkFlash = 1; });
    this.listen('app:hidden', () => { if (this.fsm.is('survive') || this.fsm.is('draw')) this.togglePause(); });

    this.started = false; // level:start 在淡入后第一帧发出 (避免与场景切换同时触发而被打断)
  }

  exit() {
    this.world.destroy();
    this.effects.destroy();
    this.subtitles.destroy();
    this.game.audio.setSwarm(0);
  }

  // ---------- 操作 ----------
  restart(showHint = false) { this.game.scenes.change('game', { level: this.level.id, showHint }); }

  nextLevel() { this.game.scenes.change('game', { level: Math.min(LEVEL_COUNT, this.level.id + 1) }); }

  toLevels() { this.game.scenes.change('levels', { chapter: this.chapter.id - 1 }); }

  togglePause() {
    if (this.fsm.is('paused')) { this.fsm.change(this.pausedFrom); return; }
    if (this.fsm.is('draw') || this.fsm.is('survive')) {
      this.pausedFrom = this.fsm.name;
      this.world.drawing.cancel();   // 画到一半暂停/切后台：取消这一笔 (以前会直接提交成线，且恢复后状态错乱)
      this.fsm.change('paused');
    }
  }

  /** 提示：画线阶段直接显示；结算面板里点「提示」则看广告后重开本关并显示提示 */
  async useHint(fromPanel = false) {
    // 广告是异步的：看广告期间玩家可能已经退出 / 换关，回来后只在仍是同一次挑战时才生效
    const token = this.enterToken;
    const still = () => this.game.scenes.current === this && this.enterToken === token;
    if (fromPanel) {
      const ok = await this.hints.request();
      if (ok && still()) this.restart(true);
      return;
    }
    if (!this.fsm.is('draw')) return;
    if (this.hints.visible) { this.hints.hide(); return; }
    await this.hints.request();
    if (!still()) this.hints.hide();
  }

  /** 测试/演示：按与玩家相同的规则画一条折线 */
  debugDraw(points) {
    return this.world.drawing.drawPolyline(points.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p)));
  }

  // ---------- 输入 ----------
  activeButtons() {
    if (this.pausePanel) return this.pausePanel.buttons;
    if (this.panel) return this.panel.buttons;
    return this.hud.buttons;
  }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    if (this.fsm.is('draw') && !this.panel) {
      if (this.world.drawing.begin(p)) this.tipAlpha = 0.99;
    }
    return false;
  }

  onPointerMove(p) {
    super.onPointerMove(p);
    const d = this.world.drawing;
    if (d.drawing || d.armed) {   // armed：按下时落点不合法，拖到合法位置才真正开始 (以前这里只认 drawing，导致「待落笔」在游戏里从不生效)
      const before = d.points.length;
      d.move(p);
      if (d.points.length > before) {
        const q = d.points[d.points.length - 1];
        if (Math.random() < 0.7) this.effects.trail(q.x, q.y, `hsl(${(330 + d.inkUsed * 0.45 - this.time * 160) % 360},95%,75%)`);
      }
    }
    return false;
  }

  onPointerUp(p) {
    super.onPointerUp(p);
    const d = this.world.drawing;
    if (p && p.cancelled) d.cancel();   // 窗口失焦 / 指针被系统收回：这一笔作废，而不是把画了一半的线提交
    else if (d.drawing || d.armed) d.end(p);
    return false;
  }

  onKeyDown(e) {
    if (this.pausePanel && this.pausePanel.showSettings) { if (e.code === 'Escape' || e.code === 'Enter') this.pausePanel.showSettings = false; return; }
    if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
    else if (e.code === 'KeyR') this.restart();
    else if (e.code === 'KeyH') this.useHint(!!this.panel && !this.result?.win);
    else if ((e.code === 'Enter' || e.code === 'KeyN') && this.panel && this.result && this.result.win) this.nextLevel();
  }

  /** 蜂群强度 0..1：近处蜜蜂按距离衰减计权，远处的只算一点点 */
  swarmIntensity() {
    const S = AudioConfig.swarm;
    const h = this.world.heroine;
    const hy = h.feetY - 60;
    let sum = 0;
    for (const b of this.world.hazards.list) {
      if (b.type !== 'bee' || b.fleeing || !b.body) continue;
      const d = Math.hypot(b.body.position.x - h.x, b.body.position.y - hy);
      const k = Math.max(0, 1 - d / S.radius);
      sum += S.farWeight + (1 - S.farWeight) * k * k;
    }
    return Math.min(1, sum / S.fullCount);
  }

  // ---------- 更新 ----------
  update(dt) {
    super.update(dt);
    if (this.fsm.is('paused')) {
      this.pausePanel.update(dt);
      this.game.audio.setSwarm(0);
      return;
    }
    this.fsm.update(dt);
    if (!this.started && !this.game.scenes.transitioning) {
      this.started = true;
      this.game.events.emit('level:start', { id: this.level.id, x: this.world.heroine.x, y: this.world.heroine.feetY - 120 });
    }
    const scale = this.game.timeScale || 1;
    let wdt = dt * scale;
    if (this.fsm.is('lost') && this.fsm.time < 0.8) wdt *= 0.3; // 失败瞬间慢动作
    this.world.update(wdt);
    this.effects.update(dt);
    this.subtitles.update(dt);
    this.hud.update(dt);
    if (this.tipAlpha < 1) this.tipAlpha = Math.max(0, this.tipAlpha - dt * 3);
    // 蜂群嗡嗡声：按主角附近的蜜蜂数量与距离计算一个强度 (整个蜂群只有一个声音)
    this.game.audio.setSwarm(this.fsm.is('survive') ? this.swarmIntensity() : 0);
    if ((this.fsm.is('won') || this.fsm.is('lost')) && !this.panel) {
      this.resultDelay -= dt;
      if (this.resultDelay <= 0) this.panel = new ResultPanel(this, this.result);
    }
    if (this.panel) this.panel.update(dt);
  }

  // ---------- 绘制 ----------
  render(ctx, dt = 1 / 60) {
    const { width: W, height: H } = this.game;
    const w = this.world;
    const assets = this.game.assets;
    const t = this.time;
    drawBackdrop(ctx, assets, this.theme, W, H, t);

    const sh = this.effects.shakeOffset;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    w.mechanisms.render(ctx, t, this.theme, 'back');
    w.terrain.render(ctx, this.theme);
    w.mechanisms.render(ctx, t, this.theme, 'mid');
    w.hazards.render(ctx, assets, t, 'back');
    if (this.hints.visible && this.fsm.is('draw') || (this.hints.visible && this.fsm.is('paused') && this.pausedFrom === 'draw')) {
      drawDashedPolyline(ctx, this.hints.points, t);
    }
    if (this.level.id === 1 && this.fsm.is('draw') && !w.drawing.drawing && w.drawing.points.length === 0 && !this.hints.visible) this.renderTutorial(ctx, t);
    w.heroine.render(ctx, assets, t);
    if (w.line) drawInkLine(ctx, w.line.worldPoints(), { time: t, solid: true, age: w.line.age });
    else if (w.drawing.points.length) {
      drawInkLine(ctx, w.drawing.points, { time: t });
      if (w.drawing.drawing) drawPenTip(ctx, w.drawing.points[w.drawing.points.length - 1], t);
    }
    w.hazards.render(ctx, assets, t, 'front');
    this.effects.render(ctx);
    if (w.drawing.blocked) drawBlocked(ctx, w.drawing.blocked, w.drawing.blockedTime / 0.6);
    ctx.restore();

    this.subtitles.render(ctx);
    this.hud.render(ctx, dt);

    // 提示文字 / 倒计时环
    if (this.fsm.is('draw') || (this.fsm.is('paused') && this.pausedFrom === 'draw')) {
      if (this.tipAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = this.tipAlpha;
        const tw = Math.min(500, 40 + this.level.tip.length * 17);
        roundRectPath(ctx, W / 2 - tw / 2, 128, tw, 40, 20);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fill();
        drawText(ctx, this.level.tip, W / 2, 149, { size: 16, color: GameConfig.colors.primaryDark });
        drawText(ctx, w.hintUsed ? `已看提示 · 本次最高 ${GameConfig.hintMaxStars} 星` : `只能画一笔 · 坚持 ${this.level.time} 秒`, W / 2, 186, { size: 14, color: GameConfig.colors.text, stroke: '#fff', strokeWidth: 4, weight: 'normal' });
        ctx.restore();
      }
    } else if (w.state === 'survive' || this.fsm.is('paused')) {
      drawCountdownRing(ctx, W / 2, 162, w.level.time - w.time, w.level.time, t);
    }

    this.effects.renderOverlay(ctx, W, H);
    if (this.panel) this.panel.render(ctx, dt);
    if (this.pausePanel) this.pausePanel.render(ctx, dt);
  }

  /** 第 1 关教学：一只发光的小手沿参考解法移动 */
  renderTutorial(ctx, t) {
    const pts = this.level.solution;
    if (t < 1) return;
    const total = this.level.solutionLength;
    const k = ((t - 1) % 2.6) / 2.2;
    if (k > 1) return;
    let target = total * k; let p = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]; const b = pts[i];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (target <= L) { p = { x: a.x + (b.x - a.x) * (target / L), y: a.y + (b.y - a.y) * (target / L) }; break; }
      target -= L; p = b;
    }
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawDashedPolyline(ctx, pts, t, '#ffb3d1');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = GameConfig.colors.primary;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = GameConfig.colors.primary;
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
