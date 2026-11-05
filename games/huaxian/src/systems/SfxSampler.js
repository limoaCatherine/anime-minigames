// 预渲染音效后端 (抖音小游戏等没有 WebAudio 的平台)。
// 音效文件由 tools/render-sfx.mjs 用 AudioSystem.synth() 同一份合成代码离线渲染 (OfflineAudioContext)，
// 归一化后编码成小 mp3；清单 (文件 / 原始增益 / 时长) 在 src/config/SfxSamples.js。
// 播放音量 = 声道音量 (MixerSystem) × 文件的原始增益，因此响度与网页版的实时合成一致。
// 每个音效最多同时 N 个 InnerAudioContext (轮流复用)，限频仍由 AudioSystem.play 负责。
import { SFX_SAMPLES, SFX_DIR } from '../config/SfxSamples.js';
import { AudioConfig } from '../config/AudioConfig.js';

const POOL = { scribble: 2, boing: 3, star: 2, tick: 2, pop: 2, click: 2 };

/** 命名音效 + 参数 -> 预渲染的变体 key (与 tools/render-sfx.mjs 的 VARIANTS 对应) */
export function sampleKey(name, opts = {}) {
  switch (name) {
    case 'scribble': {
      const r = opts.ratio != null ? opts.ratio : 1;
      return r > 0.66 ? 'scribble_0' : r > 0.33 ? 'scribble_1' : 'scribble_2';
    }
    case 'boing': return `boing_${Math.floor(Math.random() * 4)}`;
    case 'star': return `star_${Math.max(0, Math.min(2, opts.index || 0))}`;
    case 'tick': return opts.last ? 'tick_last' : 'tick';
    case 'glass': return `glass_${Math.floor(Math.random() * 2)}`;
    default: return name;
  }
}

export class SfxSampler {
  constructor(platform) {
    this.platform = platform;
    this.pools = {};
    this.played = {};          // 播放计数 (测试用)
    this.swarm = null;
    this.swarmVol = 0;
  }

  _get(key) {
    const meta = SFX_SAMPLES[key];
    if (!meta) return null;
    const base = key.replace(/_(\d|last)$/, '');
    let pool = this.pools[key];
    if (!pool) pool = this.pools[key] = { list: [], next: 0, max: POOL[base] || 1 };
    if (pool.list.length < pool.max) {
      const a = this.platform.createAudio();
      if (!a) return null;
      a.src = this.platform.resolveAsset(`${SFX_DIR}/${meta.file}`);
      pool.list.push(a);
      return { a, meta };
    }
    const a = pool.list[pool.next++ % pool.list.length];
    return { a, meta };
  }

  play(key, volume) {
    const h = this._get(key);
    if (!h) return;
    this.played[key] = (this.played[key] || 0) + 1;
    const { a, meta } = h;
    try {
      a.volume = Math.max(0, Math.min(1, volume * meta.gain));
      if (!a.paused) a.pause();
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* ignore */ }
  }

  /** 蜂群嗡嗡声：一个循环播放的无缝 wav，音量每帧平滑 */
  startSwarm() {
    if (this.swarm) return;
    const meta = SFX_SAMPLES.swarm;
    const a = meta && this.platform.createAudio();
    if (!a) return;
    a.src = this.platform.resolveAsset(`${SFX_DIR}/${meta.file}`);
    a.loop = true;
    a.volume = 0;
    this.swarm = { a, meta, playing: false };
  }

  updateSwarm(dt, target) {
    const s = this.swarm;
    if (!s) return;
    const SW = AudioConfig.swarm;
    const tau = target > this.swarmVol ? SW.attack : SW.release;
    this.swarmVol += (target - this.swarmVol) * (1 - Math.exp(-dt / tau));
    if (target <= 0 && this.swarmVol < 0.0004) this.swarmVol = 0;
    try {
      s.a.volume = Math.max(0, Math.min(1, this.swarmVol * s.meta.gain));
      if (this.swarmVol > 0 && !s.playing) { s.playing = true; const p = s.a.play(); if (p && p.catch) p.catch(() => {}); }
      else if (this.swarmVol === 0 && s.playing) { s.playing = false; s.a.pause(); }
    } catch (_) { /* ignore */ }
  }
}
