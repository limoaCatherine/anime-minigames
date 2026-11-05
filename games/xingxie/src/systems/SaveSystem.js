// 存档：星屑币、永久天赋、角色解锁、战绩统计、设置 (音量 / 开关 / 难度 / 上次角色)。
// 浏览器里存 localStorage；Electron 桌面版把 userData 指到 %APPDATA%/AnimeSurvivor，localStorage 也就落在那里；
// 抖音小游戏用 tt.setStorageSync / tt.getStorageSync (经 core/platform)。
// 无法写入 (隐私模式等) 时退化为内存存储。
import { CHARACTERS } from '../config/CharacterConfig.js';
import { TALENTS } from '../config/ProgressConfig.js';
import { platform } from '../core/platform/index.js';

export const SAVE_VERSION = 1;
const TALENT_MAP = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

function blank() {
  return {
    version: SAVE_VERSION,
    coins: 0,
    talents: {},
    unlocked: { hikari: true },
    stats: { runs: 0, clears: 0, nightmareClears: 0, sheepKills: 0, noxKills: 0, bestTime: 0, bestKills: 0, totalKills: 0, bestLevel: 0, evolutions: {} },
    lastChar: 'hikari',
    difficulty: 'normal',
    muted: false, voiceOn: true, bgmOn: true,
    volumes: null,
    sidebarDay: '',       // 抖音侧边栏复访奖励最近一次领取的日期 (YYYY-MM-DD)
  };
}

export class SaveSystem {
  constructor(key) {
    this.key = key;
    this.data = blank();
    this.available = true;
    let raw = null;
    try {
      raw = platform.storageAvailable ? platform.storageGet(key) : null;
      if (!platform.storageAvailable) this.available = false;
    } catch (_) {
      this.available = false;
      console.warn('[SaveSystem] 存档不可用，本次进度只保存在内存里');
    }
    if (raw) {
      try {
        this.data = SaveSystem.sanitize(JSON.parse(raw));
      } catch (_) {
        // 存档损坏：备份原文，换一份新存档继续玩，不崩溃
        console.warn('[SaveSystem] 存档损坏，已备份并重置');
        try { platform.storageSet(`${key}.broken`, raw); } catch (_e) { /* ignore */ }
        this.data = blank();
      }
    }
  }

  /** 修正类型 / 范围：防止手改或旧版存档导致负数、NaN、越级天赋 */
  static sanitize(old) {
    const b = blank();
    if (!old || typeof old !== 'object' || Array.isArray(old)) return b;
    const num = (v, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 ? n : d; };
    const d = { ...b, ...old };
    d.coins = num(old.coins);
    d.stats = { ...b.stats };
    const st = old.stats && typeof old.stats === 'object' ? old.stats : {};
    for (const k of Object.keys(b.stats)) if (k !== 'evolutions') d.stats[k] = num(st[k]);
    d.stats.evolutions = {};
    if (st.evolutions && typeof st.evolutions === 'object') for (const k in st.evolutions) d.stats.evolutions[k] = num(st.evolutions[k]);
    d.unlocked = { ...b.unlocked };
    if (old.unlocked && typeof old.unlocked === 'object') for (const c of CHARACTERS) if (old.unlocked[c.id] === true) d.unlocked[c.id] = true;
    d.talents = {};
    if (old.talents && typeof old.talents === 'object') for (const id in TALENT_MAP) { const lv = Math.min(TALENT_MAP[id].max, num(old.talents[id])); if (lv) d.talents[id] = lv; }
    if (!CHARACTERS.find((c) => c.id === d.lastChar)) d.lastChar = 'hikari';
    if (d.difficulty !== 'normal' && d.difficulty !== 'nightmare') d.difficulty = 'normal';
    for (const k of ['muted', 'voiceOn', 'bgmOn']) d[k] = typeof old[k] === 'boolean' ? old[k] : b[k];
    if (d.volumes != null && typeof d.volumes !== 'object') d.volumes = null;
    d.sidebarDay = typeof old.sidebarDay === 'string' ? old.sidebarDay.slice(0, 10) : '';
    return d;
  }

  get(name, def) { return name in this.data && this.data[name] != null ? this.data[name] : def; }
  set(name, value) { this.data[name] = value; this.flush(); }

  flush() {
    if (!this.available) return;
    try { platform.storageSet(this.key, JSON.stringify(this.data)); } catch (_) { this.available = false; }
  }

  get coins() { return this.data.coins; }
  get stats() { return this.data.stats; }

  addCoins(n) { this.data.coins += Math.max(0, Math.round(n)); this.flush(); }
  spend(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n) || n < 0 || this.data.coins < n) return false;
    this.data.coins -= n; this.flush(); return true;
  }

  // ---- 天赋 ----
  talentLevel(id) { return this.data.talents[id] || 0; }
  talentCost(id) {
    const t = TALENT_MAP[id]; const lv = this.talentLevel(id);
    return lv >= t.max ? null : t.costs[lv];
  }
  buyTalent(id) {
    const cost = this.talentCost(id);
    if (cost == null || !this.spend(cost)) return false;
    this.data.talents[id] = this.talentLevel(id) + 1;
    this.flush();
    return true;
  }
  talents() { return { ...this.data.talents }; }

  // ---- 角色 ----
  isUnlocked(id) { return !!this.data.unlocked[id]; }
  /** 解锁条件是否满足 (不花钱的条件)；返回 {ok, cost} */
  unlockState(c) {
    const u = c.unlock; const s = this.data.stats;
    if (this.isUnlocked(c.id)) return { unlocked: true };
    if (u.type === 'coins') return { unlocked: false, cost: u.cost, text: `${u.cost} 星屑币` };
    if (u.type === 'clears') return { unlocked: false, free: s.clears >= u.count, text: u.text };
    if (u.type === 'noxKills') return { unlocked: false, free: s.noxKills >= u.count, cost: u.altCost, text: u.text };
    return { unlocked: false };
  }
  /** 满足条件就免费解锁；否则尝试花钱 */
  tryUnlock(c) {
    const st = this.unlockState(c);
    if (st.unlocked) return true;
    if (st.free || (st.cost != null && this.spend(st.cost))) {
      this.data.unlocked[c.id] = true; this.flush(); return true;
    }
    return false;
  }
  /** 战绩达到条件的角色自动解锁，返回新解锁列表 */
  autoUnlock() {
    const out = [];
    for (const c of CHARACTERS) {
      const st = this.unlockState(c);
      if (!st.unlocked && st.free) { this.data.unlocked[c.id] = true; out.push(c); }
    }
    if (out.length) this.flush();
    return out;
  }

  /** 记录一局结果 */
  recordRun(sum) {
    const s = this.data.stats;
    s.runs++;
    if (sum.won) { s.clears++; if (sum.difficulty === 'nightmare') s.nightmareClears++; }
    s.sheepKills += sum.bossKills.sheepKing || 0;
    s.noxKills += sum.bossKills.nox || 0;
    s.bestTime = Math.max(s.bestTime, Math.floor(sum.time));
    s.bestKills = Math.max(s.bestKills, sum.kills);
    s.bestLevel = Math.max(s.bestLevel, sum.level);
    s.totalKills += sum.kills;
    for (const e of sum.evolutions) s.evolutions[e.id] = (s.evolutions[e.id] || 0) + 1;
    this.flush();
  }

  resetProgress() {
    const keep = { muted: this.data.muted, voiceOn: this.data.voiceOn, bgmOn: this.data.bgmOn, volumes: this.data.volumes, sidebarDay: this.data.sidebarDay };
    this.data = { ...blank(), ...keep };
    this.flush();
  }
}
