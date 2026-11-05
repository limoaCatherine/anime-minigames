// 抖音小游戏平台实现 (全局 tt)。所有调用都按抖音开放平台小游戏文档：
//   画布 tt.createCanvas (第一次调用得到上屏画布)  · 图片 tt.createImage
//   屏幕 / 安全区 tt.getSystemInfoSync().safeArea · 右上角胶囊 tt.getMenuButtonBoundingClientRect
//   触摸 tt.onTouchStart / onTouchMove / onTouchEnd / onTouchCancel
//   存档 tt.getStorageSync / tt.setStorageSync      · 音频 tt.createInnerAudioContext
//   前后台 tt.onShow / tt.onHide                     · 分包 tt.loadSubpackage (+ onProgressUpdate)
//   录屏 tt.getGameRecorderManager                   · 分享 tt.shareAppMessage({ channel: 'video' })
//   侧边栏 tt.checkScene / tt.navigateToScene ({ scene: 'sidebar' })
import { DouyinConfig } from '../../config/PlatformConfig.js';

/** 把 InnerAudioContext 包成 HTMLAudioElement 的子集，VoiceSystem / BgmSystem 不用区分平台 */
export class TTAudio {
  constructor(tt) {
    this.ctx = tt.createInnerAudioContext();
    this._src = '';
    this._vol = 1;
    this._paused = true;
    this._ended = false;
    this._restart = false;
    this._listeners = {};
    this.preload = 'auto';
    this.onended = null;
    try { this.ctx.obeyMuteSwitch = true; } catch (_) { /* ignore */ }
    const c = this.ctx;
    if (c.onCanplay) c.onCanplay(() => { this._emit('canplaythrough'); this._emit('loadeddata'); });
    if (c.onPlay) c.onPlay(() => { this._paused = false; });
    if (c.onPause) c.onPause(() => { this._paused = true; });
    if (c.onStop) c.onStop(() => { this._paused = true; });
    if (c.onEnded) c.onEnded(() => { this._paused = true; this._ended = true; if (this.onended) this.onended(); this._emit('ended'); });
    if (c.onError) c.onError((e) => { this._paused = true; this._emit('error', e); });
  }
  _emit(type, arg) {
    const list = this._listeners[type];
    if (!list) return;
    this._listeners[type] = list.filter((l) => !l.once);
    list.forEach((l) => { try { l.fn(arg); } catch (err) { console.error(err); } });
  }
  addEventListener(type, fn, opts) { (this._listeners[type] = this._listeners[type] || []).push({ fn, once: !!(opts && opts.once) }); }
  removeEventListener(type, fn) { if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter((l) => l.fn !== fn); }
  get src() { return this._src; }
  set src(v) { if (v === this._src) return; this._src = v; this._ended = false; this.ctx.src = v; }
  get loop() { return !!this.ctx.loop; }
  set loop(v) { this.ctx.loop = !!v; }
  get volume() { return this._vol; }
  set volume(v) { this._vol = Math.max(0, Math.min(1, Number(v) || 0)); this.ctx.volume = this._vol; }
  get currentTime() { return this.ctx.currentTime || 0; }
  set currentTime(v) { if (!v) this._restart = true; else if (this.ctx.seek) this.ctx.seek(v); }
  get paused() { return this._paused; }
  get ended() { return this._ended; }
  get duration() { return this.ctx.duration || 0; }
  // 只认官方文档列出的双端通用格式 (mp3 / aac / m4a / wav)；其它一律当作不支持
  canPlayType(type) { return /mpeg|mp3|aac|mp4|m4a|wav/i.test(type) ? 'probably' : ''; }
  load() {}
  play() {
    // currentTime = 0 之后再 play：先 stop 回到开头 (InnerAudioContext.stop 会把进度归零)
    if (this._restart && (this.ctx.currentTime > 0 || !this._paused)) { try { this.ctx.stop(); } catch (_) { /* ignore */ } }
    this._restart = false;
    this._paused = false; this._ended = false;
    try { this.ctx.play(); } catch (err) { this._paused = true; return Promise.reject(err); }
    return Promise.resolve();
  }
  pause() { this._paused = true; try { this.ctx.pause(); } catch (_) { /* ignore */ } }
  stop() { this._paused = true; try { this.ctx.stop(); } catch (_) { /* ignore */ } }
  destroy() { try { this.ctx.destroy(); } catch (_) { /* ignore */ } }
}

