// 刷怪时间轴：5:00 一局，按 30 秒分段。
// rate: 段首 → 段尾的每秒刷怪数 (线性插值)，cap: 普通怪同屏上限 (达到后暂停刷怪)
// events: 段内的定时事件 (t = 绝对秒数)
//   swarm 一群怪从一侧飞入 | ring 一圈怪围住玩家后收缩 | tide 持续数秒的怪潮 | elite 精英 | boss Boss
// 难度差异只通过 DifficultyConfig 的 spawnRate / enemyHp 系数体现，刷怪系统里没有任何模式分支。
export const WAVES = {
  standard: {
    duration: 300,
    lateHpMul: { from: 270, mul: 0.6, expMul: 1.5 },   // 「黎明冲刺」：最后 30 秒普通怪 HP ×0.6、经验 ×1.5
    // 胜利条件：撑到 duration 并且 finalBoss 已被击败。到点时 Boss 还活着 → 「黎明前最后一搏」：
    //   刷怪 ×spawnMul，玩家伤害 ×(dmgMul + dmgPerSec·已过秒数)，Boss 每秒被晨光灼烧 burn×最大HP —— 保证不会无限拖下去
    finalBoss: 'nox',
    lastStand: { spawnMul: 0.35, dmgMul: 1.2, dmgPerSec: 0.02, burn: 0.005 },
    segments: [
      { from: 0,   to: 30,  weights: { slime: 100 }, rate: [1.2, 2.6], cap: 40,
        events: [{ t: 18, type: 'swarm', enemy: 'slime', count: 8, text: '一队史莱姆滚过来了！' }] },   // 开局 18 秒来一小队史莱姆横穿，前 30 秒不至于只是站着升级
      { from: 30,  to: 60,  weights: { slime: 70, bat: 30 }, rate: [2.6, 3.6], cap: 70,
        events: [{ t: 45, type: 'swarm', enemy: 'bat', count: 12 }] },
      { from: 60,  to: 90,  weights: { slime: 50, bat: 25, bubble: 25 }, rate: [3.6, 4.6], cap: 100,
        events: [{ t: 75, type: 'elite', enemy: 'kingSlime' }] },
      { from: 90,  to: 120, weights: { slime: 35, bat: 20, bubble: 20, doll: 15, lantern: 10 }, rate: [4.6, 6], cap: 140,
        events: [{ t: 105, type: 'ring', enemy: 'doll', count: 26, radius: 300 }] },
      { from: 120, to: 150, weights: { slime: 30, bat: 20, bubble: 15, doll: 15, lantern: 10, clock: 10 }, rate: [6, 7.4], cap: 170,
        events: [{ t: 135, type: 'elite', enemy: 'clockCaptain' }] },
      { from: 150, to: 180, weights: { slime: 30, bat: 20, bubble: 15, doll: 15, lantern: 10, clock: 10 }, rate: [7, 7.5], cap: 110,
        events: [{ t: 150, type: 'boss', enemy: 'sheepKing' }] },
      { from: 180, to: 210, weights: { slime: 25, bat: 20, bubble: 15, doll: 20, lantern: 8, clock: 12 }, rate: [7.6, 9.4], cap: 220,
        events: [{ t: 195, type: 'elite', enemy: 'bearGeneral' }, { t: 198, type: 'elite', enemy: 'kingSlime' }] },
      { from: 210, to: 240, weights: { slime: 25, bat: 20, bubble: 15, doll: 20, lantern: 8, clock: 12 }, rate: [9.4, 11], cap: 280,
        events: [{ t: 220, type: 'tide', enemy: 'bat', count: 90, time: 8 }] },
      { from: 240, to: 270, weights: { slime: 40, bat: 35, bubble: 25 }, rate: [11, 12], cap: 130,
        events: [{ t: 240, type: 'boss', enemy: 'nox' }] },
      { from: 270, to: 300, weights: { slime: 25, bat: 20, bubble: 15, doll: 20, lantern: 8, clock: 12 }, rate: [12, 14], cap: 300,
        events: [{ t: 280, type: 'elite', enemy: 'clockCaptain' }] },
    ],
  },
};

export const WAVE_ORDER = ['standard'];
