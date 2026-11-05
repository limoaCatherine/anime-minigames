// 怪物表：普通怪 / 精英 / Boss 的属性与技能参数。
// 血量随时间成长：HP = hp × (1 + hpGrowth × 已过分钟) × 难度系数 (DifficultyConfig.enemyHp)
// behavior: chase 直线追 | sine 走正弦曲线 | ranged 远程放风筝 | dash 蓄力冲刺 | boss 由 BossSystem 驱动
// exp: 掉落宝石 blue/green/red/rainbow (数值见 ProgressConfig.gems)
export const ENEMY_RULES = {
  hpGrowth: 0.21,
  contactGap: 0.5,        // 玩家每 0.5 秒最多受一次接触伤害 (另有受击无敌)
  separation: 0.55,       // 怪物互相推开的强度
  despawnDist: 900,       // 离玩家超过这个距离的普通怪会被挪到玩家前方 (回收重刷)
  spawnRing: [60, 130],   // 刷怪点在屏幕外 60~130 px 的环带
  spawnAhead: 0.6,        // 60% 概率刷在玩家移动方向的前方
  hitFlash: 0.08,         // 受击闪白秒数
};

// 控制抗性 / Boss 拴绳：Boss 不吃冻结和眩晕、击退抗性 1；减速最多 bossSlowMax。
// Boss 离玩家超过 leash 像素 (被甩出画面) 时，会瞬移回屏幕边缘；中 Boss 出场 leaveAfter 秒后没打死就撤退。
export const CC_RULES = { bossSlowMax: 0.3, eliteSlowMax: 0.5, leash: 620 };

export const ENEMIES = {
  slime:   { name: '软软梦魇', hp: 8,  speed: 46, dmg: 5,  r: 13, exp: 'blue',  knockResist: 0,   behavior: 'chase', sprite: 'slime',   color: '#b48cff' },
  bat:     { name: '夜蝠糖',   hp: 5,  speed: 88, dmg: 4,  r: 11, exp: 'blue',  knockResist: 0,   behavior: 'sine',  sprite: 'bat',     color: '#ff8fc7', wave: { amp: 0.9, freq: 3.2 } },
  bubble:  { name: '泡泡梦',   hp: 12, speed: 50, dmg: 5,  r: 14, exp: 'blue',  knockResist: 0,   behavior: 'chase', sprite: 'bubble',  color: '#9be7ff', split: { into: 'bubbleMini', count: 2 } },
  bubbleMini: { name: '小泡泡', hp: 4, speed: 64, dmg: 3,  r: 9,  exp: null,    knockResist: 0,   behavior: 'chase', sprite: 'bubbleMini', color: '#bff0ff' },
  doll:    { name: '怨念玩偶', hp: 30, speed: 36, dmg: 10, r: 17, exp: 'green', knockResist: 0.5, behavior: 'chase', sprite: 'doll',    color: '#c9a27e' },
  lantern: { name: '游魂灯',   hp: 15, speed: 56, dmg: 6,  r: 13, exp: 'blue',  knockResist: 0,   behavior: 'ranged', sprite: 'lantern', color: '#ffb36b',
    ranged: { keep: 200, every: 3, bullet: { speed: 120, dmg: 8, r: 7, life: 4 } } },
  clock:   { name: '疯狂闹钟', hp: 20, speed: 40, dmg: 12, r: 14, exp: 'green', knockResist: 0.2, behavior: 'dash',  sprite: 'clock',   color: '#ff6b6b',
    dash: { every: 4, charge: 0.6, time: 0.5, mul: 3.2 } },

  // 精英：放大 + 金色描边，必掉宝箱
  kingSlime:   { name: '巨型软软王', hp: 220, speed: 44, dmg: 12, r: 26, exp: 'rainbow', knockResist: 0.8, behavior: 'chase', sprite: 'slime', scale: 1.9, elite: true, color: '#b48cff',
    slam: { every: 5, warn: 0.6, radius: 72, dmg: 15 } },
  bearGeneral: { name: '熊熊将军',   hp: 600, speed: 32, dmg: 18, r: 30, exp: 'rainbow', knockResist: 1,   behavior: 'chase', sprite: 'doll', scale: 1.8, elite: true, color: '#c9a27e',
    summon: { below: 0.5, enemy: 'slime', count: 6 } },
  clockCaptain:{ name: '闹钟队长',   hp: 450, speed: 44, dmg: 16, r: 23, exp: 'rainbow', knockResist: 0.9, behavior: 'dash', sprite: 'clock', scale: 1.6, elite: true, color: '#ff6b6b',
    dash: { every: 4.5, charge: 0.6, time: 0.4, mul: 3.6, chain: 3, chainGap: 0.4 } },

  // Boss
  sheepKing: {
    name: '数羊王·咩咩卿', hp: 1700, speed: 40, dmg: 15, r: 44, exp: 'rainbow', knockResist: 1, behavior: 'boss', sprite: 'sheepKing', boss: true, color: '#fff3d6',
    line: '咩……再数一万只羊，你就睡着了……',
    skillGap: 3,
    skills: ['stampede', 'sleepBubbles', 'pillowSlam'],
    stampede: { lanes: 2, warn: 1.0, sheep: 10, speed: 420, dmg: 10, laneGap: 150 },
    sleepBubbles: { count: 3, radius: 64, slow: 0.4, duration: 4, spread: 90 },
    pillowSlam: { warn: 1.1, radius: 80, dmg: 18, airTime: 1.1 },
    drops: { chest: 1, rainbow: 3 },
    spawnRateMul: 0.5,
    leaveAfter: 75,
  },
  nox: {
    name: '梦魇女王·诺克丝', hp: 5000, speed: 58, dmg: 20, r: 40, exp: 'rainbow', knockResist: 1, behavior: 'boss', sprite: 'nox', boss: true, color: '#7a3cff',
    line: '黎明？这个梦里不需要那种东西。',
    wreath: { every: 4, dirs: 12, rounds: 3, roundGap: 0.35, rotate: 15, bullet: { speed: 160, dmg: 10, r: 8, life: 5 } },
    cage: { every: 12, first: 6, radius: 190, duration: 6, dmg: 12, tickGap: 0.5, bats: 16 },
    mirror: { below: 0.4, count: 2, hp: 500, wreathEvery: 5 },
    drops: { chest: 1, rainbow: 4 },
    spawnRateMul: 0.4,
  },
  noxMirror: { name: '诺克丝的镜像', hp: 500, speed: 70, dmg: 12, r: 30, exp: 'red', knockResist: 1, behavior: 'mirror', sprite: 'nox', color: '#9b6bff', alpha: 0.6 },
  stampedeSheep: { name: '小羊', hp: 1, speed: 0, dmg: 10, r: 15, exp: null, knockResist: 1, behavior: 'hazard', sprite: 'sheep', invulnerable: true, color: '#ffffff' },
};
