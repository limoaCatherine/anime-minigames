// 每日一图：每天按日期从「已通关的找茬关」里抽一张，限时 + 理智更少。没有通关过任何找茬关时固定第 1 关。
import { LEVELS } from './LevelConfig.js';

export const DailyConfig = {
  timeLimit: 120,     // 秒
  sanity: 2,
  unlockAfter: 1,     // 通关几关后开放
};

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyLevelFor(key, save) {
  // 当天第一次抽到哪张就固定哪张 (否则白天多通关一关，抽签池变了，每日一图会中途换图)
  const saved = save && save.get('dailyPick');
  if (saved && saved.date === key) { const lv = LEVELS.find((l) => l.id === saved.id); if (lv) return lv; }
  const lv = pickDaily(key, save);
  if (save) save.set('dailyPick', { date: key, id: lv.id });
  return lv;
}

function pickDaily(key, save) {
  const pool = LEVELS.filter((l) => (l.type === 'find' || l.type === 'diff') && (!save || save.isCleared(l.id)));
  const list = pool.length ? pool : [LEVELS[0]];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
