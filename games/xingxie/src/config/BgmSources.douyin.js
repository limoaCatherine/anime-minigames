// BGM 文件来源 (抖音小游戏)：只用 mp3 (抖音 iOS 端不支持 ogg)。
// 文件是 tools/make_tt_bgm.py 生成的「一个循环 + 1 秒 overrun」版本，运行时由 TTLoopAudio 双实例交叉淡化实现无缝循环。
import { BGM_LOOPS } from './BgmLoopManifest.js';
const mp3 = (n) => [{ src: BGM_LOOPS[n].src, type: 'audio/mpeg' }];
export const BGM_SOURCES = { menu: mp3('menu'), battle: mp3('battle'), boss: mp3('boss') };
export const BGM_LOOP_INFO = BGM_LOOPS;
