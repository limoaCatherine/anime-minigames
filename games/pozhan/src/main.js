// 入口 (浏览器 / Electron)：装入网页平台实现，创建游戏实例并启动。
// 抖音小游戏入口见 src/main.douyin.js。
import { usePlatform, Platform } from './platform/Platform.js';
import { WebPlatform } from './platform/web.js';
import { Game } from './core/Game.js';

usePlatform(WebPlatform);

function boot() {
  const game = new Game(Platform.getMainCanvas());
  game.start();
  window.__SPOTDIFF__ = game;   // 暴露给调试 / 自动化测试 (tools/test.mjs)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
