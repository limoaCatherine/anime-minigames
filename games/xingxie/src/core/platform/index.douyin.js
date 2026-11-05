// 抖音小游戏构建专用的平台入口 (tools/build.mjs 在 --target douyin 时用它替换 index.js)，
// 这样抖音包里不会带上网页版的 DOM 代码。
import { TTPlatform } from './tt.js';

export const PLATFORM_TARGET = 'douyin';
export let platform = new TTPlatform(globalThis.tt);
export function setPlatform(p) { platform = p; return p; }