/**
 * 无缝循环的背景音乐 (抖音版)。接口与 TTAudio / HTMLAudioElement 的常用部分一致，BgmSystem 当作普通 el 用。
 * InnerAudioContext 的 loop=true 依赖底层播放器裁掉 mp3 编码器头尾静音，不保证；这里改为两个实例轮流播：
 *   文件 = 一个循环 (loop 秒) + overrun 秒的循环开头 (tools/make_tt_bgm.py 生成)
 *   当前实例播到 loop 秒 (循环点) 时，另一个实例从头开始；在当前实例的 overrun 区间内做 xfade 秒等功率交叉淡化，
 *   两边此时播的是同一段音乐，接缝处没有空白也没有跳变。计时用每帧 dt 累计，并用 currentTime 纠偏。
 *   万一计时落后、当前实例先播完 (ended)，立即切换作为兜底。
 */
export class TTLoopAudio {
  constructor(tt, info) {
    this.info = info;                       // { loop, overrun, xfade }
    this.a = [new TTAudio(tt), new TTAudio(tt)];
    this.cur = 0;
    this.pos = 0;                           // 当前实例的播放位置 (秒)
    this.fade = null;                       // { t, d } 交叉淡化进度；旧实例 = 1 - cur
    this.swaps = 0;
    this._vol = 1;
    this._paused = true;
    this._src = '';
    this._listeners = {};
    this.preload = 'auto';
    this.a.forEach((x, i) => {
      x.loop = false;
      x.addEventListener('ended', () => { if (i === this.cur && !this._paused) this._swap(); });
      x.addEventListener('error', (e) => this._emit('error', e));
    });
  }
  _emit(type, arg) { (this._listeners[type] || []).forEach((fn) => { try { fn(arg); } catch (err) { console.error(err); } }); }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) { if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter((f) => f !== fn); }
  get src() { return this._src; }
  set src(v) { this._src = v; this.a.forEach((x) => { x.src = v; }); }
  get loop() { return true; }
  set loop(_) { /* 永远循环 */ }
  get volume() { return this._vol; }
  set volume(v) { this._vol = Math.max(0, Math.min(1, Number(v) || 0)); this._apply(); }
  get paused() { return this._paused; }
  get currentTime() { return this.pos; }
  set currentTime(v) { if (!v) { this.a.forEach((x) => x.stop()); this.fade = null; this.pos = 0; this.cur = 0; } }
  get duration() { return this.info.loop; }
  canPlayType(type) { return this.a[0].canPlayType(type); }
  load() {}
  _apply() {
    const cur = this.a[this.cur]; const old = this.a[1 - this.cur];
    if (!this.fade) { cur.volume = this._vol; return; }
    const k = Math.min(1, this.fade.t / this.fade.d);
    cur.volume = this._vol * Math.sin(k * Math.PI / 2);   // 等功率：新的淡入
    old.volume = this._vol * Math.cos(k * Math.PI / 2);   //         旧的淡出
  }
  play() {
    if (!this._paused) return Promise.resolve();
    this._paused = false;
    this._apply();
    const r = this.a[this.cur].play();
    if (this.fade) this.a[1 - this.cur].play();
    return r;
  }
  pause() { this._paused = true; this.a.forEach((x) => x.pause()); }
  stop() { this._paused = true; this.fade = null; this.a.forEach((x) => x.stop()); }
  destroy() { this.a.forEach((x) => x.destroy()); }
  _swap() {
    const old = this.a[this.cur];
    this.cur = 1 - this.cur;
    const n = this.a[this.cur];
    n.currentTime = 0;
    this.pos = Math.max(0, this.pos - this.info.loop);
    this.fade = { t: 0, d: this.info.xfade };
    this._apply();
    n.play();
    if (old.ended) old.stop();
    this.swaps++;
  }
  /** 每帧调用 (BgmSystem.update) */
  tick(dt) {
    if (this._paused) return;
    this.pos += dt;
    const ct = this.a[this.cur].currentTime;
    if (ct > 0 && Math.abs(ct - this.pos) > 0.3) this.pos = ct;      // 计时纠偏 (卡顿 / 切后台回来)
    if (this.fade) {
      this.fade.t += dt;
      if (this.fade.t >= this.fade.d) { this.a[1 - this.cur].stop(); this.fade = null; }
      this._apply();
    }
    if (!this.fade && this.pos >= this.info.loop) this._swap();
  }
}

