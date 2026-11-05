// 武器表：9 把武器，每把 Lv1~Lv5；evolve = 进化配方 (武器 Lv5 + 指定被动 Lv≥passiveLv，开宝箱时触发)。
// form 决定攻击形态 (WeaponSystem 按 form 分派)，其余字段全是数值。距离单位 px (逻辑分辨率 540×960)。
// note: 升级卡上显示的变化说明 (口语化，别写成说明书)。
export const WEAPONS = {
  starWand: {
    name: '星光魔杖', form: 'projectile', icon: 'star', color: '#ffd23f',
    desc: '朝最近的怪丢星星，能穿透。',
    levels: [
      { dmg: 10, cd: 0.95, count: 1, pierce: 1, speed: 460, size: 9, life: 1.3, spread: 9, note: '朝最近的怪丢星星，能穿透。' },
      { dmg: 12, cd: 0.95, count: 2, pierce: 1, speed: 460, size: 9, life: 1.3, spread: 9, note: '一次丢 2 颗' },
      { dmg: 14, cd: 0.85, count: 2, pierce: 2, speed: 480, size: 9, life: 1.3, spread: 9, note: '伤害 +2，多穿 1 只' },
      { dmg: 16, cd: 0.8, count: 3, pierce: 2, speed: 480, size: 10, life: 1.3, spread: 9, note: '一次丢 3 颗' },
      { dmg: 20, cd: 0.72, count: 4, pierce: 3, speed: 500, size: 12, life: 1.4, spread: 9, note: '4 颗，星星变大' },
    ],
    evolve: { passive: 'starGem', passiveLv: 3, to: 'auroraWand' },
  },
  sakuraBlade: {
    name: '樱刃·居合', form: 'slash', icon: 'blade', color: '#ff8fc7',
    desc: '朝身边的怪挥一刀，顺便把怪推开。',
    levels: [
      { dmg: 22, cd: 1.25, count: 1, radius: 96, angle: 120, knock: 14, note: '朝身边的怪挥一刀，顺便把怪推开。' },
      { dmg: 27, cd: 1.25, count: 1, radius: 104, angle: 120, knock: 14, note: '伤害 +5，刀光更长' },
      { dmg: 32, cd: 1.1, count: 2, radius: 104, angle: 120, knock: 16, note: '前后各砍一刀' },
      { dmg: 37, cd: 1.0, count: 2, radius: 116, angle: 150, knock: 16, note: '刀光更宽' },
      { dmg: 46, cd: 0.85, count: 2, radius: 128, angle: 180, knock: 18, note: '半圆斩，伤害 +9' },
    ],
    evolve: { passive: 'rabbitWatch', passiveLv: 3, to: 'senbonSakura' },
  },
  talisman: {
    name: '护符环', form: 'orbit', icon: 'ring', color: '#ff6b6b',
    desc: '几张护符绕着你转，转一阵歇一阵。',
    levels: [
      { dmg: 16, cd: 2.8, count: 3, radius: 84, duration: 3.6, hitGap: 0.4, size: 13, spin: 3.4, knock: 6, note: '几张护符绕着你转，转一阵歇一阵。' },
      { dmg: 18, cd: 2.8, count: 4, radius: 84, duration: 3.6, hitGap: 0.4, size: 13, spin: 3.4, knock: 6, note: '多 1 张护符' },
      { dmg: 21, cd: 2.6, count: 4, radius: 94, duration: 4.0, hitGap: 0.4, size: 14, spin: 3.6, knock: 6, note: '转得更久，圈子更大' },
      { dmg: 24, cd: 2.4, count: 5, radius: 94, duration: 4.2, hitGap: 0.4, size: 14, spin: 3.8, knock: 6, note: '多 1 张护符' },
      { dmg: 28, cd: 2.2, count: 6, radius: 106, duration: 4.8, hitGap: 0.35, size: 15, spin: 4.0, knock: 8, note: '6 张，伤害 +4，转得更久' },
    ],
    evolve: { passive: 'starCape', passiveLv: 3, to: 'yataBarrier' },
  },
  chainSpark: {
    name: '电音连锁', form: 'chain', icon: 'bolt', color: '#6fd6ff',
    desc: '电一只，再跳到旁边那只，每跳一次稍微弱一点。',
    levels: [
      { dmg: 10, cd: 1.6, count: 1, jumps: 3, range: 120, reach: 300, falloff: 0.09, note: '电一只，再跳到旁边那只，每跳一次稍微弱一点。' },
      { dmg: 12, cd: 1.6, count: 1, jumps: 4, range: 120, reach: 300, falloff: 0.09, note: '多跳 1 次' },
      { dmg: 14, cd: 1.45, count: 2, jumps: 4, range: 128, reach: 320, falloff: 0.09, note: '一次放 2 道' },
      { dmg: 16, cd: 1.35, count: 2, jumps: 5, range: 136, reach: 320, falloff: 0.09, note: '多跳 1 次，伤害 +2' },
      { dmg: 20, cd: 1.2, count: 3, jumps: 6, range: 144, reach: 340, falloff: 0.09, note: '一次放 3 道' },
    ],
    evolve: { passive: 'magicTome', passiveLv: 3, to: 'thunderLive' },
  },
  heartRang: {
    name: '爱心回旋镖', form: 'boomerang', icon: 'heart', color: '#ff5d9e',
    desc: '扔出去还会飞回来，来回各打一次。',
    levels: [
      { dmg: 12, cd: 1.45, count: 1, range: 210, speed: 360, size: 14, knock: 10, note: '扔出去还会飞回来，来回各打一次。' },
      { dmg: 14, cd: 1.45, count: 1, range: 226, speed: 370, size: 14, knock: 10, note: '飞得更远' },
      { dmg: 16, cd: 1.35, count: 2, range: 226, speed: 380, size: 15, knock: 10, note: '一次扔 2 个' },
      { dmg: 18, cd: 1.25, count: 2, range: 256, speed: 390, size: 15, knock: 12, note: '伤害 +2，飞得更远' },
      { dmg: 22, cd: 1.15, count: 3, range: 272, speed: 400, size: 19, knock: 12, note: '3 个，个头更大' },
    ],
    evolve: { passive: 'catBell', passiveLv: 3, to: 'sweetCyclone' },
  },
  roseField: {
    name: '蔷薇花阵', form: 'zone', icon: 'rose', color: '#e2457f',
    desc: '往怪最多的地方种一圈蔷薇，踩进来就掉血。',
    levels: [
      { dmg: 6, cd: 3.0, count: 1, radius: 58, duration: 2.6, tick: 0.5, reach: 320, note: '往怪最多的地方种一圈蔷薇，踩进来就掉血。' },
      { dmg: 7, cd: 3.0, count: 1, radius: 66, duration: 2.6, tick: 0.5, reach: 320, note: '花圈更大' },
      { dmg: 7, cd: 2.9, count: 2, radius: 66, duration: 2.8, tick: 0.5, reach: 320, note: '一次种 2 圈' },
      { dmg: 8, cd: 2.8, count: 2, radius: 72, duration: 2.8, tick: 0.5, reach: 340, note: '伤害 +1' },
      { dmg: 9, cd: 2.6, count: 3, radius: 78, duration: 3.0, tick: 0.5, reach: 340, note: '一次种 3 圈' },
    ],
    evolve: { passive: 'strawberryCake', passiveLv: 3, to: 'crimsonGarden' },
  },
  paperCrane: {
    name: '纸鹤式神', form: 'homing', icon: 'crane', color: '#f4f1ff',
    desc: '放出会自己找怪的纸鹤，不挑走位。',
    levels: [
      { dmg: 9, cd: 1.2, count: 2, speed: 260, turn: 200, life: 2.0, size: 10, explode: 0, note: '放出会自己找怪的纸鹤，不挑走位。' },
      { dmg: 11, cd: 1.2, count: 2, speed: 270, turn: 200, life: 2.0, size: 10, explode: 0, note: '伤害 +2' },
      { dmg: 12, cd: 1.1, count: 3, speed: 280, turn: 210, life: 2.0, size: 10, explode: 0, note: '多 1 只纸鹤' },
      { dmg: 14, cd: 1.0, count: 3, speed: 290, turn: 220, life: 2.0, size: 11, explode: 26, note: '撞到怪会炸一下' },
      { dmg: 17, cd: 0.9, count: 4, speed: 300, turn: 230, life: 2.2, size: 12, explode: 32, note: '4 只，爆炸更大' },
    ],
    evolve: { passive: 'twinPin', passiveLv: 3, to: 'hyakkiCrane' },
  },
  frostPrism: {
    name: '冰晶棱镜', form: 'frost', icon: 'crystal', color: '#9be7ff',
    desc: '扇形撒一把冰棱，有概率把怪冻住。',
    levels: [
      { dmg: 12, cd: 1.5, count: 3, spreadDeg: 34, speed: 400, size: 8, life: 0.9, pierce: 1, freezeChance: 0.12, freezeTime: 0.8, note: '扇形撒一把冰棱，有概率把怪冻住。' },
      { dmg: 14, cd: 1.5, count: 4, spreadDeg: 40, speed: 400, size: 8, life: 0.9, pierce: 1, freezeChance: 0.12, freezeTime: 0.8, note: '多 1 根冰棱' },
      { dmg: 16, cd: 1.35, count: 5, spreadDeg: 46, speed: 410, size: 8, life: 0.95, pierce: 1, freezeChance: 0.16, freezeTime: 0.9, note: '多 1 根，冻得更容易' },
      { dmg: 18, cd: 1.25, count: 5, spreadDeg: 48, speed: 420, size: 9, life: 1.0, pierce: 2, freezeChance: 0.16, freezeTime: 1.0, note: '能多穿 1 只，冻得更久' },
      { dmg: 22, cd: 1.1, count: 7, spreadDeg: 60, speed: 430, size: 9, life: 1.0, pierce: 2, freezeChance: 0.2, freezeTime: 1.2, note: '7 根冰棱' },
    ],
    evolve: { passive: 'featherBoots', passiveLv: 3, to: 'absoluteZero' },
  },
  meteor: {
    name: '流星召唤', form: 'meteor', icon: 'meteor', color: '#ffb36b',
    desc: '往怪堆里砸流星，落地前会先亮个圈。',
    levels: [
      { dmg: 25, cd: 2.4, count: 2, radius: 50, warn: 0.5, reach: 360, note: '往怪堆里砸流星，落地前会先亮个圈。' },
      { dmg: 30, cd: 2.4, count: 2, radius: 54, warn: 0.5, reach: 360, note: '伤害 +5' },
      { dmg: 32, cd: 2.2, count: 3, radius: 58, warn: 0.5, reach: 380, note: '一次 3 颗' },
      { dmg: 40, cd: 2.0, count: 3, radius: 62, warn: 0.5, reach: 380, note: '炸得更大' },
      { dmg: 46, cd: 1.8, count: 4, radius: 66, warn: 0.5, reach: 400, note: '一次 4 颗，伤害 +6' },
    ],
    evolve: { passive: 'twinPin', passiveLv: 3, to: 'starfall' },
  },
};

