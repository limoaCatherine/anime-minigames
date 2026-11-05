// 抖音小游戏平台实现 (无 DOM / BOM，全部走 tt.* API)。官方文档：
//   画布        tt.createCanvas   https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/drawing/picture/tt-create-canvas
//   图片        tt.createImage    https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/drawing/picture/tt-create-image
//   音频        tt.createInnerAudioContext (语音 / BGM / 预渲染音效，不用 WebAudio 实时合成)
//   存储        tt.getStorageSync / tt.setStorageSync (总上限约 10MB，单 key 1MB；本游戏存档 <10KB)
//   触摸        tt.onTouchStart / Move / End / Cancel
//   生命周期    tt.onShow / tt.onHide (侧边栏复访要求在 game.js 启动时就监听 onShow)
//   系统信息    tt.getSystemInfoSync (safeArea)、tt.getMenuButtonBoundingClientRect (右上角胶囊)
//   分包        tt.loadSubpackage (音频分包 audio/)
//   激励视频    tt.createRewardedVideoAd (onClose: isEnded / count；onError: errCode)
//   录屏        tt.getGameRecorderManager (start / recordClip / stop / clipVideo)
//   分享        tt.shareAppMessage({ channel: 'video', extra: { videoPath } })
//   侧边栏      tt.checkScene / tt.navigateToScene({ scene: 'sidebar' })
/* global tt */
import { createMiniGameBase, safe } from './minigame.js';

const has = (fn) => typeof tt !== 'undefined' && typeof tt[fn] === 'function';
const G = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : {});

/**
 * @param {object} cfg 抖音工程根目录 platform-config.js 的内容
 */
