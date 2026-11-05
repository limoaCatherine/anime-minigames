// 成长相关：经验曲线、三选一权重、宝石 / 掉落、广告次数、星屑币结算、永久天赋。
export const EXP_CURVE = {
  early: [4, 8, 12, 16],                  // Lv1→2 … Lv4→5 (新手加速段)
  a: 4, b: 4.5, c: 0.12,                    // Lv≥5: round(a + b·n + c·n²)
  cap: 260,                               // Lv30 以后每级固定
};
export function expToNext(level) {
  if (level <= EXP_CURVE.early.length) return EXP_CURVE.early[level - 1];
  if (level >= 30) return EXP_CURVE.cap;
  return Math.round(EXP_CURVE.a + EXP_CURVE.b * level + EXP_CURVE.c * level * level);
}

export const SLOTS = { weapons: 4, passives: 4 };

// 三选一卡池
export const CARD_RULES = {
  choices: 3,
  weights: { upgradeWeapon: 100, upgradePassive: 80, newWeapon: 60, newPassive: 50 },
  starterBias: 1.3,        // 初始武器升级权重 ×1.3
  evoPassiveBias: 2,       // 某把武器已 Lv5 时，它进化需要的被动权重 ×2
  pityNewWeapon: 3,        // 武器格没满时，连续 3 次没出新武器，第 4 次必出
  fillers: [               // 可选卡不够 3 张时补位
    { id: 'coins', name: '一袋星屑', desc: '星屑币 +30', coins: 30, icon: 'coin', color: '#ffc94d' },
    { id: 'heal', name: '热可可', desc: '回复 30 HP', heal: 30, icon: 'cake', color: '#ff8a7a' },
    { id: 'wish', name: '流星许愿', desc: '这局伤害 +4%，可以一直叠', might: 0.04, icon: 'star', color: '#ffe680' },
  ],
  inputLock: 0.4,          // 弹出后 0.4 秒内的点击无效 (防误触)
};

// 宝石与掉落
export const PICKUPS = {
  gems: { blue: { exp: 1, r: 6, color: '#6fd6ff' }, green: { exp: 3, r: 7, color: '#5ccf8a' }, red: { exp: 10, r: 8, color: '#ff5d7e' }, rainbow: { exp: 50, r: 10, color: '#ffffff' } },
  gemSpeed: 380,           // 被吸过来时的速度
  candy: { chance: 0.01, heal: 20 },
  magnet: { chance: 0.003 },
  chest: { r: 16 },
};

// 广告 (激励视频) 与局内次数
export const RUN_RULES = {
  freeRefresh: 1,          // 每局免费刷新三选一次数 (天赋可加)
  adRefresh: 2,            // 每局看广告刷新最多次数
  revive: { adPerRun: 1, hpRatio: 0.5, invuln: 2, blastRadius: 280, blastDmg: 60 },
  skip: { coins: 20, heal: 10 },
};

// 星屑币结算：击杀 × 0.1 + 存活秒数 × 0.3 + 通关 100 (再乘难度 / 天赋 / 角色加成)
export const COIN_RULES = { perKill: 0.1, perSecond: 0.3, clearBonus: 100, adDouble: 2 };

// 永久天赋：每级花费 (星屑币)
export const TALENTS = [
  { id: 'might',   name: '星之力',   desc: '伤害 +2% / 级',     max: 5, per: 0.02, costs: [100, 200, 400, 700, 1100], icon: 'gem',   color: '#ff7ad9' },
  { id: 'vitality',name: '梦之护佑', desc: '最大 HP +5 / 级',   max: 5, per: 5,   costs: [100, 200, 400, 700, 1100], icon: 'cake',  color: '#ff5d7e' },
  { id: 'speed',   name: '轻盈步伐', desc: '移速 +1.5% / 级',   max: 5, per: 0.015, costs: [100, 200, 400, 700, 1100], icon: 'boots', color: '#5ccf8a' },
  { id: 'magnet',  name: '星屑引力', desc: '拾取范围 +6% / 级', max: 5, per: 0.06, costs: [100, 200, 400, 700, 1100], icon: 'bell',  color: '#ffb000' },
  { id: 'growth',  name: '求知',     desc: '经验 +3% / 级',     max: 5, per: 0.03, costs: [100, 200, 400, 700, 1100], icon: 'book',  color: '#8f7cff' },
  { id: 'greed',   name: '招财',     desc: '星屑币 +6% / 级',   max: 5, per: 0.06, costs: [100, 200, 400, 700, 1100], icon: 'coin',  color: '#ffc94d' },
  { id: 'reroll',  name: '再试一次', desc: '每局免费刷新 +1',   max: 2, per: 1,    costs: [300, 800],                  icon: 'reroll',color: '#6fd6ff' },
];
