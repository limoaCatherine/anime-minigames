// 小游戏平台公共基类 (抖音 tt.* / 微信 wx.* 的 API 形状几乎一致)。DouyinPlatform / WeChatPlatform 继承它。
// - 画布：api.createCanvas() 第一次调用得到上屏画布，铺满屏幕；540×960 的逻辑画面放在安全区 (避开刘海与右上角胶囊按钮) 内居中
// - 图片：api.createImage()；路径经 resolveAsset 映射到压缩后的文件 / 分包目录 (构建时生成的 minigame:assets)
// - 音频：api.createInnerAudioContext() (TTAudio 包装成 HTMLAudio 外观)；没有 WebAudio -> 音效用预渲染文件
//         BGM：TTLoopAudio 两路交替 + 交叉淡化的无缝循环 (避开 mp3 编码器补的首尾静音)
// - 输入：api.onTouchStart / Move / End / Cancel -> 统一指针事件
// - 存档：api.setStorageSync / getStorageSync
// - 生命周期：api.onHide / onShow -> app:hidden / app:visible (GameScene 暂停并作废当前一笔，音频暂停)
// - 激励视频：api.createRewardedVideoAd (config.js 的 AD_UNIT_ID)；为空时 adsEnabled=false，隐藏所有看广告界面，提示免费
/* global requestAnimationFrame */
import { Platform } from './Platform.js';
import { TTAudio, TTLoopAudio } from './TTAudio.js';
import { loadMiniGameConfig } from './minigameConfig.js';
import { MG_ASSETS, MG_LOOPS } from 'minigame:assets';

export const SHARE_TITLE = '画线守护美少女：画一条线，护住她！';
export const SHARE_DESC = '一笔画线挡住蜜蜂、文件和相亲照片，守护她坚持到最后～';

export class MiniGamePlatform extends Platform {
  /** @param {string} name 平台名  @param {object} api tt / wx  @param {string} tag 日志前缀 */
  constructor(name, api, tag = name) {
    super(name);
    this.api = api;
    this.tag = tag;
    this.cfg = loadMiniGameConfig(tag);
    this.minigame = true;
    this.features = {
      keyboard: false,
      share: typeof api.shareAppMessage === 'function',
      recorder: false,
      sidebar: false,
      autoplay: true,
    };
    this.deferAudio = true;           // BGM / 语音在 audio 分包里，分包加载完再初始化
    this.subpackages = ['images', 'audio'];
    this._hidden = false;
    this.videoPath = null;
    this.sidebarAvailable = false;
    this._storage = {
      getItem(k) {
        try { const v = api.getStorageSync(k); return v === '' || v === undefined || v === null ? null : String(v); } catch (_) { return null; }
      },
      setItem(k, v) { api.setStorageSync(k, String(v)); },
      removeItem(k) { try { api.removeStorageSync(k); } catch (_) { /* ignore */ } },
    };
  }

  // —— 画布 / 图片 / 资源 ——
  createMainCanvas() { return this.api.createCanvas(); }

  createCanvas(w, h) {
    const c = this.api.createCanvas();
    c.width = w; c.height = h;
    return c;
  }

  createImage() { return this.api.createImage(); }

  resolveAsset(src) { return MG_ASSETS[src] || src; }

  loadSubpackage(name) {
    const api = this.api;
    return new Promise((resolve) => {
      if (typeof api.loadSubpackage !== 'function') { resolve(true); return; }
      try {
        const task = api.loadSubpackage({
          name,
          success: () => resolve(true),
          fail: (err) => { console.warn(`[${this.tag}] 分包 ${name} 加载失败`, err); resolve(false); },
        });
        if (task && task.onProgressUpdate) task.onProgressUpdate((p) => { this.subProgress = { name, progress: p.progress }; });
      } catch (err) {
        console.warn(`[${this.tag}] 分包 ${name} 加载异常`, err);
        resolve(false);
      }
    });
  }

  // —— 音频 / 存储 / 时间 ——
  createAudio() { return new TTAudio(this.api); }

  /** 背景音乐：有循环信息 (构建时写入) 的文件用两路交替的无缝循环播放器 */
  createMusic(src) {
    const meta = MG_LOOPS[this.resolveAsset(src)];
    return meta ? new TTLoopAudio(this.api, meta) : null;
  }

  get storage() { return this._storage; }

  now() { return Date.now(); }

  raf(cb) { return requestAnimationFrame(() => cb(this.now())); }

  // —— 屏幕 ——
  /** 窗口信息 (宽高 / 安全区 / 像素比)；子类可覆盖 (微信用 getWindowInfo) */
  systemInfo() { return this.api.getSystemInfoSync(); }

