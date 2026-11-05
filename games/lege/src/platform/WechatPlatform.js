// 微信小游戏平台：只用官方 wx.* API (与抖音 tt.* 基本同名，复用 DouyinPlatform 的实现，只覆盖差异)。
//   画布 / 图片 / 音频 / 存储 / 触摸 / 分包 / 激励视频：同抖音 (wx.createCanvas、wx.createImage、wx.createInnerAudioContext、
//        wx.getStorageSync、wx.onTouchStart…、wx.loadSubpackage、wx.createRewardedVideoAd)
//   屏幕      wx.getWindowInfo() (基础库 2.20.1+，旧版回退 wx.getSystemInfoSync()) 的 safeArea + 右上角胶囊
//   转发      wx.shareAppMessage (结算页「分享给好友」) + wx.onShareAppMessage (右上角菜单「转发」)
//   朋友圈    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) + wx.onShareTimeline (仅 Android，beta)
//   生命周期  wx.onShow / wx.onHide / wx.onAudioInterruptionBegin/End
// 微信没有抖音的「录屏分享」和「侧边栏复访」：这两项能力恒为 false，游戏里对应的按钮 / 礼包不出现。
// 配置：wechat.config.js (GameGlobal.WECHAT_CONFIG)，appid 与广告位 ID 只在这一个文件里填。
import { DouyinPlatform, has } from './DouyinPlatform.js';

export class WechatPlatform extends DouyinPlatform {
  constructor(wx) {
    super(wx);
    this.name = 'wechat';
    this.isDouyin = false;
    this.isWechat = true;
    this.wx = wx;
    // 有的基础库默认遵循静音键 (iOS 静音时没声音)；游戏音效跟随系统媒体音量即可
    if (has(wx, 'setInnerAudioOption')) this._try(() => wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }));
  }

  static loadConfig() {
    const g = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
    const cfg = g && g.WECHAT_CONFIG;
    return Object.assign({
      appid: '', rewardedAdUnitId: '', freeReviveWithoutAd: true, rewardOnAdError: false,
      shareTitle: '叠三张就消！你能清空这一桌美少女吗？',
      shareImage: 'assets/share.png',                 // 转发卡片 5:4
      timelineTitle: '《美少女了个美》叠三张就消，来试试能过几关',
      timelineImage: 'assets/share_timeline.png',     // 朋友圈卡片 1:1
      shareTimeline: true,
    }, cfg || {});
  }

  _capabilities(wx) {
    return {
      share: has(wx, 'shareAppMessage'),
      timeline: has(wx, 'onShareTimeline') && this.config.shareTimeline !== false,
      record: false,     // 微信无抖音式录屏分享
      sidebar: false,    // 微信无侧边栏复访
      rewardedAd: has(wx, 'createRewardedVideoAd') && DouyinPlatform.isRealId(this.config.rewardedAdUnitId),
    };
  }

  /** 右上角菜单：转发 + 分享到朋友圈 */
  _initShareMenu(wx) {
    if (has(wx, 'onShareAppMessage')) wx.onShareAppMessage(() => this.shareParams());
    const timeline = has(wx, 'onShareTimeline') && this.config.shareTimeline !== false;
    if (timeline) wx.onShareTimeline(() => this.timelineParams());
    if (has(wx, 'showShareMenu')) {
      this._try(() => wx.showShareMenu({ withShareTicket: false, menus: timeline ? ['shareAppMessage', 'shareTimeline'] : ['shareAppMessage'] }));
    }
  }

  timelineParams() {
    return { title: this.config.timelineTitle || this.config.shareTitle, imageUrl: this.config.timelineImage, query: 'from=timeline' };
  }

  /** 微信 shareAppMessage 没有 success/fail 回调 (调用即拉起转发面板) */
  share(extra = {}) {
    if (!this.capabilities.share) return Promise.resolve(false);
    this._try(() => this.wx.shareAppMessage(this.shareParams(extra)));
    return Promise.resolve(true);
  }

  // 没有录屏 / 侧边栏
  startRecord() { return false; }
  stopRecord() { return Promise.resolve(null); }
  shareVideo() { return Promise.resolve(false); }
  checkSidebar() { return Promise.resolve(false); }
  launchedFromSidebar() { return false; }
  navigateToSidebar() { return Promise.resolve(false); }

  /** 屏幕信息：优先 wx.getWindowInfo (新接口)，旧基础库回退 getSystemInfoSync */
  viewport() {
    const wx = this.wx;
    const win = this._try(() => (has(wx, 'getWindowInfo') ? wx.getWindowInfo() : null), null);
    const dev = this._try(() => (has(wx, 'getDeviceInfo') ? wx.getDeviceInfo() : null), null);
    if (win && win.windowWidth) {
      const keep = this.sys;
      this.sys = { ...keep, ...win, pixelRatio: win.pixelRatio || (dev && dev.pixelRatio) || keep.pixelRatio };
      const v = super.viewport();
      this.sys = keep;
      return v;
    }
    return super.viewport();
  }
}
