// 微信小游戏平台实现 (无 DOM / BOM，全部走 wx.* API)。官方文档 (developers.weixin.qq.com/minigame)：
//   画布        wx.createCanvas (第一次调用 = 上屏画布)        /dev/api/render/canvas/wx.createCanvas.html
//   图片        wx.createImage
//   音频        wx.createInnerAudioContext({ useWebAudioImplement })  短音效开 WebAudio 实现，语音 / BGM 关
//                                                               /dev/api/media/audio/wx.createInnerAudioContext.html
//   存储        wx.getStorageSync / wx.setStorageSync
//   触摸        wx.onTouchStart / Move / End / Cancel
//   生命周期    wx.onShow / wx.onHide (切后台自动暂停)
//   系统信息    wx.getWindowInfo (safeArea / pixelRatio；老基础库退回 wx.getSystemInfoSync)
//               wx.getMenuButtonBoundingClientRect (右上角胶囊，内容放在它下方)
//   分包        wx.loadSubpackage (音频分包 audio/)              /dev/guide/base-ability/subPackage/useSubPackage.html
//   激励视频    wx.createRewardedVideoAd (全局单例；onClose res.isEnded；onError errCode 1004 = 暂无广告)
//                                                               /dev/api/ad/wx.createRewardedVideoAd.html
//   分享        wx.shareAppMessage / wx.onShareAppMessage (转发给好友)、wx.onShareTimeline (分享到朋友圈，仅安卓)
//               wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
//   更新        wx.getUpdateManager (新版本下载好后提示重启)
// 不包含抖音专属功能：没有侧边栏复访礼包、没有录屏分享。分享不发任何奖励 (避免诱导分享)。
/* global wx */
import { createMiniGameBase, safe } from './minigame.js';

const has = (fn) => typeof wx !== 'undefined' && typeof wx[fn] === 'function';
const G = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : {});
const DEFAULT_TITLE = '次元破绽！这张图毫无破绽……吗？';

/**
 * @param {object} cfg 微信工程根目录 platform-config.js 的内容
 */
export function createWechatPlatform(cfg = {}) {
  const windowInfo = () => (has('getWindowInfo') ? safe(() => wx.getWindowInfo(), null) : null) || safe(() => wx.getSystemInfoSync(), {}) || {};
  const base = createMiniGameBase(wx, cfg, {
    tag: 'wechat',
    windowInfo,
    // 短音效 (预渲染 sfx 池) 用 WebAudio 实现，延迟更低；语音 / BGM 是长音频，用默认实现省内存
    createAudioContext: (short) => (short ? safe(() => wx.createInnerAudioContext({ useWebAudioImplement: true }), null) : null) || wx.createInnerAudioContext(),
    // 1004 (暂无广告) 时微信默认会弹「分享后得奖励」的兜底页；我们不做分享奖励，关掉它
    adOptions: { disableFallbackSharePage: true },
  });

  const shareInfo = (title) => {
    const o = { title: title || cfg.shareTitle || DEFAULT_TITLE, query: '' };
    if (cfg.shareImageUrl) o.imageUrl = cfg.shareImageUrl;
    if (cfg.shareImageUrlId) o.imageUrlId = cfg.shareImageUrlId;
    return o;
  };

  const P = Object.assign(base, {
    name: 'wechat',
    features: { record: false, share: has('shareAppMessage'), sidebar: false, keyboard: false, wheel: false },
    /** 主动转发给好友 (结算页「分享给好友」)。微信不回传是否真的分享了，所以也不可能、也不会发奖励 */
    shareApp: has('shareAppMessage') ? ({ title } = {}) => { safe(() => wx.shareAppMessage(shareInfo(title))); return Promise.resolve(true); } : null,
  });

  // 右上角菜单：转发 + 分享到朋友圈
  if (has('showShareMenu')) safe(() => wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] }));
  if (has('onShareAppMessage')) wx.onShareAppMessage(() => shareInfo());
  if (has('onShareTimeline')) wx.onShareTimeline(() => { const o = shareInfo(); o.query = ''; return o; });

  // 版本更新：新版本下载完成后询问是否重启 (不强制)
  if (has('getUpdateManager')) {
    const um = safe(() => wx.getUpdateManager(), null);
    if (um && um.onUpdateReady) {
      um.onUpdateReady(() => {
        if (!has('showModal')) return;
        wx.showModal({ title: '发现新版本', content: '新版本已经准备好，是否重启游戏？', success: (r) => { if (r && r.confirm) safe(() => um.applyUpdate()); } });
      });
    }
  }

  // AppID 自检：project.config.json 里还是占位 AppID 时在控制台提醒
  if (has('getAccountInfoSync')) {
    const acc = safe(() => wx.getAccountInfoSync(), null);
    const real = acc && acc.miniProgram && acc.miniProgram.appId;
    if (real && /^touristappid$/i.test(real)) console.warn('[wechat] 当前是游客 AppID (touristappid)，只能本地调试；上传前请把 project.config.json 的 appid 改成你的小游戏 AppID (wx 开头)');
  }
  G.__SPOTDIFF_PLATFORM__ = P;
  return P;
}
