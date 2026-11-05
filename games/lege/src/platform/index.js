// 平台抽象层入口：游戏逻辑只通过 `platform` 访问宿主能力 (画布、图片、音频、存储、输入、广告、分享、录屏、生命周期)。
//   - 网页 / Electron：WebPlatform (DOM + WebAudio + localStorage)
//   - 抖音小游戏：DouyinPlatform (tt.* API)，`npm run build:douyin` 用 esbuild define `globalThis.__DOUYIN__ = true` 选中
//   - 微信小游戏：WechatPlatform (wx.* API)，`npm run build:wechat` 用 esbuild define `globalThis.__WECHAT__ = true` 选中
// 开发模式 (浏览器直接加载 src/ 的 ES 模块) 下两个标记都未定义 → 网页平台。
import { WebPlatform } from './WebPlatform.js';
import { DouyinPlatform } from './DouyinPlatform.js';
import { WechatPlatform } from './WechatPlatform.js';

// 构建时 esbuild 把标记替换成常量 true/false；另外各小游戏构建用插件把用不到的平台换成空壳
// (抖音包里不含 WebPlatform / WechatPlatform；微信包里不含 WebPlatform)
const isDouyin = !!globalThis.__DOUYIN__;
const isWechat = !!globalThis.__WECHAT__;

/* global wx, tt */
export const platform = isWechat ? new WechatPlatform(typeof wx !== 'undefined' ? wx : globalThis.wx)
  : isDouyin ? new DouyinPlatform(typeof tt !== 'undefined' ? tt : globalThis.tt)
    : new WebPlatform();
