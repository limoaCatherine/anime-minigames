// 抖音小游戏平台 (tt.*)。只在 douyin/ 构建里使用 (tools/build-douyin.mjs)。
// 画布 / 图片 / 音频 / 输入 / 存档 / 生命周期 / 激励视频 见公共基类 MiniGamePlatform.js；这里只有抖音独有的：
// - 录屏：生存倒计时开始自动 tt.getGameRecorderManager().start()，胜负后 stop；结算面板「分享录屏」
// - 分享：tt.showShareMenu + tt.onShareAppMessage (右上角菜单)；tt.shareAppMessage (结算面板，有录屏时发视频)
// - 侧边栏复访：tt.checkScene / tt.navigateToScene({scene:'sidebar'})，从侧边栏进入每天奖励一次免广告提示
/* global tt */
import { MiniGamePlatform, SHARE_TITLE, SHARE_DESC } from './MiniGamePlatform.js';

const SIDEBAR_KEY = 'animeDrawLine.sidebar';

export class DouyinPlatform extends MiniGamePlatform {
  constructor() {
    super('douyin', tt, 'douyin');
    this.tt = tt;
    this.features.recorder = typeof tt.getGameRecorderManager === 'function';
    this.features.sidebar = typeof tt.checkScene === 'function' && typeof tt.navigateToScene === 'function';
    this.recState = 'idle';
    this.recLog = [];                 // 录屏调用记录 (测试 / 调试)
    this.fromSidebar = false;
  }

  onShowExtra(res) { this._checkSidebarLaunch(res); }

  // —— 平台服务：录屏 / 分享菜单 / 侧边栏 ——
  init(game) {
    super.init(game);
    const ev = game.events;
    // 右上角「…」菜单里的分享
    try {
      if (typeof tt.showShareMenu === 'function') tt.showShareMenu({});
      if (typeof tt.onShareAppMessage === 'function') tt.onShareAppMessage(() => this.shareOptions());
    } catch (err) { console.warn('[douyin] 分享菜单初始化失败', err); }

    // 录屏：生存倒计时开始时自动录制，胜负揭晓 1.5 秒后停止 (多录一点胜利/失败演出)
    if (this.features.recorder) {
      try {
        const rec = tt.getGameRecorderManager();
        this.recorder = rec;
        rec.onStart(() => { this.recState = 'recording'; this.recLog.push('start'); });
        rec.onStop((res) => {
          this.recState = 'stopped';
          this.videoPath = res && res.videoPath ? res.videoPath : null;
          this.recLog.push(`stop:${this.videoPath ? 'video' : 'none'}`);
          ev.emit('record:stop', { videoPath: this.videoPath });
        });
        if (rec.onError) rec.onError((err) => { this.recState = 'error'; this.recLog.push('error'); console.warn('[douyin] 录屏出错', err); });
      } catch (err) { this.features.recorder = false; }
      ev.on('level:start', () => { this.videoPath = null; this._stopRecord(); });
      ev.on('level:survive', (e) => this._startRecord(((e && e.time) || 10) + 6));
      ev.on('level:win', () => this._stopRecordLater());
      ev.on('level:lose', () => this._stopRecordLater());
      ev.on('scene:changed', () => this._stopRecord());
    }

    // 侧边栏复访奖励是「免广告提示」：没有广告位时提示本来就免费，不显示该入口
    if (this.features.sidebar && !this.adsEnabled) this.features.sidebar = false;
    if (this.features.sidebar) {
      try {
        tt.checkScene({
          scene: 'sidebar',
          success: (res) => { this.sidebarAvailable = !!(res && res.isExist); ev.emit('sidebar:check', { available: this.sidebarAvailable }); },
          fail: () => { this.sidebarAvailable = false; },
        });
      } catch (_) { this.sidebarAvailable = false; }
      try { this._checkSidebarLaunch(typeof tt.getLaunchOptionsSync === 'function' ? tt.getLaunchOptionsSync() : null); } catch (_) { /* ignore */ }
    }
  }

  _startRecord(seconds) {
    if (!this.recorder || this.recState === 'recording') return;
    clearTimeout(this._recTimer);
    try {
      this.recLog.push('start-request');
      this.recorder.start({ duration: Math.max(5, Math.min(300, Math.round(seconds))) });
    } catch (err) { console.warn('[douyin] 录屏开始失败', err); }
  }

  _stopRecordLater() {
    clearTimeout(this._recTimer);
    this._recTimer = setTimeout(() => this._stopRecord(), 1500);
  }

  _stopRecord() {
    clearTimeout(this._recTimer);
    if (!this.recorder || this.recState !== 'recording') return;
    try { this.recorder.stop(); } catch (_) { /* ignore */ }
  }

  /**
   * 分享：有录屏时发布录屏视频 (channel: 'video')，否则普通分享卡片。
   * @returns {Promise<boolean>}
   */
  share({ video = true } = {}) {
    return new Promise((resolve) => {
      const done = (ok, how) => { this.lastShare = { ok, how }; resolve(ok); };
      try {
        if (video && this.videoPath) {
          tt.shareAppMessage({
            channel: 'video',
            title: SHARE_TITLE,
            desc: SHARE_DESC,
            extra: { videoPath: this.videoPath, videoTopics: ['画线守护美少女', '画线小游戏'], hashtag_list: ['画线守护美少女', '画线小游戏'] },
            success: () => done(true, 'video'),
            fail: (err) => { console.warn('[douyin] 录屏分享失败', err); done(false, 'video'); },
          });
        } else {
          tt.shareAppMessage({ ...this.shareOptions(), success: () => done(true, 'card'), fail: () => done(false, 'card') });
        }
      } catch (err) { done(false, 'error'); }
    });
  }

  // —— 侧边栏复访 ——
  _today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

  _checkSidebarLaunch(o) {
    if (!o) return;
    const q = o.query || {};
    if ((o.launch_from === 'homepage' && o.location === 'sidebar_card') || o.scene === '021036' || q.launch_from === 'homepage') {
      if (o.location === 'sidebar_card' || o.scene === '021036' || q.location === 'sidebar_card') {
        this.fromSidebar = true;
        if (this.game) this.game.events.emit('sidebar:enter', {});
      }
    }
  }

  get sidebarClaimedToday() { return this._storage.getItem(SIDEBAR_KEY) === this._today(); }

  /** 菜单「侧边栏」按钮：从侧边栏进入的当天可领一次免广告提示，否则引导去侧边栏 */
  sidebarAction() {
    if (this.fromSidebar && !this.sidebarClaimedToday) {
      this._storage.setItem(SIDEBAR_KEY, this._today());
      if (this.game) this.game.ads.grantFree(1);
      this.toast('领取成功：免广告提示 ×1');
      return Promise.resolve('claimed');
    }
    return new Promise((resolve) => {
      tt.showModal({
        title: '侧边栏奖励',
        content: this.sidebarClaimedToday ? '今天的奖励已经领过啦，明天再从侧边栏进入吧～' : '从抖音首页「侧边栏」进入本游戏，每天可领取一次「免广告提示」。',
        confirmText: '去侧边栏',
        cancelText: '知道了',
        success: (r) => {
          if (!r || !r.confirm) { resolve('cancel'); return; }
          tt.navigateToScene({ scene: 'sidebar', success: () => resolve('navigate'), fail: () => resolve('navigate-fail') });
        },
        fail: () => resolve('cancel'),
      });
    });
  }
}
