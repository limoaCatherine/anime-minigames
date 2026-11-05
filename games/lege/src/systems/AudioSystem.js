// 音效系统：订阅玩法事件自动发声；声音本身由 SfxEngine 合成 (多层 + 包络 + 滤波噪声 + 小混响)。
// - 音量来自 MixerSystem (总音量 × 音效声道 × 开关)，默认 100% = 0.12
// - 同名音效有最小间隔，避免连锁时爆音；每次播放带轻微音高抖动
// - 浏览器要求用户交互后才能出声，第一次点击/按键时解锁
import { AudioConfig } from '../config/AudioConfig.js';
import { SfxEngine, SFX_LIST } from './SfxEngine.js';
import { SFX_FILE_GAIN, SFX_DIR, sfxVariant } from '../config/SfxFiles.js';
import { platform } from '../platform/index.js';

const POOL_SIZE = 6;   // 抖音：音效播放器个数 (InnerAudioContext)

export { SFX_LIST };

// 同名音效的最小间隔 (秒)
const MIN_GAP = { hover: 0.06, deal: 0.03, pick: 0.03, land: 0.03, tick: 0.05, default: 0.04 };

export class AudioSystem {
  constructor(events, mixer) {
    this.events = events;
    this.mixer = mixer;
    this.ctx = null;
    this.engine = null;
    this.bus = null;
    this.lastPlay = {};
    this.playLog = [];         // 最近播放的音效名 (测试用)
    this.tension = 0;          // 0 无 / 1 卡槽 5 张 / 2 卡槽 6 张 → 心跳
    this.beatTimer = 0;
    this.unlocked = false;
    this.fileMode = platform.sfxMode === 'files';   // 抖音：预渲染 mp3
    this.pool = [];
    this.poolIdx = 0;
    this.hidden = false;
    this.clock = 0;
    events.on('input:down', () => this.unlock());
    events.on('input:key', () => this.unlock());
    events.on('mixer:change', () => this.applyLevels());
    events.on('app:hidden', () => { this.hidden = true; for (const a of this.pool) a.pause(); });
    events.on('app:visible', () => { this.hidden = false; });

    events.on('card:pick', (e) => this.play('pick', e));
    events.on('card:land', () => this.play('land'));
    events.on('card:deny', () => this.play('deny'));
    events.on('card:deal', (e) => this.play('deal', e));
    events.on('match', (e) => {
      this.play('clear', { combo: e.combo || 1 });
      if ((e.combo || 1) >= 2) this.play('combo', { combo: e.combo });
    });
    events.on('slot:warn', () => this.play('warn'));
    events.on('prop:moveOut', () => this.play('moveOut'));
    events.on('prop:undo', () => this.play('undo'));
    events.on('prop:shuffle', () => this.play('shuffle'));
    events.on('prop:denied', () => this.play('deny'));
    events.on('revive', () => this.play('revive'));
    events.on('ad:tick', () => this.play('tick'));
    events.on('level:start', () => this.play('start'));
    events.on('level:win', (e) => this.play(e.hell ? 'bigVictory' : 'victory'));
    events.on('level:fail', () => this.play('gameover'));
    events.on('level:unlock', () => this.play('unlock'));
    events.on('ui:star', (e) => this.play('star', e));
    events.on('ui:hover', () => this.play('hover'));
    events.on('scene:changed', (name) => { if (name !== 'boot') this.play('whoosh'); this.tension = 0; });
  }

  get muted() { return this.mixer.muted; }
  get volume() { return this.mixer.gain('sfx'); }

  unlock() {
    if (this.fileMode) {
      if (!this.pool.length) {
        for (let i = 0; i < POOL_SIZE; i++) { const a = platform.createAudio(); if (a) this.pool.push(a); }
      }
      if (!this.unlocked) { this.unlocked = true; this.events.emit('audio:unlocked'); }
      return;
    }
    try {
      if (typeof window === 'undefined') return;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.bus = this.ctx.createGain();
        this.bus.gain.value = this.volume;
        const comp = this.ctx.createDynamicsCompressor();   // 只做安全限幅
        comp.threshold.value = -6; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.1;
        this.bus.connect(comp);
        comp.connect(this.ctx.destination);
        this.engine = new SfxEngine(this.ctx, this.bus, { reverbSeconds: AudioConfig.reverb.seconds, reverbSend: AudioConfig.reverb.send });
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.unlocked) { this.unlocked = true; this.events.emit('audio:unlocked'); }
    } catch (err) {
      console.warn('[AudioSystem] 无法初始化音频:', err);
    }
  }

  applyLevels() {
    if (this.bus) this.bus.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
  }

  toggleMute() { return this.mixer.setMuted(!this.mixer.muted); }

  get ready() { return this.fileMode ? this.pool.length > 0 && this.volume > 0 && !this.hidden : !!(this.engine && this.volume > 0); }

  /** 卡槽紧张度 (GameScene 每帧设置)：0 无 / 1 慢心跳 / 2 快心跳 */
  setTension(level) {
    if (level > this.tension) this.beatTimer = 0;
    this.tension = level;
  }

  update(dt) {
    this.clock += dt;
    if (this.tension > 0) {
      this.beatTimer -= dt;
      if (this.beatTimer <= 0) {
        this.beatTimer = this.tension >= 2 ? 0.52 : 0.82;
        this.play('heartbeat', { fast: this.tension >= 2 });
      }
    }
  }

  play(name, opts = {}) {
    if (!this.ready) return false;
    const now = this.fileMode ? this.clock : this.ctx.currentTime;
    const gap = MIN_GAP[name] ?? MIN_GAP.default;
    if (this.lastPlay[name] !== undefined && now - this.lastPlay[name] < gap) return false;
    this.lastPlay[name] = now;
    this.playLog.push(name);
    if (this.playLog.length > 80) this.playLog.shift();
    if (this.fileMode) this.playFile(name, opts);
    else this.engine.play(name, opts);
    return true;
  }

  /** 抖音：从播放器池里取一个 (优先空闲的)，换上对应的预渲染文件 */
  playFile(name, opts) {
    const src = `${SFX_DIR}${sfxVariant(name, opts)}.mp3`;
    let a = this.pool.find((x) => x.paused);
    if (!a) { a = this.pool[this.poolIdx % this.pool.length]; this.poolIdx++; a.pause(); }
    if (a.src !== src) a.src = src;
    else a.currentTime = 0;
    a.volume = Math.min(1, this.volume / SFX_FILE_GAIN);
    a.play().catch(() => {});
  }
}
