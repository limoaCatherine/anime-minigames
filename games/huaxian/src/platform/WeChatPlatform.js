// 微信小游戏平台 (wx.*)。只在 wechat/ 构建里使用 (tools/build-wechat.mjs)。
// 画布 / 图片 / 音频 / 输入 / 存档 / 生命周期 / 激励视频 见公共基类 MiniGamePlatform.js；这里是微信的差异：
// - 窗口信息：优先 wx.getWindowInfo() (基础库 2.25.3+，含 safeArea / pixelRatio)，旧版退回 wx.getSystemInfoSync()
// - 分享：wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) 打开右上角「转发 / 分享到朋友圈」，
//         wx.onShareAppMessage / wx.onShareTimeline (基础库 2.11.3+，官方标注 Beta、暂只支持 Android) 提供卡片内容；结算面板按钮调用 wx.shareAppMessage (主动转发)
//         微信已不再返回转发成功回调，所以 share() 调用即视为成功，也不做「分享得奖励」(平台规范禁止诱导分享)
// - 没有抖音的录屏 / 侧边栏
// - 激励视频：wx.createRewardedVideoAd，onClose 的 isEnded=true 才发奖励；AD_UNIT_ID 为空 -> 不显示任何看广告界面
/* global wx */
import { MiniGamePlatform, SHARE_TITLE } from './MiniGamePlatform.js';

export class WeChatPlatform extends MiniGamePlatform {
  constructor() {
    super('wechat', wx, 'wechat');
    this.wx = wx;
    this.features.recorder = false;
    this.features.sidebar = false;
    this.features.timeline = typeof wx.onShareTimeline === 'function';
    this.shareLog = [];               // 分享调用记录 (测试 / 调试)
  }

  systemInfo() {
    let s = null;
    try { if (typeof wx.getWindowInfo === 'function') s = wx.getWindowInfo(); } catch (_) { s = null; }
    if (!s || !s.windowWidth) s = wx.getSystemInfoSync();
    if (!s.pixelRatio) {
      try { if (typeof wx.getDeviceInfo === 'function') s = { ...s, pixelRatio: wx.getDeviceInfo().pixelRatio }; } catch (_) { /* ignore */ }
    }
    return s;
  }

  init(game) {
    super.init(game);
    try {
      if (typeof wx.showShareMenu === 'function') wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
      if (typeof wx.onShareAppMessage === 'function') wx.onShareAppMessage(() => { this.shareLog.push('menu'); return this.shareOptions(); });
      if (typeof wx.onShareTimeline === 'function') wx.onShareTimeline(() => { this.shareLog.push('timeline'); return this.timelineOptions(); });
    } catch (err) { console.warn('[wechat] 分享菜单初始化失败', err); }
  }

  /** 转发卡片 (图片 5:4) */
  shareOptions() {
    return { title: SHARE_TITLE, imageUrl: this.resolveAsset('assets/share.jpg'), query: 'from=share' };
  }

  /** 分享到朋友圈 (单页模式，图片取正方形图) */
  timelineOptions() {
    return { title: SHARE_TITLE, imageUrl: this.resolveAsset('assets/share_timeline.jpg'), query: 'from=timeline' };
  }

  /** 结算面板「分享给好友」：主动转发 */
  share() {
    try {
      wx.shareAppMessage(this.shareOptions());
      this.shareLog.push('button');
      this.lastShare = { ok: true, how: 'card' };
      return Promise.resolve(true);
    } catch (err) {
      this.lastShare = { ok: false, how: 'error' };
      return Promise.resolve(false);
    }
  }
}
