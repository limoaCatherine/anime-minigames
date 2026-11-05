// 关卡场景：找不合理 (find) / 找不同 (diff) / 助她脱困 & 换装 (puzzle) / 文字拼字 (word)。
// 关卡内容全部来自 LevelConfig；这里只有通用玩法逻辑 (没有任何按关卡或难度的分支)。
import { Platform } from '../platform/Platform.js';
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { LEVELS, levelById } from '../config/LevelConfig.js';
import { CHARACTERS } from '../config/CharacterConfig.js';
import { BARRAGE } from '../config/BarrageConfig.js';
import { ITEMS } from '../config/ItemConfig.js';
import { DailyConfig, dailyLevelFor, todayKey } from '../config/DailyConfig.js';
import { renderScene } from '../art/SceneRenderer.js';
import { ART } from '../art/index.js';
import { contains, signedDist, centerOf, radiusOf, shapeOf } from '../core/geometry.js';
import { PuzzleState } from '../systems/PuzzleSystem.js';
import { BarrageSystem } from '../systems/BarrageSystem.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { Button, Icons } from '../ui/Button.js';
import { drawText, roundRectPath, drawHeart, drawPanel, drawBackground } from '../ui/draw.js';
import { drawFace } from '../ui/portrait.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { Dialog } from '../ui/Dialog.js';
import { ResultPanel } from '../ui/ResultPanel.js';
import { TweenManager } from '../core/Tween.js';

const L = GameConfig.layout;
const ANY = () => true;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const SLOT = { x0: 120, rows: [848, 910], size: 54, gap: 8, cols: 4, n: 8 };

export class GameScene extends Scene {
  constructor(game) {
    super(game, 'game');
    this.barrage = new BarrageSystem(game.events);
    game.events.on('ad:error', () => { if (game.scenes.current === this) game.subtitle.show('zero7', '暂时没有可看的广告，等会儿再试。', 2.6); });
    // 切到后台 / 最小化：自动暂停 (每日一图的计时也会停)
    game.events.on('app:hidden', () => { if (game.scenes.current === this && this.state === 'play' && !this.panel && !this.dialog) this.openPause(); });
    // 抖音录屏：切后台时暂停录制，回来继续
    game.events.on('app:hidden', () => { if (Platform.recorder && game.scenes.current === this) Platform.recorder.pause(); });
    game.events.on('app:visible', () => { if (Platform.recorder && game.scenes.current === this) Platform.recorder.resume(); });
    this.fx = new EffectSystem();
    this.tweens = new TweenManager();
  }

  // ———————————————————— 生命周期 ————————————————————
  enter(data = {}) {
    const g = this.game;
    this.daily = !!data.daily;
    this.dailyKey = todayKey();   // 跨过零点才通关也记在开始那天
    const lv = data.daily ? dailyLevelFor(this.dailyKey, g.save) : levelById(data.levelId || 'L01');
    this.level = lv;
    this.retry = !!data.retry;
    this.type = lv.type;
    this.isFind = lv.type === 'find' || lv.type === 'diff';
    this.views = lv.type === 'diff' ? [{ ...L.diff.a, variant: 'A' }, { ...L.diff.b, variant: 'B' }] : [{ ...L.scene, variant: 'A' }];
    this.aspect = this.views[0].h / this.views[0].w;
    this.found = new Set();
    this.foundOrder = [];
    this.eggFound = false;
    this.sanityMax = (this.daily ? DailyConfig.sanity : lv.sanity) || 3;
    this.sanity = this.sanityMax;
    this.timeLimit = this.daily ? DailyConfig.timeLimit : (lv.timeLimit || 0);
    this.mistakes = 0; this.adHints = 0; this.ticketHints = 0; this.revives = 0; this.freeHints = GameConfig.hint.freePerLevel; this.freeCd = 0; this.exactCd = 0;
    this.elapsed = 0; this.state = 'intro'; this.endTimer = -1; this.pending = null;
    this.puzzle = this.isFind ? null : new PuzzleState(lv);
    this.cam = { z: 1, cx: 0.5, cy: 0.5 };
    this.hint = null; this.loupe = null; this.gesture = null; this.dragItem = null; this.selected = null;
    this.flyers = []; this.wordFill = [];
    this.panel = null; this.dialog = null;
    this.lastWrongAt = -9; this.idleTimer = 0; this.reactionPose = 'idle'; this.react = 0;
    this.barrage.crowdOn = g.save.get('barrage', true);
    this.barrage.clear(); this.fx.clear(); this.tweens.clear(); g.subtitle.clear();
    this.zoneFx = {};
    this.buildButtons();
    g.voice.beginLevel(lv.id, this.retry);
    g.events.emit('level:start', { id: lv.id });
    this.showIntro();
  }

  exit() {
    this.game.voice.stop(); this.game.subtitle.clear();
    if (this.recording && Platform.recorder) Platform.recorder.cancel();
    this.recording = false;
  }

  // ———————————————————— 抖音录屏 (网页 / 桌面版 Platform.recorder 为 null，整段跳过) ————————————————————
  startRecording() {
    this.recording = false; this.video = null;
    if (!Platform.recorder || !Platform.recorder.supported) return;
    Platform.recorder.start(); this.recording = true;
  }
  /** 高光时刻：找到刁钻点 / 最后一处 / 彩蛋 / 解谜结局 → 标记前 4 秒 + 后 2 秒 */
  highlight() { if (this.recording) Platform.recorder.highlight(); }

  shareVideo() {
    const g = this.game; const lv = this.level;
    if (!this.video || !this.video.videoPath) return;
    const title = this.daily ? '今日一图，我找出了所有破绽！' : `《次元破绽！》${lv.title}——我找出了所有破绽！`;
    Platform.shareVideo({ videoPath: this.video.videoPath, title }).then((ok) => {
      if (g.scenes.current === this) g.subtitle.show('zero7', ok ? '分享成功！让大家也来找找看。' : '分享取消了，想发的时候再点。', 2.2);
    });
  }

  buildButtons() {
    const a = this.game.audio; const W = GameConfig.width;
    const mk = (o) => { const b = new Button(o); b.audio = a; return b; };
    this.backBtn = mk({ x: 40, y: 46, w: 58, h: 58, style: 'icon', icon: Icons.back, onClick: () => this.openPause() });
    this.gearBtn = mk({ x: W - 40, y: 46, w: 58, h: 58, style: 'icon', icon: Icons.gear, onClick: () => this.openSettings() });
    this.hintBtn = mk({ x: W - 78, y: 880, w: 128, h: 92, style: 'gold', label: '', onClick: () => this.useHint() });
    this.zoomBtn = mk({ x: W - 186, y: 880, w: 64, h: 64, style: 'icon', icon: zoomIcon(() => this.cam.z > 1.05), onClick: () => this.toggleZoom() });
    this.buttons = [this.backBtn, this.gearBtn, this.hintBtn, ...(this.isFind ? [this.zoomBtn] : [])];
  }

  activeButtons() {
    if (this.panel) return this.panel.widgets || this.panel.buttons;
    if (this.dialog) return this.dialog.buttons;
    if (this.state !== 'play') return [];
    return this.buttons;
  }

