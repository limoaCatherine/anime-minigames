// 音效合成引擎 (WebAudio)。每个音效由多层组成：带包络的振荡器、滤波噪声、钟声泛音，最后送入一个小房间混响。
// 同一套代码既用于实时播放 (AudioSystem)，也用于离线渲染测响度 (tools/measure_audio.mjs → OfflineAudioContext)。
// 音阶统一用 C 大调五声音阶，连消时钟声逐级升高；每次播放有轻微音高抖动，不会"复读机"。
import { SFX_TRIM } from '../config/SfxTrim.js';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const C5 = 523.25;
export const pent = (i, base = C5) => base * Math.pow(2, PENTA[Math.max(0, Math.min(PENTA.length - 1, i))] / 12);

// 每个音效的说明 (README / 调试面板用)
export const SFX_LIST = {
  click: '按钮：软"啵"一声 + 一点木质点击',
  hover: '悬停：很轻的高音"叮"',
  toggle: '开关：两音拨片 (开上行、关下行)',
  pick: '拿牌："嗒"的木片声，音高跟花色走，带随机抖动',
  land: '落槽：卡片拍进木托盘的闷响',
  deny: '点到被压住的卡：两下闷闷的"嘟"',
  deal: '发牌：纸牌擦过桌面的"唰"',
  clear: '三消：三音钟声 + 气泡 + 闪光，连消时整体升调',
  combo: '连消 ×2 起：快速上行的钟琴音阶',
  warn: '卡槽剩 1 格：柔和的双音提示',
  heartbeat: '卡槽 5 张起：低频心跳 (6 张更快)',
  moveOut: '移出：向上扫的风声 + 上滑音',
  undo: '撤回：倒带式下滑音',
  shuffle: '洗牌：一串纸牌拨动声',
  revive: '复活：铺底和弦慢慢涨起来 + 上行钟声',
  tick: '倒计时 / 滑条：木鱼"嗒"',
  start: '开局：三个上行小钟',
  victory: '通关：钟声琶音 + 和弦',
  bigVictory: 'BOSS 通关：两段琶音 + 闪光长尾',
  gameover: '失败：下行的柔和三角波，带低通"泄气"',
  unlock: '解锁关卡：钟琴快速上行',
  star: '得星：单颗钟声，一颗比一颗高',
  whoosh: '切换页面：很轻的风声',
};

