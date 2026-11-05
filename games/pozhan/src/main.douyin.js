// 抖音小游戏入口：由 build-douyin/game.js 调用 boot(cfg)。
// 平台相关代码全部在 platform/douyin.js，游戏核心与网页版 / 桌面版共用。
import { usePlatform, Platform } from './platform/Platform.js';
import { createDouyinPlatform } from './platform/douyin.js';
import { Game } from './core/Game.js';

export function boot(cfg = {}) {
  usePlatform(createDouyinPlatform(cfg));
  const game = new Game(Platform.getMainCanvas());
  game.start();
  const G = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
  G.__SPOTDIFF__ = game;   // 方便在开发者工具控制台调试 / 自动化测试
  return game;
}