  // ———————————————————— 开场 / 结算 ————————————————————
  showIntro() {
    const lv = this.level; const g = this.game;
    const host = lv.host || 'nuonuo';
    const lines = [lv.desc];
    if (this.daily) lines.unshift(`今日限时 ${DailyConfig.timeLimit} 秒，理智只有 ${DailyConfig.sanity} 点`);
    this.dialog = new IntroCard(g, {
      no: this.daily ? '每日一图' : `第 ${lv.index + 1} 关`, title: lv.title, tag: lv.tag, lines, host,
      goal: this.goalText(),
      onStart: () => {
        this.dialog = null; this.state = 'play';
        this.startRecording();
        const intro = lv.introSay || [host, 'intro'];
        g.voice.say(intro[0], intro[1]);
        if (lv.introText) setTimeout(() => { if (this.state === 'play' && !g.voice.isPlaying()) g.subtitle.show(lv.introText[0], lv.introText[1]); }, 2600);
      },
    });
  }

  goalText() {
    const lv = this.level;
    if (lv.type === 'find') return `找出 ${lv.spots.length} 处不合理`;
    if (lv.type === 'diff') return `找出上下两图的 ${lv.spots.length} 处不同`;
    return lv.goal || '帮她脱困';
  }

  get target() { return this.isFind ? this.level.spots.length : 0; }

  computeStars() {
    const S = GameConfig.stars;
    const ok = (t) => this.mistakes <= t.maxMistakes && this.adHints <= t.maxAdHints && this.revives <= (t.maxRevives ?? 99);
    if (ok(S.three)) return 3;
    if (ok(S.two)) return 2;
    return 1;
  }

  /** 找齐全部之后：有问答 (level.quiz) 先答题，答对正常通关，答错进沙雕结局 */
  complete() {
    const q = this.level.quiz;
    if (this.state !== 'play' && this.state !== 'clearing') return;
    if (!q || this.daily) { this.finish('win'); return; }
    const g = this.game;
    this.state = 'quiz'; this.hint = null; this.loupe = null;
    if (q.say) g.voice.say(q.say[0], q.say[1], { priority: 5 });
    this.dialog = new Dialog({
      title: q.title || '最后一题', lines: q.q.split('\n'), lineSize: 20,
      buttons: q.options.map((label, i) => ({ label, style: 'secondary', fontSize: 22, onClick: () => this.answerQuiz(i) })),
    }, g.audio);
  }

  answerQuiz(i) {
    const q = this.level.quiz; const ok = i === q.answer;
    this.dialog = null; this.state = 'ending';
    const e = ok ? q.right : q.wrong;
    if (e && e.text) this.game.subtitle.show(e.text[0], e.text[1]);
    this.game.events.emit(ok ? 'quiz:right' : 'quiz:wrong', {});
    if (!ok) this.fx.cross(GameConfig.width / 2, 460);
    this.finish(ok ? 'win' : 'silly');
  }

  /** 结算。'clearing' (最后一处找到后的庆祝) / 'ending' (解谜结局演出、答题后) 期间输入已锁定，也允许结算 */
  finish(kind) {
    if (!['play', 'clearing', 'ending'].includes(this.state)) return;
    this.state = 'end';
    const g = this.game; const lv = this.level; const silly = kind === 'silly';
    this.hint = null; this.loupe = null;
    const stars = silly ? 0 : this.computeStars();
    g.events.emit('level:win', { id: lv.id, silly, stars });
    let res = { unlockedLevel: null };
    if (silly) g.save.addAchievement(`silly_${lv.id}`);
    else if (this.daily) g.save.submitDaily(this.dailyKey, stars);
    else res = g.save.submit(lv.id, lv.index + 1, { win: true, stars, time: this.elapsed });
    if (this.eggFound) g.save.addAchievement(`egg_${lv.id}`);
    const host = lv.host || 'nuonuo';
    const ending = silly ? lv.silly || {} : lv.ending || {};
    setTimeout(() => {
      if (this.game.scenes.current !== this) return;
      const say = ending.say || (silly ? null : [host, 'win']);
      if (say) g.voice.say(say[0], say[1], { priority: 5 });
      const next = LEVELS[lv.index + 1];
      const buttons = [];
      if (silly) {
        if (lv.quiz && this.isFind) buttons.push({ label: '重新作答', onClick: () => { this.panel = null; this.state = 'clearing'; this.complete(); } });
        else buttons.push({ label: '重来，走正经结局', onClick: () => this.restart() });
        buttons.push({ label: '返回选关', style: 'secondary', onClick: () => g.scenes.change('levels') });
      } else {
        if (!this.daily && next) buttons.push({ label: '下一关', onClick: () => g.scenes.change('game', { levelId: next.id }) });
        buttons.push({ label: '再玩一次', style: 'secondary', onClick: () => this.restart() });
        buttons.push({ label: '返回选关', style: 'ghost', onClick: () => g.scenes.change('levels', { unlocked: res.unlockedLevel }) });
      }
      let shareBtnIdx = -1;
      const rec = this.recording ? Platform.recorder.stop() : null;
      this.recording = false;
      if (rec) {
        // 抖音审核要求：每局结算页都要有明显的「分享录屏」入口；录屏还在生成时先置灰
        shareBtnIdx = Math.min(1, buttons.length);
        buttons.splice(shareBtnIdx, 0, { label: '分享本局录屏', style: 'gold', onClick: () => this.shareVideo() });
      } else if (Platform.shareApp) {
        // 微信：没有录屏，结算页给一个普通的「分享给好友」(不发任何奖励，避免诱导分享)
        buttons.splice(Math.min(1, buttons.length), 0, { label: '分享给好友', style: 'gold', onClick: () => Platform.shareApp({ title: silly ? `我在「${lv.title}」解锁了沙雕结局！` : `「${lv.title}」${stars} 星通关，你能找全吗？` }) });
      }
      const lines = this.isFind ? this.foundOrder.map((id) => [...lv.spots, lv.egg].find((s) => s && s.id === id).name) : (ending.recap || []);
      this.panel = new ResultPanel(g, {
        kind: silly ? 'silly' : 'win', title: silly ? '沙雕结局！' : (this.daily ? '今日一图 完成！' : '通关！'), stars, time: this.elapsed,
        mistakes: this.mistakes, hints: this.adHints, hintsLabel: g.ads.enabled ? '看广告提示' : '精确提示', lines, host: ending.who || host, pose: ending.pose || (this.isFind ? 'broken' : 'smug'),
        quote: ending.quote || (silly ? '……这也算结局？' : '下次一定藏得更好！'), badge: ending.badge, buttons,
      });
      if (rec) {
        const btn = this.panel.buttons[shareBtnIdx]; const panel = this.panel;
        btn.enabled = false; btn.label = '录屏生成中…';
        rec.then((v) => {
          if (this.panel !== panel) return;
          this.video = v;
          if (v) { btn.enabled = true; btn.label = '分享本局录屏'; } else btn.label = '录屏太短，无法分享';
        });
      }
    }, silly ? 1600 : 1100);
  }

