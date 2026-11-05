// 游戏场景：组合牌桌 / 卡槽 / 消除 / 道具 / 特效 / 字幕等系统。
// 内部状态机：playing (游戏中) / paused (暂停) / failed (卡槽已满，等待复活) / ad (看广告中) / won (通关演出)
import { Scene } from '../core/Scene.js';
import { StateMachine } from '../core/StateMachine.js';
import { TweenManager } from '../core/Tween.js';
import { dateSeed, dateKey } from '../core/Random.js';
import { GameConfig } from '../config/GameConfig.js';
import { getLevel, MAX_LEVEL, levelTag } from '../config/LevelConfig.js';
import { generateLevel } from '../systems/LayoutGenerator.js';
import { greedy } from '../systems/Solver.js';
import { BoardSystem } from '../systems/BoardSystem.js';
import { SlotSystem } from '../systems/SlotSystem.js';
import { MatchSystem } from '../systems/MatchSystem.js';
import { PropSystem } from '../systems/PropSystem.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { SubtitleSystem } from '../systems/SubtitleSystem.js';
import { HUD } from '../ui/HUD.js';
import { Dialog } from '../ui/Dialog.js';
import { AdOverlay } from '../ui/AdOverlay.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { drawSlotBar, drawTempRowHint } from '../ui/SlotBar.js';
import { drawImageBackground, drawText, roundRectPath } from '../ui/draw.js';
import { platform } from '../platform/index.js';

export class GameScene extends Scene {
  constructor(game) {
    super(game, 'game');
  }

  enter({ level = 1, seed = null } = {}) {
    const g = this.game;
    this.levelId = level;
    this.level = getLevel(level);
    this.hell = !!this.level.boss;
    this.tweens = new TweenManager();
    this.board = new BoardSystem(g.events, this.tweens);
    this.slot = new SlotSystem(g.events, this.tweens);
    this.match = new MatchSystem(g.events, this.tweens, this.slot);
    // 抖音侧边栏礼包：下一局多 1 次「移出」(领取后只生效一局)
    const bonus = g.save.get('bonusMoveOut', 0) > 0;
    this.props = new PropSystem(this, { moveOut: bonus ? 2 : 1, undo: 1, shuffle: 1, revive: 1 });
    if (bonus) g.save.set('bonusMoveOut', 0);
    this.bonusToast = bonus;
    this.effects = new EffectSystem(g.events);
    this.subtitles = new SubtitleSystem(g.events, (t) => g.cardSprites[t], GameConfig.subtitleY);
    this.hud = new HUD({ level: this.level, game: g, onPause: () => this.pause(), onProp: (k) => this.useProp(k) });
    this.dialog = null;
    this.settings = null;
    this.adOverlay = null;
    this.toasts = [];
    this.dt = 1 / 60;
    this.failTimer = 0;
    this.endTimer = 0;
    this.playTime = 0;
    this.warned = false;
    // 每日挑战：开局时就定下日期 (跨过午夜才结算也算开局那天)
    this.dailyKey = level === 'daily' ? dateKey() : null;
    this.dailySeed = level === 'daily' ? dateSeed() : null;

    this.generated = this.generate(seed);
    this.board.load(this.generated);
    this.hud.syncProps(this.props);

    this.fsm = new StateMachine(this);
    this.fsm
      .add('playing', { enter() { this.dialog = null; } })
      .add('paused', {})
      .add('failed', {})
      .add('ad', {})
      .add('won', {});
    this.fsm.change('playing');
    this.listen('app:hidden', () => { if (this.fsm.is('playing')) this.pause(); });
    g.music.play(this.hell ? 'hell' : 'game');
    g.events.emit('level:start', { level: this.levelId, hell: this.hell });
    if (bonus) this.toast('侧边栏礼包：这局「移出」+1');
    // 抖音：开局自动录屏 (最长 300 秒)，结算页可"分享录屏"
    this.recording = platform.startRecord();
  }

  exit() {
    this.game.audio.setTension(0);
    if (this.recording) { this.recording = false; platform.stopRecord(); }   // 中途离开：停止录屏 (不分享)
    // 中途离开 (暂停 → 选关 / 重开) 时把正在说的台词停掉；结算时让胜负台词说完
    if (!this.fsm.is('won') && !this.fsm.is('failed')) this.game.voice.stop();
    this.effects.destroy();
    this.subtitles.destroy();
    if (this.game.ads.isShowingFake) this.game.ads.closeFake(false);
  }

  /** 生成布局；第 1 关额外用贪心求解器验证"随便玩也能过" */
  generate(seed) {
    let s = seed != null ? seed : this.levelId === 'daily' ? this.dailySeed : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    let gen = null;
    for (let tries = 0; tries < 40; tries++) {
      gen = generateLevel(this.level, s + tries);
      if (this.level.verify !== 'greedy' || greedy(gen.cards).ok) break;
    }
    return gen;
  }

