// 当前运行平台 (网页 / 桌面版构建)。抖音构建时 tools/build-douyin.mjs 会把本文件替换为 current.douyin.js。
import { detectWebPlatform } from './WebPlatform.js';

export const platform = detectWebPlatform();
