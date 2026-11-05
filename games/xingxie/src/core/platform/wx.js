// 微信小游戏平台实现 (全局 wx)。接口按微信开放文档 (developers.weixin.qq.com/minigame)：
//   画布 wx.createCanvas (第一次调用得到上屏画布)        · 图片 wx.createImage
//   窗口 / 安全区 wx.getWindowInfo().safeArea (基础库 2.25.3+；低版本退回 wx.getSystemInfoSync)
//   右上角胶囊 wx.getMenuButtonBoundingClientRect        · 触摸 wx.onTouchStart / Move / End / Cancel
//   存档 wx.getStorageSync / wx.setStorageSync            · 音频 wx.createInnerAudioContext (mp3；BGM 双实例交叉淡化)
//   前后台 wx.onShow / wx.onHide                          · 分包 wx.loadSubpackage (+ onProgressUpdate)
//   激励视频 wx.createRewardedVideoAd (小游戏端全局单例)
//   转发 wx.showShareMenu({ menus: ['shareAppMessage','shareTimeline'] }) + wx.onShareAppMessage + wx.onShareTimeline
//        (朋友圈为官方 Beta，暂只 Android) · 主动转发 wx.shareAppMessage
// 抖音专有的录屏 (getGameRecorderManager) 和侧边栏 (checkScene / navigateToScene) 在这里不提供。
import { WechatConfig } from '../../config/PlatformConfig.js';
import { TTAudio, TTLoopAudio } from './tt.js';   // 两个类只用 InnerAudioContext 的通用接口，微信同名同义，直接复用

export class WXPlatform {
  constructor(wx) {
    this.name = 'wechat';
    this.isTT = false;          // 抖音专有能力 (侧边栏) 关闭
    this.isMiniGame = true;     // 小游戏运行时：预渲染音效 / 共享语音实例 / 无缝循环 BGM
    this.wx = wx;
    this.canvas = null;
    this._hidden = false;
    this._layoutCss = { s: 1, x: 0, y: 0 };
    this._packState = {};
    this.lastShow = null;
    try { this.lastShow = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : null; } catch (_) { /* ignore */ }
    this._showCbs = []; this._hideCbs = [];
    if (wx.onShow) wx.onShow((res) => { this.lastShow = res || this.lastShow; this._hidden = false; this._showCbs.forEach((f) => f(res || {})); });
    if (wx.onHide) wx.onHide(() => { this._hidden = true; this._hideCbs.forEach((f) => f()); });
    this.sys = this._sysInfo();
    this._setupShareMenu();
  }

  _sysInfo() {
    const wx = this.wx;
    try { if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo(); } catch (_) { /* ignore */ }
    try { return wx.getSystemInfoSync(); } catch (_) { return { windowWidth: 375, windowHeight: 667, pixelRatio: 2 }; }
  }

  // —— 画布 / 图片 ——
  getMainCanvas() { if (!this.canvas) this.canvas = this.wx.createCanvas(); return this.canvas; }
  createCanvas(w = 1, h = 1) { const c = this.wx.createCanvas(); c.width = w; c.height = h; return c; }
  createImage() { return this.wx.createImage(); }

