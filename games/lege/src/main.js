// 入口：创建游戏实例并启动。
import { Game } from './core/Game.js';
import { installDebug } from './debug.js';
import { platform } from './platform/index.js';

function boot() {
  const canvas = platform.getMainCanvas();
  const game = new Game(canvas);
  game.start();
  // 暴露给调试/自动化测试
  window.__ANIME_STACK__ = game;
  installDebug(game);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