  fail() {
    if (this.state !== 'play' && this.state !== 'dying') return;
    this.state = 'fail';
    const g = this.game;
    g.events.emit('level:fail', { id: this.level.id });
    setTimeout(() => g.voice.say('zero7', 'lose', { priority: 5 }), 300);
    const timeout = this.timeLimit && this.elapsed >= this.timeLimit;
    // 统一广告策略：有广告位 → 看广告理智回满；没有 → 每关 1 次免费「再试一次」
    const ads = g.ads.enabled; const freeRetry = !ads && this.revives === 0;
    this.dialog = new Dialog({
      title: timeout ? '时间到！' : '理智值归零',
      lines: timeout ? ['今天的吐槽额度用完了'] : ['吐槽太多次空气，脑子转不动了', ads ? '看段广告冷静一下？' : freeRetry ? '深呼吸，再试一次？(每关 1 次)' : '这关的「再试一次」已经用过了'],
      buttons: [
        ...(timeout ? [] : ads ? [{ label: '看广告：理智回满', style: 'gold', onClick: () => this.revive() }]
          : freeRetry ? [{ label: '再试一次', style: 'gold', onClick: () => this.retryOnce() }] : []),
        { label: '重新开始', onClick: () => this.restart() },
        { label: '返回选关', style: 'ghost', onClick: () => g.scenes.change('levels') },
      ],
    }, g.audio);
  }

  revive() {
    this.showAd('revive').then((ok) => { if (ok) this.restoreSanity(); });
  }

  /** 没有广告位时：每关 1 次免费「再试一次」(计入 revives → 最多 2 星) */
  retryOnce() {
    if (this.revives > 0 || this.state !== 'fail') return;
    this.restoreSanity();
  }

  restoreSanity() {
    this.dialog = null;
    this.sanity = this.sanityMax; this.state = 'play'; this.revives++;
    this.game.voice.say('zero7', 'revive', { priority: 5 });
    this.fx.float('理智回满！', 270, 450, '#7cf0ff', 30);
  }

  restart() {
    this.game.scenes.change('game', { levelId: this.level.id, daily: this.daily, retry: true });
  }

  openPause() {
    if (this.state !== 'play') return;
    const g = this.game;
    this.state = 'pause';
    this.dialog = new Dialog({
      title: '暂停', lines: [`${this.level.title} · ${this.goalText()}`],
      buttons: [
        { label: '继续', onClick: () => { this.dialog = null; this.state = 'play'; } },
        { label: `围观弹幕：${g.save.get('barrage', true) ? '开' : '关'}`, style: 'secondary', onClick: () => {
          g.save.set('barrage', !g.save.get('barrage', true)); this.barrage.crowdOn = g.save.get('barrage', true);
          this.dialog = null; this.state = 'play'; this.openPause();
        } },
        { label: '重新开始', style: 'secondary', onClick: () => this.restart() },
        { label: '返回选关', style: 'ghost', onClick: () => g.scenes.change('levels') },
      ],
    }, g.audio);
  }

