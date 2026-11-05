// 入口 (微信小游戏)：platform/wx.js 在模块加载时同步注册 wx.onShow / 右上角转发菜单，随后创建游戏。
import { platform } from './core/platform/index.js';
import { Game } from './core/Game.js';

const game = new Game(platform.getMainCanvas());
game.start();
globalThis.__ANIME_SURVIVOR__ = game;   // 调试 / 自动化测试