export function createDouyinPlatform(cfg = {}) {
  const base = createMiniGameBase(tt, cfg, { tag: 'douyin', windowInfo: () => safe(() => tt.getSystemInfoSync(), {}) });
  const life = base.life;

  // —— 录屏：每关一段，最高光片段 (刁钻点 / 最后一处) 用 recordClip 标记，结算时剪成短视频 ——
  const rec = {
    mgr: null, state: 'idle', clips: 0, startedAt: 0, videoPath: '', waiters: [],
    get() {
      if (!this.mgr && has('getGameRecorderManager')) {
        this.mgr = tt.getGameRecorderManager();
        this.mgr.onStart(() => { this.state = 'recording'; this.ignoreNextStop = false; });
        this.mgr.onStop((res) => this.handleStop(res));
        if (this.mgr.onError) this.mgr.onError((e) => { console.warn('[douyin] 录屏错误', e); this.state = 'idle'; this.flush(''); });
      }
      return this.mgr;
    },
    handleStop(res) {
      this.state = 'idle';
      if (this.ignoreNextStop) { this.ignoreNextStop = false; return; }
      const full = (res && res.videoPath) || '';
      const len = (Date.now() - this.startedAt) / 1000;
      if (!full) { this.flush(''); return; }
      // 有高光片段：剪成「高光 + 最后 6 秒(结算)」；没有就用整段
      if (this.clips > 0 && this.mgr.clipVideo) {
        this.mgr.clipVideo({ path: full, timeRange: [6, 0], success: (r) => this.flush((r && r.videoPath) || full, len), fail: () => this.flush(full, len) });
      } else this.flush(full, len);
    },
    flush(path, len = 0) { this.videoPath = path; this.length = len; const w = this.waiters; this.waiters = []; for (const f of w) f(path ? { videoPath: path, duration: len } : null); },
  };

  const baseAd = base.rewardedAd;
  const P = Object.assign(base, {
    name: 'douyin',
    features: { record: has('getGameRecorderManager'), share: has('shareAppMessage'), sidebar: has('checkScene') && has('navigateToScene'), keyboard: false, wheel: false },
    /** 激励视频：播放期间暂停录屏 */
    rewardedAd(placement) {
      return P.adsAvailable() ? baseAd(placement, { before: () => P.recorder.pause(), after: () => P.recorder.resume() }) : null;
    },

    recorder: {
      get supported() { return !!rec.get(); },
      start() {
        const m = rec.get(); if (!m) return;
        const busy = rec.state !== 'idle';
        if (busy) { rec.ignoreNextStop = true; safe(() => m.stop()); }
        rec.clips = 0; rec.videoPath = ''; rec.state = 'starting';
        setTimeout(() => { rec.startedAt = Date.now(); safe(() => m.start({ duration: 300 })); }, busy ? 400 : 0);
      },
      /** 标记高光：前 4 秒 + 后 2 秒 */
      highlight() { const m = rec.get(); if (!m || rec.state !== 'recording') return; safe(() => m.recordClip({ timeRange: [4, 2], success: () => { rec.clips++; } })); },
      /** 结束并拿到可分享的视频 (不足 3 秒的录屏抖音不允许发布 → null) */
      stop() {
        const m = rec.get();
        if (!m || rec.state === 'idle') return Promise.resolve(null);
        return new Promise((resolve) => {
          let settled = false;
          const fin = (r) => { if (settled) return; settled = true; resolve(r && r.duration >= 3 ? r : null); };
          rec.waiters.push(fin);
          setTimeout(() => fin(null), 6000);   // 录屏没真正开始 (开发者工具不支持录屏等) 时不卡住结算
          safe(() => m.stop());
        });
      },
      cancel() { const m = rec.get(); if (m && rec.state !== 'idle') { rec.ignoreNextStop = true; safe(() => m.stop()); } },
      pause() { const m = rec.get(); if (m && rec.state === 'recording') safe(() => m.pause()); },
      resume() { const m = rec.get(); if (m && rec.state === 'recording') safe(() => m.resume()); },
    },

    /** 分享录屏 (channel: 'video')。videoPath 必须是录屏得到的有效文件，否则抖音会误拉起摄像头 → 调用前已校验 */
    shareVideo({ videoPath, title }) {
      return new Promise((resolve) => {
        if (!videoPath || !has('shareAppMessage')) { resolve(false); return; }
        const opt = {
          channel: 'video', title: title || '次元破绽！', query: '',
          extra: { videoPath, videoTopics: cfg.videoTopics || ['次元破绽'], withVideoId: true },
          success: () => resolve(true), fail: (e) => { console.warn('[douyin] 分享录屏失败/取消', e); resolve(false); },
        };
        if (cfg.shareTemplateId) opt.templateId = cfg.shareTemplateId;
        tt.shareAppMessage(opt);
      });
    },

    sidebar: {
      check() {
        return new Promise((resolve) => {
          if (!has('checkScene')) { resolve(false); return; }
          tt.checkScene({ scene: 'sidebar', success: (r) => resolve(!!(r && r.isExist)), fail: () => resolve(false) });
        });
      },
      navigate() {
        return new Promise((resolve) => {
          if (!has('navigateToScene')) { resolve(false); return; }
          tt.navigateToScene({ scene: 'sidebar', success: () => resolve(true), fail: (e) => { console.warn('[douyin] 跳转侧边栏失败', e); resolve(false); } });
        });
      },
      /** 用 onShow 的「最新」返回值判断 (热启动从侧边栏回来也能领) */
      fromSidebar() { const s = life.lastShow || {}; return s.launch_from === 'homepage' && s.location === 'sidebar_card'; },
    },
  });

  // 被动分享 (右上角菜单里的「分享」)
  if (has('onShareAppMessage')) {
    tt.onShareAppMessage(() => {
      const o = { title: '次元破绽！这张图毫无破绽……吗？', query: '' };
      if (cfg.shareTemplateId) o.templateId = cfg.shareTemplateId;
      return o;
    });
  }
  if (has('showShareMenu')) safe(() => tt.showShareMenu({}));

  // AppID 自检：platform-config.js 里写的和实际运行的不一致时提醒 (开发者工具控制台可见)
  if (cfg.appId && has('getEnvInfoSync')) {
    const env = safe(() => tt.getEnvInfoSync(), null);
    const real = env && env.microapp && env.microapp.appId;
    if (real && real !== cfg.appId) console.warn(`[douyin] platform-config.js 的 appId (${cfg.appId}) 与当前项目 AppID (${real}) 不一致，请检查 project.config.json`);
  }
  G.__SPOTDIFF_PLATFORM__ = P;
  return P;
}
