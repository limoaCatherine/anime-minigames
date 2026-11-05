// 微信小游戏入口：由 build-wechat/game.js 调用 boot(cfg)。
// 平台相关代码全部在 platform/wechat.js (+ 与抖音共用的 platform/minigame.js)，游戏核心与网页版 / 桌面版 / 抖音版共用。
import { usePlatform, Platform } from './platform/Platform.js';
import { createWechatPlatform } from './platform/wechat.js';
import { Game } from './core/Game.js';

export function boot(cfg = {}) {
  usePlatform(createWechatPlatform(cfg));
  const game = new Game(Platform.getMainCanvas());
  game.start();
  const G = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
  G.__SPOTDIFF__ = game;   // 方便在开发者工具控制台调试 / 自动化测试
  return game;
}
