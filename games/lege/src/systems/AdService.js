// 广告服务：激励视频 (看广告复活 / 将来可扩展为看广告得道具)。
//
// 对外只有一个入口：  ads.showRewardedAd(placement) -> Promise<boolean>   (true = 看完，发放奖励)
//
// 运行环境判断：
//  1. 抖音小游戏 (platform/DouyinPlatform.js，douyin.config.js 里填了 rewardedAdUnitId) → tt.createRewardedVideoAd：
//     onClose 的 isEnded=true 才发奖励；中途关闭 / onError → 不发奖励 (可在配置里改 rewardOnAdError)
//  2. 其他环境 (含抖音里还没填广告位 id 的开发期) (浏览器 / file://) → 占位广告：画面上显示「广告占位」+ 5 秒倒计时，**不含任何真实广告 SDK**
//  3. 也可以通过 ads.setProvider(fn) 注入任意平台的实现 (微信 wx.createRewardedVideoAd 等)，fn 返回 Promise<boolean>
import { GameConfig } from '../config/GameConfig.js';
import { platform } from '../platform/index.js';

export class AdService {
  constructor(events) {
    this.events = events;
    this.provider = null;          // 自定义平台实现
    this.fake = null;              // 占位广告状态 { placement, time, duration, resolve }
    this.fakeDuration = GameConfig.ad.fakeDuration;
    this.lastResult = null;
    this.stats = { shown: 0, rewarded: 0 };
  }

  setProvider(fn) { this.provider = fn; }

  get isShowingFake() { return !!this.fake; }

  /**
   * 展示激励视频。
   * @param {string} placement 广告位用途 (如 'revive')，便于统计
   * @returns {Promise<boolean>} 是否完整观看 (应发放奖励)
   */
  showRewardedAd(placement = 'revive') {
    this.stats.shown++;
    this.lastResult = null;
    const done = (ok) => { if (ok) this.stats.rewarded++; this.events.emit('ad:closed', { placement, rewarded: ok }); return ok; };
    if (this.provider) return Promise.resolve(this.provider(placement)).then(done, () => done(false));
    const real = platform.showRewardedAd(placement);      // 抖音：真实激励视频；网页 / 未填广告位：null
    if (real) {
      // 真广告播放期间：BGM / 语音 / 音效全部暂停，关掉广告再恢复
      this.events.emit('app:hidden', { reason: 'ad' });
      return real.then((r) => { this.events.emit('app:visible', { reason: 'ad' }); this.lastResult = r; if (!r.rewarded && r.reason !== 'ended') this.events.emit('ad:notRewarded', r); return r.rewarded; })
        .then(done, () => done(false));
    }
    return new Promise((resolve) => {
      this.fake = { placement, time: 0, duration: this.fakeDuration, resolve, lastTick: Math.ceil(this.fakeDuration) };
      this.events.emit('ad:open', { placement });
    }).then(done);
  }

  // —— 占位广告：由场景每帧驱动、由 UI (ui/AdOverlay.js) 绘制 ——
  update(dt) {
    const f = this.fake;
    if (!f) return;
    f.time += dt;
    const left = Math.ceil(Math.max(0, f.duration - f.time));
    if (left < f.lastTick) { f.lastTick = left; if (left > 0) this.events.emit('ad:tick', { left }); }
  }

  get fakeRemaining() { return this.fake ? Math.max(0, this.fake.duration - this.fake.time) : 0; }
  get fakeFinished() { return !!this.fake && this.fake.time >= this.fake.duration; }

  /** 用户在占位广告上点击「领取奖励」(倒计时结束后) 或「关闭」(提前关闭 = 无奖励) */
  closeFake(rewarded) {
    const f = this.fake;
    if (!f) return;
    this.fake = null;
    f.resolve(!!rewarded && f.time >= f.duration);
  }
}
