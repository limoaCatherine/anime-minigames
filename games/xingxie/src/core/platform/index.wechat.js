// 微信小游戏构建专用的平台入口 (tools/build.mjs 在 --target wechat 时用它替换 index.js)，
// 微信包里不会带上网页版的 DOM 代码。
import { WXPlatform } from './wx.js';

export const PLATFORM_TARGET = 'wechat';
export let platform = new WXPlatform(globalThis.wx);
export function setPlatform(p) { platform = p; return p; }
