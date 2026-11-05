// 音频系统：全部短音效由 WebAudio 实时合成 (不使用音效文件)，按《次元破绽！》音频规范 (合成类新标准) 设计：
// - 找对：五声音阶铃声 (C D E G A)，连续找对逐级升高 (超过一个八度进入高八度)，点错后重置；最后一处 → 上行琶音收尾
//   音色 = 正弦 + 少量三角波叠加，5ms 起音、300~500ms 指数衰减、轻微 detune 增加"手作感"
// - 点错：低频下滑音 (滤波后的方波) + 短促噪声，≤200ms，不刺耳
// - 道具组合成功：两音上行 + 轻微混响尾；提示揭示 / 道具使用 / 通关 / 失败 各有独立音色
// - 每次播放加入轻微随机音高 (±2.5%)，避免复读机感
// 自己订阅玩法事件，场景无需关心音效。浏览器要求用户交互后才能出声，因此在第一次点击/按键时解锁。
import { AudioConfig } from '../config/AudioConfig.js';
import { Platform } from '../platform/Platform.js';

const PENTA = [0, 2, 4, 7, 9];                    // 宫 商 角 徵 羽
const C5 = 523.25;
/** 第 i 个五声音阶音 (i 超过 5 进入高一个八度) */
export const pentaNote = (i, base = C5) => base * Math.pow(2, (PENTA[i % 5] + 12 * Math.floor(i / 5)) / 12);

export const SFX_LIST = {
  correct: '找对：五声音阶铃声，连续找对逐级升高',
  final: '最后一处：上行琶音收尾',
  wrong: '点错：低频下滑闷响 + 短噪声 (≤200ms)',
  reveal: '提示揭示：上扫的闪光',
  pick: '拾取道具：木质"嗒"',
  combine: '道具组合：两音上行 + 混响尾',
  use: '道具生效：亮晶晶的三音',
  deny: '道具用错：两下闷"嘟"',
  hold: '长按蓄力：上升的轻音',
  swipe: '滑动：风声',
  barrage: '弹幕飞过：极轻的"咻"',
  win: '通关：铃声琶音 + 和弦',
  silly: '沙雕结局：滑稽的下滑 + 弹簧声',
  lose: '理智清零：下行三角波',
  star: '得星：一颗比一颗高',
  click: '按钮：软"啵"',
  hover: '悬停：很轻的"叮"',
  toggle: '开关', tick: '滑条 / 倒计时', unlock: '解锁关卡', whoosh: '翻页',
};

/** 抖音版用的预渲染音效清单：key → 合成参数 (tools/render_sfx.mjs 用 OfflineAudioContext 逐个渲染成 mp3) */
export const SFX_TAKES = 2;   // 每个音效渲染 2 个版本 (不同随机音高)，播放时随机选，保留"不复读"的手感
export function sfxKey(name, opts = {}) {
  switch (name) {
    case 'correct': return `correct_${Math.min(opts.step || 0, 12)}`;
    case 'final': return `final_${Math.min(opts.step || 0, 7)}`;
    case 'star': return `star_${Math.min(opts.n || 0, 2)}`;
    case 'toggle': return `toggle_${opts.on ? 1 : 0}`;
    default: return name;
  }
}
export function sfxVariants() {
  const out = [];
  const add = (name, opts = {}) => out.push({ key: sfxKey(name, opts), name, opts });
  for (let i = 0; i <= 12; i++) add('correct', { step: i });
  for (let i = 0; i <= 7; i++) add('final', { step: i });
  for (let i = 0; i <= 2; i++) add('star', { n: i });
  add('toggle', { on: false }); add('toggle', { on: true });
  for (const n of Object.keys(SFX_LIST)) if (!['correct', 'final', 'star', 'toggle', 'hover'].includes(n)) add(n);
  return out;
}

export class AudioSystem {
  constructor(events, mixer) {
    this.events = events;
    this.mixer = mixer;
    this.ctx = null;
    this.master = null;
    this.lastPlay = {};
    this.streak = 0;
    this.history = [];        // 最近播放的音效 (测试用)
    this.files = Platform.sfxMode === 'files';
    this.pool = []; this.poolIdx = 0;
    events.on('mixer:change', () => this.applyVolume());
    events.on('input:down', () => this.unlock());
    events.on('input:key', () => this.unlock());

    // 玩法事件 -> 音效
    events.on('find:correct', (e) => {
      if (e.last) { this.play('final', { step: this.streak }); this.streak = 0; return; }
      this.play('correct', { step: this.streak }); this.streak++;
    });
    events.on('find:wrong', () => { this.streak = 0; this.play('wrong'); });
    events.on('level:start', () => { this.streak = 0; });
    events.on('hint:reveal', () => this.play('reveal'));
    events.on('prop:pick', () => this.play('pick'));
    events.on('prop:combine', () => this.play('combine'));
    events.on('prop:use', () => this.play('use'));
    events.on('prop:deny', () => this.play('deny'));
    events.on('prop:hold', () => this.play('hold'));
    events.on('prop:swipe', () => this.play('swipe'));
    events.on('level:win', (e) => this.play(e && e.silly ? 'silly' : 'win'));
    events.on('level:fail', () => this.play('lose'));
  }