  // —— 玩法 ——
  /** 点击一张卡 (玩家点击与测试钩子共用此入口) */
  tryPick(card) {
    if (!this.fsm.is('playing')) return false;
    if (card.state !== 'board' || card.flying) return false;
    if (!card.free) {
      card.shake = 0.3;
      this.game.events.emit('card:deny', { card });
      return false;
    }
    if (this.slot.isFull) return false;
    this.props.recordPick(card);
    this.match.onPick();
    this.board.hovered = null;
    this.slot.add(card);
    this.board.refresh();
    this.game.events.emit('card:pick', { x: card.cx, y: card.cy, type: card.type });
    const matched = this.match.check(card);
    if (!matched && this.slot.count >= GameConfig.slot.warnAt && this.slot.count < this.slot.capacity) {
      if (!this.warned) this.game.events.emit('slot:warn', { count: this.slot.count });
      this.warned = true;
    } else if (this.slot.count < GameConfig.slot.warnAt) {
      this.warned = false;
    }
    return true;
  }

  useProp(key) {
    if (!this.fsm.is('playing')) return false;
    const ok = this.props.use(key);
    this.hud.syncProps(this.props);
    return ok;
  }

  pause() {
    if (!this.fsm.is('playing')) return;
    const g = this.game;
    this.fsm.change('paused');
    this.dialog = new Dialog({
      title: '暂停一下',
      lines: [`${this.level.name} · ${this.level.title}`, `${levelTag(this.level)} · 还剩 ${this.board.remaining} 张`],
      buttons: [
        { label: '继续', onClick: () => this.fsm.change('playing') },
        { label: '重新开始', style: 'secondary', onClick: () => g.scenes.change('game', { level: this.levelId }) },
        { label: '设置', style: 'secondary', fontSize: 22, onClick: () => {
          this.settings = new SettingsPanel(g, () => { this.settings = null; this.hud.syncSound(); });
        } },
        { label: '选择关卡', style: 'ghost', onClick: () => g.scenes.change(this.levelId === 'daily' ? 'menu' : 'levels') },
      ],
    }, g.audio);
  }

  fail() {
    const g = this.game;
    this.fsm.change('failed');
    g.events.emit('level:fail', { level: this.levelId });
    const mode = platform.adMode;   // 'placeholder' 网页占位广告 / 'rewarded' 抖音激励视频 / 'free' 抖音未开通流量主 / 'none'
    const canRevive = this.props.remaining('revive') > 0 && mode !== 'none';
    if (!canRevive) { this.endTimer = 1.4; return; }
    const free = mode === 'free';
    this.dialog = new Dialog({
      title: '塞满了！',
      image: g.cardSprites[0] ? g.cardSprites[Math.floor(Math.random() * g.cardSprites.length)].normal : null,
      lines: free ? ['再给你一次机会，帮你挪走 3 张', '这关只能用一次'] : ['看个广告，帮你挪走 3 张', '这关只能复活一次'],
      buttons: [
        free ? { label: '再试一次', style: 'gold', onClick: () => this.freeRevive() }
          : { label: '看广告复活', style: 'gold', onClick: () => this.startRevive() },
        { label: '算了', style: 'ghost', onClick: () => this.finish(false) },
      ],
    }, g.audio);
  }

  startRevive() {
    const g = this.game;
    if (!this.fsm.is('failed')) return;
    this.fsm.change('ad');
    this.adOverlay = new AdOverlay(g.ads, g.audio);
    g.ads.showRewardedAd('revive').then((ok) => {
      this.adOverlay = null;
      if (g.scenes.current !== this || !this.fsm.is('ad')) return;
      if (ok) {
        this.doRevive();
      } else {
        this.fsm.change('failed');
        const r = g.ads.lastResult;
        this.toast(r && r.reason === 'error' ? '广告暂时加载不出来，稍后再试' : '广告没看完，复活不了');
      }
    });
  }

  /** 抖音首发版 (未开通流量主)：每关免费复活一次，不播广告 */
  freeRevive() {
    if (!this.fsm.is('failed')) return;
    this.dialog = null;
    this.doRevive();
  }

  doRevive() {
    this.props.uses.revive--;
    this.fsm.change('playing');
    this.props.moveOut(3, 'revive');
    this.failTimer = 0;
  }

  win() {
    const g = this.game;
    this.fsm.change('won');
    this.endTimer = this.hell ? 3.4 : 2.2;
    g.events.emit('level:win', { level: this.levelId, hell: this.hell });
  }