  /** 上屏画布铺满屏幕；逻辑画面 (540×960) 等比放进「安全区 ∩ 胶囊按钮下方」并居中，四周留边由 Game 涂底色 */
  layout(lw, lh) {
    const sys = this.sys = this._sysInfo();
    const ww = sys.windowWidth || sys.screenWidth || 375;
    const wh = sys.windowHeight || sys.screenHeight || 667;
    const dpr = Math.min(sys.pixelRatio || 2, 2);
    const sa = sys.safeArea && sys.safeArea.height ? sys.safeArea : { left: 0, right: ww, top: 0, bottom: wh };
    let top = Math.max(0, sa.top || 0);
    try {
      const mb = this.wx.getMenuButtonBoundingClientRect && this.wx.getMenuButtonBoundingClientRect();
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

  toLogical(clientX, clientY) { const L = this._layoutCss; return { x: (clientX - L.x) / L.s, y: (clientY - L.y) / L.s }; }
  onResize(cb) { if (this.wx.onWindowResize) this.wx.onWindowResize(() => cb()); }

  // —— 输入：wx.onTouch* ——
  bindPointer(h) {
    const wx = this.wx;
    const each = (e, fn) => { const list = (e && (e.changedTouches || e.touches)) || []; for (let i = 0; i < list.length; i++) fn(list[i]); };
    wx.onTouchStart((e) => each(e, (t) => h.down(t.identifier, t.clientX, t.clientY, 'touch', () => {})));
    wx.onTouchMove((e) => each(e, (t) => h.move(t.identifier, t.clientX, t.clientY, 'touch')));
    wx.onTouchEnd((e) => each(e, (t) => h.up(t.identifier, t.clientX, t.clientY, 'touch')));
    if (wx.onTouchCancel) wx.onTouchCancel((e) => each(e, (t) => h.up(t.identifier, t.clientX, t.clientY, 'touch')));
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
  storageGet(key) { const v = this.wx.getStorageSync(key); return v === '' || v == null ? null : String(v); }
  storageSet(key, value) { this.wx.setStorageSync(key, value); }
  get storageAvailable() { return typeof this.wx.getStorageSync === 'function'; }

  // —— 音频 ——
  createAudio() { return new TTAudio(this.wx); }
  createLoopAudio(info) { return new TTLoopAudio(this.wx, info); }
  get audioContextClass() { return null; }
  get speech() { return null; }

  // —— 分包 (game.json subpackages + wx.loadSubpackage) ——
  packFor(src) { return WechatConfig.packs.find((p) => src.startsWith(p.prefix) && p.test.test(src)) || null; }
  resolve(src) { const p = this.packFor(src); return p ? p.root + src : src; }
  packReady(name) { return this._packState[name] === 'ready'; }
  srcReady(src) { const p = this.packFor(src); return !p || this.packReady(p.name); }
  get packs() { return WechatConfig.packs; }
  /** 基础库 2.1.0 以下没有 wx.loadSubpackage：后台下发整包 (官方老版本兼容说明)，直接视为就绪 */
  loadPack(name, onProgress = () => {}) {
    const wx = this.wx;
    if (this._packState[name] === 'ready') { onProgress(1); return Promise.resolve(true); }
    if (typeof wx.loadSubpackage !== 'function') { this._packState[name] = 'ready'; onProgress(1); return Promise.resolve(true); }
    this._packState[name] = 'loading';
    return new Promise((resolve) => {
      let task = null;
      try {
        task = wx.loadSubpackage({
          name,
          success: () => { this._packState[name] = 'ready'; onProgress(1); resolve(true); },
          fail: (err) => { console.warn(`[分包] ${name} 加载失败`, err); this._packState[name] = 'failed'; resolve(false); },
          complete: () => {},
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
  get rewardedAdApi() { return typeof this.wx.createRewardedVideoAd === 'function' ? this.wx : null; }

  // —— 录屏 / 侧边栏：微信没有，返回空 ——
  get recorder() { return null; }
  get canShareVideo() { return false; }
  shareVideo() { return Promise.resolve({ ok: false, reason: 'unsupported' }); }
  checkSidebar() { return Promise.resolve(false); }
  get launchedFromSidebar() { return false; }
  navigateToSidebar() { return Promise.resolve(false); }

  // —— 转发 / 朋友圈 ——
  _shareData(kind) {
    const S = WechatConfig.share;
    return kind === 'timeline'
      ? { title: S.timelineTitle, imageUrl: S.imageUrl, query: S.query + '&ch=timeline' }
      : { title: S.title, imageUrl: S.imageUrl, query: S.query };
  }
  _setupShareMenu() {
    const wx = this.wx;
    this.shareMenu = { menu: false, app: false, timeline: false };
    try {
      if (wx.showShareMenu) {
        // 「分享到朋友圈」必须和「发送给朋友」同时显示 (官方注意事项)；menus 为 Beta，iOS 上只出转发
        wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
        this.shareMenu.menu = true;
      }
      if (wx.onShareAppMessage) { wx.onShareAppMessage(() => this._shareData('app')); this.shareMenu.app = true; }
      if (wx.onShareTimeline) { wx.onShareTimeline(() => this._shareData('timeline')); this.shareMenu.timeline = true; }
    } catch (err) { console.warn('[分享] 设置右上角转发菜单失败', err); }
  }
  get canShareLink() { return typeof this.wx.shareAppMessage === 'function'; }
  /** 主动拉起转发 (选择聊天)。微信不回传是否真的发出去了，所以只返回「已拉起」 */
  shareLink(extra = {}) {
    if (!this.canShareLink) return Promise.resolve({ ok: false, reason: 'unsupported' });
    try {
      const d = this._shareData('app');
      this.wx.shareAppMessage({ ...d, ...extra });
      return Promise.resolve({ ok: true, reason: 'opened' });
    } catch (err) { return Promise.resolve({ ok: false, reason: 'fail', err }); }
  }

  toast(title) { try { this.wx.showToast({ title, icon: 'none', duration: 2000 }); } catch (_) { /* ignore */ } }
  vibrate() { try { if (this.wx.vibrateShort) this.wx.vibrateShort({ type: 'light' }); } catch (_) { /* ignore */ } }
}
