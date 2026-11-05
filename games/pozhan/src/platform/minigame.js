// 小游戏平台公共实现 (抖音 tt.* / 微信 wx.* 的 API 形状基本一致)：
// 画布、图片、InnerAudioContext 包装、分包加载、存储、触摸、安全区布局、前后台、激励视频。
// 平台差异 (录屏 / 侧边栏 / 分享方式等) 在 douyin.js / wechat.js 里补充。
/* global requestAnimationFrame */

export const safe = (f, d) => { try { return f(); } catch (e) { return d; } };

/** InnerAudioContext 包一层 HTMLAudioElement 风格的接口 (VoiceSystem / BgmSystem / AudioSystem 共用) */
export class MiniAudio {
  constructor(ctx) {
    this.c = ctx;
    this._src = ''; this._vol = 1; this._loop = false;
    this.paused = true; this.ended = false; this.error = null; this.preload = 'auto';
    this.ls = {};
    const c = this.c;
    if (c.onPlay) c.onPlay(() => { this.paused = false; this.ended = false; });
    if (c.onPause) c.onPause(() => { this.paused = true; });
    if (c.onStop) c.onStop(() => { this.paused = true; });
    if (c.onEnded) c.onEnded(() => { this.paused = true; this.ended = true; this.emit('ended'); });
    if (c.onCanplay) c.onCanplay(() => { this.emit('canplaythrough'); this.emit('loadeddata'); });
    if (c.onError) c.onError((e) => { this.paused = true; this.error = { code: e && e.errCode }; this.emit('error'); });
  }
  emit(type) { const l = this.ls[type]; if (!l) return; this.ls[type] = l.filter((x) => !x.once); for (const x of l) safe(() => x.cb()); }
  addEventListener(type, cb, opt) { (this.ls[type] = this.ls[type] || []).push({ cb, once: !!(opt && opt.once) }); }
  removeEventListener(type, cb) { if (this.ls[type]) this.ls[type] = this.ls[type].filter((x) => x.cb !== cb); }
  get src() { return this._src; }
  set src(v) { this._src = v; this.ended = false; safe(() => { this.c.src = v; }); }
  get volume() { return this._vol; }
  set volume(v) { this._vol = Math.max(0, Math.min(1, v)); safe(() => { this.c.volume = this._vol; }); }
  get loop() { return this._loop; }
  set loop(v) { this._loop = !!v; safe(() => { this.c.loop = !!v; }); }
  get currentTime() { return safe(() => this.c.currentTime || 0, 0); }
  set currentTime(t) { safe(() => this.c.seek(t)); }
  get duration() { return safe(() => this.c.duration || 0, 0); }
  canPlayType() { return ''; }
  load() {}
  play() { this.paused = false; this.ended = false; safe(() => this.c.play()); return Promise.resolve(); }
  pause() { this.paused = true; safe(() => this.c.pause()); }
}

/**
 * @param {object} api   tt 或 wx
 * @param {object} cfg   工程根目录 platform-config.js 的内容
 * @param {object} opt   { tag: 日志前缀, createAudioContext(short), windowInfo(), adOptions }
 */
