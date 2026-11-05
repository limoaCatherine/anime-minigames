// 平台配置 —— 抖音 / 微信小游戏的 AppID 和激励视频广告位 ID **只在这里填写** (其它地方都从这里读取)。
//
// douyin.appid             抖音开放平台 → 控制台 → 你的小游戏 → 开发设置 里的 AppID (形如 tt0123456789abcdef)
// douyin.rewardedAdUnitId  抖音开放平台 → 商业化 → 流量主 → 广告管理 → 新建「激励视频」广告位后得到的 ID
// wechat.appid             微信公众平台 (mp.weixin.qq.com) → 开发 → 开发管理 → 开发设置 里的 AppID (形如 wx0123456789abcdef)
// wechat.rewardedAdUnitId  微信公众平台 → 流量主 → 广告管理 → 新建「激励式视频」广告位后得到的广告单元 ID (形如 adunit-xxxxxxxx)
//
// rewardedAdUnitId 留空时：所有「看广告」按钮 (换一批 / 结算翻倍) 都不显示，复活改为每局免费一次「再试一次」；
//   填上 ID 并重新构建后，抖音版自动恢复激励视频 (复活 / 换一批 / 翻倍)。不会弹任何占位广告。
//   网页版 / exe 没有广告 SDK，始终按「留空」处理 (以后接入其他平台广告可用 ads.setProvider 注入)。
// appid 留空时：打包时 project.config.json 里的 appid 写成占位符 (开发者工具可用「测试号」打开)。
// 填好后执行 `npm run build:douyin` / `npm run build:wechat`，会同步写进对应工程的 project.config.json 和 game.js。
// 微信版 appid 留空时 project.config.json 写 touristappid (开发者工具里以游客模式打开，可本地调试，不能真机预览 / 上传)。
export const PlatformConfig = {
  douyin: {
    appid: '',
    rewardedAdUnitId: '',
  },
  wechat: {
    appid: '',
    rewardedAdUnitId: '',
  },
};

// —— 以下为抖音版的玩法侧参数 (不含任何账号 / 广告 ID) ——
export const DouyinConfig = {
  projectName: '星屑轮舞',
  // 分包：语音 / 背景音乐 / 半身立绘。主包只放启动必需的东西 (代码、头像、菜单背景、音效)。
  // src 以 prefix 开头 (且符合 test) 的资源放进对应分包，运行时路径变为 root + src。
  // weight 只用于合成总进度条 (约等于各分包体积 MB)。
  packs: [
    { name: 'art', root: 'sub_art/', prefix: 'assets/images/', test: /_card\.(png|jpg)$/, weight: 1 },
    { name: 'bgm', root: 'sub_bgm/', prefix: 'assets/audio/bgm/', test: /\.mp3$/, weight: 2.4 },
    { name: 'voice', root: 'sub_voice/', prefix: 'assets/audio/voice/', test: /\.mp3$/, weight: 3.4 },
  ],
  packRetryDelay: 6,          // 分包下载失败后隔几秒重试一次 (只重试一次，之后静默降级)

  // 录屏 (tt.getGameRecorderManager)：开战自动录，Boss 击破 / 满屏割草时 recordClip 打点，结算时剪成集锦
  recorder: {
    duration: 300,            // 单次录屏上限 (秒，官方范围 3~300)
    minLength: 4,             // 录屏不足这个秒数不提供分享 (官方要求录屏需 > 3 秒)
    clipBefore: 4,            // 高光片段：事件前几秒
    clipAfter: 3,             // 高光片段：事件后几秒
    maxClips: 6,
    clipGap: 10,              // 两次打点最短间隔 (秒)
    massKill: { count: 45, window: 3 },   // 3 秒内击杀 ≥45 只视为「满屏割草」
  },
  share: {
    title: '星屑轮舞',
    desc: '撑过五分钟，等天亮。',
    topics: ['星屑轮舞', '割草游戏'],
  },
  // 侧边栏复访奖励 (每天一次)
  sidebarReward: 30,
};

// —— 微信版的玩法侧参数 (不含任何账号 / 广告 ID)。分包划分与抖音版相同 ——
// 微信没有抖音的录屏分享和侧边栏；改为「转发给好友」(wx.shareAppMessage / 右上角菜单) 和「分享到朋友圈」(wx.onShareTimeline)。
export const WechatConfig = {
  projectName: '星屑轮舞',
  packs: DouyinConfig.packs,
  packRetryDelay: DouyinConfig.packRetryDelay,
  share: {
    title: '魔法少女守夜割草，撑过五分钟等天亮！',
    timelineTitle: '星屑轮舞｜撑过五分钟，等天亮',
    imageUrl: 'assets/share/share_5x4.jpg',   // 转发卡片图 (官方显示比例 5:4)，主包内
    query: 'from=share',
  },
};
