// 微信小游戏配置 —— 上架前只需要改这一个文件 (详见 微信上架说明.md)。
// APPID 改完后运行 `node tools/build-wechat.mjs` 会同步到 project.config.json (或者手动改那里的 "appid")。
// AD_UNIT_ID 在运行时读取，改完直接在开发者工具里重新编译即可。
module.exports = {
  // 微信公众平台 mp.weixin.qq.com → 开发 → 开发管理 → 开发设置 → 开发者 ID → AppID (形如 wx0123456789abcdef)
  APPID: '',
  // 流量主 → 广告管理 → 新建广告位 →「激励视频」后得到的广告位 ID (形如 adunit-0123456789abcdef)；留空 = 游戏里不显示任何看广告界面，提示免费 (看过提示的那次最高 2 星)
  AD_UNIT_ID: '',
};