export function createMiniGameBase(api, cfg, opt) {
  const tag = opt.tag;
  const has = (fn) => !!api && typeof api[fn] === 'function';
  // —— 生命周期：必须在 game.js 执行时立刻监听 (抖音侧边栏复访、微信分享回流都依赖最新的 onShow 参数) ——
  const life = { lastShow: null, showCbs: [], hideCbs: [] };
  if (has('getLaunchOptionsSync')) life.lastShow = safe(() => api.getLaunchOptionsSync(), null);
  if (has('onShow')) api.onShow((res) => { life.lastShow = res || {}; for (const cb of life.showCbs) safe(() => cb(res || {})); });
  if (has('onHide')) api.onHide(() => { for (const cb of life.hideCbs) safe(() => cb()); });

  const audioPkg = { ready: !has('loadSubpackage'), promise: null };   // 老客户端没有分包能力 → 整包，直接可用
  let mainCanvas = null;

  function loadAudioPackage() {
    if (audioPkg.promise) return audioPkg.promise;
    audioPkg.promise = new Promise((resolve, reject) => {
      if (audioPkg.ready) { resolve(); return; }
      audioPkg.task = api.loadSubpackage({
        name: 'audio',
        success: () => { audioPkg.ready = true; resolve(); },
        fail: (e) => { console.warn(`[${tag}] 音频分包加载失败，只显示字幕`, e); reject(e); },
        complete: () => {},
      });
    });
    return audioPkg.promise;
  }

  // —— 激励视频：全局单例，onClose / onError 只注册一次，用"当前等待中的 resolve"分发 ——
  let ad = null; let adPending = null;
  function getAd() {
    if (ad) return ad;
    ad = api.createRewardedVideoAd({ adUnitId: cfg.rewardedAdUnitId, ...(opt.adOptions || {}) });
    ad.onClose((res) => {
      // 微信：老基础库 res 为 undefined 表示看完；抖音：isEnded 或 count ≥ 1
      const ok = res === undefined || (!!res && (res.isEnded || (typeof res.count === 'number' && res.count > 0)));
      const p = adPending; adPending = null; if (p) p(ok);
    });
    ad.onError((err) => {
      console.warn(`[${tag}] 激励视频错误`, err && err.errCode, err && err.errMsg);
      const p = adPending; adPending = null; if (p) p('error');
    });
    return ad;
  }

  const P = {
    features: { record: false, share: false, sidebar: false, keyboard: false, wheel: false },
    singleVoicePlayer: true,
    sfxMode: 'files',
    config: cfg,
    life, has,

    getMainCanvas() { if (!mainCanvas) mainCanvas = api.createCanvas(); return mainCanvas; },   // 第一次 createCanvas = 上屏画布
    createCanvas(w = 1, h = 1) { const c = api.createCanvas(); c.width = w; c.height = h; return c; },   // 之后都是离屏画布
    createImage() { return api.createImage(); },
    createAudio(o = {}) { return new MiniAudio(opt.createAudioContext ? opt.createAudioContext(!!o.short) : api.createInnerAudioContext()); },
    createAudioContext() { return null; },
    /** 构建时：图片/音效在主包 images/ sfx/，语音/BGM 在分包 audio/ */
    assetPath(p) {
      return p.replace(/^assets\/images\//, 'images/').replace(/^assets\/audio\/sfx\//, 'sfx/').replace(/^assets\/audio\//, 'audio/');
    },
    prepare(onProgress = () => {}) {
      // 图片在主包，立即可用；音频分包放后台下载 (进菜单不等它)
      loadAudioPackage().catch(() => {});
      onProgress(1);
      return Promise.resolve();
    },
    audioReady() { return loadAudioPackage(); },
    isAudioReady() { return audioPkg.ready; },

    now() { return Date.now(); },
    raf(cb) { return typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(cb, 16); },
    query() { const o = (life.lastShow && life.lastShow.query) || {}; return typeof o === 'object' ? o : {}; },

    storageGet(key) { const v = api.getStorageSync(key); return v === '' || v === undefined || v === null ? null : String(v); },
    storageSet(key, value) { api.setStorageSync(key, value); },

    /** 画布铺满屏幕；540×960 内容放在「胶囊按钮下方 ~ Home 指示条上方」的安全区里等比居中 */
    layoutCanvas(canvas, W, H) {
      const si = (opt.windowInfo ? opt.windowInfo() : safe(() => api.getSystemInfoSync(), {})) || {};
      const sw = si.windowWidth || si.screenWidth || W; const sh = si.windowHeight || si.screenHeight || H;
      const dpr = Math.min(si.pixelRatio || 2, 2);   // 2 倍已经很清晰，3 倍屏也按 2 倍画，省性能
      canvas.width = Math.round(sw * dpr); canvas.height = Math.round(sh * dpr);
      const sa = si.safeArea || { top: si.statusBarHeight || 0, bottom: sh };
      let top = Math.max(sa.top || 0, si.statusBarHeight || 0);
      const mb = has('getMenuButtonBoundingClientRect') ? safe(() => api.getMenuButtonBoundingClientRect(), null) : null;
      if (mb && mb.bottom > 0 && mb.bottom < sh * 0.2) top = Math.max(top, mb.bottom + 6);
      const bottom = Math.max(0, sh - (sa.bottom || sh));
      const availH = Math.max(1, sh - top - bottom);
      const s = Math.min(sw / W, availH / H);
      const ox = (sw - W * s) / 2; const oy = top + (availH - H * s) / 2;
      return { scale: s * dpr, ox: ox * dpr, oy: oy * dpr, fullW: canvas.width, fullH: canvas.height, letterbox: true, dpr, css: { s, ox, oy, top, bottom, sw, sh } };
    },
    onResize(cb) { if (has('onWindowResize')) api.onWindowResize(() => cb()); },
    onHide(cb) { life.hideCbs.push(cb); },
    onShow(cb) { life.showCbs.push(cb); },

    toLogical(game, cx, cy) {
      const L = game.layout;
      return { x: (cx * L.dpr - L.ox) / L.scale, y: (cy * L.dpr - L.oy) / L.scale };
    },
    bindInput(input) {
      const pt = (t) => [t.clientX !== undefined ? t.clientX : t.x, t.clientY !== undefined ? t.clientY : t.y];
      api.onTouchStart((e) => { for (const t of e.changedTouches || []) { const [x, y] = pt(t); input.pointerDown(t.identifier, x, y, 'touch'); } });
      api.onTouchMove((e) => { for (const t of e.changedTouches || []) { const [x, y] = pt(t); input.pointerMove(t.identifier, x, y); } });
      api.onTouchEnd((e) => { for (const t of e.changedTouches || []) { const [x, y] = pt(t); input.pointerUp(t.identifier, x, y, false); } });
      api.onTouchCancel((e) => { for (const t of e.changedTouches || []) { const [x, y] = pt(t); input.pointerUp(t.identifier, x, y, true); } });
    },

    /** 填了激励视频广告位 id 才算有广告；否则游戏里不显示任何看广告按钮 (提示 / 复活走免费规则) */
    adsAvailable() { return !!cfg.rewardedAdUnitId && has('createRewardedVideoAd'); },
    /** 激励视频 → Promise<true | false | 'error'>；onBefore / onAfter 给录屏暂停用 */
    rewardedAd(placement, hooks = {}) {
      if (!P.adsAvailable()) return null;
      return new Promise((resolve) => {
        const a = getAd();
        if (adPending) adPending(false);
        if (hooks.before) hooks.before();
        adPending = (r) => { if (hooks.after) hooks.after(); resolve(r); };
        a.show().catch(() => a.load().then(() => a.show())).catch((err) => {
          console.warn(`[${tag}] 激励视频展示失败`, placement, err);
          const p = adPending; adPending = null; if (p) p('error');
        });
      });
    },
    recorder: null,
    shareVideo: null,
    shareApp: null,
    sidebar: null,
  };
  return P;
}
