// 抖音小游戏平台：只用官方 tt.* API，不依赖 DOM/BOM 适配器。
//   画布      tt.createCanvas()        (第一次调用 = 上屏画布，之后 = 离屏画布)
//   图片      tt.createImage()
//   音频      tt.createInnerAudioContext()  (BGM 循环、语音共用 1 个、音效 6 个轮流用；音效为预渲染 mp3)
//   存储      tt.getStorageSync / tt.setStorageSync
//   输入      tt.onTouchStart / onTouchMove / onTouchEnd / onTouchCancel
//   生命周期  tt.onShow / tt.onHide (切后台暂停游戏、停声音)，tt.onAudioInterruptionBegin/End
//   屏幕      tt.getSystemInfoSync() 的 safeArea + tt.getMenuButtonBoundingClientRect() (避开刘海和右上角胶囊)
//   分包      tt.loadSubpackage({ name: 'audio' })  (语音 + BGM)
//   广告      tt.createRewardedVideoAd({ adUnitId })  onClose 里 isEnded=true 才发奖励；onError → 不发奖励
//   分享      tt.shareAppMessage / tt.onShareAppMessage (右上角菜单"分享")
//   录屏      tt.getGameRecorderManager()  开局自动录、结束停止、结算页"分享录屏" (channel: 'video')
//   侧边栏    tt.checkScene / tt.navigateToScene({ scene: 'sidebar' })；onShow 的 launch_from/location 判断复访
// 所有 tt 调用都包了 try/catch：低版本基础库缺某个 API 时，对应功能静默关闭，不影响游戏。
import { DyAudio } from './DyAudio.js';
import { LoopAudio } from './LoopAudio.js';

const has = (tt, fn) => !!tt && typeof tt[fn] === 'function';

export { has };

export class DouyinPlatform {
  constructor(tt) {
    this.tt = tt;
    this.name = 'douyin';
    this.isDouyin = true;
    this.isMiniGame = true;           // 抖音 / 微信小游戏共用：加载页健康忠告、预渲染暗色卡牌、结算页分享按钮
    this.sfxMode = 'files';           // 抖音不保证有 WebAudio → 音效用预渲染的小 mp3
    this.sharedVoicePlayer = true;    // 语音只用 1 个 InnerAudioContext，控制实例数
    this.config = this.constructor.loadConfig();
    this.sys = this._try(() => tt.getSystemInfoSync(), {}) || {};
    this.launchInfo = this._try(() => tt.getLaunchOptionsSync(), {}) || {};
    this.lastShow = this.launchInfo;  // 最新一次 onShow 参数 (侧边栏复访判断必须用最新值)
    this.showListeners = [];
    this.visListeners = [];
    this.sidebarExists = null;
    this.capabilities = this._capabilities(tt);
    this.recorder = null;
    this.record = { state: 'idle', videoPath: null, startedAt: 0, duration: 0, error: null };
    this._canvas = null;
    this._ad = null;

    // ★ 侧边栏复访要求：game.js 运行时就同步监听 onShow，否则从侧边栏返回时拿不到 launch_from
    if (has(tt, 'onShow')) {
      tt.onShow((res) => {
        this.lastShow = res || {};
        for (const fn of this.showListeners) this._try(() => fn(this.lastShow));
        for (const fn of this.visListeners) this._try(() => fn(true));
      });
    }
    if (has(tt, 'onHide')) tt.onHide(() => { for (const fn of this.visListeners) this._try(() => fn(false)); });
    if (has(tt, 'onAudioInterruptionBegin')) tt.onAudioInterruptionBegin(() => { for (const fn of this.visListeners) this._try(() => fn(false)); });
    if (has(tt, 'onAudioInterruptionEnd')) tt.onAudioInterruptionEnd(() => { for (const fn of this.visListeners) this._try(() => fn(true)); });

    this._initShareMenu(tt);
  }

  /** 平台能力 (子类 WechatPlatform 覆盖：没有录屏 / 侧边栏) */
  _capabilities(tt) {
    return {
      share: has(tt, 'shareAppMessage'),
      record: has(tt, 'getGameRecorderManager'),
      sidebar: has(tt, 'navigateToScene') && has(tt, 'checkScene'),
      rewardedAd: has(tt, 'createRewardedVideoAd') && DouyinPlatform.isRealId(this.config.rewardedAdUnitId),
    };
  }