export class TTPlatform {
  constructor(tt) {
    this.name = 'douyin';
    this.isTT = true;
    this.isMiniGame = true;
    this.tt = tt;
    this.canvas = null;
    this._hidden = false;
    this._layoutCss = { s: 1, x: 0, y: 0 };
    this._packState = {};
    this._recorder = undefined;
    // 侧边栏：必须在 game.js 一开始就同步监听 onShow，记下最近一次的启动场景 (官方接入指南要求)
    this.lastShow = null;
    try { this.lastShow = tt.getLaunchOptionsSync ? tt.getLaunchOptionsSync() : null; } catch (_) { /* ignore */ }
    this._showCbs = []; this._hideCbs = [];
    if (tt.onShow) tt.onShow((res) => { this.lastShow = res || this.lastShow; this._hidden = false; this._showCbs.forEach((f) => f(res || {})); });
    if (tt.onHide) tt.onHide(() => { this._hidden = true; this._hideCbs.forEach((f) => f()); });
    this.sys = this._sysInfo();
  }

  _sysInfo() { try { return this.tt.getSystemInfoSync(); } catch (_) { return { windowWidth: 375, windowHeight: 667, pixelRatio: 2 }; } }

  // —— 画布 / 图片 ——
  getMainCanvas() { if (!this.canvas) this.canvas = this.tt.createCanvas(); return this.canvas; }
  createCanvas(w = 1, h = 1) { const c = this.tt.createCanvas(); c.width = w; c.height = h; return c; }
  createImage() { return this.tt.createImage(); }

  /**
   * 上屏画布铺满整个屏幕；逻辑画面 (540×960) 等比放进「安全区 ∩ 胶囊按钮下方」的区域并居中，四周留边由 Game 涂底色。
   */
  layout(lw, lh) {
    const sys = this.sys = this._sysInfo();
    const ww = sys.windowWidth || sys.screenWidth || 375;
    const wh = sys.windowHeight || sys.screenHeight || 667;
    const dpr = Math.min(sys.pixelRatio || 2, 2);
    const sa = sys.safeArea && sys.safeArea.height ? sys.safeArea : { left: 0, right: ww, top: 0, bottom: wh };
    let top = Math.max(0, sa.top || 0);
    try {
      const mb = this.tt.getMenuButtonBoundingClientRect && this.tt.getMenuButtonBoundingClientRect();
      if (mb && mb.bottom > 0 && mb.bottom < wh * 0.25) top = Math.max(top, mb.bottom + 4);
    } catch (_) { /* ignore */ }
    const bottom = Math.min(wh, sa.bottom || wh);
    const left = Math.max(0, sa.left || 0); const right = Math.min(ww, sa.right || ww);
    const aw = Math.max(1, right - left); const ah = Math.max(1, bottom - top);
    const s = Math.min(aw / lw, ah / lh);
    const x = left + (aw - lw * s) / 2;
    const y = top + (ah - lh * s) / 2;
    this._layoutCss = { s, x, y };
    const c = this.getMainCanvas();
    c.width = Math.round(ww * dpr); c.height = Math.round(wh * dpr);
    return { canvasW: c.width, canvasH: c.height, scale: s * dpr, offX: x * dpr, offY: y * dpr };
  }

  toLogical(clientX, clientY) {
    const L = this._layoutCss;
    return { x: (clientX - L.x) / L.s, y: (clientY - L.y) / L.s };
  }

  onResize(cb) { if (this.tt.onWindowResize) this.tt.onWindowResize(() => cb()); }

  // —— 输入：tt.onTouch* (只跟踪第一根手指) ——
  bindPointer(h) {
    const tt = this.tt;
    const each = (e, fn) => { const list = (e && (e.changedTouches || e.touches)) || []; for (let i = 0; i < list.length; i++) fn(list[i]); };
    tt.onTouchStart((e) => each(e, (t) => h.down(t.identifier, t.clientX, t.clientY, 'touch', () => {})));
    tt.onTouchMove((e) => each(e, (t) => h.move(t.identifier, t.clientX, t.clientY, 'touch')));
    tt.onTouchEnd((e) => each(e, (t) => h.up(t.identifier, t.clientX, t.clientY, 'touch')));
    if (tt.onTouchCancel) tt.onTouchCancel((e) => each(e, (t) => h.up(t.identifier, t.clientX, t.clientY, 'touch')));
  }
  onKeyDown() {}
  onKeyUp() {}
  onBlur() {}

  // —— 生命周期 ——
  get hidden() { return this._hidden; }
  onShow(cb) { this._showCbs.push(cb); }
  onHide(cb) { this._hideCbs.push(cb); }

  // —— 时间 / 帧 ——
  now() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  raf(cb) { return typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(() => cb(this.now()), 16); }
  query() { return false; }

  // —— 存储 ——
  storageGet(key) { const v = this.tt.getStorageSync(key); return v === '' || v == null ? null : String(v); }
  storageSet(key, value) { this.tt.setStorageSync(key, value); }
  get storageAvailable() { return typeof this.tt.getStorageSync === 'function'; }

