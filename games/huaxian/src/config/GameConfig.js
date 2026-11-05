// 全局游戏参数：画面尺寸、物理、画线、主角、配色等。
// 想调手感/难度，优先改这里 (关卡数据见 LevelConfig.js，敌人参数见 HazardConfig.js)。
export const GameConfig = {
  title: '画线守护美少女',
  subtitle: 'AnimeDrawLine',
  version: '1.5.0',
  publisher: '狸猫',     // 出品方 (标题画面 / 制作人员 / exe 版本信息 / 抖音版 统一使用)
  // 启动画面显著位置全文登载《健康游戏忠告》(微信小程序平台常见拒绝情形 3.6.6 / 国家新闻出版署要求)；
  // 取得软著 / 版号后把登记号、出版物号填在这里，会显示在忠告下方 (留空不显示)
  healthAdvice: ['抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。', '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。'],
  copyrightRegNo: '',   // 例：'软著登记号：2026SR0000000'
  publicationNo: '',    // 例：'出版物号：ISBN 978-7-0000-0000-0' (IAA 小游戏不需要版号，留空)

  // 逻辑分辨率 (9:16 竖屏)，实际显示按窗口等比缩放
  width: 540,
  height: 960,
  hudHeight: 112,        // 顶部 HUD 区域 (不可画线)

  physics: {
    gravityY: 1,
    timestep: 1000 / 60,
    maxSubSteps: 5,
    positionIterations: 10,
    velocityIterations: 8,
    killY: 1150,          // 低于该高度的物体被移除 (主角掉落 = 失败)
    // 防穿透限速 (像素/物理步)：|v| ≤ safety × (物体最小半厚 + 挡板半厚)
    // barrierHalf = 画的线半厚 (14/2)；lineBarrierHalf = 线会撞到的最薄地形/玻璃半厚 (18/2)
    antiTunnel: { safety: 0.9, barrierHalf: 7, lineBarrierHalf: 9, maxSpeed: 32 },
  },

  // 画线
  line: {
    thickness: 14,        // 物理厚度
    renderWidth: 11,      // 绘制宽度
    minSegment: 6,        // 采样间隔 (像素)
    simplify: 2.2,        // 道格拉斯-普克简化阈值
    minLength: 24,        // 太短的线视为取消
    density: 0.0038,
    friction: 1,
    frictionStatic: 1.5,
    restitution: 0.05,
    angularDamping: 0.95, // 每步角速度保留比例
    zoneMargin: 6,        // 禁画区 (主角/敌人/蜂巢) 外扩
  },

  // 星级：用墨量 <= 解法长度 × 系数 (关卡可单独覆盖 stars:[三星上限, 二星上限])
  stars: { three: 1.15, two: 1.45 }, // 1.3：收紧 (原 1.3 / 1.8)，第 1~3 关教学关单独保留宽松的 starFactor
  hintMaxStars: 2,       // 本次挑战看过提示 (参考解法) 时最多得几星 (同类游戏的常见做法：提示能过关，但满星要靠自己)
  inkFactorRange: [1.6, 1.45], // 1.3：关卡未指定 ink 时 = 解法长度 × 系数 (第 1 关 1.6 倍 -> 第 40 关 1.45 倍)；第 1~3 关教学关单独给 2.4 倍

  heroine: {
    bodyW: 54,
    bodyH: 100,
    spriteH: 124,          // idle 立绘的绘制高度，其他表情按同一比例
    density: 0.008,
    friction: 0.9,
    scaredRadius: 150,     // 危险物进入该半径 -> 害怕表情
  },

  fontFamily: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC","Noto Sans SC",sans-serif',

  colors: {
    bgTop: '#ffe1f0',
    bgBottom: '#dcd6ff',
    primary: '#ff6fa8',
    primaryDark: '#e2457f',
    secondary: '#8f7cff',
    secondaryDark: '#6a56e0',
    green: '#5ccf8a',
    greenDark: '#35a866',
    text: '#5a3d6e',
    textLight: '#ffffff',
    danger: '#ff4d6d',
    panel: 'rgba(255,255,255,0.9)',
    ground: '#f7d6e6',
    groundTop: '#9be08f',
    groundEdge: '#c99ab6',
    star: '#ffd23f',
  },

  storageKey: 'animeDrawLine.save.v2',
  /** 旧版本存档键 (20 关版本)，首次启动时自动迁移 */
  legacyStorageKeys: ['animeDrawLine.save.v1'],
};

// 碰撞分类 (Matter.js collisionFilter.category 位)
export const CAT = {
  TERRAIN: 0x0001,
  LINE: 0x0002,
  HERO: 0x0004,
  BEE: 0x0008,
  HAZARD: 0x0010,   // 老板 / 亲戚 / 石头
  PROJ: 0x0020,     // 文件 / 爱心照片
  SENSOR: 0x0040,   // 蜂巢等纯装饰
};
