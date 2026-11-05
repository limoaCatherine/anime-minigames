// 存档系统：localStorage 持久化关卡进度 (解锁/星级/最佳进度)、每日挑战与音频设置。
// file:// 或隐私模式下 localStorage 可能不可用 → 全部 try/catch，自动退化为内存存储。
import { platform } from '../platform/index.js';

const SETTINGS_KEYS = ['muted', 'bgmOn', 'sfxOn', 'voiceOn', 'volumes', 'settingsVersion'];

const fresh = () => ({
  unlocked: 1,        // 已解锁的最高关卡
  seenUnlocked: 1,    // 选关地图上已播放过"解锁动画"的最高关卡
  cleared: {},        // { 1: true }
  stars: {},          // { 1: 3 } 各关最高星级 (1~3)
  best: {},           // { 5: 0.43 } 各关最佳清除比例 (0~1)
  clearCount: {},     // 各关通关次数
  plays: 0,
  dailyCleared: '',   // 最近一次通关每日挑战的日期
});

export class SaveSystem {
  constructor(key) {
    this.key = key;
    this.data = {
      ...fresh(),
      muted: false,
      bgmOn: true, sfxOn: true, voiceOn: true,
      volumes: null,        // 各声道音量滑块 (MixerSystem)
    };
    this.available = true;
    try {
      const raw = platform.storageGet(key);
      if (raw) {
        Object.assign(this.data, JSON.parse(raw));
        for (const k of ['bgmVol', 'sfxVol', 'voiceVolume']) delete this.data[k];   // v2 旧版音量字段
      }
    } catch (err) {
      this.available = false;
      console.warn('[SaveSystem] localStorage 不可用，存档仅在本次运行中有效');
    }
  }

  get(name, def) {
    return name in this.data ? this.data[name] : def;
  }

  set(name, value) {
    this.data[name] = value;
    this.flush();
  }

  flush() {
    if (!this.available) return;
    try {
      platform.storageSet(this.key, JSON.stringify(this.data));
    } catch (_) {
      this.available = false;
    }
  }

  isCleared(level) { return !!this.data.cleared[level]; }
  bestProgress(level) { return this.data.best[level] || 0; }
  starsOf(level) { return this.data.stars[level] || 0; }
  /** 主线关卡的星星总数 (每日挑战的星星不计入 x/45) */
  get totalStars() { return Object.entries(this.data.stars).reduce((a, [k, v]) => a + (/^\d+$/.test(k) ? v : 0), 0); }

  /**
   * 提交一局结果。progress = 已消除张数 / 总张数；stars = 本局星级 (通关时)
   * @returns {{isNewBest:boolean, newStars:boolean, unlockedLevel:number|null}}
   */
  submit(level, { win, progress, stars = 0 }) {
    this.data.plays = (this.data.plays || 0) + 1;
    let isNewBest = false;
    let newStars = false;
    let unlockedLevel = null;
    if (progress > (this.data.best[level] || 0)) { this.data.best[level] = progress; isNewBest = true; }
    if (win) {
      this.data.cleared[level] = true;
      this.data.clearCount[level] = (this.data.clearCount[level] || 0) + 1;
      if (stars > (this.data.stars[level] || 0)) { this.data.stars[level] = stars; newStars = true; }
      if (typeof level === 'number' && level + 1 > this.data.unlocked) {
        this.data.unlocked = level + 1;
        unlockedLevel = level + 1;
      }
    }
    this.flush();
    return { isNewBest, newStars, unlockedLevel };
  }

  /** 清空进度 (保留设置) */
  reset() {
    const keep = {};
    for (const k of SETTINGS_KEYS) keep[k] = this.data[k];
    this.data = { ...fresh(), ...keep };
    this.flush();
  }
}
