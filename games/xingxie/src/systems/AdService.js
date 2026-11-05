// 广告服务：激励视频 (复活 / 换一批 / 结算翻倍)。
//
// 对外入口：
//   ads.enabled                         -> 当前是否有可用的激励视频 (false 时界面隐藏所有「看广告」按钮)
//   ads.showRewardedAd(placement)       -> Promise<boolean>   (true = 看完，发放奖励)
// 失败 / 中途关闭一律 resolve(false)，调用方不发奖励、也不扣次数。
//
// 何时 enabled：
//  1. 抖音 / 微信小游戏，且 config/PlatformConfig.js 对应平台 (douyin / wechat) 填了 rewardedAdUnitId
//     → tt.createRewardedVideoAd / wx.createRewardedVideoAd (两边接口同形：load / show / onClose(res.isEnded) / onError)
//     · 实例全局只建一个、开局预加载；onClose 的 res.isEnded 为 true 才算看完
//     · show 失败先 load 再 show 一次，仍失败 → 提示「广告暂时没准备好」并返回 false (兜底)
//  2. 通过 ads.setProvider(fn) 注入了其他平台的广告实现 (fn 返回 Promise<boolean>)
//  其余情况 (网页版 / exe / 小游戏但广告位 ID 留空) → enabled = false：
//     不显示看广告按钮、不弹任何占位广告；复活改为每局免费一次「再试一次」。
import { PlatformConfig } from '../config/PlatformConfig.js';
import { platform } from '../core/platform/index.js';

export class AdService {
  constructor(events) {
    this.events = events;
    this.provider = null;          // 自定义平台实现
    this._ttAd = null;
    this._pending = null;          // 正在展示的真实广告 { resolve }
    this.stats = { shown: 0, rewarded: 0, errors: 0 };
    this.lastError = null;
    this.adUnitId = platform.name === 'wechat' ? PlatformConfig.wechat.rewardedAdUnitId : PlatformConfig.douyin.rewardedAdUnitId;
    if (this.realAvailable) this._ensureTT();
  }

  setProvider(fn) { this.provider = fn; this.events.emit('ad:availability', { enabled: this.enabled }); }

  /** 是否走真实激励视频 (小游戏 + 已填广告位) */
  get realAvailable() { return !!(platform.rewardedAdApi && this.adUnitId); }
  /** 是否有可用的激励视频；false 时隐藏所有看广告按钮 */
  get enabled() { return !!this.provider || this.realAvailable; }
  get mode() { return this.provider ? 'provider' : this.realAvailable ? (platform.name === 'wechat' ? 'wechat' : 'douyin') : 'off'; }

  /**
   * 展示激励视频。
   * @param {string} placement 广告位用途 ('revive' | 'refresh' | 'double')，便于统计
   * @returns {Promise<boolean>} 是否完整观看 (应发放奖励)
   */
  showRewardedAd(placement = 'revive') {
    // 没有可用广告：按钮本应已隐藏；被误调时直接返回 false，不弹任何占位
    if (!this.enabled) { this.lastReason = 'disabled'; return Promise.resolve(false); }
    this.stats.shown++;
    const done = (ok, reason) => {
      if (ok) this.stats.rewarded++;
      this.lastReason = reason || (ok ? 'ended' : 'early');
      this.events.emit('ad:closed', { placement, rewarded: !!ok, reason: reason || (ok ? 'ended' : 'early') });
      return !!ok;
    };
    if (this.provider) return Promise.resolve(this.provider(placement)).then((ok) => done(ok), () => done(false, 'error'));
    if (this.realAvailable) {
      this.events.emit('ad:open', { placement, real: true });
      return this._showTT().then((r) => done(r.ok, r.reason), () => done(false, 'error'));
    }
    return Promise.resolve(false);
  }

  _ensureTT() {
    if (this._ttAd) return this._ttAd;
    const tt = platform.rewardedAdApi;
    try {
      const ad = tt.createRewardedVideoAd({ adUnitId: this.adUnitId });
      ad.onClose((res) => {
        const p = this._pending; this._pending = null;
        // 旧基础库 onClose 可能不带参数，按看完处理 (与平台示例一致)；新版以 isEnded 为准
        const ended = res === undefined ? true : !!(res && res.isEnded);
        if (p) p.resolve({ ok: ended, reason: ended ? 'ended' : 'early', count: res && res.count });
      });
      ad.onError((err) => {
        this.stats.errors++;
        this.lastError = err;
        console.warn('[AdService] 激励视频错误', err);
        const p = this._pending;
        if (p && p.showing === false) { this._pending = null; this._notifyFail(); p.resolve({ ok: false, reason: 'error', err }); }
      });
      if (ad.load) ad.load().catch(() => {});
      this._ttAd = ad;
    } catch (err) {
      console.warn('[AdService] 创建激励视频失败', err);
      this._ttAd = null;
    }
    return this._ttAd;
  }

  _showTT() {
    const ad = this._ensureTT();
    if (!ad) { this._notifyFail(); return Promise.resolve({ ok: false, reason: 'error' }); }
    return new Promise((resolve) => {
      const p = { resolve, showing: false };
      this._pending = p;
      const fail = (err) => {
        if (this._pending !== p) return;
        this._pending = null;
        this.lastError = err;
        this._notifyFail();
        resolve({ ok: false, reason: 'error', err });
      };
      const show = () => ad.show().then(() => { p.showing = true; });
      show().catch(() => (ad.load ? ad.load() : Promise.reject()).then(show)).catch(fail);
    });
  }

  _notifyFail() {
    this.events.emit('ad:error', { message: '广告暂时没准备好，稍后再试' });
  }
}
