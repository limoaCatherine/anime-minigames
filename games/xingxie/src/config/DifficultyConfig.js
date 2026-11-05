// 难度系数：系统只读系数，不判断「现在是什么模式」。
export const DifficultyConfig = {
  normal:    { id: 'normal', name: '普通', enemyHp: 1.0, enemyDmg: 1.0, spawnRate: 1.0, expGain: 1.0, coinGain: 1.0, unlock: null },
  nightmare: { id: 'nightmare', name: '噩梦', enemyHp: 1.45, enemyDmg: 1.2, spawnRate: 1.2, expGain: 1.1, coinGain: 1.5, unlock: { clears: 1 } },
};
export const DIFFICULTY_ORDER = ['normal', 'nightmare'];
