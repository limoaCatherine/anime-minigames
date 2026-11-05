// 存档系统：使用平台存储 (网页 localStorage / 抖音 tt.setStorageSync) 持久化每关星级、最少用墨、已解锁的提示与设置。
// 隐私模式等无法写入时自动退化为内存存储。
// 版本迁移：v2 (40 关) 首次启动时若没有 v2 存档，会读取旧的 v1 (20 关) 存档，
// 保留解锁进度 / 已解锁提示 / 设置，并写入新键 (旧键保留不删，便于回退)。
// 存档版本 3 (1.2)：第 10~20 关在 40 关版本里重新设计过，旧 v1 存档带来的这些关的星级 / 最少用墨作废
// (通关记录保留 -> 后面的关卡不会重新上锁)；选关界面在这些关上显示「新」角标。
// 存档版本 4 (1.3)：第 4~40 关为「每关一个关键点」重新设计 (罩子不再通吃)，旧星级 / 最少用墨作废，
// 通关记录 / 解锁 / 提示保留，选关界面显示「新」角标。
// 损坏恢复：每次成功读档后把内容备份到 <key>.bak；主存档损坏时从备份恢复，损坏的原文另存到 <key>.corrupt。
export const SAVE_VERSION = 4;
/** 40 关版本里重新设计过的关卡 (v1 存档里的星级不再有效) */
export const REDESIGNED_LEVELS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
/** 1.3 重新设计的关卡 (存档版本 < 4 里的星级不再有效) */
export const REDESIGNED_LEVELS_V13 = Array.from({ length: 37 }, (_, i) => i + 4);

// 设置版本：与关卡进度版本独立。提升版本时按顺序执行迁移 (没有 settingsVersion 的存档视为 v1)
export const SETTINGS_VERSION = 3;
const SETTINGS_MIGRATIONS = {
  // v1 -> v2 (声音改版)：整体音量约减半、新增背景音乐。丢弃旧存档里保存的音量，改用新的默认值
  2: (data) => { delete data.voiceVolume; delete data.sfxVolume; delete data.bgmVolume; },
  // v2 -> v3：默认音量再降低约 40~50% (语音 0.3 / 音效 0.12 / 音乐 0.15)，改为「总音量 + 各声道」滑块；丢弃旧的音量值
  3: (data) => { delete data.voiceVolume; delete data.sfxVolume; delete data.bgmVolume; delete data.volumes; },
};

/** 把任意旧存档对象规整为当前格式 (容错：缺字段、类型不对、关卡号越界都会被丢弃) */
export function migrateSave(old, maxLevel = 40, opts = {}) {
  const out = { levels: {}, hints: {} };
  const reset = new Set(opts.resetStars || []);
  if (!old || typeof old !== 'object') return out;
  const levels = old.levels && typeof old.levels === 'object' ? old.levels : {};
  for (const [k, rec] of Object.entries(levels)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id < 1 || id > maxLevel || !rec || typeof rec !== 'object') continue;
    const stars = Math.max(0, Math.min(3, Math.round(Number(rec.stars) || 0)));
    out.levels[id] = {
      stars,
      bestInk: Number.isFinite(rec.bestInk) ? Math.round(rec.bestInk) : null,
      clears: Math.max(0, Math.round(Number(rec.clears) || (stars > 0 ? 1 : 0))),
    };
    if (rec.redesigned) out.levels[id].redesigned = true;
    if (reset.has(id) && (stars > 0 || out.levels[id].clears > 0)) {
      // 关卡已重新设计：旧星级 / 最少用墨作废，通关次数保留 (解锁不受影响)
      out.levels[id] = { stars: 0, bestInk: null, clears: Math.max(1, out.levels[id].clears), redesigned: true };
    }
  }
  const hints = old.hints && typeof old.hints === 'object' ? old.hints : {};
  for (const [k, v] of Object.entries(hints)) {
    const id = Number(k);
    if (v && Number.isInteger(id) && id >= 1 && id <= maxLevel) out.hints[id] = true;
  }
  for (const f of ['plays', 'lastLevel']) if (Number.isFinite(old[f])) out[f] = old[f];
  for (const f of ['muted', 'voiceOn', 'bgmOn']) if (typeof old[f] === 'boolean') out[f] = old[f];
  for (const f of ['sfxVolume', 'voiceVolume', 'bgmVolume']) if (Number.isFinite(old[f])) out[f] = Math.max(0, Math.min(1, old[f]));
  if (Number.isInteger(old.settingsVersion)) out.settingsVersion = old.settingsVersion;
  if (old.volumes && typeof old.volumes === 'object') out.volumes = { ...old.volumes };
  if (out.lastLevel != null) out.lastLevel = Math.max(1, Math.min(maxLevel, Math.round(out.lastLevel)));
  return out;
}

/** v2 存档里的这条记录是否原封不动地来自 v1 存档 (40 关版本首次启动时直接复制过来的) */
function sameRecord(a, b) {
  return !!a && !!b && (Number(a.stars) || 0) === (Number(b.stars) || 0) && (a.bestInk ?? null) === (b.bestInk ?? null);
}

