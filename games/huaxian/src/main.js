// 入口 (网页 / 桌面版)：创建游戏实例并启动。抖音小游戏入口见 src/main.douyin.js。
import { Game } from './core/Game.js';
import { platform } from './platform/current.js';

function boot() {
  const game = new Game(platform);
  game.start();
  // 暴露给调试/自动化测试
  window.__ANIME_DRAWLINE__ = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
