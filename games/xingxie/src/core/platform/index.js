// 平台层入口：玩法代码只和 `platform` 打交道，不直接碰 window / document / tt。
//   网页版 / Electron：web.js     抖音小游戏：tt.js     微信小游戏：wx.js
// 构建时 esbuild 用 define 注入 __PLATFORM__ ('web' | 'douyin' | 'wechat')；直接用 node 跑测试时没有注入，按 web 处理。
import { WebPlatform } from './web.js';
import { TTPlatform } from './tt.js';
import { WXPlatform } from './wx.js';

/* global __PLATFORM__ */
export const PLATFORM_TARGET = typeof __PLATFORM__ !== 'undefined' ? __PLATFORM__ : 'web';

function create() {
  if (PLATFORM_TARGET === 'douyin') {
    const tt = typeof globalThis !== 'undefined' ? globalThis.tt : undefined;
    if (!tt) throw new Error('抖音版需要运行在抖音小游戏环境 (缺少全局 tt)');
    return new TTPlatform(tt);
  }
  if (PLATFORM_TARGET === 'wechat') {
    const wx = typeof globalThis !== 'undefined' ? globalThis.wx : undefined;
    if (!wx) throw new Error('微信版需要运行在微信小游戏环境 (缺少全局 wx)');
    return new WXPlatform(wx);
  }
  return new WebPlatform();
}

export let platform = create();

/** 测试用：替换平台实现 */
export function setPlatform(p) { platform = p; return p; }
