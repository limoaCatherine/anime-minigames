// BGM 文件来源 (网页版 / exe)：优先 ogg (首尾无缝)，Safari 等不支持 ogg 时退回 mp3。
// 抖音版构建时 (tools/build.mjs) 这个文件会被替换成 BgmSources.douyin.js：只有 mp3，不出现任何 ogg。
const DIR = 'assets/audio/bgm/';
const both = (n) => [{ src: `${DIR}bgm_${n}.ogg`, type: 'audio/ogg; codecs="vorbis"' }, { src: `${DIR}bgm_${n}.mp3`, type: 'audio/mpeg' }];
export const BGM_SOURCES = { menu: both('menu'), battle: both('battle'), boss: both('boss') };
/** 抖音版才有：循环长度信息 (TTLoopAudio 用)；网页版靠 ogg 本身无缝 + loop=true */
export const BGM_LOOP_INFO = null;
