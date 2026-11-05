// 预渲染音效 (抖音小游戏用)：WebAudio 在抖音里不保证可用，所以 build:douyin 时用 tools/render_sfx.mjs
// 把 SfxEngine 的每个音效 (含音高变体) 离线渲染成小 mp3，运行时用 InnerAudioContext 轮流播放。
// 网页 / 桌面版仍然实时合成 (有随机音高抖动)。

/** 渲染时整体乘的增益 (留出峰值余量)；播放时音量再除回来 */
export const SFX_FILE_GAIN = 0.5;
export const SFX_DIR = 'assets/sfx/';

/** 运行时：某次播放对应哪个文件 */
export function sfxVariant(name, o = {}) {
  switch (name) {
    case 'pick': return `pick_${(o.type || 0) % 7}`;
    case 'clear': return `clear_${Math.max(0, Math.min(6, (o.combo || 1) - 1))}`;
    case 'combo': return `combo_${Math.max(2, Math.min(7, o.combo || 2))}`;
    case 'heartbeat': return o.fast ? 'heartbeat_fast' : 'heartbeat';
    case 'toggle': return o.on === false ? 'toggle_off' : 'toggle_on';
    case 'star': return `star_${Math.max(0, Math.min(2, o.index || 0))}`;
    default: return name;
  }
}

/** 渲染清单：[文件名, 音效名, 参数, 渲染秒数] */
export function sfxRenderList(names) {
  const out = [];
  for (const n of names) {
    const sec = n === 'bigVictory' || n === 'revive' ? 3.5 : n === 'victory' || n === 'gameover' ? 2.8 : 2.2;
    if (n === 'pick') for (let t = 0; t < 7; t++) out.push([`pick_${t}`, n, { type: t }, 1.2]);
    else if (n === 'clear') for (let c = 1; c <= 7; c++) out.push([`clear_${c - 1}`, n, { combo: c }, sec]);
    else if (n === 'combo') for (let c = 2; c <= 7; c++) out.push([`combo_${c}`, n, { combo: c }, sec]);
    else if (n === 'heartbeat') { out.push(['heartbeat', n, { fast: false }, 1.2]); out.push(['heartbeat_fast', n, { fast: true }, 1.2]); }
    else if (n === 'toggle') { out.push(['toggle_on', n, { on: true }, 1]); out.push(['toggle_off', n, { on: false }, 1]); }
    else if (n === 'star') for (let i = 0; i < 3; i++) out.push([`star_${i}`, n, { index: i }, 2]);
    else out.push([n, n, {}, sec]);
  }
  return out;
}