// 进化形态：一档数值 + 特性字段 (splash / echo / permanent …)。卡片和宝箱都显示 desc。
export const EVOLUTIONS = {
  auroraWand: {
    name: '极光星河杖', from: 'starWand', form: 'projectile', icon: 'star', color: '#ffe680',
    desc: '一次扇形丢 6 颗，怎么都穿得过去，打中还会溅星屑。',
    stats: { dmg: 24, cd: 0.6, count: 6, pierce: 999, speed: 520, size: 12, life: 1.4, spread: 12, splash: { ratio: 0.3, radius: 34 } },
  },
  senbonSakura: {
    name: '千樱一闪', from: 'sakuraBlade', form: 'slash', icon: 'blade', color: '#ffb3d9',
    desc: '一圈 360° 斩，0.3 秒后残影再补一刀，每第 3 刀必暴击。',
    stats: { dmg: 42, cd: 0.95, count: 1, radius: 136, angle: 360, knock: 20, echo: 0.3, critEvery: 3 },
  },
  yataBarrier: {
    name: '八咫结界', from: 'talisman', form: 'orbit', icon: 'ring', color: '#ff9a9a',
    desc: '8 张护符一直转不停，碰到就弹飞，你受到的伤害 -15%。',
    stats: { dmg: 18, cd: 0, count: 8, radius: 104, duration: 0, hitGap: 0.35, size: 15, spin: 4.2, knock: 32, permanent: true, dmgReduce: 0.15 },
  },
  thunderLive: {
    name: '万雷演唱会', from: 'chainSpark', form: 'chain', icon: 'bolt', color: '#b5f0ff',
    desc: '一次 4 道，每道跳 10 次，越跳越疼，被电到的怪会麻 0.5 秒。',
    stats: { dmg: 26, cd: 1.05, count: 4, jumps: 10, range: 150, reach: 360, falloff: -0.1, stun: 0.5 },
  },
  sweetCyclone: {
    name: '甜心大回旋', from: 'heartRang', form: 'boomerang', icon: 'heart', color: '#ff9cc4',
    desc: '3 个大爱心来回飞，路过的经验宝石顺手带回来。',
    stats: { dmg: 32, cd: 1.0, count: 3, range: 290, speed: 420, size: 24, knock: 14, pullGems: 70 },
  },
  crimsonGarden: {
    name: '绯红庭园', from: 'roseField', form: 'zone', icon: 'rose', color: '#ff4d6d',
    desc: '一次 3 片大花园，持续 5 秒，造成的伤害会一点点回血。',
    stats: { dmg: 15, cd: 2.4, count: 3, radius: 112, duration: 5, tick: 0.5, reach: 360, lifesteal: 0.01, healCap: 3 },
  },
  hyakkiCrane: {
    name: '百鹤夜行', from: 'paperCrane', form: 'homing', icon: 'crane', color: '#ffffff',
    desc: '一次放 8 只纸鹤，撞到就炸，炸得还不小。',
    stats: { dmg: 22, cd: 0.85, count: 8, speed: 320, turn: 260, life: 2.4, size: 12, explode: 46 },
  },
  absoluteZero: {
    name: '绝对零度', from: 'frostPrism', form: 'frost', icon: 'crystal', color: '#d6f6ff',
    desc: '冰棱撒满一圈，冻住的怪再挨打会直接碎掉 (额外伤害)。',
    stats: { dmg: 26, cd: 1.05, count: 12, spreadDeg: 360, speed: 440, size: 10, life: 1.0, pierce: 3, freezeChance: 0.3, freezeTime: 1.5, shatter: 1.0 },
  },
  starfall: {
    name: '星落天穹', from: 'meteor', form: 'meteor', icon: 'meteor', color: '#ffd28a',
    desc: '每轮 6 颗流星，每 10 秒再砸一颗超大的，屏幕都在抖。',
    stats: { dmg: 56, cd: 1.6, count: 6, radius: 76, warn: 0.45, reach: 420, giantEvery: 10, giantDmg: 300, giantRadius: 180 },
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);
export const MAX_WEAPON_LEVEL = 5;