  /** 右上角"…"菜单里的分享 (被动分享) */
  _initShareMenu(tt) {
    if (has(tt, 'onShareAppMessage')) tt.onShareAppMessage(() => this.shareParams());
    if (has(tt, 'showShareMenu')) this._try(() => tt.showShareMenu({}));
  }

  /** 读 douyin.config.js (AppID / 广告位 id 等，唯一需要手填的文件) */
  static loadConfig() {
    // game.js 先 require('./douyin.config.js')，该文件把配置挂到 GameGlobal.DOUYIN_CONFIG
    const g = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
    const cfg = g && g.DOUYIN_CONFIG;
    return Object.assign({
      appid: '', rewardedAdUnitId: '', freeReviveWithoutAd: true, rewardOnAdError: false,
      shareTitle: '叠三张就消！你能清空这一桌美少女吗？', shareImage: 'assets/share.png',
      videoTopics: ['美少女了个美', '叠叠消', '三消小游戏'], recordMaxSeconds: 290,
      sidebarReward: true,
    }, cfg || {});
  }

  /** 是否填写了真实 id (不是占位符) */
  static isRealId(id) { return !!id && !/^(TODO|填|your|xxx|placeholder)/i.test(String(id)); }

  _try(fn, fallback) {
    try { return fn(); } catch (err) { if (typeof console !== 'undefined') console.warn(`[${this.name}]`, err && err.message ? err.message : err); return fallback; }
  }

  // —— 画布 / 图片 / 音频 / 存储 ——
  getMainCanvas() {
    if (!this._canvas) this._canvas = this.tt.createCanvas();
    return this._canvas;
  }

  createCanvas(w, h) {
    if (!this._canvas) this.getMainCanvas();        // 保证第一个画布是上屏画布
    const c = this.tt.createCanvas();
    c.width = w; c.height = h;
    return c;
  }

  createImage() { return this.tt.createImage(); }
  createAudio() { return has(this.tt, 'createInnerAudioContext') ? new DyAudio(this.tt) : null; }
  /** BGM：两路交叉淡化的无缝循环 (mp3 + InnerAudioContext.loop 会有空隙) */
  createLoopAudio() { return has(this.tt, 'createInnerAudioContext') ? new LoopAudio(this.tt, () => this.now()) : null; }
  audioExt() { return '.mp3'; }   // InnerAudioContext 在 iOS / Android 都支持 mp3

  storageGet(key) {
    const v = this.tt.getStorageSync(key);
    return v === '' || v === undefined ? null : v;
  }
  storageSet(key, value) { this.tt.setStorageSync(key, value); }

  now() {
    if (!this._perf) this._perf = this._try(() => (has(this.tt, 'getPerformance') ? this.tt.getPerformance() : null), null) || { now: () => Date.now() };
    return this._perf.now();
  }
  raf(fn) {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
    return setTimeout(() => fn(this.now()), 16);
  }

  // —— 屏幕：整屏画布 + 内容 9:16 居中，避开刘海 / 胶囊 / 底部手势条 ——
  viewport() {
    const s = this.sys;
    const width = s.windowWidth || s.screenWidth || 375;
    const height = s.windowHeight || s.screenHeight || 667;
    const safe = s.safeArea || {};
    let insetTop = safe.top || s.statusBarHeight || 0;
    const menu = this._try(() => (has(this.tt, 'getMenuButtonBoundingClientRect') ? this.tt.getMenuButtonBoundingClientRect() : null), null);
    if (menu && menu.bottom) insetTop = Math.max(insetTop, menu.bottom + 4);
    const insetBottom = safe.bottom ? Math.max(0, height - safe.bottom) : 0;
    return { width, height, dpr: s.pixelRatio || 2, insetTop, insetBottom };
  }

  layout(canvas, logicalW, logicalH) {
    const v = this.viewport();
    const dpr = Math.min(v.dpr, 3);
    canvas.width = Math.round(v.width * dpr);
    canvas.height = Math.round(v.height * dpr);
    // 先尽量避开安全区；屏幕太矮放不下时再退回整屏居中
    let top = v.insetTop; let avail = v.height - v.insetTop - v.insetBottom;
    let scale = Math.min(v.width / logicalW, avail / logicalH);
    if (scale * logicalW < v.width * 0.82) { top = 0; avail = v.height; scale = Math.min(v.width / logicalW, avail / logicalH); }
    const cssOffsetX = (v.width - logicalW * scale) / 2;
    const cssOffsetY = top + (avail - logicalH * scale) / 2;
    return { pixelScale: scale * dpr, offsetX: cssOffsetX * dpr, offsetY: cssOffsetY * dpr, cssScale: scale, cssOffsetX, cssOffsetY };
  }

