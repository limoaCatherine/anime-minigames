// 存档系统：本地存储 (网页 localStorage / 抖音 tt.setStorageSync，见 platform/) 持久化关卡进度 (解锁 / 星级 / 通关)、成就 (沙雕结局 / 彩蛋)、每日挑战与音频设置。
// 桌面版 (Electron) 的 localStorage 保存在 %APPDATA%\AnimeSpotDiff 中。
// file:// 或隐私模式下 localStorage 可能不可用 → 全部 try/catch，自动退化为内存存储。
import { Platform } from '../platform/Platform.js';
const SETTINGS_KEYS = ['muted', 'bgmOn', 'sfxOn', 'voiceOn', 'volumes', 'settingsVersion'];

const fresh = () => ({
  unlocked: 1,        // 已解锁的最高关卡序号 (1 起)
  seenUnlocked: 1,    // 选关地图上已播放过"解锁动画"的最高关卡
  cleared: {},        // { L01: true }
  stars: {},          // { L01: 3 }
  bestTime: {},       // { L01: 73.2 } 秒
  achievements: {},   // { silly_L03: true, egg_L02: true }
  plays: 0,
  dailyCleared: '',   // 最近一次通关每日一图的日期 (YYYY-MM-DD)
  dailyStars: 0,
  dailyPick: null,    // { date, id }：当天抽到的图，当天固定不变
});

export class SaveSystem {
  constructor(key) {
    this.key = key;
    this.data = { ...fresh(), muted: false, bgmOn: true, sfxOn: true, voiceOn: true, volumes: null };
    this.available = true;
    try {
      const raw = Platform.storageGet(key);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (err) {
      this.available = false;
      console.warn('[SaveSystem] 本地存储不可用，存档仅在本次运行中有效');
    }
  }

  get(name, def) { return name in this.data ? this.data[name] : def; }
  set(name, value) { this.data[name] = value; this.flush(); }

  flush() {
    if (!this.available) return;
    try { Platform.storageSet(this.key, JSON.stringify(this.data)); } catch (_) { this.available = false; }
  }

  isCleared(id) { return !!this.data.cleared[id]; }
  starsOf(id) { return this.data.stars[id] || 0; }
  get totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + b, 0); }
  hasAchievement(k) { return !!this.data.achievements[k]; }
  get achievementCount() { return Object.keys(this.data.achievements).length; }

  addAchievement(k) {
    if (this.data.achievements[k]) return false;
    this.data.achievements[k] = true;
    this.flush();
    return true;
  }

  /**
   * 提交一关结果。index = 关卡序号 (1 起)
   * @returns {{newStars:boolean, unlockedLevel:number|null, bestTime:boolean}}
   */
  submit(id, index, { win, stars = 0, time = 0 }) {
    this.data.plays = (this.data.plays || 0) + 1;
    let newStars = false; let unlockedLevel = null; let bestTime = false;
    if (win) {
      this.data.cleared[id] = true;
      if (stars > (this.data.stars[id] || 0)) { this.data.stars[id] = stars; newStars = true; }
      if (!this.data.bestTime[id] || time < this.data.bestTime[id]) { this.data.bestTime[id] = Math.round(time * 10) / 10; bestTime = true; }
      if (index + 1 > this.data.unlocked) { this.data.unlocked = index + 1; unlockedLevel = index + 1; }
    }
    this.flush();
    return { newStars, unlockedLevel, bestTime };
  }

  submitDaily(date, stars) {
    // 先比较再覆盖日期：同一天取最好成绩，新的一天从头算 (旧写法先改日期，导致永远和昨天的星数取最大)
    const prev = this.data.dailyCleared === date ? (this.data.dailyStars || 0) : 0;
    this.data.dailyCleared = date;
    this.data.dailyStars = Math.max(stars, prev);
    this.flush();
  }

  /** 清空进度 (保留设置) */
  reset() {
    const keep = {};
    for (const k of SETTINGS_KEYS) keep[k] = this.data[k];
    this.data = { ...fresh(), ...keep };
    this.flush();
  }
}
