// 全局游戏参数：画面尺寸、版面布局、节奏、星级规则、配色、广告等。
// 关卡内容与难度全部在 LevelConfig.js / ChapterConfig.js；系统代码里没有任何难度分支。
export const GameConfig = {
  title: '次元破绽！',
  subtitle: 'AnimeSpotDiff · 二次元梗图找茬',
  version: '1.3.0',
  publisher: '狸猫',          // 出品方 (制作人员 / 菜单页脚 / README / exe 元数据 / 抖音工程统一用这个)

  // 逻辑分辨率 (9:16 竖屏，与《美少女合成》《美少女了个美》一致)，实际显示按窗口等比缩放
  width: 540,
  height: 960,

  // 关卡画面布局
  layout: {
    hudHeight: 92,
    // 单图 (找不合理 / 助她脱困 / 文字拼字)：场景视口
    scene: { x: 0, y: 96, w: 540, h: 700 },
    // 双图 (找不同)：上下两块，场景比例 540x330
    diff: { a: { x: 0, y: 96, w: 540, h: 342 }, b: { x: 0, y: 450, w: 540, h: 342 } },
    bottomY: 800,          // 底栏 (道具栏 / 角色反应 / 提示按钮) 顶部 y
    subtitleY: 742,        // 语音字幕气泡中心 y (场景底部，不遮挡底栏)
    subtitleDiffY: 824,    // 找不同关的字幕位置 (底栏上沿)
  },

  // 视口缩放 (找不合理 / 找不同关)
  zoom: { max: 2.5, wheelStep: 1.15, doubleTap: 2, loupe: 2.2, loupeRadius: 74, holdTime: 0.38 },

  // 输入判定
  input: { tapSlop: 12, holdTime: 0.75, swipeMin: 70 },

  // 星级：错误 (扣理智) 与 广告提示次数决定
  stars: {
    // v1.1：三星允许手滑 1 次 (但不能看广告提示 / 复活)；二星最多错 3 次、看 1 次广告提示、复活 1 次
    three: { maxMistakes: 1, maxAdHints: 0, maxRevives: 0 },
    two: { maxMistakes: 3, maxAdHints: 1, maxRevives: 1 },
  },

  // 提示：每关第 1 次免费 (零七「划重点」只圈一大块区域)，用掉后 freeCooldown 秒回复；之后看激励视频直接高亮一处
  //       (没配广告位时改为免费精确提示，两次之间冷却 noAdExactCooldown 秒)
  // 抖音「首页侧边栏复访」每日礼包：从侧边栏进入游戏可领的提示券数量 (提示券 = 立即可用的精确提示)
  sidebar: { tickets: 2 },
  hint: { freePerLevel: 1, freeCooldown: 75, noAdExactCooldown: 45, areaScale: 2.6, exactTime: 3.2, areaTime: 3.6 },

  fontFamily: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC",sans-serif',

  colors: {
    bgTop: '#ffe6ef',
    bgBottom: '#dcd8ff',
    primary: '#ff6f91',
    primaryDark: '#e0466d',
    secondary: '#7c83ff',
    secondaryDark: '#5a5fe0',
    gold: '#ffb72b',
    goldDark: '#e08a00',
    mark: '#ff3b5c',          // 找到破绽时的红圈
    text: '#4f3a63',
    textLight: '#ffffff',
    danger: '#ff4d6d',
    panel: 'rgba(255,255,255,0.92)',
  },

  // 激励视频广告：提示 / 恢复理智。见 src/systems/AdService.js
  // 统一广告策略 (v1.3，网页 / 桌面 / 抖音 / 微信一致)：
  //   - 平台配置里的激励视频广告位 id 为空 (或平台没有广告能力) → 隐藏所有「看广告」按钮，不再有 5 秒占位广告：
  //       · 原来的广告提示 → 免费精确提示，带冷却 (hint.noAdExactCooldown)，照样计入 adHints (所以最多 2 星，和以前一样)
  //       · 原来的广告复活 → 每关 1 次免费「再试一次」(计入 revives，同样最多 2 星)
  //   - 填了广告位 id (流量主开通后) → 自动恢复「看广告」入口，无需改代码
  //   抖音 / 微信的广告位 id 不在这里：填在各自工程根目录的 platform-config.js (和 AppID 放在一起)
  ad: {},

  storageKey: 'animeSpotDiff.save.v1',
};