  onResize(fn) { if (has(this.tt, 'onWindowResize')) this.tt.onWindowResize(() => { this.sys = this._try(() => this.tt.getSystemInfoSync(), this.sys); fn(); }); }
  onVisibility(fn) { this.visListeners.push(fn); }
  onShow(fn) { this.showListeners.push(fn); }

  /** 触摸 → InputSystem (只取第一根手指) */
  bindTouch(handlers) {
    const tt = this.tt;
    const pick = (e) => {
      const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      return t ? { id: t.identifier, x: t.clientX, y: t.clientY } : null;
    };
    tt.onTouchStart((e) => { const p = pick(e); if (p) handlers.down(p); });
    tt.onTouchMove((e) => { const p = pick(e); if (p) handlers.move(p); });
    tt.onTouchEnd((e) => { const p = pick(e); if (p) handlers.up(p); });
    tt.onTouchCancel((e) => { const p = pick(e); if (p) handlers.up(p); });
    return true;
  }

  /** 加载分包 (语音 + BGM)；老版本客户端没有 loadSubpackage 时是整包，直接成功 */
  loadSubpackage(name, onProgress = () => {}) {
    const tt = this.tt;
    if (!has(tt, 'loadSubpackage')) return Promise.resolve(true);
    return new Promise((resolve) => {
      const task = this._try(() => tt.loadSubpackage({
        name,
        success: () => { onProgress(1); resolve(true); },
        fail: (err) => { console.warn('[Douyin] 分包加载失败', name, err); resolve(false); },
      }), null);
      if (task && typeof task.onProgressUpdate === 'function') task.onProgressUpdate((r) => onProgress((r.progress || 0) / 100));
      if (!task) resolve(false);
    });
  }

  // —— 激励视频广告 ——
  /**
   * 复活方式 (由 douyin.config.js 的 rewardedAdUnitId 一个值决定)：
   *   'rewarded' 填了广告位 ID → 看激励视频复活
   *   'free'     没填 (首发版：流量主要上线后才能开通) → 每关免费「再试一次」，界面上不出现任何广告字样
   *   'none'     没填且 freeReviveWithoutAd=false → 不提供复活
   */
  get adMode() {
    if (this.capabilities.rewardedAd) return 'rewarded';
    return this.config.freeReviveWithoutAd === false ? 'none' : 'free';
  }

  /**
   * @returns {Promise<{rewarded:boolean, reason:string}>}  只在 adMode === 'rewarded' 时调用
   */
  showRewardedAd(placement) {
    const tt = this.tt;
    const id = this.config.rewardedAdUnitId;
    if (!DouyinPlatform.isRealId(id) || !has(tt, 'createRewardedVideoAd')) {
      return Promise.resolve({ rewarded: false, reason: 'no-ad-unit' });   // 不会走到这里：没广告位时 adMode 不是 'rewarded'
    }
    return new Promise((resolve) => {
      let settled = false;
      const ad = this._ad || (this._ad = tt.createRewardedVideoAd({ adUnitId: id }));
      const finish = (rewarded, reason) => {
        if (settled) return;
        settled = true;
        if (ad.offClose) ad.offClose(onClose);
        if (ad.offError) ad.offError(onError);
        resolve({ rewarded, reason });
      };
      const onClose = (res) => {
        // 基础库较老时 res 为 undefined，按官方说明视为看完
        const ended = res === undefined ? true : !!(res && res.isEnded);
        finish(ended, ended ? 'ended' : 'closed-early');
      };
      const onError = (err) => {
        console.warn('[Douyin] 激励视频错误', placement, err);
        finish(!!this.config.rewardOnAdError, 'error');
      };
      ad.onClose(onClose);
      if (ad.onError) ad.onError(onError);
      ad.show().catch(() => ad.load().then(() => ad.show())).catch(onError);
    });
  }

  // —— 分享 ——
  shareParams(extra = {}) {
    return {
      title: extra.title || this.config.shareTitle,
      imageUrl: this.config.shareImage,
      query: extra.query || '',
    };
  }
  share(extra = {}) {
    if (!this.capabilities.share) return Promise.resolve(false);
    return new Promise((resolve) => this.tt.shareAppMessage({ ...this.shareParams(extra), success: () => resolve(true), fail: () => resolve(false) }));
  }