export class SaveSystem {
  /**
   * @param {string} key 当前存档键
   * @param {{legacyKeys?: string[], maxLevel?: number}} [opts]
   */
  constructor(key, opts = {}) {
    this.key = key;
    this.maxLevel = opts.maxLevel || 40;
    this.migratedFrom = null;
    this.data = {
      levels: {},        // { [id]: { stars: 0..3, bestInk: number, clears: number } }
      hints: {},         // { [id]: true } 看过广告解锁的提示 (之后免费)
      plays: 0,
      muted: false,
      voiceOn: true,
      lastLevel: 1,
      version: SAVE_VERSION,
      settingsVersion: SETTINGS_VERSION,
    };
    let loaded = false;
    this.available = true;
    // 存储由平台层传入 (Game 总是传)；无头测试不传时退回全局 localStorage
    if (opts.storage !== undefined) this.ls = opts.storage;
    else { try { this.ls = typeof window !== 'undefined' ? window.localStorage : null; } catch (_) { this.ls = null; } }
    try {
      const ls = this.ls;
      let raw = ls && ls.getItem(key);
      const parse = (text) => {
        const obj = JSON.parse(text);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad save');
        return obj;
      };
      let parsed = null;
      if (raw) {
        try { parsed = parse(raw); } catch (_) {
          // 主存档损坏：保留原文以便排查，尝试用上次的备份恢复
          console.warn('[SaveSystem] 存档损坏，尝试从备份恢复');
          try { ls.setItem(`${key}.corrupt`, raw); } catch (_) { /* ignore */ }
          this.recoveredFromBackup = false;
          const bak = ls.getItem(`${key}.bak`);
          if (bak) { try { parsed = parse(bak); this.recoveredFromBackup = true; } catch (_) { /* 备份也坏了 */ } }
          this.corrupted = true;
        }
      }
      if (parsed) {
        const ver = Number(parsed.version) || 2;
        let resetStars = [];
        if (ver < 3) {
          // v2 -> v3：只重置「原封不动来自 v1 存档」的重新设计关卡 (玩家在 40 关版本里重新打过的成绩保留)
          let v1 = null;
          for (const lk of opts.legacyKeys || []) { try { const t = ls.getItem(lk); if (t) { v1 = parse(t); break; } } catch (_) { /* ignore */ } }
          if (v1 && v1.levels) resetStars = REDESIGNED_LEVELS.filter((id) => sameRecord(parsed.levels && parsed.levels[id], v1.levels[id]));
        }
        if (ver < 4) resetStars = [...new Set([...resetStars, ...REDESIGNED_LEVELS_V13])];
        Object.assign(this.data, { settingsVersion: 1 }, migrateSave(parsed, this.maxLevel, { resetStars }), { version: SAVE_VERSION });
        loaded = true;
        if (ver < SAVE_VERSION || this.corrupted) this.flush();
      } else if (ls) {
        for (const lk of opts.legacyKeys || []) {
          const old = ls.getItem(lk);
          if (!old) continue;
          try {
            Object.assign(this.data, { settingsVersion: 1 }, migrateSave(parse(old), this.maxLevel, { resetStars: [...new Set([...REDESIGNED_LEVELS, ...REDESIGNED_LEVELS_V13])] }), { version: SAVE_VERSION });
            this.migratedFrom = lk;
            loaded = true;
            console.info(`[SaveSystem] 已从旧存档 ${lk} 迁移`);
          } catch (_) { /* 旧存档损坏：忽略，从头开始 */ }
          break;
        }
        if (this.migratedFrom || this.corrupted) this.flush();
      }
      if (loaded && ls) { try { ls.setItem(`${key}.bak`, JSON.stringify(this.data)); } catch (_) { /* ignore */ } }
    } catch (err) {
      this.available = false;
      console.warn('[SaveSystem] 存储不可用，存档仅在本次运行中有效');
    }
    this.migrateSettings(loaded);
  }

  /** 设置迁移：旧版本存档里保存的 (较大的) 音量不再沿用 */
  migrateSettings(loaded) {
    const from = loaded ? (this.data.settingsVersion || 1) : SETTINGS_VERSION;
    for (let v = from + 1; v <= SETTINGS_VERSION; v++) if (SETTINGS_MIGRATIONS[v]) SETTINGS_MIGRATIONS[v](this.data);
    if (this.data.settingsVersion !== SETTINGS_VERSION) {
      this.settingsMigratedFrom = from;
      this.data.settingsVersion = SETTINGS_VERSION;
      this.flush();
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
    if (!this.available || !this.ls) return;
    try {
      this.ls.setItem(this.key, JSON.stringify(this.data));
    } catch (_) {
      this.available = false;
    }
  }

  stars(id) { return (this.data.levels[id] && this.data.levels[id].stars) || 0; }

  /** 通过过该关 (星级被重置的重新设计关卡也算通过过) */
  isCleared(id) { const r = this.data.levels[id]; return !!r && (r.stars > 0 || r.clears > 0); }

  /** 旧存档通过过、但关卡已重新设计 (星级作废，还没在新版里重新通关) */
  isRedesigned(id) { const r = this.data.levels[id]; return !!r && !!r.redesigned && !(r.stars > 0); }

  /** 第 1 关总是解锁；之后需要通过上一关 */
  isUnlocked(id) { return id === 1 || this.isCleared(id - 1); }

  get totalStars() { return Object.values(this.data.levels).reduce((s, l) => s + (l.stars || 0), 0); }

  /** 提交过关成绩，返回 { newBest, prevStars } */
  submit(id, stars, inkUsed) {
    const rec = this.data.levels[id] || { stars: 0, bestInk: null, clears: 0 };
    const prevStars = rec.stars;
    rec.stars = Math.max(rec.stars, stars);
    const ink = Math.round(inkUsed);
    const newBest = rec.bestInk == null || ink < rec.bestInk;
    if (newBest) rec.bestInk = ink;
    rec.clears = (rec.clears || 0) + 1;
    delete rec.redesigned;
    this.data.levels[id] = rec;
    this.flush();
    return { newBest, prevStars };
  }

  hintUnlocked(id) { return !!this.data.hints[id]; }

  unlockHint(id) { this.data.hints[id] = true; this.flush(); }

  reset() {
    this.data.levels = {};
    this.data.hints = {};
    this.flush();
  }
}
