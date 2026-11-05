// 入口 (抖音小游戏)：platform/tt.js 在模块加载时就同步注册 tt.onShow (侧边栏复访要求)，随后创建游戏。
import { platform } from './core/platform/index.js';
import { Game } from './core/Game.js';

const game = new Game(platform.getMainCanvas());
game.start();
globalThis.__ANIME_SURVIVOR__ = game;   // 调试 / 自动化测试
