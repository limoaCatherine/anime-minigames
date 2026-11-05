// 广告服务：激励视频 (看广告得精确提示 / 理智回满)。
//
// 统一广告策略 (v1.3，网页 / 桌面 / 抖音 / 微信一致，详见 GameConfig.ad)：
//   ads.enabled === false (没填激励视频广告位 id / 平台没有广告能力)
//       → 游戏里不出现任何「看广告」按钮，也没有占位广告；提示和复活改为免费 (提示有冷却，复活每关 1 次)
//   ads.enabled === true  → 「看广告」入口自动出现，ads.showRewardedAd(placement) 拉起平台激励视频
//
// 平台实现：Platform.adsAvailable() 判断是否已配置；Platform.rewardedAd(placement) 返回 Promise<true | false | 'error'>
//   抖音 tt.createRewardedVideoAd / 微信 wx.createRewardedVideoAd，广告位 id 写在各自工程的 platform-config.js
//   结果：true = 看完 (发奖励)；false = 中途关闭；'error' = 拉取失败 / 暂无广告 (1004 等)，不发奖励，提示稍后再试
// 也可以 ads.setProvider(fn) 注入任意实现 (自动化测试用)，fn 返回 Promise<boolean>。
import { Platform } from '../platform/Platform.js';

export class AdService {
  constructor(events) {
    this.events = events;
    this.provider = null;
    this.stats = { shown: 0, rewarded: 0 };
  }

  setProvider(fn) { this.provider = fn; }

  /** 是否有真实激励视频可用 (决定 UI 上是否出现「看广告」按钮) */
  get enabled() {
    if (this.provider) return true;
    try { return !!(Platform.adsAvailable && Platform.adsAvailable()); } catch (_) { return false; }
  }

  /**
   * 展示激励视频。
   * @param {string} placement 广告位用途 ('hint' / 'revive')，便于统计
   * @returns {Promise<boolean>} 是否完整观看 (应发放奖励)
   */
  showRewardedAd(placement = 'hint') {
    this.stats.shown++;
    const done = (ok) => { if (ok) this.stats.rewarded++; this.events.emit('ad:closed', { placement, rewarded: ok }); return ok; };
    if (this.provider) return Promise.resolve(this.provider(placement)).then(done, () => done(false));
    const real = this.enabled && Platform.rewardedAd ? Platform.rewardedAd(placement) : null;
    if (!real) { this.events.emit('ad:error', { placement }); return Promise.resolve(done(false)); }
    return Promise.resolve(real).then((r) => {
      if (r === 'error') this.events.emit('ad:error', { placement });
      return done(r === true);
    }, () => { this.events.emit('ad:error', { placement }); return done(false); });
  }

  update() {}
}