  /** 结束本局并进入结算场景 */
  finish(win) {
    const g = this.game;
    const total = this.board.total;
    const cleared = this.board.cards.filter((c) => c.state === 'gone' || c.state === 'clearing').length;
    const progress = win ? 1 : total ? cleared / total : 0;
    const prevBest = g.save.bestProgress(this.levelId);
    const propsUsed = ['moveOut', 'undo', 'shuffle'].reduce((n, k) => n + this.props.used(k), 0);
    const revived = this.props.used('revive') > 0;
    // 星级：★★★ 不用道具且不复活 / ★★ 不复活 / ★ 通关
    const stars = !win ? 0 : revived ? 1 : propsUsed === 0 ? 3 : 2;
    const prevStars = g.save.starsOf(this.levelId);
    const res = g.save.submit(this.levelId, { win, progress, stars });
    if (win && this.levelId === 'daily') g.save.set('dailyCleared', this.dailyKey);
    const video = this.recording ? platform.stopRecord() : null;
    this.recording = false;
    g.scenes.change('result', {
      video,
      win, levelId: this.levelId, level: this.level, hell: this.hell, progress, isNewBest: !win && progress > prevBest,
      time: this.playTime, cleared, total, snapshot: g.snapshot(), stars, prevStars, propsUsed, revived,
      unlockedLevel: res.unlockedLevel,
      hasNext: typeof this.levelId === 'number' && this.levelId < MAX_LEVEL,
    });
  }

  toast(text) {
    this.toasts = [{ text, life: 0, max: 1.6 }];
  }

  // —— 输入 ——
  activeButtons() {
    if (this.adOverlay && this.game.ads.isShowingFake) return this.adOverlay.buttons;
    if (this.settings) return this.settings.widgets;
    if (this.dialog) return this.dialog.buttons;
    if (this.fsm.is('playing')) return this.hud.buttons;
    return [];
  }