  // —— 录屏 ——
  _rec() {
    if (!this.capabilities.record) return null;
    if (this.recorder) return this.recorder;
    const r = this._try(() => this.tt.getGameRecorderManager(), null);
    if (!r) return null;
    this._waiters = [];
    r.onStart(() => { if (this.record.state === 'starting') this.record.state = 'recording'; });
    r.onStop((res) => this._stopped(res && res.videoPath ? res.videoPath : null, null));
    if (r.onError) r.onError((err) => this._stopped(null, err));
    this.recorder = r;
    return r;
  }

  /** 录屏结束 (onStop / onError / 超时)：通知等待者；有排队的新录屏就接着开 */
  _stopped(videoPath, err) {
    const rec = this.record;
    if (rec.state === 'idle' || rec.state === 'stopped' || rec.state === 'error') return;
    rec.duration = (this.now() - rec.startedAt) / 1000;
    rec.state = err ? 'error' : 'stopped';
    rec.videoPath = videoPath;
    rec.error = err || null;
    const ws = this._waiters; this._waiters = [];
    for (const w of ws) w(videoPath);
    if (this._pendingStart) { this._pendingStart = false; this._doStart(); }
  }

  _doStart() {
    this.record = { state: 'starting', videoPath: null, startedAt: this.now(), duration: 0, error: null };
    this._try(() => this.recorder.start({ duration: Math.min(300, this.config.recordMaxSeconds || 290) }));
  }

  /** 开局自动录屏 (最长 300 s，抖音限制)。上一段还没停完就排队，停完再开 */
  startRecord() {
    if (!this._rec()) return false;
    const st = this.record.state;
    if (st === 'starting' || st === 'recording') { this.stopRecord(); this._pendingStart = true; }
    else if (st === 'stopping') this._pendingStart = true;
    else this._doStart();
    return true;
  }

  /** 结束录屏，返回 Promise<videoPath|null>；不足 3 秒的录屏抖音会失败 (返回 null 或时长 < 3) */
  stopRecord() {
    const r = this.recorder;
    const st = this.record.state;
    if (!r || (st !== 'recording' && st !== 'starting' && st !== 'stopping')) return Promise.resolve(this.record.videoPath);
    this._pendingStart = false;
    return new Promise((resolve) => {
      this._waiters.push(resolve);
      if (st !== 'stopping') {
        this.record.state = 'stopping';
        this._try(() => r.stop());
        setTimeout(() => { if (this.record.state === 'stopping') this._stopped(null, { errMsg: 'stop timeout' }); }, 4000);
      }
    });
  }

  get recordedSeconds() { return this.record.duration; }

  /** 分享录屏到抖音 (视频发布器) */
  shareVideo(videoPath, title) {
    if (!this.capabilities.share || !videoPath) return Promise.resolve(false);
    return new Promise((resolve) => this.tt.shareAppMessage({
      channel: 'video',
      title: title || this.config.shareTitle,
      extra: { videoPath, videoTopics: this.config.videoTopics, hashtag_list: this.config.videoTopics, withVideoId: true },
      success: () => resolve(true),
      fail: (err) => { console.warn('[Douyin] 分享录屏失败', err); resolve(false); },
    }));
  }

  // —— 侧边栏复访 ——
  checkSidebar() {
    if (!this.capabilities.sidebar || !this.config.sidebarReward) return Promise.resolve(false);
    if (this.sidebarExists !== null) return Promise.resolve(this.sidebarExists);
    return new Promise((resolve) => {
      this._try(() => this.tt.checkScene({
        scene: 'sidebar',
        success: (res) => { this.sidebarExists = !!(res && res.isExist); resolve(this.sidebarExists); },
        fail: () => { this.sidebarExists = false; resolve(false); },
      }));
    });
  }

  /** 用"最新一次 onShow"判断本次是否从首页侧边栏进入 */
  launchedFromSidebar() {
    const s = this.lastShow || {};
    return s.launch_from === 'homepage' && s.location === 'sidebar_card';
  }

  navigateToSidebar() {
    if (!this.capabilities.sidebar) return Promise.resolve(false);
    return new Promise((resolve) => this.tt.navigateToScene({ scene: 'sidebar', success: () => resolve(true), fail: () => resolve(false) }));
  }

  vibrate() { if (has(this.tt, 'vibrateShort')) this._try(() => this.tt.vibrateShort({ type: 'light' })); }
  toast(title) { if (has(this.tt, 'showToast')) this._try(() => this.tt.showToast({ title, icon: 'none', duration: 1800 })); }
}
