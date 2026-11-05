// 全局游戏参数：画面尺寸、卡牌尺寸、各区域布局、节奏、配色、广告等。
// 想调整版面/手感，优先改这里。
export const GameConfig = {
  title: '美少女了个美',
  subtitle: 'AnimeStack',
  version: '3.3.0',
  producer: '狸猫',          // 出品方 (菜单页脚、制作人员、抖音分享文案)

  // 逻辑分辨率 (9:16 竖屏)，实际显示按窗口等比缩放
  width: 540,
  height: 960,

  // 卡牌：正面为正方形 cardSize，底部另有 thickness 的"厚度" (贴图 160x176 等比缩放)
  card: {
    size: 62,
    thickness: 6.2,
    radius: 10,
  },

  // 牌桌网格：单位 = 半张卡 (卡牌在相邻层之间错开半张卡，与原版一致)
  board: {
    unit: 31,       // = card.size / 2
    cols: 16,       // 网格宽度 (单位)，16 单位 = 8 张卡
    rows: 16,       // 网格高度 (单位)
    left: 22,       // (540 - 16*31) / 2
    top: 124,       // HUD (0~64) 与字幕条 (66~118) 之下
  },
  subtitleY: 92,          // 语音字幕条中心 y (位于 HUD 与牌桌之间，不遮挡任何卡牌)

  // 底部一行：左右两个"侧边牌堆" + 中间的"移出暂存区"
  pileRowY: 640,          // 该行卡牌顶部 y
  pileMarginX: 18,
  pileStep: 6,            // 牌堆中相邻两张错开的像素
  tempRow: { slots: 3, gap: 4, stackOffsetY: 7 },

  // 卡槽
  slot: {
    capacity: 7,
    y: 736,               // 卡槽内卡牌顶部 y
    gap: 3,
    warnAt: 6,            // 达到该数量时提示危险
  },

  hudHeight: 64,
  propsY: 872,            // 道具按钮中心 y

  // 节奏
  flyTime: 0.3,          // 卡牌飞入卡槽
  slotShiftTime: 0.16,    // 槽内卡牌让位
  clearDelay: 0.05,       // 落入后多久开始消除
  clearTime: 0.26,        // 消除缩放动画
  failDelay: 0.35,        // 填满后多久判负

  fontFamily: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC","Noto Sans SC","Yu Gothic",sans-serif',

  colors: {
    bgTop: '#ffe1f0',
    bgBottom: '#dcd6ff',
    primary: '#ff6fa8',
    primaryDark: '#e2457f',
    secondary: '#8f7cff',
    secondaryDark: '#6a56e0',
    gold: '#ffb72b',
    goldDark: '#e08a00',
    text: '#5a3d6e',
    textLight: '#ffffff',
    danger: '#ff4d6d',
    panel: 'rgba(255,255,255,0.9)',
  },

  // 激励视频广告 (复活)。见 src/systems/AdService.js 与 docs/README.md「接入抖音激励视频」
  ad: {
    fakeDuration: 5,          // 占位广告倒计时 (秒)
  },

  storageKey: 'animeStack.save.v2',
};