export class SfxEngine {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} out  音效总线 (音量由外部控制)
   */
  constructor(ctx, out, { reverbSeconds = 1.1, reverbSend = 0.16 } = {}) {
    this.ctx = ctx;
    this.out = out;
    this.sendLevel = reverbSend;
    this.noiseBuf = this.makeNoise();
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeIR(reverbSeconds);
    this.verbIn = ctx.createGain();
    this.verbIn.gain.value = 1;
    this.verbIn.connect(this.verb);
    this.verb.connect(out);
  }

  makeNoise() {
    const ctx = this.ctx;
    const len = ctx.sampleRate;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    return b;
  }

  makeIR(sec) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    let s = 777;
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const r = (s / 0x3fffffff) - 1;
        lp += (r - lp) * 0.35;                         // 偏暗的混响
        d[i] = lp * Math.exp(-i / (ctx.sampleRate * sec * 0.22)) * (i < 300 ? i / 300 : 1);
      }
    }
    return b;
  }

  /** 一次播放的输出：干声 + 混响 send，整体乘以该音效的校准增益 */
  voice(name, send = this.sendLevel) {
    const g = this.ctx.createGain();
    g.gain.value = SFX_TRIM[name] ?? 1;
    g.connect(this.out);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.verbIn);
    }
    return g;
  }

  env(g, t, vol, attack, dur, curve = 'exp') {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t + attack + dur);
  }

  osc(out, { f = 440, f2 = null, type = 'sine', t = 0, dur = 0.15, vol = 0.3, attack = 0.004, detune = 0, lp = null, glide = 0.8 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur * glide);
    const g = ctx.createGain();
    this.env(g, t, vol, attack, dur);
    let node = o;
    if (lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.7;
      o.connect(fl); node = fl;
    }
    node.connect(g); g.connect(out);
    o.start(t); o.stop(t + attack + dur + 0.05);
  }

  noise(out, { t = 0, dur = 0.12, vol = 0.2, f = 1800, f2 = null, q = 1, type = 'bandpass', attack = 0.003 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const g = ctx.createGain();
    this.env(g, t, vol, attack, dur);
    src.connect(fl); fl.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.6);
    src.stop(t + attack + dur + 0.05);
  }

  /** 钟声：基音 + 非整数泛音，各自衰减 */
  bell(out, f, t, vol = 0.2, decay = 0.6) {
    this.osc(out, { f, t, dur: decay, vol, attack: 0.002 });
    this.osc(out, { f: f * 2.0, t, dur: decay * 0.5, vol: vol * 0.28, attack: 0.002 });
    this.osc(out, { f: f * 2.76, t, dur: decay * 0.3, vol: vol * 0.16, attack: 0.001 });
    this.osc(out, { f: f * 5.4, t, dur: decay * 0.12, vol: vol * 0.07, attack: 0.001 });
  }

  sparkle(out, t, n = 4, vol = 0.04) {
    for (let k = 0; k < n; k++) {
      this.osc(out, { f: 2400 + Math.random() * 2400, t: t + k * 0.04 + Math.random() * 0.02, dur: 0.08, vol, attack: 0.001 });
    }
  }

  /** 播放命名音效 (opts: type / combo / fast / on / index) */
  play(name, opts = {}, when = 0) {
    const t = this.ctx.currentTime + when;
    const j = (c = 30) => (Math.random() * 2 - 1) * c;                  // 音高抖动 (cents)
    const jr = (c = 30) => Math.pow(2, j(c) / 1200);
    switch (name) {
      case 'click': {
        const o = this.voice(name, 0.08);
        this.osc(o, { f: 760 * jr(40), f2: 1250, t, dur: 0.06, vol: 0.5, attack: 0.002, glide: 0.5 });
        this.noise(o, { t, dur: 0.018, vol: 0.25, f: 3200, q: 1.2 });
        break;
      }
      case 'hover': {
        const o = this.voice(name, 0.1);
        this.osc(o, { f: 1980 * jr(50), t, dur: 0.04, vol: 0.18, attack: 0.002 });
        break;
      }
      case 'toggle': {
        const o = this.voice(name, 0.08);
        const [a, b] = opts.on === false ? [880, 587] : [587, 880];
        this.osc(o, { f: a, t, dur: 0.05, vol: 0.35, type: 'triangle' });
        this.osc(o, { f: b, t: t + 0.055, dur: 0.08, vol: 0.4, type: 'triangle' });
        this.noise(o, { t, dur: 0.015, vol: 0.2, f: 2600 });
        break;
      }
      case 'pick': {
        const o = this.voice(name, 0.06);
        const f = pent(((opts.type || 0) % 7) + 3, 392) * jr(25);
        this.osc(o, { f, f2: f * 0.94, t, dur: 0.07, vol: 0.55, type: 'triangle', attack: 0.001 });
        this.osc(o, { f: f * 3.01, t, dur: 0.025, vol: 0.12, attack: 0.001 });
        this.noise(o, { t, dur: 0.025, vol: 0.35, f: 2600 * jr(80), q: 1.5 });
        break;
      }
      case 'land': {
        const o = this.voice(name, 0.08);
        this.osc(o, { f: 190 * jr(40), f2: 120, t, dur: 0.08, vol: 0.6, attack: 0.002 });
        this.noise(o, { t, dur: 0.05, vol: 0.4, f: 900, type: 'lowpass', q: 0.7 });
        this.noise(o, { t, dur: 0.012, vol: 0.18, f: 4200, q: 2 });
        break;
      }
      case 'deny': {
        const o = this.voice(name, 0.05);
        for (const k of [0, 0.1]) this.osc(o, { f: 230, f2: 205, t: t + k, dur: 0.07, vol: 0.45, type: 'triangle', lp: 900 });
        break;
      }
      case 'deal': {
        const o = this.voice(name, 0.05);
        this.noise(o, { t, dur: 0.11, vol: 0.4, f: 2600 * jr(100), f2: 5200, q: 0.9, attack: 0.01 });
        break;
      }
      case 'clear': {
        const o = this.voice(name, 0.22);
        const c = Math.min(6, (opts.combo || 1) - 1);
        this.noise(o, { t, dur: 0.06, vol: 0.25, f: 1500, f2: 4500, q: 1.4 });           // 气泡"啵"
        this.osc(o, { f: 420, f2: 900, t, dur: 0.07, vol: 0.25, attack: 0.002 });
        [0, 2, 4].forEach((s, i) => this.bell(o, pent(c + s, C5) * jr(8), t + 0.03 + i * 0.055, 0.32 - i * 0.04, 0.55));
        this.sparkle(o, t + 0.12, 3 + c, 0.05);
        break;
      }
      case 'combo': {
        const o = this.voice(name, 0.25);
        const n = Math.min(7, (opts.combo || 2) + 2);
        const c = Math.min(6, (opts.combo || 2) - 1);
        for (let i = 0; i < n; i++) this.bell(o, pent(c + i + 3, C5), t + 0.18 + i * 0.045, 0.16, 0.3);
        break;
      }
      case 'warn': {
        const o = this.voice(name, 0.1);
        for (const [k, f] of [[0, 988], [0.13, 784]]) {
          this.osc(o, { f, t: t + k, dur: 0.1, vol: 0.4, type: 'square', lp: 1800, attack: 0.006 });
          this.osc(o, { f: f / 2, t: t + k, dur: 0.1, vol: 0.2, attack: 0.006 });
        }
        break;
      }
      case 'heartbeat': {
        const o = this.voice(name, 0.0);
        const v = opts.fast ? 1 : 0.8;
        this.osc(o, { f: 62, f2: 44, t, dur: 0.12, vol: 0.9 * v, attack: 0.004 });
        this.osc(o, { f: 58, f2: 42, t: t + 0.16, dur: 0.1, vol: 0.6 * v, attack: 0.004 });
        this.noise(o, { t, dur: 0.05, vol: 0.12 * v, f: 160, type: 'lowpass' });
        break;
      }
      case 'moveOut': {
        const o = this.voice(name, 0.2);
        this.noise(o, { t, dur: 0.32, vol: 0.4, f: 500, f2: 4500, q: 1.1, attack: 0.05 });
        this.osc(o, { f: 380, f2: 1300, t, dur: 0.3, vol: 0.3, type: 'triangle', glide: 0.9 });
        this.sparkle(o, t + 0.22, 4);
        break;
      }
      case 'undo': {
        const o = this.voice(name, 0.15);
        this.osc(o, { f: 1250, f2: 480, t, dur: 0.24, vol: 0.32, type: 'triangle', glide: 0.95 });
        this.noise(o, { t, dur: 0.22, vol: 0.12, f: 3500, f2: 900, q: 1 });
        break;
      }
      case 'shuffle': {
        const o = this.voice(name, 0.08);
        for (let i = 0; i < 9; i++) this.noise(o, { t: t + i * 0.045 + Math.random() * 0.015, dur: 0.035, vol: 0.32, f: 2500 + Math.random() * 2500, q: 1.3 });
        this.osc(o, { f: 300, f2: 600, t: t + 0.35, dur: 0.12, vol: 0.2, type: 'triangle' });
        break;
      }
      case 'revive': {
        const o = this.voice(name, 0.3);
        for (const f of [261.6, 329.6, 392]) {
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.12, t + 0.35);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
          const lpf = this.ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.setValueAtTime(600, t); lpf.frequency.linearRampToValueAtTime(2400, t + 0.4);
          for (const d of [-7, 7]) { const s = this.ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = d; s.connect(lpf); s.start(t); s.stop(t + 1.35); }
          lpf.connect(g); g.connect(o);
        }
        [0, 2, 4, 5, 7].forEach((s, i) => this.bell(o, pent(s, C5), t + 0.25 + i * 0.07, 0.22, 0.6));
        this.sparkle(o, t + 0.6, 6);
        break;
      }
      case 'tick': {
        const o = this.voice(name, 0.04);
        this.osc(o, { f: 1480 * jr(20), t, dur: 0.035, vol: 0.4, attack: 0.001 });
        this.osc(o, { f: 2960, t, dur: 0.015, vol: 0.1, attack: 0.001 });
        break;
      }
      case 'start': {
        const o = this.voice(name, 0.2);
        [3, 5, 7].forEach((s, i) => this.bell(o, pent(s, C5 / 2), t + i * 0.09, 0.28, 0.45));
        break;
      }
      case 'victory':
      case 'bigVictory': {
        const big = name === 'bigVictory';
        const o = this.voice(name, 0.28);
        const runs = big ? [[0, 2, 4, 5, 7], [2, 4, 5, 7, 9]] : [[0, 2, 4, 5, 7]];
        let tt = t;
        runs.forEach((run) => { run.forEach((s, i) => this.bell(o, pent(s, C5 / 2), tt + i * 0.085, 0.26, 0.5)); tt += run.length * 0.085 + 0.08; });
        for (const f of [261.6, 329.6, 392, 523.3]) {
          this.osc(o, { f, t: tt, dur: big ? 1.6 : 1.0, vol: 0.1, type: 'triangle', attack: 0.02 });
          this.osc(o, { f: f * 2, t: tt, dur: big ? 1.2 : 0.7, vol: 0.04, attack: 0.02 });
        }
        this.sparkle(o, tt, big ? 12 : 6, 0.05);
        break;
      }
      case 'gameover': {
        const o = this.voice(name, 0.25);
        [[0, 392], [0.2, 349.2], [0.4, 311.1], [0.62, 261.6]].forEach(([k, f]) => {
          this.osc(o, { f, f2: f * 0.97, t: t + k, dur: k > 0.5 ? 0.8 : 0.24, vol: 0.32, type: 'triangle', lp: k > 0.5 ? 900 : 1600, attack: 0.01 });
        });
        this.noise(o, { t: t + 0.62, dur: 0.5, vol: 0.06, f: 1200, f2: 200, q: 0.8, attack: 0.05 });
        break;
      }
      case 'unlock': {
        const o = this.voice(name, 0.3);
        for (let i = 0; i < 6; i++) this.bell(o, pent(i + 2, C5), t + i * 0.05, 0.2, 0.45);
        this.sparkle(o, t + 0.3, 6);
        break;
      }
      case 'star': {
        const o = this.voice(name, 0.25);
        this.bell(o, pent(4 + (opts.index || 0) * 2, C5), t, 0.32, 0.7);
        this.sparkle(o, t + 0.04, 3);
        break;
      }
      case 'whoosh': {
        const o = this.voice(name, 0.1);
        this.noise(o, { t, dur: 0.26, vol: 0.3, f: 350, f2: 1600, q: 0.8, type: 'bandpass', attack: 0.08 });
        break;
      }
      default:
        break;
    }
  }
}
