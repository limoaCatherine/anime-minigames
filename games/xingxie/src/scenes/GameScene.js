// 战斗场景：固定步长推进 BattleWorld，处理摇杆 / 键盘输入、暂停、升级三选一、宝箱、复活、广告，然后交给 ResultScene 结算。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { COIN_RULES, RUN_RULES } from '../config/ProgressConfig.js';
import { AudioConfig } from '../config/AudioConfig.js';
import { BattleWorld } from '../systems/BattleWorld.js';
import { EffectSystem } from '../render/EffectSystem.js';
import { BattleRenderer } from '../render/BattleRenderer.js';
import { SubtitleSystem } from '../systems/SubtitleSystem.js';
import { HUD, Joystick } from '../ui/HUD.js';
import { LevelUpPanel, ChestPanel, RevivePanel } from '../ui/BattlePanels.js';
import { PausePanel } from '../ui/PausePanel.js';
import { Button, Icons } from '../ui/Button.js';
import { platform } from '../core/platform/index.js';

const KEYMAP = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

export class GameScene extends Scene {
  constructor(game) {
    super(game, 'game');
    this.keys = new Set();
    platform.onKeyUp((e) => this.keys.delete(e.code));
    platform.onBlur(() => this.keys.clear());
  }

  enter(data = {}) {
    const g = this.game;
    this.opts = { character: data.character || g.save.get('lastChar', 'hikari'), difficulty: data.difficulty || g.save.get('difficulty', 'normal') };
    this.world = new BattleWorld({ ...this.opts, talents: g.save.talents(), seed: data.seed != null ? data.seed : (Math.random() * 1e9) | 0, events: g.events });
    this.effects = new EffectSystem(this);
    this.renderer = new BattleRenderer(g, this.world, this.effects);
    this.hud = new HUD(this);
    this.joy = new Joystick();
    this.levelPanel = new LevelUpPanel(this);
    this.chestPanel = new ChestPanel(this);
    this.revivePanel = new RevivePanel(this);
    this.pausePanel = null;
    this.subs = new SubtitleSystem(g, this);
    this.acc = 0;
    this.paused = false;
    this.ending = null;       // { won, t }
    this.finished = false;
    this.reviveOpen = false;
    this.adBusy = false;
    this.swarmT = 0;
    this.fps = { frames: 0, t: 0, value: 60, min: 60, history: [] };
    this.keys.clear();
    this.pauseBtn = new Button({ x: GameConfig.width - 30, y: 92, w: 44, h: 44, style: 'icon', icon: Icons.pause, onClick: () => this.togglePause() });
    this.pauseBtn.audio = g.audio;

    const L = (ev, fn) => this.listen(ev, fn);
    L('levelup:open', (e) => this.levelPanel.open(e.cards));
    L('chest:open', (r) => this.chestPanel.open(r));
    L('player:die', () => this.onDie());
    L('battle:win', () => { this.ending = { won: true, t: 2.6 }; this.effects.showBanner('天亮了！', '大家的梦都守住了', '#ffd28a', 3); });
    L('boss:spawn', (e) => { this.effects.showBanner(e.name, e.line, '#ff7ad9', 3.2); g.bgm.play('boss'); });
    L('boss:die', (e) => { this.effects.showBanner('击败！', `${e.name} 回去睡觉了`, '#ffe680', 2.4); if (this.world.state === 'playing' || this.world.state === 'levelup') g.bgm.play('battle'); });
    L('boss:retreat', (e) => { this.effects.showToast(`${e.name} 打着哈欠溜走了`, '#d8ccff'); if (!this.world.lastStand) g.bgm.play('battle'); });
    L('dawn:laststand', () => { this.effects.showBanner('黎明前最后一搏', '天快亮了，把她打回梦里去！', '#ffb36b', 3.2); g.bgm.play('boss'); });
    L('app:hidden', () => { if (!this.paused && this.world.state === 'playing' && !this.ending) this.togglePause(); });
    L('elite:spawn', (e) => this.effects.showToast(`精英「${e.name}」出现了，打倒它会掉宝箱`, '#ffd23f'));
    L('wave:event', (e) => this.effects.showToast(e.name, '#ff9cc4'));
    L('weapon:evolve', (e) => this.effects.showToast(`进化：${e.name}`, '#ffe680'));
    L('player:revive', () => this.effects.showToast('再来！', '#6fd6ff'));

    g.save.set('lastChar', this.opts.character);
    g.bgm.play('battle');
    g.events.emit('battle:start', { character: this.opts.character, difficulty: this.opts.difficulty });
  }

