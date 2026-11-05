// ============================================================================
//  《美少女了个美》微信小游戏 —— 唯一需要你手动填写的配置文件
//  出品：狸猫
//
//  ★ appid（必填）
//      微信公众平台 mp.weixin.qq.com → 开发 → 开发管理 → 开发设置 → AppID(小程序ID)，以 wx 开头
//
//  ★ rewardedAdUnitId（首发版留空 ''）—— 它就是"广告开关"：
//      留空      → 没有任何广告：卡槽塞满时每关免费「再试一次」(界面上不出现广告字样)
//      填了 ID   → 自动改成"看激励视频复活"(wx.createRewardedVideoAd，看完才复活)
//      流量主要等小游戏上线、累计独立访客 (UV) > 500 后才能开通 (以 mp 后台「流量主」页面为准)，开通后：
//      mp 后台 → 流量主 → 广告管理 → 新建「激励广告」广告位 → 把 adunit-xxxx 填到这里
//
//  · 修改后：如果你是用源码构建，重新运行 npm run build:wechat；
//    如果你直接用的是「微信小游戏」文件夹，改这个文件即可，再把 project.config.json 里的 appid 改成同一个
//    (或在微信开发者工具「详情 → 基本信息」里修改 AppID)。
// ============================================================================
var WECHAT_CONFIG = {
  appid: 'TODO_填写你的AppID',
  rewardedAdUnitId: '',          // 首发版留空 = 免费复活、无广告；开通流量主后填入 adunit-xxxxxxxx

  // —— 以下可选，一般不用改 ——
  freeReviveWithoutAd: true,     // 没有广告位 ID 时：true = 每关免费复活一次；false = 不提供复活
  rewardOnAdError: false,        // 广告拉取失败 (无填充/网络) 时是否仍给奖励；false = 提示"稍后再试"
  shareTitle: '叠三张就消！你能清空这一桌美少女吗？',   // 转发给好友 / 群聊的标题
  shareImage: 'assets/share.png',                       // 转发卡片图 (5:4，500×400)
  shareTimeline: true,                                  // 右上角菜单显示「分享到朋友圈」(微信仅 Android 支持)
  timelineTitle: '《美少女了个美》叠三张就消，来试试能过几关',
  timelineImage: 'assets/share_timeline.png',           // 朋友圈卡片图 (1:1，500×500)
};

if (typeof GameGlobal !== 'undefined') GameGlobal.WECHAT_CONFIG = WECHAT_CONFIG;
if (typeof module !== 'undefined') module.exports = WECHAT_CONFIG;
