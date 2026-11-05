// 提示系统：显示当前关卡的参考解法 (虚线)。
// 第一次使用某关的提示需要「看激励视频」(AdService)，解锁后该关提示永久免费。
export class HintSystem {
  constructor(events, save, ads) {
    this.events = events;
    this.save = save;
    this.ads = ads;
    this.visible = false;
    this.busy = false;
    this.level = null;
  }

  setLevel(level) {
    this.level = level;
    this.visible = false;
  }

  get unlocked() { return !!this.level && this.save.hintUnlocked(this.level.id); }

  /** 没有可用的激励视频 (抖音版 AD_UNIT_ID 为空)：提示直接免费，不显示任何「看广告」界面 (仍按看过提示封顶星级) */
  get free() { return !this.ads.enabled; }

  /** 现在点提示能不能直接显示 (已解锁或免费) */
  get available() { return this.unlocked || this.free; }

  /** 提示按钮角标：已解锁「免费」/ 需要看广告「广告」/ 没有广告时不显示角标 */
  get tag() { return this.unlocked ? '免费' : this.free ? null : '广告'; }

  /** 请求显示提示：已解锁直接显示，否则先看广告 */
  async request() {
    if (!this.level || this.busy) return false;
    if (this.available) return this.show();
    this.busy = true;
    const level = this.level;     // 看广告期间可能已经换关：奖励发给发起请求的那一关
    try {
      const ok = await this.ads.showRewardedAd('hint');
      if (!ok) { this.events.emit('hint:failed', this.ads.lastResult || { ok: false }); return false; }
      this.save.unlockHint(level.id);
      if (this.level !== level) return false;
      return this.show();
    } finally {
      this.busy = false;
    }
  }

  show() {
    this.visible = true;
    this.events.emit('hint:show', { id: this.level.id });
    return true;
  }

  hide() { this.visible = false; }

  get points() { return this.level ? this.level.solution : null; }
}