  viewport() {
    const api = this.api;
    const s = this.systemInfo();
    const w = s.windowWidth || s.screenWidth || 375;
    const h = s.windowHeight || s.screenHeight || 667;
    const sa0 = s.safeArea || {};
    const safe = {
      left: sa0.left || 0,
      top: sa0.top || 0,
      right: sa0.right || w,
      bottom: sa0.bottom || h,
    };
    // 右上角胶囊按钮 (更多 / 关闭) 下方开始放画面，避免挡住游戏里的右上角按钮
    try {
      const m = typeof api.getMenuButtonBoundingClientRect === 'function' ? api.getMenuButtonBoundingClientRect() : null;
      if (m && m.bottom > 0 && m.bottom < h * 0.2) safe.top = Math.max(safe.top, m.bottom + 4);
    } catch (_) { /* ignore */ }
    if (safe.right - safe.left < 100 || safe.bottom - safe.top < 100) { safe.left = 0; safe.top = 0; safe.right = w; safe.bottom = h; }
    return { width: w, height: h, dpr: Math.min(s.pixelRatio || 2, 2.5), safeArea: safe, fullscreen: true, system: s };
  }

  layout() {}

  canvasRect(canvas, view) { return { left: view.ox, top: view.oy, width: view.cssW, height: view.cssH }; }

  onResize(cb) { if (typeof this.api.onWindowResize === 'function') this.api.onWindowResize(() => cb()); }

  isHidden() { return this._hidden; }

  onVisibility(cb) {
    this.api.onHide(() => { this._hidden = true; cb(true); });
    this.api.onShow((res) => {
      this._hidden = false;
      cb(false);
      this.onShowExtra(res);
    });
  }

  onShowExtra() {}

  // —— 触摸输入 ——
  bindInput(canvas, h) {
    const api = this.api;
    const each = (e, fn) => {
      const list = (e && (e.changedTouches || e.touches)) || [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        fn({ id: t.identifier != null ? t.identifier : 0, clientX: t.clientX != null ? t.clientX : t.x, clientY: t.clientY != null ? t.clientY : t.y, type: 'touch' });
      }
    };
    api.onTouchStart((e) => each(e, h.down));
    api.onTouchMove((e) => each(e, h.move));
    api.onTouchEnd((e) => each(e, h.up));
    if (typeof api.onTouchCancel === 'function') api.onTouchCancel(() => h.cancel());
  }

  init(game) { this.game = game; }

  shareOptions() {
    return { title: SHARE_TITLE, desc: SHARE_DESC, imageUrl: this.resolveAsset('assets/share.jpg'), query: 'from=share' };
  }

  get hasVideo() { return !!this.videoPath; }

  // —— 激励视频 ——
  /** 有广告位 ID 且基础库支持激励视频才算启用 (否则界面上不出现任何「看广告」) */
  get adsEnabled() { return !!String(this.cfg.AD_UNIT_ID || '').trim() && typeof this.api.createRewardedVideoAd === 'function'; }

  adBackend() { return this.adsEnabled ? this.name : 'none'; }

  showRewardedVideo(placement) {
    const api = this.api;
    const id = String(this.cfg.AD_UNIT_ID || '').trim();
    if (!this.adsEnabled) return Promise.resolve({ ok: false, reason: 'no-ad-unit' });   // 不会被调用 (AdService 先判断 enabled)
    return new Promise((resolve) => {
      let settled = false;
      const finish = (r) => { if (!settled) { settled = true; resolve(r); } };
      try {
        if (!this._ad) {
          this._ad = api.createRewardedVideoAd({ adUnitId: id });
          this._ad.onError((err) => console.warn(`[${this.tag}] 激励视频错误`, err));
        }
        const ad = this._ad;
        const onClose = (res) => {
          ad.offClose(onClose);
          // 只有完整看完 (isEnded) 才发奖励 (平台规范)；微信基础库 < 2.1.0 的 onClose 没有参数，视为看完
          const ended = res === undefined ? true : !!(res && res.isEnded);
          finish({ ok: ended, reason: ended ? 'ended' : 'closed-early' });
        };
        ad.onClose(onClose);
        ad.show().catch(() => ad.load().then(() => ad.show())).catch((err) => {
          ad.offClose(onClose);
          console.warn(`[${this.tag}] 激励视频「${placement}」播放失败`, err);
          this.toast('广告暂时无法播放，请稍后再试');
          finish({ ok: false, reason: 'error' });
        });
      } catch (err) {
        finish({ ok: false, reason: 'error' });
      }
    });
  }

  toast(msg) { try { this.api.showToast({ title: msg, icon: 'none' }); } catch (_) { console.log(msg); } }
}
