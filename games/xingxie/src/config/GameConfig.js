// 全局参数：画面、配色、存档键、广告、性能上限。玩法数值见同目录的其它 *Config.js。
export const GameConfig = {
  title: '星屑轮舞',
  subtitle: 'AnimeSurvivor',
  version: '1.3.2',
  // 出品方 (标题页 / 制作人员 / 打包信息统一读这里)
  publisher: '狸猫',

  // 逻辑分辨率 (9:16 竖屏)，实际显示按窗口等比缩放
  width: 540,
  height: 960,

  fontFamily: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC","Noto Sans SC",sans-serif',

  colors: {
    bgTop: '#2a1f5c',
    bgBottom: '#5b3a8c',
    primary: '#ff6fa8',
    primaryDark: '#e2457f',
    secondary: '#8f7cff',
    secondaryDark: '#6a56e0',
    green: '#5ccf8a',
    greenDark: '#35a866',
    gold: '#ffc94d',
    goldDark: '#e09a1a',
    text: '#5a3d6e',
    textLight: '#ffffff',
    danger: '#ff4d6d',
    panel: 'rgba(255,255,255,0.93)',
    star: '#ffd23f',
    exp: '#6fd6ff',
    hp: '#ff5d7e',
  },

  // 战斗主循环：固定步长逻辑 (掉帧时每帧最多补 3 步，防止死亡螺旋)
  loop: { step: 1 / 60, maxSteps: 3 },
  // 镜头：角色在屏幕中心偏下 (上方视野更大)
  camera: { playerScreenY: 0.56, shakeDecay: 9 },

  // 同屏上限 (超出时的降级策略见 docs/README.md)
  caps: {
    enemies: 300,
    projectiles: 260,
    enemyBullets: 100,
    gems: 400,
    gemMergeAt: 300,       // 地上宝石超过这个数量时，把最远的宝石合并成红宝石
    zones: 40,
    damageNumbers: 40,
    particles: 260,
    critOnlyNumbersAbove: 200, // 同屏怪 > 200 时只显示暴击数字
  },

  storageKey: 'animeSurvivor.save.v1',
};