  get volume() { return this.mixer.gain('sfx'); }
  applyVolume() { if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02); }

  unlock() {
    if (this.files) return;
    try {
      if (!this.ctx) {
        const ctx = Platform.createAudioContext();
        if (!ctx) return;
        this.initContext(ctx);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) {
      console.warn('[AudioSystem] 无法初始化音频:', err);
    }
  }

  /** 搭建合成链 (实时 AudioContext 或离线 OfflineAudioContext 都可以) */
  initContext(ctx) {
    {
      {
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 3;
        this.master.connect(comp); comp.connect(ctx.destination);
        // 轻量混响 (指数衰减噪声脉冲)
        this.verb = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * AudioConfig.reverb.seconds);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const d = ir.getChannelData(c);
          let s = 1234 + c * 77;
          for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3); }
        }
        this.verb.buffer = ir;
        this.send = ctx.createGain();
        this.send.gain.value = AudioConfig.reverb.send;
        this.send.connect(this.verb); this.verb.connect(this.master);
        const nl = ctx.sampleRate;
        this.noiseBuf = ctx.createBuffer(1, nl, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
      }
    }
  }

  get ready() { return this.files ? this.volume > 0 : (this.ctx && this.master && this.volume > 0); }

  /** 文件模式 (抖音)：小播放器池轮流播放预渲染音效；限频规则与合成模式相同 */
  playFile(name, opts) {
    if (name === 'hover') return;            // 触屏没有悬停
    const now = Platform.now() / 1000;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.035) return;
    this.lastPlay[name] = now;
    this.history.push(name); if (this.history.length > 40) this.history.shift();
    if (!this.pool.length) for (let i = 0; i < AudioConfig.sfxPool; i++) this.pool.push(Platform.createAudio({ short: true }));
    const el = this.pool[this.poolIdx++ % this.pool.length];
    const take = Math.floor(Math.random() * SFX_TAKES);
    try {
      el.src = Platform.assetPath(`assets/audio/sfx/${sfxKey(name, opts)}_${take}.mp3`);
      el.volume = this.volume;
      const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
    } catch (_) { /* 静默 */ }
  }

  /** 单个振荡器音 (带包络 / 可选滑音 / 可选混响) */
  tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, attack = 0.005, detune = 0, wet = true, filter = null }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur * 0.85);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(this.master);
    if (wet) g.connect(this.send);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.1, vol = 0.1, freq = 1500, q = 1, type = 'bandpass', delay = 0, wet = false }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    if (wet) g.connect(this.send);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  /** 铃声：正弦 + 少量三角波，5ms 起音，指数衰减，轻微 detune */
  bell(freq, { vol = 0.2, dur = 0.42, delay = 0 } = {}) {
    this.tone({ freq, type: 'sine', dur, vol, delay, attack: 0.005, detune: -4 });
    this.tone({ freq, type: 'triangle', dur: dur * 0.8, vol: vol * 0.22, delay, attack: 0.005, detune: 5 });
    this.tone({ freq: freq * 2, type: 'sine', dur: dur * 0.5, vol: vol * 0.12, delay, attack: 0.004 });
  }

  play(name, opts = {}) {
    if (!this.ready) return;
    if (this.files) { this.playFile(name, opts); return; }
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.035) return;
    this.lastPlay[name] = now;
    this.history.push(name); if (this.history.length > 40) this.history.shift();
    const j = 1 + (Math.random() * 2 - 1) * AudioConfig.pitchJitter;   // 轻微随机音高
    switch (name) {
      case 'correct': {
        const f = pentaNote(Math.min(opts.step || 0, 12)) * j;
        this.bell(f, { vol: 0.24, dur: 0.38 + Math.random() * 0.1 });
        this.tone({ freq: f * 1.5, type: 'sine', dur: 0.22, vol: 0.05, delay: 0.05 });
        break;
      }
      case 'final': {
        const base = Math.min(opts.step || 0, 7);
        [0, 1, 2, 3, 4, 5].forEach((k, i) => this.bell(pentaNote(base + k) * j, { vol: 0.2, dur: 0.5, delay: i * 0.065 }));
        this.bell(pentaNote(base + 7) * j, { vol: 0.16, dur: 0.9, delay: 0.42 });
        break;
      }
      case 'wrong':
        this.tone({ freq: 190 * j, freqEnd: 105, type: 'square', dur: 0.17, vol: 0.2, attack: 0.004, wet: false, filter: { freq: 520, q: 0.8 } });
        this.tone({ freq: 110 * j, freqEnd: 70, type: 'sine', dur: 0.18, vol: 0.22, attack: 0.003, wet: false });
        this.noise({ dur: 0.06, vol: 0.06, freq: 700, q: 0.9 });
        break;
      case 'reveal':
        this.tone({ freq: 600 * j, freqEnd: 1800, type: 'sine', dur: 0.4, vol: 0.09 });
        for (let k = 0; k < 4; k++) this.tone({ freq: (2400 + Math.random() * 1600) * j, dur: 0.1, vol: 0.035, delay: 0.12 + k * 0.05, attack: 0.002 });
        break;
      case 'pick':
        this.tone({ freq: 880 * j, freqEnd: 660, type: 'triangle', dur: 0.08, vol: 0.16, attack: 0.002, wet: false });
        this.noise({ dur: 0.03, vol: 0.06, freq: 2600, q: 2 });
        break;
      case 'combine':
        this.bell(pentaNote(2) * j, { vol: 0.2, dur: 0.35 });
        this.bell(pentaNote(5) * j, { vol: 0.22, dur: 0.7, delay: 0.11 });
        break;
      case 'use':
        [3, 5, 7].forEach((k, i) => this.bell(pentaNote(k) * j, { vol: 0.17, dur: 0.4, delay: i * 0.07 }));
        break;
      case 'deny':
        this.tone({ freq: 240 * j, type: 'triangle', dur: 0.09, vol: 0.16, wet: false });
        this.tone({ freq: 200 * j, type: 'triangle', dur: 0.12, vol: 0.16, delay: 0.1, wet: false });
        break;
      case 'hold':
        this.tone({ freq: 300 * j, freqEnd: 900, type: 'sine', dur: 0.6, vol: 0.06, attack: 0.2 });
        break;
      case 'swipe':
        this.noise({ dur: 0.25, vol: 0.09, freq: 1200, q: 0.6, type: 'bandpass' });
        this.tone({ freq: 400 * j, freqEnd: 900, type: 'sine', dur: 0.2, vol: 0.04 });
        break;
      case 'barrage':
        this.noise({ dur: 0.12, vol: 0.025, freq: 3200, q: 1.2 });
        break;
      case 'win':
        [0, 2, 4, 5, 7, 9, 10].forEach((k, i) => this.bell(pentaNote(k) * j, { vol: 0.17, dur: 0.5, delay: i * 0.085 }));
        [0, 2, 4].forEach((k) => this.tone({ freq: pentaNote(k) / 2, type: 'triangle', dur: 1.2, vol: 0.07, delay: 0.6, attack: 0.05 }));
        break;
      case 'silly':
        this.tone({ freq: 700, freqEnd: 180, type: 'triangle', dur: 0.5, vol: 0.14 });
        for (let k = 0; k < 4; k++) this.tone({ freq: 300 + k * 90, freqEnd: 520 + k * 90, type: 'sine', dur: 0.09, vol: 0.1, delay: 0.5 + k * 0.08 });
        [0, 2, 4, 7].forEach((k, i) => this.bell(pentaNote(k + 5), { vol: 0.13, dur: 0.4, delay: 0.85 + i * 0.07 }));
        break;
      case 'lose':
        [4, 3, 2, 0].forEach((k, i) => this.tone({ freq: pentaNote(k) * 0.5, freqEnd: pentaNote(k) * 0.48, type: 'triangle', dur: 0.4, vol: 0.16, delay: i * 0.16, filter: { freq: 1400 } }));
        break;
      case 'star':
        this.bell(pentaNote(5 + (opts.n || 0) * 2) * j, { vol: 0.2, dur: 0.6 });
        break;
      case 'click':
        this.tone({ freq: 620 * j, freqEnd: 940, type: 'sine', dur: 0.07, vol: 0.13, attack: 0.002, wet: false });
        break;
      case 'hover':
        this.tone({ freq: 1760 * j, type: 'sine', dur: 0.04, vol: 0.025, attack: 0.002, wet: false });
        break;
      case 'toggle':
        this.tone({ freq: opts.on ? 660 : 880, type: 'triangle', dur: 0.06, vol: 0.1, wet: false });
        this.tone({ freq: opts.on ? 880 : 660, type: 'triangle', dur: 0.08, vol: 0.1, delay: 0.06, wet: false });
        break;
      case 'tick':
        this.tone({ freq: 1320 * j, type: 'sine', dur: 0.05, vol: 0.1, attack: 0.002, wet: false });
        break;
      case 'unlock':
        [0, 1, 2, 3, 4, 5].forEach((k, i) => this.tone({ freq: pentaNote(k + 5), dur: 0.2, vol: 0.1, delay: i * 0.05 }));
        break;
      case 'whoosh':
        this.noise({ dur: 0.18, vol: 0.05, freq: 900, q: 0.5 });
        break;
      default:
        break;
    }
  }
}