  /** 开局发牌动画还没落完 (这时卡还看不清，不接受点牌) */
  get dealing() { return this.time < (this.board.dealTime || 0) - 0.25; }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    if (!this.fsm.is('playing') || this.dealing) return false;
    const card = this.board.topAt(p);
    if (card && !card.flying) return this.tryPick(card);
    return false;
  }

  onPointerMove(p) {
    super.onPointerMove(p);
    if (this.fsm.is('playing') && !this.dealing && p.type !== 'touch') this.board.updateHover(p);
    return false;
  }

  onKeyDown(e) {
    if (this.settings) { if (e.code === 'Escape') { this.settings = null; this.hud.syncSound(); } return; }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.fsm.is('playing')) this.pause();
      else if (this.fsm.is('paused')) this.fsm.change('playing');
    }
    if (!this.fsm.is('playing')) return;
    if (e.code === 'Digit1') this.useProp('moveOut');
    if (e.code === 'Digit2' || (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey))) this.useProp('undo');
    if (e.code === 'Digit3') this.useProp('shuffle');
  }

  // —— 帧更新 ——
  update(dt) {
    super.update(dt);
    this.dt = dt;
    const paused = this.fsm.is('paused');
    if (!paused) {
      this.tweens.update(dt);
      this.match.update();
      if (this.match.banner) this.match.banner.life += dt;
      this.board.update(dt);
      this.effects.update(dt);
      this.subtitles.update(dt);
    }
    this.fsm.update(dt);
    if (this.dialog) this.dialog.update(dt);
    if (this.settings) this.settings.update(dt);
    // 卡槽紧张度 → 心跳音效 (5 张慢、6 张快)
    const n = this.slot.count;
    this.game.audio.setTension(this.fsm.is('playing') ? (n >= 6 ? 2 : n >= 5 ? 1 : 0) : 0);
    if (this.adOverlay) { this.adOverlay.update(dt); this.game.ads.update(dt); }
    for (const t of this.toasts) t.life += dt;
    this.toasts = this.toasts.filter((t) => t.life < t.max);

    if (this.fsm.is('playing')) {
      this.playTime += dt;
      if (this.slot.isFull && !this.slot.anyFlying) {
        this.failTimer += dt;
        if (this.failTimer >= GameConfig.failDelay) { this.failTimer = 0; this.fail(); }
      } else {
        this.failTimer = 0;
      }
      if (this.board.remaining === 0 && this.slot.count === 0 && !this.match.busy) this.win();
    } else if (this.fsm.is('won') || (this.fsm.is('failed') && !this.dialog)) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.game.scenes.transitioning) this.finish(this.fsm.is('won'));
    }
  }

  render(ctx) {
    const g = this.game;
    const W = GameConfig.width;
    const H = GameConfig.height;
    const sprites = g.cardSprites;
    const sh = this.effects.shakeOffset;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    drawImageBackground(ctx, g.assets.getImage('bg'), W, H, this.time);
    // 牌桌底板 (轻微白色衬底，保证卡牌清晰)
    const b = GameConfig.board;
    roundRectPath(ctx, b.left - 10, b.top - 10, b.cols * b.unit + 20, b.rows * b.unit + 22, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();

    const temps = this.board.cards.some((c) => c.zone === 'temp');
    if (temps) drawTempRowHint(ctx, (i, l) => this.props.tempPos(i, l));
    this.renderPileLabels(ctx);
    this.board.render(ctx, sprites);
    drawSlotBar(ctx, this.slot.count, this.time);
    for (const c of this.slot.cards) if (!c.flying) c.render(ctx, sprites[c.type], false);
    for (const c of this.match.clearingCards) if (!c.flying) c.render(ctx, sprites[c.type], false);
    // 飞行中的卡 (飞往卡槽 / 撤回 / 移出) 画在最上面
    for (const c of this.board.cards) {
      if (c.flying && c.state !== 'gone') c.render(ctx, sprites[c.type], false);
    }
    this.effects.render(ctx);
    ctx.restore();

    this.hud.render(ctx, this.fsm.is('playing') ? this.dt : 0, { remaining: this.board.remaining, total: this.board.total, time: this.time });
    this.renderComboBanner(ctx);
    this.subtitles.render(ctx);
    if (this.recording && platform.record && platform.record.state === 'recording') {
      // 录屏提示 (抖音规范：自动录屏时显示"录屏中"或隐藏)
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.time * 4);
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.arc(24, 100, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawText(ctx, '录屏中', 34, 100, { size: 11, color: '#fff', align: 'left', stroke: 'rgba(120,40,80,0.5)', strokeWidth: 3, weight: 'normal' });
    }
    this.effects.renderOverlay(ctx, W, H);
    for (const t of this.toasts) {
      const k = t.life / t.max;
      ctx.save();
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : Math.min(1, t.life / 0.12);
      ctx.font = `bold 20px ${GameConfig.fontFamily}`;
      const tw = ctx.measureText(t.text).width + 40;
      roundRectPath(ctx, (W - tw) / 2, 470, tw, 46, 23);
      ctx.fillStyle = 'rgba(90,40,100,0.85)';
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      drawText(ctx, t.text, W / 2, 494, { size: 20, color: '#fff' });
      ctx.restore();
    }
    if (this.dialog) this.dialog.render(ctx, this.settings ? 0 : this.dt);
    if (this.settings) this.settings.render(ctx, this.dt);
    if (this.adOverlay && g.ads.isShowingFake) this.adOverlay.render(ctx, this.dt);
  }

  /** 连消横幅：牌桌中部的大号 "×N 连消!" */
  renderComboBanner(ctx) {
    const b = this.match.banner;
    if (!b) return;
    const k = b.life / b.max;
    if (k >= 1) return;
    const W = GameConfig.width;
    const pop = k < 0.12 ? 0.4 + (k / 0.12) * 0.75 : k < 0.2 ? 1.15 - (k - 0.12) / 0.08 * 0.15 : 1;
    ctx.save();
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.translate(W / 2, 360 - k * 30);
    ctx.scale(pop, pop);
    ctx.rotate(-0.06);
    const words = ['', '', '顺！', '好手感', '停不下来', '手要冒烟了', '神了', '传说级'];
    const word = words[Math.min(words.length - 1, b.combo)];
    drawText(ctx, `${b.combo} 连消!`, 0, 0, { size: 52, color: '#ffd23f', stroke: '#e2457f', strokeWidth: 12 });
    drawText(ctx, `${b.combo} 连消!`, 0, 0, { size: 52, color: '#fff4a8', stroke: '#ffffff', strokeWidth: 4 });
    drawText(ctx, word, 0, 46, { size: 28, color: '#ff6fa8', stroke: '#fff', strokeWidth: 7 });
    ctx.restore();
  }

  /** 侧边牌堆上方显示剩余张数 */
  renderPileLabels(ctx) {
    for (const side of ['left', 'right']) {
      const n = this.board.cards.filter((c) => c.state === 'board' && c.zone === 'pile' && c.side === side).length;
      const total = this.board.cards.filter((c) => c.zone === 'pile' && c.side === side).length;
      if (!total) continue;
      const x = side === 'left' ? GameConfig.pileMarginX + 30 : GameConfig.width - GameConfig.pileMarginX - 30;
      drawText(ctx, `牌堆 ×${n}`, x, GameConfig.pileRowY - 10, { size: 13, color: '#fff', stroke: 'rgba(150,70,130,0.8)', strokeWidth: 4 });
    }
  }
}