  openSettings() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.panel = new SettingsPanel(this.game, () => { this.panel = null; this.state = 'play'; });
  }

  showAd(placement) {
    return this.game.ads.showRewardedAd(placement);
  }

  // ———————————————————— 提示 ————————————————————
  useHint() {
    if (this.state !== 'play') return;
    const g = this.game;
    if (this.hint) { this.hint.t = Math.min(this.hint.t, 0.3); g.subtitle.show('zero7', '提示还亮着呢，看圈里。', 1.6); return; }
    if (this.freeHints > 0) {
      this.freeHints--;
      if (this.freeHints === 0) this.freeCd = GameConfig.hint.freeCooldown;
      this.giveHint(false); return;
    }
    // 侧边栏复访送的提示券：直接给精确提示，不用看广告 / 不用等冷却
    const tickets = g.save.get('hintTickets', 0);
    if (tickets > 0) {
      g.save.set('hintTickets', tickets - 1); this.ticketHints++;
      this.fx.float(`提示券 -1 (剩 ${tickets - 1})`, GameConfig.width - 78, 820, '#8a6cff', 16);
      this.giveHint(true); return;
    }
    if (!g.ads.enabled) {
      // 没有广告位：免费精确提示 + 冷却 (照样计入 adHints → 最多 2 星)
      if (this.exactCd > 0) { g.subtitle.show('zero7', `精确提示冷却中，还要 ${Math.ceil(this.exactCd)} 秒。`, 1.8); return; }
      this.exactCd = GameConfig.hint.noAdExactCooldown; this.adHints++;
      g.voice.say('shezhang', 'approve');
      this.giveHint(true); return;
    }
    g.voice.say('shezhang', 'ad');
    this.state = 'pause';
    this.showAd('hint').then((ok) => {
      this.state = 'play';
      if (ok) { this.adHints++; this.giveHint(true); }
    });
  }

  /** exact=false：零七的「划重点」只圈出一大块区域；exact=true：直接高亮那一处 */
  giveHint(exact) {
    const g = this.game; const H = GameConfig.hint;
    if (this.isFind) {
      const rest = this.level.spots.filter((s) => !this.found.has(s.id));
      if (!rest.length) return;
      // 优先提示非刁钻点 (最后才提示刁钻点)
      const easy = rest.filter((s) => !s.tricky);
      const s = pick(easy.length ? easy : rest);
      const [cx, cy] = centerOf(s); const r = radiusOf(s, this.aspect);
      if (exact) this.hint = { c: [cx, cy], r: r * 1.15, t: 0, max: H.exactTime, exact: true, id: s.id };
      else {
        const R = Math.max(0.14, r * H.areaScale);
        const a = Math.random() * Math.PI * 2; const off = (R - r) * 0.55;
        const hx = Math.min(1 - R * 0.6, Math.max(R * 0.6, cx + Math.cos(a) * off));
        const hy = Math.min(1 - R * 0.6 / this.aspect, Math.max(R * 0.6 / this.aspect, cy + Math.sin(a) * off / this.aspect));
        this.hint = { c: [hx, hy], r: R, t: 0, max: H.areaTime, exact: false, id: s.id };
      }
      g.voice.say('zero7', 'hint');
    } else {
      const h = this.puzzle.hint();
      if (!h) return;
      const z = h.zone && this.puzzle.zone(h.zone);
      if (z && exact) { const [cx, cy] = centerOf(z); this.hint = { c: [cx, cy], r: radiusOf(z, this.aspect) * 1.1, t: 0, max: H.exactTime, exact: true }; }
      g.voice.say('zero7', 'hint');
      setTimeout(() => g.subtitle.show('zero7', exact ? (h.exact || h.text) : h.text, 3.6), g.voice.isPlaying() ? 1700 : 0);
      if (exact && h.item) this.flashItem = { id: h.item, t: 0 };
    }
    g.events.emit('hint:reveal', { exact });
  }

  // ———————————————————— 坐标换算 ————————————————————
  viewAt(p) { return this.views.find((v) => p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h) || null; }

  toScene(p, v) {
    const c = this.cam;
    return [((p.x - v.x) / v.w - 0.5) / c.z + c.cx, ((p.y - v.y) / v.h - 0.5) / c.z + c.cy];
  }

  toScreen(nx, ny, v = this.views[0]) {
    const c = this.cam;
    return [v.x + ((nx - c.cx) * c.z + 0.5) * v.w, v.y + ((ny - c.cy) * c.z + 0.5) * v.h];
  }

  clampCam() {
    const c = this.cam;
    c.z = Math.max(1, Math.min(GameConfig.zoom.max, c.z));
    const h = 0.5 / c.z;
    c.cx = Math.max(h, Math.min(1 - h, c.cx)); c.cy = Math.max(h, Math.min(1 - h, c.cy));
  }

  zoomAt(p, factor) {
    if (!this.isFind) return;
    const v = this.viewAt(p) || this.views[0];
    const before = this.toScene(p, v);
    this.cam.z *= factor; this.clampCam();
    const after = this.toScene(p, v);
    this.cam.cx += before[0] - after[0]; this.cam.cy += before[1] - after[1];
    this.clampCam();
  }

  toggleZoom() {
    const target = this.cam.z > 1.05 ? 1 : GameConfig.zoom.doubleTap;
    this.tweens.to(this.cam, { z: target }, { duration: 0.25, onUpdate: () => this.clampCam() });
  }

  onWheel(e) { if (this.state === 'play' && this.isFind && this.viewAt(e)) this.zoomAt(e, e.dy < 0 ? GameConfig.zoom.wheelStep : 1 / GameConfig.zoom.wheelStep); }
  onPinch(e) { if (this.state === 'play' && this.isFind) this.zoomAt({ x: e.cx, y: e.cy }, e.scale); }

  // ———————————————————— 输入 ————————————————————
  onPointerDown(p) {
    if (super.onPointerDown(p)) return true;
    if (this.state !== 'play' || this.panel || this.dialog) return false;
    this.idleTimer = 0;
    // 道具栏
    if (!this.isFind) {
      const slot = this.slotAt(p);
      if (slot >= 0 && this.puzzle.inv[slot]) {
        this.dragItem = { id: this.puzzle.inv[slot], slot, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
        return true;
      }
    }
    const v = this.viewAt(p);
    if (!v) return false;
    const [nx, ny] = this.toScene(p, v);
    this.gesture = { sx: p.x, sy: p.y, x: p.x, y: p.y, t: 0, v, nx, ny, moved: false, pan: false, held: false, cam: { ...this.cam } };
    if (!this.isFind) {
      // 手势优先落在可直接操作的区域上；道具接收区 (drop) 只在没有其他区域时用来给出提示
      const z = this.zoneAt(nx, ny, (zz) => zz.action !== 'drop' && zz.action !== 'target') || this.zoneAt(nx, ny);
      this.gesture.zone = z;
      if (z && z.action === 'drag') this.gesture.drag = true;
      if (z && z.action === 'hold') this.game.events.emit('prop:hold');
    }
    return true;
  }

  onPointerMove(p) {
    super.onPointerMove(p);
    if (this.dragItem) { Object.assign(this.dragItem, { x: p.x, y: p.y }); if (Math.hypot(p.x - this.dragItem.sx, p.y - this.dragItem.sy) > GameConfig.input.tapSlop) this.dragItem.moved = true; return; }
    const gs = this.gesture;
    if (!gs) return;
    gs.x = p.x; gs.y = p.y;
    const d = Math.hypot(p.x - gs.sx, p.y - gs.sy);
    if (d > GameConfig.input.tapSlop) gs.moved = true;
    if (this.loupe) { this.loupe.x = p.x; this.loupe.y = p.y; return; }
    if (this.isFind && gs.moved && this.cam.z > 1.01) {
      gs.pan = true;
      this.cam.cx = gs.cam.cx - (p.x - gs.sx) / gs.v.w / this.cam.z;
      this.cam.cy = gs.cam.cy - (p.y - gs.sy) / gs.v.h / this.cam.z;
      this.clampCam();
    }
  }

  onPointerCancel(p) { super.onPointerCancel(p); this.gesture = null; this.dragItem = null; this.loupe = null; }

  onPointerUp(p) {
    if (super.onPointerUp(p)) return true;
    if (this.dragItem) { const d = this.dragItem; this.dragItem = null; if (this.state === 'play') this.releaseItem(d, p); return true; }
    const gs = this.gesture; this.gesture = null;
    if (!gs || this.state !== 'play') { this.loupe = null; return false; }
    if (this.loupe) {
      // 放大镜松手：手指下面正好是破绽就算找到；没对准不扣分 (放大镜是用来看的)
      this.loupe = null;
      const [lx, ly] = this.toScene(p, gs.v);
      const hit = this.level.spots.find((s) => !this.found.has(s.id) && contains(s, lx, ly, this.aspect, 0.004));
      if (hit) this.foundSpot(hit, p);
      return true;
    }
    if (gs.pan) return true;
    const v = gs.v;
    const [nx, ny] = this.toScene(p, v);
    if (this.isFind) {
      if (!gs.moved) this.tapFind(nx, ny, p);
      return true;
    }
    // 解谜关
    if (gs.held) return true;
    if (gs.drag && gs.moved) {
      const ids = gs.zone.targets ? Object.keys(gs.zone.targets) : [gs.zone.to];
      const target = this.zoneAt(nx, ny, (z) => ids.includes(z.id) && z.id !== gs.zone.id);
      if (target) this.doAct(gs.zone, 'drag', p, { to: target.id });
      else { this.game.events.emit('prop:deny'); if (gs.zone.dragMiss) this.game.subtitle.show(...gs.zone.dragMiss); }
      return true;
    }
    const dx = p.x - gs.sx; const dy = p.y - gs.sy;
    if (Math.hypot(dx, dy) >= GameConfig.input.swipeMin) {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const z = gs.zone || this.zoneAt(nx, ny);
      if (z && z.action === 'swipe' && (!z.dir || z.dir === dir)) this.doAct(z, 'swipe', p);
      else if (z) this.teach(z, p);
      return true;
    }
    if (!gs.moved) {
      const z = gs.zone;
      if (z && z.action === 'tap') this.doAct(z, 'tap', p);
      else if (z) this.teach(z, p);
      else this.fx.ping(p.x, p.y, 'rgba(255,255,255,0.8)');
    }
    return true;
  }

  onKeyDown(e) {
    if (e.code === 'Escape') { if (this.panel && this.panel.onClose) this.panel.onClose(); else if (this.state === 'play') this.openPause(); }
    if (e.code === 'KeyH' && this.state === 'play') this.useHint();
  }

  // ———————————————————— 找不合理 / 找不同 ————————————————————
  tapFind(nx, ny, p) {
    const lv = this.level; const g = this.game;
    const pad = 0.012;
    const cand = lv.spots.filter((s) => !this.found.has(s.id) && contains(s, nx, ny, this.aspect, pad));
    if (lv.egg && !this.eggFound && contains(lv.egg, nx, ny, this.aspect, pad * 0.5) && !cand.length) { this.findEgg(p); return; }
    if (cand.length) {
      cand.sort((a, b) => signedDist(a, nx, ny, this.aspect) - signedDist(b, nx, ny, this.aspect));
      this.foundSpot(cand[0], p);
      return;
    }
    // 点到已经找到的地方 (包括彩蛋)：不扣分
    if (lv.egg && this.eggFound && contains(lv.egg, nx, ny, this.aspect, pad)) { this.fx.ping(p.x, p.y, '#9ff0ff'); return; }
    if (lv.spots.some((s) => this.found.has(s.id) && contains(s, nx, ny, this.aspect, pad))) { this.fx.ping(p.x, p.y, '#ffd34d'); return; }
    // 点错：连点保护 (0.35 秒内的重复误触只算一次)
    if (this.elapsed - this.lastWrongAt < 0.35) return;
    this.lastWrongAt = this.elapsed;
    this.mistakes++;
    this.sanity--;
    this.fx.cross(p.x, p.y);
    g.events.emit('find:wrong', {});
    if (Math.random() < 0.35) this.barrage.add(pick(BARRAGE.wrong));
    const host = lv.host || 'nuonuo';
    const opts = [[host, 'gloat'], [host, 'wrong'], ['zero7', 'wrong']].filter(([w, k]) => g.voice.pools.has(`${w}_${k}`));
    const o = Math.random() < 0.6 ? opts[0] : pick(opts);
    g.voice.say(o[0], o[1]);
    this.react = -1.2;
    if (this.sanity <= 0) { this.state = 'dying'; this.gesture = null; this.loupe = null; setTimeout(() => this.fail(), 500); }
  }

  foundSpot(s, p) {
    const g = this.game; const lv = this.level;
    this.found.add(s.id); this.foundOrder.push(s.id);
    const last = this.found.size >= this.target;
    g.events.emit('find:correct', { id: s.id, last, tricky: !!s.tricky });
    if (s.tricky || last) this.highlight();
    const [cx, cy] = centerOf(s);
    for (const v of this.views) { const [sx, sy] = this.toScreen(cx, cy, v); this.fx.burst(sx, sy, { n: last ? 26 : 14 }); }
    this.marks = this.marks || {};
    this.marks[s.id] = { t: 0 };
    this.barrage.add(s.barrage, { big: true, color: '#fff27a', self: true });
    if (s.tricky) this.barrage.add(pick(BARRAGE.tricky));
    else if (last) this.barrage.add(pick(BARRAGE.last));
    const crowd = Math.random() < 0.5 ? 1 + (Math.random() < 0.25 ? 1 : 0) : 0;
    for (let i = 0; i < crowd; i++) setTimeout(() => this.barrage.add(pick(BARRAGE.crowd)), 250 + i * 380);
    if (this.hint && this.hint.id === s.id) this.hint = null;
    this.fx.float(`${this.found.size} / ${this.target}`, p.x, p.y - 20, '#fff', 22);
    const host = lv.host || 'nuonuo';
    const ratio = this.found.size / this.target;
    if (s.say) g.voice.say(s.say[0], s.say[1], { priority: 3 });
    else if (!last) g.voice.say(host, ratio >= 0.6 && g.voice.pools.has(`${host}_broken`) ? 'broken' : 'found');
    this.react = 1.4;
    if (last) {
      // 庆祝期间锁输入：不会再误触扣分，也不会被暂停卡住
      this.state = 'clearing'; this.hint = null; this.loupe = null; this.gesture = null;
      setTimeout(() => this.complete(), 900);
    }
  }

  findEgg(p) {
    const g = this.game; const e = this.level.egg;
    this.eggFound = true;
    this.highlight();
    this.fx.burst(p.x, p.y, { n: 22, colors: ['#ffffff', '#fff27a', '#9ff0ff'] });
    this.fx.float('隐藏彩蛋！', p.x, p.y - 24, '#fff27a', 24);
    this.barrage.add(e.barrage || pick(BARRAGE.egg), { big: true, color: '#9ff0ff', self: true });
    this.barrage.add(pick(BARRAGE.egg));
    g.events.emit('find:correct', { id: e.id, egg: true, last: false });
    this.foundOrder.push(e.id);
  }

  // ———————————————————— 解谜 ————————————————————
  zoneAt(nx, ny, filter = ANY) {
    if (!this.puzzle) return null;
    const zs = this.puzzle.activeZones().filter((z) => shapeOf(z) && filter(z) && contains(z, nx, ny, this.aspect, 0.01) && (z.action !== 'target' || filter !== ANY));
    if (!zs.length) return null;
    zs.sort((a, b) => (b.z || 0) - (a.z || 0) || signedDist(a, nx, ny, this.aspect) - signedDist(b, nx, ny, this.aspect));
    return zs[0];
  }

  /** 动作做错 (比如该长按的点了一下)：提示，不扣分 */
  teach(z, p) {
    const g = this.game;
    this.fx.ping(p.x, p.y, '#ffffff');
    if (z.teach) { g.subtitle.show(...z.teach); return; }
    const T = { hold: '好像要按住不放？', swipe: '试试用手指划一下？', drop: '这里大概要用个道具…', drag: '这个能拖动？' };
    if (T[z.action]) g.subtitle.show('zero7', T[z.action], 2.2);
  }

  doAct(z, action, p, extra) {
    const r = this.puzzle.act(z.id, action, extra);
    if (!r.ok) return;
    const ev = action === 'swipe' ? 'prop:swipe' : (z.effect && z.effect.give ? 'prop:pick' : 'prop:use');
    this.game.events.emit(ev);
    this.applyEffects(r.effects, p, z);
  }

  slotRect(i) { const c = i % SLOT.cols; const r = Math.floor(i / SLOT.cols); return { x: SLOT.x0 + c * (SLOT.size + SLOT.gap), y: SLOT.rows[r] - SLOT.size / 2, w: SLOT.size, h: SLOT.size }; }
  slotAt(p) {
    if (!this.puzzle) return -1;
    for (let i = 0; i < SLOT.n; i++) { const r = this.slotRect(i); if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i; }
    return -1;
  }

  releaseItem(d, p) {
    const g = this.game;
    if (!d.moved) { this.selected = this.selected === d.id ? null : d.id; this.fx.float(ITEMS[d.id] ? ITEMS[d.id].name : d.id, d.sx, d.sy - 52, '#fff', 17); g.audio.play('tick'); return; }
    const slot = this.slotAt(p);
    if (slot >= 0 && slot !== d.slot && this.puzzle.inv[slot]) {
      const r = this.puzzle.combine(d.id, this.puzzle.inv[slot]);
      if (r.ok) {
        g.events.emit('prop:combine');
        const rc = this.slotRect(Math.max(0, this.puzzle.inv.indexOf(r.combine.result)));
        this.fx.burst(rc.x + rc.w / 2, rc.y + rc.h / 2, { n: 16 });
        this.fx.float(`获得：${ITEMS[r.combine.result].name}`, 270, 820, '#fff27a', 20);
        this.applyEffects(r.effects, p);
      } else { g.events.emit('prop:deny'); g.subtitle.show('zero7', '这俩凑不到一块。', 1.8); }
      return;
    }
    const v = this.viewAt(p);
    if (!v) return;
    const [nx, ny] = this.toScene(p, v);
    const z = this.zoneAt(nx, ny, (zz) => zz.action === 'drop') || this.zoneAt(nx, ny);
    if (!z) { g.events.emit('prop:deny'); return; }
    if (z.action !== 'drop') { this.teach(z, p); return; }
    const r = this.puzzle.drop(z.id, d.id);
    if (r.ok) { g.events.emit('prop:use'); this.applyEffects(r.effects, p, z); return; }
    // 用错道具：扣理智 (除非这个区域自己定义了 deny 效果)
    g.events.emit('prop:deny');
    if (r.effects && r.effects.length) this.applyEffects(r.effects, p, z);
    else this.penalize(p, z.denyText || ['zero7', `${ITEMS[d.id] ? ITEMS[d.id].name : '这个'}？不是这么用的。`]);
  }

  penalize(p, text) {
    const g = this.game;
    this.mistakes++; this.sanity--;
    this.fx.cross(p.x, p.y);
    g.events.emit('find:wrong', {});
    if (text) g.subtitle.show(text[0], text[1], 2.4);
    else g.voice.say('zero7', 'wrong');
    if (this.sanity <= 0 && this.state === 'play') { this.state = 'dying'; this.gesture = null; this.dragItem = null; setTimeout(() => this.fail(), 600); }
  }

  applyEffects(effects, p, z) {
    const g = this.game;
    let delay = 0;
    for (const e of effects) {
      if (e.give) for (const it of e.give) {
        const slot = this.puzzle.inv.lastIndexOf(it);
        const rc = this.slotRect(Math.max(0, slot));
        this.flyers.push({ item: it, x0: p.x, y0: p.y, x1: rc.x + rc.w / 2, y1: rc.y + rc.h / 2, t: 0, max: 0.5 });
      }
      if (e.say) g.voice.say(e.say[0], e.say[1], { priority: e.sayPriority || 4 });
      if (e.text) { const tx = e.text; setTimeout(() => { if (this.game.scenes.current === this) g.subtitle.show(tx[0], tx[1], tx[2]); }, (e.say ? 1900 : 0) + delay); delay += 200; }
      if (e.barrage) [].concat(e.barrage).forEach((b, i) => setTimeout(() => this.barrage.add(b, { big: i === 0, self: i === 0, color: i === 0 ? '#fff27a' : undefined }), i * 350));
      if (e.penalty) this.penalize(p, null);
      if (e.shake) this.fx.shake = e.shake;
      if (e.burst !== false && (e.set || e.give)) this.fx.burst(p.x, p.y, { n: 10 });
      if (e.fly) this.wordFly(e.fly, p);
      if (e.float) this.fx.float(e.float, p.x, p.y - 30, '#fff27a', 22);
      if (e.end) {
        // 结局演出期间锁输入 (不再扣分、不能暂停卡死)
        this.highlight();
        const k = e.end; this.state = 'ending'; this.gesture = null; this.dragItem = null; this.hint = null;
        setTimeout(() => this.finish(k === 'silly' ? 'silly' : 'win'), e.endDelay ?? 1300);
      }
    }
  }

  wordFly(f, p) {
    // 拼字：文字从点击位置飞到目标槽位
    this.flyers.push({ glyph: f.glyph, x0: p.x, y0: p.y, x1: f.to ? f.to[0] : 270, y1: f.to ? f.to[1] : 160, t: 0, max: 0.6 });
  }

  // ———————————————————— 更新 ————————————————————
  update(dt) {
    super.update(dt);
    const g = this.game;
    g.subtitle.update(dt);
    this.barrage.update(dt); this.fx.update(dt); this.tweens.update(dt);
    if (this.panel) this.panel.update(dt);
    if (this.dialog) this.dialog.update(dt);
    for (const f of this.flyers) f.t += dt;
    this.flyers = this.flyers.filter((f) => f.t < f.max);
    if (this.marks) for (const k in this.marks) this.marks[k].t += dt;
    if (this.hint) { this.hint.t += dt; if (this.hint.t > this.hint.max) this.hint = null; }
    this.react *= Math.pow(0.1, dt);
    if (this.flashItem) { this.flashItem.t += dt; if (this.flashItem.t > 3) this.flashItem = null; }
    if (this.state !== 'play') return;
    this.elapsed += dt;
    if (this.freeHints <= 0 && this.freeCd > 0) {
      this.freeCd -= dt;
      if (this.freeCd <= 0) { this.freeCd = 0; this.freeHints = 1; this.fx.float('免费提示 +1', GameConfig.width - 78, 820, '#38c7a0', 18); }
    }
    if (this.exactCd > 0) this.exactCd = Math.max(0, this.exactCd - dt);
    if (this.timeLimit && this.elapsed >= this.timeLimit) { this.fail(); return; }
    // 长按：找茬关 = 放大镜；解谜关 = 长按交互
    const gs = this.gesture;
    if (gs && !gs.moved) {
      gs.t += dt;
      if (this.isFind && !this.loupe && gs.t >= GameConfig.zoom.holdTime) this.loupe = { x: gs.x, y: gs.y, v: gs.v };
      if (!this.isFind && gs.zone && gs.zone.action === 'hold' && !gs.held && gs.t >= (gs.zone.holdTime || GameConfig.input.holdTime)) {
        gs.held = true;
        this.doAct(gs.zone, 'hold', { x: gs.x, y: gs.y });
      }
    }
    // 闲聊：一段时间没操作
    this.idleTimer += dt;
    if (this.idleTimer > 16) { this.idleTimer = 0; g.voice.say(this.level.host || 'nuonuo', 'idle'); }
  }

  // ———————————————————— 绘制 ————————————————————
  render(ctx) {
    const g = this.game; const W = GameConfig.width; const H = GameConfig.height; const C = GameConfig.colors;
    const dt = 1 / 60;
    drawBackground(ctx, W, H, this.time);
    const [ox, oy] = this.fx.offset;
    ctx.save(); ctx.translate(ox, oy);
    for (const v of this.views) this.renderView(ctx, v);
    ctx.restore();
    if (this.loupe) this.renderLoupe(ctx);
    if (this.type === 'diff') {
      drawText(ctx, '上图', 22, L.diff.a.y + 16, { size: 13, color: '#fff', stroke: 'rgba(60,30,70,0.6)', strokeWidth: 4, align: 'left' });
      drawText(ctx, '下图', 22, L.diff.b.y + 16, { size: 13, color: '#fff', stroke: 'rgba(60,30,70,0.6)', strokeWidth: 4, align: 'left' });
    }
    this.barrage.render(ctx);
    this.renderHUD(ctx, dt);
    this.renderBottom(ctx, dt);
    this.fx.render(ctx);
    for (const f of this.flyers) {
      const k = f.t / f.max; const e = 1 - Math.pow(1 - k, 3);
      const x = f.x0 + (f.x1 - f.x0) * e; const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 60;
      if (f.item) this.drawItem(ctx, f.item, x, y, 44);
      if (f.glyph) drawText(ctx, f.glyph, x, y, { size: 40, color: '#fff', stroke: '#e0466d', strokeWidth: 6 });
    }
    if (this.dragItem && this.dragItem.moved) this.drawItem(ctx, this.dragItem.id, this.dragItem.x, this.dragItem.y - 10, 58, 0.9);
    if (this.gesture && this.gesture.drag && this.gesture.moved && this.gesture.zone.ghost) {
      ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(this.gesture.x, this.gesture.y);
      const gh = this.gesture.zone.ghost; ART[gh.a](ctx, gh, this.sceneState(this.views[0])); ctx.restore();
    }
    this.renderHoldRing(ctx);
    g.subtitle.render(ctx, this.isFind ? GameConfig.layout.subtitleDiffY : undefined);   // 找茬关字幕放到底栏上沿，不挡画面里的破绽   // 找不同关下图占满场景，字幕挪到底栏上沿，避免挡住热区
    if (this.dialog) this.dialog.render(ctx, dt);
    if (this.panel) this.panel.render(ctx, dt);
  }

  sceneState(v) {
    return { w: v.w, h: v.h, t: this.time, img: (k) => this.game.assets.getImage(k), flags: this.puzzle ? this.puzzle.flags : new Set(), found: this.found, variant: v.variant };
  }

  renderView(ctx, v) {
    const c = this.cam;
    ctx.save();
    roundRectPath(ctx, v.x, v.y, v.w, v.h, 0); ctx.clip();
    ctx.translate(v.x + v.w / 2, v.y + v.h / 2); ctx.scale(c.z, c.z); ctx.translate(-c.cx * v.w, -c.cy * v.h);
    const S = this.sceneState(v);
    renderScene(ctx, this.level.layers, S);
    // 已找到的红圈 (手绘感：两圈略微错开)
    if (this.isFind) {
      for (const s of this.level.spots) {
        if (!this.found.has(s.id)) continue;
        const m = this.marks && this.marks[s.id];
        const k = m ? Math.min(1, m.t / 0.35) : 1;
        this.drawMark(ctx, s, v, k, GameConfig.colors.mark);
      }
      if (this.eggFound && this.level.egg) this.drawMark(ctx, this.level.egg, v, 1, '#38c7ff');
    }
    if (this.hint) this.drawHint(ctx, v);
    ctx.restore();
    // 视口边框
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
    ctx.strokeRect(v.x + 1.5, v.y + 1.5, v.w - 3, v.h - 3);
    ctx.restore();
  }

  drawMark(ctx, s, v, k, color) {
    const [cx, cy] = centerOf(s);
    const sh = shapeOf(s);
    let rx; let ry;
    if (sh.kind === 'circle') { rx = s.r * v.w; ry = rx; } else {
      const xs = sh.pts.map((q) => q[0]); const ys = sh.pts.map((q) => q[1]);
      rx = (Math.max(...xs) - Math.min(...xs)) * v.w / 2; ry = (Math.max(...ys) - Math.min(...ys)) * v.h / 2;
    }
    rx = Math.max(18, rx * 0.95); ry = Math.max(18, ry * 0.95);
    const x = cx * v.w; const y = cy * v.h;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 4 / this.cam.z * 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(x, y, rx + 1, ry + 1, -0.08, -1.6, -1.6 + Math.PI * 2.1 * k); ctx.stroke();
    ctx.lineWidth = 3.2 / this.cam.z * 1.2; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.08, -1.6, -1.6 + Math.PI * 2.1 * k); ctx.stroke();
    ctx.restore();
  }

  drawHint(ctx, v) {
    const h = this.hint;
    const x = h.c[0] * v.w; const y = h.c[1] * v.h; const r = h.r * v.w;
    const fade = Math.min(1, h.t / 0.3, (h.max - h.t) / 0.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    if (h.exact) {
      const pulse = 1 + 0.08 * Math.sin(h.t * 8);
      ctx.lineWidth = 4; ctx.strokeStyle = '#ffe14d'; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -h.t * 40;
      ctx.beginPath(); ctx.arc(x, y, r * pulse + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,225,77,0.18)'; ctx.fill();
    } else {
      // 区域提示：周围压暗，留出一个圆
      ctx.fillStyle = 'rgba(40,20,60,0.35)';
      ctx.beginPath(); ctx.rect(-v.w, -v.h, v.w * 3, v.h * 3); ctx.arc(x, y, r, 0, Math.PI * 2, true); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(124,240,255,0.95)'; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -h.t * 30;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  renderLoupe(ctx) {
    const lp = this.loupe; const Z = GameConfig.zoom; const R = Z.loupeRadius;
    const v = lp.v; const cx = lp.x; const cy = lp.y - R - 26;
    const [nx, ny] = this.toScene(lp, v);
    const z = this.cam.z * Z.loupe;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.save(); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-nx * v.w, -ny * v.h);
    renderScene(ctx, this.level.layers, this.sceneState(v));
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = GameConfig.colors.primary; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.strokeStyle = 'rgba(255,60,90,0.7)'; ctx.stroke();
    ctx.restore();
  }

  renderHoldRing(ctx) {
    const gs = this.gesture;
    if (!gs || this.isFind || !gs.zone || gs.zone.action !== 'hold' || gs.moved || gs.held) return;
    const k = Math.min(1, gs.t / (gs.zone.holdTime || GameConfig.input.holdTime));
    ctx.save();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(gs.x, gs.y, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = GameConfig.colors.primary;
    ctx.beginPath(); ctx.arc(gs.x, gs.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    ctx.restore();
  }

  renderHUD(ctx, dt) {
    const W = GameConfig.width; const C = GameConfig.colors; const lv = this.level;
    const g = ctx.createLinearGradient(0, 0, 0, 92);
    g.addColorStop(0, 'rgba(255,255,255,0.92)'); g.addColorStop(1, 'rgba(255,240,247,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 94);
    drawText(ctx, this.daily ? '每日一图' : `第 ${lv.index + 1} 关`, W / 2, 24, { size: 14, color: '#a08bb4' });
    drawText(ctx, lv.title, W / 2, 50, { size: 25, color: C.text });
    // 进度 / 目标
    const sub = this.isFind ? `已找到 ${this.found.size} / ${this.target}` : (lv.goal || '');
    drawText(ctx, sub, W / 2, 77, { size: 14, color: C.primaryDark });
    if (this.timeLimit) {
      const left = Math.max(0, this.timeLimit - this.elapsed);
      drawText(ctx, `${Math.ceil(left)}s`, W - 92, 46, { size: 18, color: left < 15 ? C.danger : C.text });
    }
    this.backBtn.render(ctx, dt); this.gearBtn.render(ctx, dt);
  }

  renderBottom(ctx, dt) {
    const W = GameConfig.width; const C = GameConfig.colors; const lv = this.level; const y0 = L.bottomY;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    roundRectPath(ctx, 0, y0, W, GameConfig.height - y0 + 20, 0); ctx.fill();
    ctx.restore();
    // 角色反应 (找茬关：嘴硬 → 心虚 → 破防)
    const host = lv.host || 'nuonuo';
    let pose = 'idle';
    if (this.isFind) {
      const ratio = this.found.size / Math.max(1, this.target);
      pose = this.react < -0.2 ? 'smug' : ratio >= 0.75 ? 'broken' : ratio >= 0.35 || this.react > 0.3 ? 'panic' : 'smug';
    } else pose = this.react < -0.2 ? 'smug' : 'idle';
    const bob = Math.sin(this.time * 3) * 1.5 + (this.react > 0.2 ? Math.sin(this.time * 30) * this.react * 2 : 0);
    drawFace(ctx, this.game, host, 60, 862 + bob, 42, pose);
    // 理智
    for (let i = 0; i < this.sanityMax; i++) {
      ctx.fillStyle = i < this.sanity ? '#ff5d8a' : '#e6dbee';
      drawHeart(ctx, 60 + (i - (this.sanityMax - 1) / 2) * 24, 932, 9);
    }
    if (this.isFind) {
      // 破绽进度点
      const n = this.target; const per = Math.min(20, 180 / n);
      for (let i = 0; i < n; i++) {
        const x = 132 + i * per; const on = i < this.found.size;
        ctx.beginPath(); ctx.arc(x, 868, Math.min(8, per * 0.38), 0, Math.PI * 2);
        ctx.fillStyle = on ? C.mark : '#eadff2'; ctx.fill();
      }
      drawText(ctx, '理智 (点错扣 1)', 124, 836, { size: 13, color: '#a08bb4', align: 'left' });
      drawText(ctx, this.eggFound ? '隐藏彩蛋 ✓' : (Platform.features.wheel ? '长按放大镜 · 滚轮/双指缩放' : '长按放大镜 · 双指缩放'), 124, 904, { size: 12, color: '#b4a2c4', align: 'left', weight: 'normal' });
      this.zoomBtn.render(ctx, dt);
    } else {
      // 道具栏
      for (let i = 0; i < SLOT.n; i++) {
        const r = this.slotRect(i);
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = '#f6eefa'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#e4d3ee'; ctx.stroke();
        const it = this.puzzle.inv[i];
        if (it && !(this.dragItem && this.dragItem.moved && this.dragItem.slot === i)) {
          if (this.flashItem && this.flashItem.id === it) {
            ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.flashItem.t * 10);
            roundRectPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 14); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe14d'; ctx.stroke(); ctx.restore();
          }
          this.drawItem(ctx, it, r.x + r.w / 2, r.y + r.h / 2, 46);
        }
      }
      drawText(ctx, this.puzzle.inv.length ? '拖道具到画面上使用 · 叠在一起可组合' : '点、长按、拖、划——都试试', 120, 946, { size: 11, color: '#b4a2c4', align: 'left', weight: 'normal' });
    }
    // 提示按钮
    const b = this.hintBtn;
    b.render(ctx, dt);
    ctx.save(); ctx.translate(b.x, b.y);
    drawBulb(ctx, 0, -14, 15);
    drawText(ctx, '提示', 0, 18, { size: 20, color: '#fff', stroke: '#c77700', strokeWidth: 4 });
    const free = this.freeHints > 0;
    const tickets = free ? 0 : this.game.save.get('hintTickets', 0);
    const ads = this.game.ads.enabled;
    // 角标：免费 (区域提示) > 提示券 > ▶广告 (有广告位) / 精确 (没广告位，免费精确提示) / 冷却中
    const exactReady = !ads && this.exactCd <= 0;
    const badge = free ? '免费' : tickets > 0 ? `券×${Math.min(tickets, 99)}` : ads ? '▶广告' : exactReady ? '精确' : '冷却';
    roundRectPath(ctx, 22, -50, 56, 24, 12);
    ctx.fillStyle = free ? '#38c7a0' : tickets > 0 ? '#8a6cff' : ads ? '#ff5d7a' : exactReady ? '#ff8a3d' : '#9a8aa8'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    drawText(ctx, badge, 50, -38, { size: 12, color: '#fff' });
    // 冷却倒计时 (v1.2：在按钮正下方，两行字幕最低到 y≈861，这里在 y≈940，不会被盖住)
    let cd = null;
    if (!free && this.freeCd > 0) cd = { t: this.freeCd, label: '免费', color: 'rgba(56,199,160,0.95)' };
    if (!free && !ads && tickets <= 0 && this.exactCd > 0 && (!cd || this.exactCd < cd.t)) cd = { t: this.exactCd, label: '精确', color: 'rgba(255,138,61,0.95)' };
    if (cd) {
      roundRectPath(ctx, -40, 50, 80, 20, 10); ctx.fillStyle = cd.color; ctx.fill();
      drawText(ctx, `${cd.label} ${Math.ceil(cd.t)}s`, 0, 60.5, { size: 12, color: '#fff' });
    }
    ctx.restore();
  }

  drawItem(ctx, id, x, y, size, alpha = 1) {
    const it = ITEMS[id];
    if (!it || !ART[it.icon]) { drawText(ctx, it ? it.name[0] : '?', x, y, { size: size * 0.5, color: GameConfig.colors.text }); return; }
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
    const k = size / 60; ctx.scale(it.flip ? -k : k, k);
    ART[it.icon](ctx, it, { t: this.time, img: (key) => this.game.assets.getImage(key) });
    ctx.restore();
  }
}

function drawBulb(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#fff8c9'; ctx.strokeStyle = '#c77700'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(x + r * 0.45, y + r * 1.05); ctx.lineTo(x - r * 0.45, y + r * 1.05); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c77700'; ctx.fillRect(x - r * 0.45, y + r * 1.1, r * 0.9, r * 0.35);
  ctx.restore();
}

function zoomIcon(isZoomed) {
  return (ctx, s) => {
    ctx.save();
    ctx.strokeStyle = GameConfig.colors.primaryDark; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-s * 0.06, -s * 0.06, s * 0.24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.12); ctx.lineTo(s * 0.3, s * 0.3); ctx.stroke();
    ctx.lineWidth = s * 0.07;
    ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.06); ctx.lineTo(s * 0.04, -s * 0.06);
    if (!isZoomed()) { ctx.moveTo(-s * 0.06, -s * 0.16); ctx.lineTo(-s * 0.06, s * 0.04); }
    ctx.stroke();
    ctx.restore();
  };
}