  // —— 音频：InnerAudioContext；短音效由 SfxSampler 播放预渲染的 wav ——
  createAudio() { return new TTAudio(this.tt); }
  /** 无缝循环 BGM (双实例交叉淡化)，info 来自 BgmLoopManifest */
  createLoopAudio(info) { return new TTLoopAudio(this.tt, info); }
  get audioContextClass() { return null; }
  get speech() { return null; }

  // —— 分包 ——
  packFor(src) { return DouyinConfig.packs.find((p) => src.startsWith(p.prefix) && p.test.test(src)) || null; }
  resolve(src) { const p = this.packFor(src); return p ? p.root + src : src; }
  packReady(name) { return this._packState[name] === 'ready'; }
  srcReady(src) { const p = this.packFor(src); return !p || this.packReady(p.name); }
  get packs() { return DouyinConfig.packs; }
  /** tt.loadSubpackage；低版本客户端没有该接口时整包下发，直接视为已就绪 */
  loadPack(name, onProgress = () => {}) {
    const tt = this.tt;
    if (this._packState[name] === 'ready') { onProgress(1); return Promise.resolve(true); }
    if (typeof tt.loadSubpackage !== 'function') { this._packState[name] = 'ready'; onProgress(1); return Promise.resolve(true); }
    this._packState[name] = 'loading';
    return new Promise((resolve) => {
      let task = null;
      try {
        task = tt.loadSubpackage({
          name,
          success: () => { this._packState[name] = 'ready'; onProgress(1); resolve(true); },
          fail: (err) => { console.warn(`[分包] ${name} 加载失败`, err); this._packState[name] = 'failed'; resolve(false); },
        });
      } catch (err) { console.warn(`[分包] ${name} 加载异常`, err); this._packState[name] = 'failed'; resolve(false); return; }
      if (task && task.onProgressUpdate) {
        task.onProgressUpdate((res) => {
          const p = res && res.totalBytesExpectedToWrite ? res.totalBytesWritten / res.totalBytesExpectedToWrite : (res && res.progress || 0) / 100;
          onProgress(Math.max(0, Math.min(1, p)));
        });
      }
    });
  }

  // —— 激励视频 ——
  get rewardedAdApi() { return typeof this.tt.createRewardedVideoAd === 'function' ? this.tt : null; }

  // —— 录屏 / 分享 ——
  get recorder() {
    if (this._recorder === undefined) {
      try { this._recorder = typeof this.tt.getGameRecorderManager === 'function' ? this.tt.getGameRecorderManager() : null; } catch (_) { this._recorder = null; }
    }
    return this._recorder;
  }
  get canShareVideo() { return typeof this.tt.shareAppMessage === 'function'; }
  /** 发布录屏到抖音。videoPath 为空会打开拍摄器 (审核不允许)，所以调用方必须先确认有录屏 */
  shareVideo(videoPath, { title, desc, topics = [] } = {}) {
    if (!videoPath || !this.canShareVideo) return Promise.resolve({ ok: false, reason: 'no-video' });
    return new Promise((resolve) => {
      this.tt.shareAppMessage({
        channel: 'video',
        title, desc,
        extra: { videoPath, videoTopics: topics, hashtag_list: topics, withVideoId: true },
        success: () => resolve({ ok: true }),
        fail: (e) => resolve({ ok: false, reason: e && /cancel/i.test(e.errMsg || '') ? 'cancel' : 'fail', err: e }),
      });
    });
  }

  // —— 侧边栏复访 ——
  checkSidebar() {
    const tt = this.tt;
    if (typeof tt.checkScene !== 'function') return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        tt.checkScene({ scene: 'sidebar', success: (res) => resolve(!!(res && res.isExist)), fail: () => resolve(false) });
      } catch (_) { resolve(false); }
    });
  }
  /** 最近一次 onShow / 冷启动是否来自侧边栏 (launch_from=homepage, location=sidebar_card) */
  get launchedFromSidebar() {
    const s = this.lastShow || {};
    const q = s.query || {};
    const from = s.launch_from || q.launch_from; const loc = s.location || q.location;
    return from === 'homepage' && loc === 'sidebar_card';
  }
  navigateToSidebar() {
    const tt = this.tt;
    if (typeof tt.navigateToScene !== 'function') return Promise.resolve(false);
    return new Promise((resolve) => {
      try { tt.navigateToScene({ scene: 'sidebar', success: () => resolve(true), fail: () => resolve(false) }); } catch (_) { resolve(false); }
    });
  }

  toast(title) { try { this.tt.showToast({ title, icon: 'none', duration: 2000 }); } catch (_) { /* ignore */ } }
  vibrate() { try { if (this.tt.vibrateShort) this.tt.vibrateShort({}); } catch (_) { /* ignore */ } }
}
