// 抖音小游戏 tt API 模拟 + 无 DOM 的运行环境 (Node vm)，供 tools/test_douyin.mjs 使用。
// 刻意不提供 window / document / Image / Audio / localStorage：抖音版代码只能经 tt 访问平台能力。
// 时间是模拟的：requestAnimationFrame / setTimeout / performance.now 都由 env.advance(ms) 推进。
// 行为参照抖音开放平台文档：createCanvas 第一次返回上屏画布；loadSubpackage 返回带 onProgressUpdate 的 task；
// createRewardedVideoAd 的 onClose(res.isEnded)；getGameRecorderManager 的 start/stop/recordClip/clipVideo；
// shareAppMessage({channel:'video'})；checkScene / navigateToScene；onShow / onHide。

function fakeCtx(canvas) {
  const grad = { addColorStop() {} };
  const target = {
    canvas, globalAlpha: 1, font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    measureText: (t) => ({ width: String(t).length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false,
  };
  let draws = 0;
  return new Proxy(target, {
    get(t, k) {
      if (k === '__draws') return draws;
      if (k in t) return t[k];
      return (...a) => { if (k === 'drawImage' || k === 'fillText' || k === 'fillRect' || k === 'fill') draws++; return undefined; };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

export function createEnv() {
  let now = 1000;
  const timers = []; let tid = 1;
  let rafs = [];
  const log = [];
  const L = (name, arg) => log.push({ name, arg: arg === undefined ? null : JSON.parse(JSON.stringify(arg, (k, v) => (typeof v === 'function' ? undefined : v))) });
  const setTimeout_ = (fn, ms = 0) => { const id = tid++; timers.push({ id, at: now + Math.max(0, ms), fn }); return id; };
  const clearTimeout_ = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const store = {};
  const H = { show: [], hide: [], ts: [], tm: [], te: [], tc: [] };
  const cfg = {
    sys: { windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, pixelRatio: 3, platform: 'ios',
      safeArea: { left: 0, right: 390, top: 47, bottom: 810, width: 390, height: 763 } },
    menu: { left: 296, right: 383, top: 51, bottom: 83, width: 87, height: 32 },
    sidebarExist: true,
    ad: { mode: 'ended' },            // ended | early | showFail
    packDelay: 60,
    packFail: {},                     // name -> 失败次数
    launch: { scene: '011001', query: {} },
  };
  const canvases = [];
  const makeCanvas = () => { const c = { width: 300, height: 150 }; c.getContext = () => (c._ctx = c._ctx || fakeCtx(c)); canvases.push(c); return c; };
  const images = [];
  const makeImage = () => {
    const img = { width: 0, height: 0, complete: false, onload: null, onerror: null };
    let src = '';
    Object.defineProperty(img, 'src', {
      get: () => src,
      set: (v) => {
        src = v; images.push(v);
        setTimeout_(() => {
          const ok = env.fileExists(v);
          if (ok) { img.width = 256; img.height = 256; img.complete = true; img.onload && img.onload(); } else img.onerror && img.onerror(new Error('404 ' + v));
        }, 3);
      },
    });
    return img;
  };

  const audios = [];
  class Audio {
    constructor() { this.id = audios.length; audios.push(this); this._src = ''; this.paused = true; this.volume = 1; this.loop = false; this._pos = 0; this.cb = {}; this.plays = 0; this.srcLog = []; this.volLog = []; }
    // 播放位置随模拟时间推进；文件时长由 env.durationOf(src) 给出 (默认 0.15 秒的短音)
    get duration() { return env.durationOf(this._src); }
    get currentTime() { return this.paused ? this._pos : this._pos + (now - this.startedAt) / 1000; }
    set currentTime(v) { this._pos = v; if (!this.paused) this.startedAt = now; }
    set src(v) { this._src = v; this.srcLog.push(v); setTimeout_(() => this._fire(env.fileExists(v) ? 'canplay' : 'error', { errCode: 10001 }), 5); }
    get src() { return this._src; }
    _fire(n, a) { (this.cb[n] || []).forEach((f) => f(a)); }
    onCanplay(f) { (this.cb.canplay = this.cb.canplay || []).push(f); }
    onPlay(f) { (this.cb.play = this.cb.play || []).push(f); }
    onPause(f) { (this.cb.pause = this.cb.pause || []).push(f); }
    onStop(f) { (this.cb.stop = this.cb.stop || []).push(f); }
    onEnded(f) { (this.cb.ended = this.cb.ended || []).push(f); }
    onError(f) { (this.cb.error = this.cb.error || []).push(f); }
    play() {
      if (!this.paused) return;
      this.plays++; this.paused = false; this.startedAt = now; this._fire('play'); clearTimeout_(this._t);
      if (!this.loop) this._t = setTimeout_(() => { this._pos = this.duration; this.paused = true; this.endedAt = now; this._fire('ended'); }, Math.max(0, (this.duration - this._pos) * 1000));
    }
    pause() { if (!this.paused) this._pos = this.currentTime; this.paused = true; clearTimeout_(this._t); this._fire('pause'); }
    stop() { this.paused = true; this._pos = 0; clearTimeout_(this._t); this._fire('stop'); }
    seek(t) { this.currentTime = t; }
    destroy() { this.destroyed = true; }
  }

  const ads = [];
  class RewardedAd {
    constructor(o) { this.o = o; this.close = []; this.err = []; ads.push(this); L('ad.create', o); }
    onClose(f) { this.close.push(f); }
    offClose(f) { this.close = this.close.filter((x) => x !== f); }
    onError(f) { this.err.push(f); }
    load() { L('ad.load'); return cfg.ad.mode === 'showFail' ? Promise.reject({ errCode: 1004, errMsg: 'no ad' }) : Promise.resolve(); }
    show() {
      L('ad.show', cfg.ad.mode);
      if (cfg.ad.mode === 'showFail') { const e = { errCode: 1004, errMsg: 'no ad' }; this.err.forEach((f) => f(e)); return Promise.reject(e); }
      const mode = cfg.ad.mode;
      setTimeout_(() => this.close.forEach((f) => f({ isEnded: mode === 'ended', count: 1 })), 80);
      return Promise.resolve();
    }
  }

  const rec = { state: 'idle', cb: {}, clips: 0 };
  const recorder = {
    start(o) { L('rec.start', o); rec.state = 'rec'; setTimeout_(() => (rec.cb.start || []).forEach((f) => f({})), 5); },
    pause() { L('rec.pause'); rec.state = 'pause'; },
    resume() { L('rec.resume'); rec.state = 'rec'; },
    stop() { L('rec.stop'); rec.state = 'idle'; setTimeout_(() => (rec.cb.stop || []).forEach((f) => f({ videoPath: 'ttfile://temp/record_full.mp4' })), 20); },
    recordClip(o) { L('rec.clip', o); const i = rec.clips++; setTimeout_(() => o.success && o.success({ index: i }), 5); },
    clipVideo(o) { L('rec.clipVideo', o); setTimeout_(() => o.success && o.success({ videoPath: 'ttfile://temp/record_clip.mp4' }), 20); },
    onStart(f) { (rec.cb.start = rec.cb.start || []).push(f); },
    onStop(f) { (rec.cb.stop = rec.cb.stop || []).push(f); },
    onError(f) { (rec.cb.error = rec.cb.error || []).push(f); },
    onInterruptionBegin() {}, onInterruptionEnd() {},
  };

  const tt = {
    getSystemInfoSync() { return JSON.parse(JSON.stringify(cfg.sys)); },
    getMenuButtonBoundingClientRect() { return { ...cfg.menu }; },
    getLaunchOptionsSync() { return JSON.parse(JSON.stringify(cfg.launch)); },
    createCanvas() { const c = makeCanvas(); if (canvases.length === 1) L('createCanvas.screen'); return c; },
    createImage() { return makeImage(); },
    onTouchStart(f) { H.ts.push(f); }, onTouchMove(f) { H.tm.push(f); }, onTouchEnd(f) { H.te.push(f); }, onTouchCancel(f) { H.tc.push(f); },
    onShow(f) { H.show.push(f); L('onShow.listen'); }, onHide(f) { H.hide.push(f); },
    getStorageSync(k) { return k in store ? store[k] : ''; },
    setStorageSync(k, v) { L('setStorageSync', k); store[k] = v; },
    createInnerAudioContext() { L('createInnerAudioContext'); return new Audio(); },
    loadSubpackage(o) {
      L('loadSubpackage', o.name);
      const task = { cbs: [], onProgressUpdate(f) { this.cbs.push(f); } };
      if (cfg.packFail[o.name] > 0) { cfg.packFail[o.name]--; setTimeout_(() => o.fail && o.fail({ errMsg: 'loadSubpackage:fail network' }), cfg.packDelay); return task; }
      let p = 0;
      const tick = () => {
        p = Math.min(100, p + 25);
        task.cbs.forEach((f) => f({ progress: p, totalBytesWritten: p * 1000, totalBytesExpectedToWrite: 100000 }));
        if (p < 100) setTimeout_(tick, cfg.packDelay); else { env.loadedPacks.add(o.name); o.success && o.success({}); }
      };
      setTimeout_(tick, cfg.packDelay);
      return task;
    },
    createRewardedVideoAd(o) { return new RewardedAd(o); },
    getGameRecorderManager() { L('getGameRecorderManager'); return recorder; },
    shareAppMessage(o) { L('shareAppMessage', o); setTimeout_(() => o.success && o.success({}), 10); },
    checkScene(o) { L('checkScene', o); setTimeout_(() => o.success && o.success({ isExist: cfg.sidebarExist }), 5); },
    navigateToScene(o) { L('navigateToScene', o); setTimeout_(() => o.success && o.success({}), 5); },
    showToast(o) { L('showToast', o); },
    vibrateShort() {},
  };

  const env = {
    tt, cfg, log, store, audios, ads, rec, canvases, images, loadedPacks: new Set(),
    fileExists: () => true,
    durationOf: () => 0.15,
    get now() { return now; },
    globals: {
      tt, console,
      setTimeout: setTimeout_, clearTimeout: clearTimeout_, setInterval: () => 0, clearInterval: () => {},
      requestAnimationFrame: (cb) => { rafs.push(cb); return rafs.length; },
      cancelAnimationFrame: () => {},
      performance: { now: () => now },
      Date, Math, JSON, Promise, Array, Object, Map, Set, WeakMap, Symbol, Number, String, Boolean, Error, RegExp,
      Float32Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Float64Array, ArrayBuffer, DataView, Proxy, Reflect, Intl,
      isFinite, isNaN, parseFloat, parseInt, encodeURIComponent, decodeURIComponent,
    },
    /** 推进模拟时间：逐帧 (16ms) 跑 rAF，并触发到期的 setTimeout */
    async advance(ms, step = 16) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + step);
        for (;;) {
          timers.sort((a, b) => a.at - b.at);
          const t = timers[0];
          if (!t || t.at > now) break;
          timers.shift();
          try { t.fn(); } catch (e) { env.errors.push(String(e && e.stack || e)); }
        }
        const list = rafs; rafs = [];
        for (const cb of list) { try { cb(now); } catch (e) { env.errors.push(String(e && e.stack || e)); } }
        await Promise.resolve(); await Promise.resolve();
      }
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
    touch(type, x, y, id = 0) {
      const t = { identifier: id, clientX: x, clientY: y };
      const e = { touches: type === 'end' ? [] : [t], changedTouches: [t], timeStamp: now };
      ({ start: H.ts, move: H.tm, end: H.te, cancel: H.tc })[type].forEach((f) => f(e));
    },
    show(res = {}) { H.show.forEach((f) => f(res)); },
    hide() { H.hide.forEach((f) => f()); },
    errors: [],
  };
  return env;
}
