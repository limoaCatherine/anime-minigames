// 抖音小游戏版本的打包入口 (tools/build-douyin.mjs → build-douyin/js/main.js)
// 和网页版 src/main.js 共用全部游戏代码；平台差异都在 src/platform/DouyinPlatform.js。
/* global GameGlobal */
import { Game } from '../src/core/Game.js';
import { installDebug } from '../src/debug.js';
import { platform } from '../src/platform/index.js';

const game = new Game(platform.getMainCanvas());
game.start();
GameGlobal.__ANIME_STACK__ = game;   // 调试 / 自动化测试 (tools/test-douyin.mjs)
installDebug(game);
