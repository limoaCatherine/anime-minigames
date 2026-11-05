// 抖音小游戏的音效播放器：播放 tools/render_sfx.mjs 用 AudioSystem.synth() 离线渲染出的 wav (主包 assets/sfx/)。
// - 限频 (同类 50ms) / 命中类并发上限 (5) 由 AudioSystem.play() 先判断，这里只负责发声
// - 命中类专用 5 个 InnerAudioContext，其它音效共用 3 个，怪群环境声 1 个循环；
//   Android 同时最多 10 路音频 (官方文档)，加上 BGM 和语音刚好在上限内
// - 同一个音效优先复用已经装着该文件的实例，减少换 src 的加载延迟；都在响时抢最早开始的那个
// - 音高随机 (±6%) 改为每个音效预渲染 2~3 个变体随机挑；宝石连拾的音阶每一级各渲染一个
import { SFX_MANIFEST } from '../config/SfxManifest.js';
import { AudioConfig } from '../config/AudioConfig.js';
import { platform as defaultPlatform } from '../core/platform/index.js';

const HIT_NAMES = new Set(['hit', 'crit', 'pop', 'boom']);

export class SfxSampler {
  static supported(p = defaultPlatform) {
    return !!(p && p.isMiniGame && SFX_MANIFEST && SFX_MANIFEST.files && Object.keys(SFX_MANIFEST.files).length);
  }

  constructor(p = defaultPlatform) {
    this.p = p;
    this.vol = AudioConfig.sfxVolume;
    this.hitPool = [];
    this.pool = [];
    this.swarmEl = null;
    this.swarmLevel = 0;
    this.played = [];             // 最近播放记录 (测试用)
    this.hitMax = AudioConfig.hit.maxVoices;
    this.otherMax = 3;
  }

  setVolume(v) { this.vol = v; if (this.swarmEl) this.swarmEl.volume = this._swarmGain(); }

  /** 文件按 K 倍放大存储，播放时除回来 */
  gain() { return Math.max(0, Math.min(1, (this.vol / AudioConfig.sfxVolume) / (SFX_MANIFEST.gain || 1))); }

  key(name, o = {}) {
    if (name === 'gem') return `gem_${o.type === 'red' || o.type === 'rainbow' ? 'b' : 's'}${o.gemStep || 0}`;
    if (name === 'hit' && (o.boss || o.elite)) return 'hit_big';
    return name;
  }

  play(name, o = {}) {
    const k = this.key(name, o);
    const list = SFX_MANIFEST.files[k];
    if (!list || !list.length) return false;
    const src = list[Math.floor(Math.random() * list.length)];
    const hit = HIT_NAMES.has(name);
    const pool = hit ? this.hitPool : this.pool;
    const max = hit ? this.hitMax : this.otherMax;
    const now = this.p.now();
    const idle = (e) => e.paused || e.ended || now - e._t > (e._dur || 0) * 1000 + 80;
    let el = pool.find((e) => e.src === src && idle(e)) || pool.find(idle);
    if (!el && pool.length < max) { el = this.p.createAudio(); pool.push(el); }
    if (!el) el = pool.reduce((a, b) => (a._t <= b._t ? a : b));
    if (el.src !== src) el.src = src;
    el._t = now; el._dur = (SFX_MANIFEST.dur && SFX_MANIFEST.dur[src]) || 0.5;
    el.volume = this.gain();
    el.currentTime = 0;
    try { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (_) { /* ignore */ }
    this.played.push(k); if (this.played.length > 50) this.played.shift();
    return true;
  }

  // swarm_loop.wav 按强度 1 渲染，播放时乘当前强度
  _swarmGain() { return Math.max(0, Math.min(1, this.swarmLevel * this.gain())); }

  /** 怪群环境声：一个循环的低沉底噪，音量跟随密度 */
  setSwarm(level) {
    this.swarmLevel = level;
    const src = SFX_MANIFEST.swarm;
    if (!src) return;
    if (level <= 0.001) { if (this.swarmEl && !this.swarmEl.paused) this.swarmEl.pause(); return; }
    if (!this.swarmEl) { this.swarmEl = this.p.createAudio(); this.swarmEl.loop = true; this.swarmEl.src = src; }
    this.swarmEl.volume = this._swarmGain();
    if (this.swarmEl.paused) { try { this.swarmEl.play(); } catch (_) { /* ignore */ } }
  }
}
