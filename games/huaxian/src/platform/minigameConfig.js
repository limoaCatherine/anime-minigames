// 小游戏版 (抖音 douyin/ · 微信 wechat/) 的运行时配置：读取与 game.js 同目录的 config.js (CommonJS)。
// 不打包进 game.js，所以改了广告位 ID 不用重新构建；APPID 由构建脚本同步到 project.config.json。
/* global require */
export function loadMiniGameConfig(tag = 'minigame') {
  try {
    const cfg = require('./config.js');
    return cfg && cfg.default ? cfg.default : (cfg || {});
  } catch (err) {
    console.warn(`[${tag}] 读取 config.js 失败，使用默认配置`, err);
    return {};
  }
}
