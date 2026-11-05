// 广告服务：激励视频的统一入口 (接口与《美少女合成》anime-stack 一致)。
//
//   ads.showRewardedAd(placement) -> Promise<boolean>   true = 完整看完，可以发奖励 (本作：解锁该关提示)
//   ads.setProvider(fn)                                  注入任意平台实现，fn(placement) 返回 Promise<boolean>
//   ads.stats                                           { shown, rewarded, free }
//
// 运行环境 (由平台层 src/platform 决定)：
//  1. 抖音小游戏 + douyin/config.js 填了 AD_UNIT_ID → tt.createRewardedVideoAd，onClose 的 isEnded=true 才发奖励
//  2. 抖音小游戏但 AD_UNIT_ID 为空 → ads.enabled = false：不显示任何「看广告」界面 (没有占位弹窗)，
//     提示直接免费 (HintSystem.free)，仍按「看过提示」封顶 2 星
//  3. 网页 / 桌面版 → 桩实现：立即视为看完 (没有任何真实广告 SDK)
// 侧边栏复访奖励 (抖音) 通过 grantFree() 给一次免广告的提示。
export const AdConfig = {
  stubDelayMs: 0,           // 网页桩实现模拟广告时长 (毫秒)
};

export class AdService {
  constructor(events, { platform = null } = {}) {
    this.events = events;
    this.platformRef = platform;
    this.provider = null;
    this.freeCredits = 0;
    this.lastResult = null;
    this.stats = { shown: 0, rewarded: 0, free: 0 };
  }

  /** 兼容 1.3：播放次数 */
  get shown() { return this.stats.shown; }

  setProvider(fn) { this.provider = fn; }

  /** 奖励一次免广告 (抖音侧边栏复访) */
  grantFree(n = 1) { this.freeCredits += n; this.events && this.events.emit('ad:free', { credits: this.freeCredits }); }

  /** 是否有可用的激励视频 (网页桩 = true；抖音版 AD_UNIT_ID 为空 = false) */
  get enabled() {
    if (this.provider) return true;
    const p = this.platformRef;
    return !(p && p.adsEnabled === false);
  }

  /** 当前广告后端名 (调试) */
  get backend() {
    if (this.provider) return 'provider';
    const p = this.platformRef;
    return p && p.adBackend ? p.adBackend() : 'stub';
  }

  /**
   * 展示激励视频。
   * @param {string} placement 广告位用途，如 'hint'
   * @returns {Promise<boolean>} 是否完整观看 (应发放奖励)
   */
  showRewardedAd(placement = 'hint') {
    if (this.freeCredits > 0) {
      this.freeCredits--;
      this.stats.free++;
      this.lastResult = { ok: true, free: true };
      return Promise.resolve(true);
    }
    if (!this.enabled) {
      // 没有广告位：调用方本不该走到这里 (界面已隐藏)；直接视为可用，绝不弹出占位广告
      this.stats.free++;
      this.lastResult = { ok: true, free: true, noAds: true };
      return Promise.resolve(true);
    }
    this.stats.shown++;
    const backend = this.backend;
    this.events && this.events.emit('ad:show', { placement, platform: backend });
    const done = (ok) => {
      ok = !!ok;
      if (ok) this.stats.rewarded++;
      if (!this.lastResult) this.lastResult = { ok };
      this.events && this.events.emit('ad:close', { placement, ok });
      return ok;
    };
    this.lastResult = null;
    if (this.provider) return Promise.resolve().then(() => this.provider(placement)).then(done, () => done(false));
    const p = this.platformRef;
    const real = p ? p.showRewardedVideo(placement) : null;     // 抖音：真实激励视频；网页：null (桩)
    if (real) {
      return real.then((r) => {
        if (r && typeof r === 'object') { this.lastResult = r; return r.ok; }
        return r;
      }).then(done, () => done(false));
    }
    console.log(`[AdService] (桩) 激励视频「${placement}」-> 视为观看完成`);
    this.lastResult = { ok: true, stub: true };
    return new Promise((resolve) => setTimeout(() => resolve(true), AdConfig.stubDelayMs)).then(done);
  }

  /** 兼容 1.3 接口：-> {ok} */
  showRewarded(placement) {
    return this.showRewardedAd(placement).then((ok) => ({ ...(this.lastResult || {}), ok }));
  }
}
