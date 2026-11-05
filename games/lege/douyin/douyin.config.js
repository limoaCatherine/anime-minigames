// ============================================================================
//  《美少女了个美》抖音小游戏 —— 唯一需要你手动填写的配置文件
//  出品：狸猫
//
//  ★ appid（必填）
//      抖音开放平台 → 你的小游戏 → 开发管理 / 开发设置 → AppID (以 tt 开头)
//
//  ★ rewardedAdUnitId（首发版留空 ''）—— 它就是"广告开关"：
//      留空      → 没有任何广告：卡槽塞满时每关免费「再试一次」(界面上不出现广告字样)
//      填了 ID   → 自动改成"看激励视频复活"(tt.createRewardedVideoAd，看完才复活)
//      流量主要等小游戏上线后才能申请 (个人主体还要求 DAU ≥ 50)，开通后：
//      抖音开放平台 → 变现 / 流量主 → 广告管理 → 新建「激励视频」广告位 → 把 ID 填到这里
//
//  · 修改后：如果你是用源码构建，重新运行 npm run build:douyin；
//    如果你直接用的是「抖音小游戏」文件夹，改这个文件即可 (开发者工具导入时选同一个 AppID)。
// ============================================================================
var DOUYIN_CONFIG = {
  appid: 'TODO_填写你的AppID',
  rewardedAdUnitId: '',          // 首发版留空 = 免费复活、无广告；开通流量主后填入广告位 ID

  // —— 以下可选，一般不用改 ——
  freeReviveWithoutAd: true,     // 没有广告位 ID 时：true = 每关免费复活一次；false = 不提供复活
  rewardOnAdError: false,        // 广告拉取失败 (无填充/网络) 时是否仍给奖励；false = 提示"稍后再试"
  shareTitle: '叠三张就消！你能清空这一桌美少女吗？',
  shareImage: 'assets/share.png', // 分享卡片图 (5:4)
  videoTopics: ['美少女了个美', '叠叠消', '三消小游戏'], // 录屏分享时带的话题
  recordMaxSeconds: 290,         // 自动录屏上限 (抖音最多 300 秒)
  sidebarReward: true,           // 侧边栏复访礼包 (抖音要求接入)
};

if (typeof GameGlobal !== 'undefined') GameGlobal.DOUYIN_CONFIG = DOUYIN_CONFIG;
if (typeof module !== 'undefined') module.exports = DOUYIN_CONFIG;