/** 开场卡片：关卡名 + 玩法目标 + 一句简介 */
class IntroCard {
  constructor(game, o) {
    this.game = game; this.o = o; this.t = 0;
    const W = GameConfig.width;
    this.btn = new Button({ x: W / 2, y: 650, w: 260, h: 64, label: '开始', fontSize: 28, onClick: () => o.onStart() });
    this.btn.audio = game.audio;
    this.buttons = [this.btn];
  }

  update(dt) { this.t += dt; }

  render(ctx, dt) {
    const o = this.o; const W = GameConfig.width; const C = GameConfig.colors;
    const e = 1 - Math.pow(1 - Math.min(1, this.t / 0.3), 3);
    ctx.save();
    ctx.fillStyle = `rgba(60,25,70,${0.45 * e})`; ctx.fillRect(0, 0, W, GameConfig.height);
    ctx.globalAlpha = e; ctx.translate(0, (1 - e) * 30);
    drawPanel(ctx, 50, 300, W - 100, 400, 28, '#fff9fc');
    roundRectPath(ctx, W / 2 - 70, 284, 140, 34, 17); ctx.fillStyle = C.primary; ctx.fill();
    drawText(ctx, o.no, W / 2, 301, { size: 17, color: '#fff' });
    drawText(ctx, o.title, W / 2, 366, { size: 34, color: C.text, stroke: '#fff', strokeWidth: 6 });
    drawText(ctx, o.tag || '', W / 2, 402, { size: 15, color: '#a08bb4' });
    roundRectPath(ctx, 90, 424, W - 180, 44, 22); ctx.fillStyle = '#ffeef5'; ctx.fill();
    drawText(ctx, `目标：${o.goal}`, W / 2, 446, { size: 19, color: C.primaryDark });
    let y = 500;
    for (const line of o.lines) {
      for (const part of wrap(ctx, line, W - 170, 16)) { drawText(ctx, part, W / 2, y, { size: 16, color: C.text, weight: 'normal' }); y += 26; }
    }
    ctx.restore();
    if (this.t > 0.2) this.btn.render(ctx, dt);
  }
}

export function wrap(ctx, text, maxW, size) {
  ctx.save(); ctx.font = `normal ${size}px ${GameConfig.fontFamily}`;
  const out = []; let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) out.push(cur);
  ctx.restore();
  return out;
}
