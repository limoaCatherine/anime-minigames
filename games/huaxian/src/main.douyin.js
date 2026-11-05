// 抖音小游戏入口 (tools/build-douyin.mjs 打包为 douyin/game.js)。
// 与网页版共用全部玩法代码；平台差异都在 src/platform/DouyinPlatform.js。
/* global GameGlobal */
import { Game } from './core/Game.js';
import { platform } from './platform/current.js';

const game = new Game(platform);
game.start();
// 调试 / 自动化测试 (tools/test-douyin.mjs)
if (typeof GameGlobal !== 'undefined') GameGlobal.__ANIME_DRAWLINE__ = game;
