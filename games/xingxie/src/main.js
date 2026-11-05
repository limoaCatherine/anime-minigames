// 入口 (网页版 / Electron)：创建游戏实例并启动。抖音小游戏的入口是 main.douyin.js，微信小游戏是 main.wechat.js。
import { Game } from './core/Game.js';

function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  game.start();
  window.__ANIME_SURVIVOR__ = game;   // 调试 / 自动化测试
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