  exit() { this.game.audio.setSwarm(0); }

  // ---------- 流程 ----------
  togglePause() {
    if (this.ending || this.world.state === 'dead') return;
    this.paused = !this.paused;
    if (this.paused) { this.pausePanel = new PausePanel(this); this.joy.up(); this.game.audio.setSwarm(0); }
  }
  restart() { this.game.scenes.change('game', { ...this.opts }); }
  toMenu() { this.game.scenes.change('menu'); }

  onDie() {
    this.joy.up();
    if (this.world.reviveUsed < RUN_RULES.revive.adPerRun) { this.revivePanel.open(); this.reviveOpen = true; }
    else this.ending = { won: false, t: 1.8 };
  }

  tryRevive() {
    if (this.world.state !== 'dead' || this.world.reviveUsed >= RUN_RULES.revive.adPerRun) return;
    // 没有可用激励视频 (广告位 ID 留空 / 网页版 / exe)：每局免费「再试一次」
    if (!this.game.ads.enabled) { this.reviveOpen = false; this.world.revive(RUN_RULES.revive); return; }
    this.showAd('revive', (ok) => {
      if (ok && this.world.state === 'dead') { this.reviveOpen = false; this.world.revive(RUN_RULES.revive); }
      else if (!ok && this.game.ads.lastReason !== 'error') this.effects.showToast('广告没看完，复活不了…可以再试一次', '#ffb0b0');
    });
  }

  /** 看广告：期间整局冻结 (靠 adBusy 挡住更新)，同一时间只允许一个广告 */
  showAd(placement, cb) {
    if (this.adBusy) return;
    this.adBusy = true;
    this.joy.up();
    this.game.audio.setSwarm(0);
    this.game.ads.showRewardedAd(placement).then((ok) => { this.adBusy = false; this.acc = 0; cb(!!ok); }, () => { this.adBusy = false; cb(false); });
  }

  coinGain() { return this.world.player.s.coinGain || 1; }
  coinsEstimate() {
    const w = this.world;
    return Math.floor((w.kills * COIN_RULES.perKill + w.time * COIN_RULES.perSecond + (w.state === 'won' ? COIN_RULES.clearBonus : 0) + w.coinsPicked) * this.coinGain());
  }

  finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.reviveOpen = false;
    const g = this.game; const w = this.world;
    const sum = w.summary();
    sum.won = won;
    const coins = this.coinsEstimate();
    g.save.addCoins(coins);
    g.save.recordRun(sum);
    const unlocks = g.save.autoUnlock();
    g.scenes.change('result', { summary: sum, coins, unlocks, opts: this.opts, fps: this.fps });
  }

  // ---------- 输入 ----------
  activeButtons() {
    if (this.paused && this.pausePanel) return this.pausePanel.buttons;
    const st = this.world.state;
    if (st === 'levelup') return this.levelPanel.buttons;
    if (st === 'chest') return this.chestPanel.buttons;
    if (this.reviveOpen) return this.revivePanel.buttons;
    if (this.ending) return [];
    return [this.pauseBtn];
  }

  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    if (!this.paused && this.world.state === 'playing' && !this.ending) this.joy.down(p);
    return false;
  }
  onPointerMove(p) { super.onPointerMove(p); this.joy.move(p); }
  onPointerUp(p) { super.onPointerUp(p); this.joy.up(); }

  onKeyDown(e) {
    if (KEYMAP[e.code]) { this.keys.add(e.code); return; }
    const st = this.world.state;
    if (e.code === 'Escape' || e.code === 'KeyP') { this.togglePause(); return; }
    if (st === 'levelup' && !this.levelPanel.locked) {
      const i = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (i != null) this.world.levelup.choose(i);
      if (e.code === 'KeyR') this.levelPanel.refresh(false);
    } else if (st === 'chest' && (e.code === 'Enter' || e.code === 'Space') && this.chestPanel.t > 0.9) this.world.levelup.closeChest();
  }

  inputVector() {
    let x = this.joy.vec.x; let y = this.joy.vec.y;
    if (!this.joy.active) {
      for (const k of this.keys) { const v = KEYMAP[k]; if (v) { x += v[0]; y += v[1]; } }
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    }
    return [x, y];
  }

  // ---------- 主循环 ----------
  update(dt) {
    super.update(dt);
    const g = this.game; const w = this.world;
    this.fps.frames++; this.fps.t += dt;
    if (this.fps.t >= 0.5) {
      this.fps.value = this.fps.frames / this.fps.t; this.fps.frames = 0; this.fps.t = 0;
      if (this.time > 3) { this.fps.min = Math.min(this.fps.min, this.fps.value); this.fps.history.push(Math.round(this.fps.value)); if (this.fps.history.length > 600) this.fps.history.shift(); }
    }
    this.subs.update(dt);
    if (this.adBusy) return;
    if (this.paused) { if (this.pausePanel) this.pausePanel.update(dt); return; }

    if (w.state === 'playing') {
      const [ix, iy] = this.inputVector();
      w.input.x = ix; w.input.y = iy;
      const step = GameConfig.loop.step;
      this.acc += dt * (g.timeScale || 1);
      let n = 0;
      const maxSteps = GameConfig.loop.maxSteps * Math.max(1, Math.ceil(g.timeScale || 1));
      while (this.acc >= step && n < maxSteps && w.state === 'playing') { w.step(step); this.acc -= step; n++; }
      if (n >= maxSteps) this.acc = 0;
      this.effects.update(dt);
      // 怪群环境声：每 0.25 秒按玩家附近的怪物数量更新一次
      this.swarmT -= dt;
      if (this.swarmT <= 0) {
        this.swarmT = 0.25;
        const cnt = w.grid.countCircle(w.p.x, w.p.y, AudioConfig.swarm.radius);
        g.audio.setSwarm(Math.min(1, cnt / AudioConfig.swarm.fullCount));
      }
    } else {
      this.acc = 0;
      if (this.effects.banner || this.effects.toast || this.effects.parts.activeCount) this.effects.update(dt * (w.state === 'levelup' || w.state === 'chest' ? 0 : 1));
      if (w.state !== 'won' && w.state !== 'dead') g.audio.setSwarm(0);
    }
    if (w.state === 'levelup') this.levelPanel.update(dt);
    if (w.state === 'chest') this.chestPanel.update(dt);
    if (this.reviveOpen) this.revivePanel.update(dt);
    if (this.ending) {
      this.effects.update(dt);
      this.ending.t -= dt;
      if (this.ending.t <= 0) this.finish(this.ending.won);
    }
    this.renderer.update(dt);
  }

  render(ctx, dt) {
    const g = this.game; const w = this.world;
    this.renderer.render(ctx);
    this.joy.render(ctx);
    this.hud.render(ctx, dt);
    if (w.state === 'playing' && !this.ending) this.pauseBtn.render(ctx, dt);
    this.subs.render(ctx);
    if (g.debug && g.debug.fps) {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(GameConfig.width - 110, 116, 104, 20);
      ctx.fillStyle = '#9f9'; ctx.font = '12px monospace'; ctx.fillText(`${this.fps.value.toFixed(0)}fps e${w.enemies.pool.activeCount}`, GameConfig.width - 106, 130); ctx.restore();
    }
    if (w.state === 'levelup') this.levelPanel.render(ctx, dt);
    else if (w.state === 'chest') this.chestPanel.render(ctx, dt);
    if (this.reviveOpen) this.revivePanel.render(ctx, dt);
    if (this.paused && this.pausePanel) this.pausePanel.render(ctx, dt);
  }
}
