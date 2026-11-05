// 音频系统：全部音效由 WebAudio 实时合成 (柔和、可爱风格)，无需音频文件。
// 1.4：没有 WebAudio 的平台 (抖音小游戏) 改用 tools/render-sfx.mjs 用同一份合成代码离线预渲染的小音频文件
// (SfxSampler，tt.createInnerAudioContext 池)；限频 / 静音 / 声道音量逻辑两种后端共用。
// 自己订阅玩法事件 (画线 / 成形 / 蜜蜂弹开 / 投掷 / 倒计时 / 胜负 …)，场景无需关心音效。
// 浏览器要求用户交互后才能出声，因此在第一次点击/按键时解锁。
//
// 声音设计 (参考「画线救狗」类休闲游戏)：
// - 蜜蜂：整个蜂群只有「一个」很轻的低通嗡嗡声，强度由场景按「主角附近的蜜蜂数量 + 距离」计算后传入
//   (setSwarm 0..1)，平滑淡入淡出、增益上限很低；不会每只蜜蜂一个声音
// - 蜜蜂撞线：极轻的「啵」，限频 + 随机音高
// - 其余音效都用正弦 / 三角波的短音符，柔和的起音，音量约为旧版的一半
import { AudioConfig } from '../config/AudioConfig.js';
import { SfxSampler, sampleKey } from './SfxSampler.js';

// 五声音阶 (半音)
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
const C5 = 523.25;
const note = (i) => C5 * Math.pow(2, PENTA[Math.max(0, Math.min(PENTA.length - 1, i))] / 12);
const SW = AudioConfig.swarm;

export class AudioSystem {
  constructor(events, save, mixer, platform = null) {
    this.events = events;
    this.platform = platform;
    this.sampler = null;        // 预渲染音效后端 (无 WebAudio 时)
    this.save = save;
    this.mixer = mixer;              // 音量由 MixerSystem 决定 (总音量 × 音效声道)
    this.ctx = null;
    this.master = null;
    this.muted = !!save.get('muted', false);
    this.lastPlay = {};
    this.swarm = null;          // 蜂群嗡嗡声节点
    this.swarmLevel = 0;        // 最近一次设置的强度 (0..1，测试用)
    this.count = {};            // 播放计数 (测试用)
    events.on('mixer:change', () => {
      if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    });
    events.on('input:down', () => this.unlock());
    events.on('input:key', () => this.unlock());

    // 玩法事件 -> 音效
    events.on('level:start', () => this.play('start'));
    events.on('draw:start', () => this.play('drawStart'));
    events.on('draw:ink', (e) => this.play('scribble', { ratio: e.ratio }));
    events.on('draw:blocked', () => this.play('blocked'));
    events.on('ink:empty', () => this.play('inkEmpty'));
    events.on('line:commit', () => this.play('pop'));
    events.on('bee:bounce', () => this.play('boing'));
    events.on('hazard:throw', (e) => this.play('whoosh', e));
    events.on('hazard:blocked', () => this.play('thud'));
    events.on('hazard:land', () => this.play('land'));
    events.on('rock:spawn', () => this.play('rumble'));
    events.on('rock:hit', () => this.play('rockHit'));
    events.on('timer:tick', (e) => this.play('tick', { last: e.seconds <= 1 }));
    events.on('heroine:scared', () => this.play('gasp'));
    events.on('level:win', () => { this.setSwarm(0); this.play('victory'); });
    events.on('level:lose', () => { this.setSwarm(0); this.play('hit'); this.play('lose'); });
    events.on('ui:star', (e) => this.play('star', { index: e.index }));
    events.on('hint:show', () => this.play('hint'));
    events.on('portal:warp', () => this.play('warp'));
    events.on('spring:launch', () => this.play('spring'));
    events.on('glass:break', () => this.play('glass'));
    events.on('scene:changed', () => this.setSwarm(0));
    events.on('app:hidden', () => this.setSwarm(0));
  }

  get volume() {
    return this.mixer ? this.mixer.gain('sfx') : AudioConfig.sfxVolume;
  }

  unlock() {
    try {
      if (this.sampler) return;
      if (!this.ctx) {
        const ctx = this.platform ? this.platform.createAudioContext() : null;
        if (!ctx) {
          if (this.platform && this.platform.createAudio) this.sampler = new SfxSampler(this.platform);
          return;
        }
        this.ctx = ctx;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        // 整体再过一个柔和的低通，去掉刺耳的高频
        const soft = this.ctx.createBiquadFilter();
        soft.type = 'lowpass'; soft.frequency.value = 7000; soft.Q.value = 0.5;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(soft); soft.connect(comp);
        comp.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) {
      console.warn('[AudioSystem] 无法初始化音频:', err);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.save.set('muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    if (this.muted) this.setSwarm(0);
    this.events.emit('audio:mute', this.muted);
    return this.muted;
  }

  get ready() {
    return !this.muted && !!((this.ctx && this.master) || this.sampler);
  }

  /** 当前时间 (秒)，用于限频 */
  clock() {
    if (this.ctx) return this.ctx.currentTime;
    return (this.platform ? this.platform.now() : Date.now()) / 1000;
  }

  /** 每帧调用 (Game 主循环)：预渲染后端的蜂群音量平滑 */
  update(dt) {
    if (this.sampler) this.sampler.updateSwarm(dt, this.muted ? 0 : this.swarmLevel * SW.maxGain * this.volume);
  }

  tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, attack = 0.008, vibrato = 0 }) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur * 0.85);
    let lfo = null;
    if (vibrato) {
      lfo = ctx.createOscillator(); lfo.frequency.value = 6;
      const lg = ctx.createGain(); lg.gain.value = freq * vibrato;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.12, vol = 0.2, freq = 1800, q = 1, delay = 0, type = 'bandpass', attack = 0.004 }) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
  }

  /** 八音盒般的叮：基音 + 很轻的非谐泛音 */
  chime(freq, { vol = 0.1, delay = 0, dur = 0.5 } = {}) {
    this.tone({ freq, type: 'sine', dur, vol, delay, attack: 0.004 });
    this.tone({ freq: freq * 2.76, type: 'sine', dur: dur * 0.35, vol: vol * 0.12, delay, attack: 0.002 });
  }

  sparkle(count = 3, delay = 0, vol = 0.018) {
    for (let k = 0; k < count; k++) {
      this.tone({ freq: 2000 + Math.random() * 1400, type: 'sine', dur: 0.12, vol, delay: delay + k * 0.05, attack: 0.004 });
    }
  }

  /** 蜂群嗡嗡声强度：0 = 静音，1 = 最大 (上限很低)。由场景每帧按附近蜜蜂数量与距离计算 */
  setSwarm(level) {
    const lv = Math.max(0, Math.min(1, level || 0));
    if (this.swarm && Math.abs(lv - this.swarmLevel) < 0.015 && lv > 0) return; // 变化很小时不重复排程
    this.swarmLevel = lv;
    if (this.sampler) { if (lv > 0 && !this.muted) this.sampler.startSwarm(); return; }   // 音量在 update() 里平滑
    if (!this.ctx) return;
    const target = this.muted ? 0 : this.swarmLevel * SW.maxGain;
    if (target <= 0.0004 && !this.swarm) return;
    const ctx = this.ctx;
    if (!this.swarm) {
      // 两个轻微失谐的三角波 + 一点粉红噪声，强低通；音量与音高缓慢起伏 (像远处的一团蜂群)
      const mk = (f) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; return o; };
      const o1 = mk(SW.base); const o2 = mk(SW.base * 1.012); const o3 = mk(SW.base * 2.005);
      const g3 = ctx.createGain(); g3.gain.value = 0.25;
      const wob = ctx.createOscillator(); wob.frequency.value = 0.37;            // 缓慢音高起伏
      const wobG = ctx.createGain(); wobG.gain.value = SW.base * 0.035;
      wob.connect(wobG); wobG.connect(o1.frequency); wobG.connect(o2.frequency);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = SW.lowpass; filter.Q.value = 0.6;
      const trem = ctx.createGain(); trem.gain.value = 0.8;                    // 轻微的音量起伏
      const tremLfo = ctx.createOscillator(); tremLfo.frequency.value = 5.3;
      const tremG = ctx.createGain(); tremG.gain.value = 0.18;
      tremLfo.connect(tremG); tremG.connect(trem.gain);
      const out = ctx.createGain(); out.gain.value = 0;
      o1.connect(filter); o2.connect(filter); o3.connect(g3); g3.connect(filter);
      filter.connect(trem); trem.connect(out); out.connect(this.master);
      const nodes = [o1, o2, o3, wob, tremLfo];
      nodes.forEach((n) => n.start());
      this.swarm = { nodes, out, filter };
    }
    const now = ctx.currentTime;
    const cur = this.swarm.out.gain.value;
    this.swarm.out.gain.setTargetAtTime(target, now, target > cur ? SW.attack : SW.release);
    // 越近越「亮」一点点
    this.swarm.filter.frequency.setTargetAtTime(SW.lowpass * (0.8 + 0.4 * this.swarmLevel), now, 0.3);
    if (target <= 0.0004) {
      const s = this.swarm;
      this.swarm = null;
      setTimeout(() => { try { s.nodes.forEach((n) => n.stop()); } catch (_) { /* ignore */ } }, 3000);
    }
  }

  /** 兼容旧接口 */
  setBuzz(level) { this.setSwarm(level); }

  /** 播放命名音效 */
  play(name, opts = {}) {
    this.count[name] = (this.count[name] || 0) + 1;
    if (!this.ready) return;
    const now = this.clock();
    const gap = { scribble: 0.07, boing: AudioConfig.bounce.gap, blocked: 0.25, thud: 0.1, warp: 0.1, spring: 0.1, rockHit: 0.08, gasp: 1.5 }[name] || 0.035;
    if (this.lastPlay[name] && now - this.lastPlay[name] < gap) return;
    this.lastPlay[name] = now;
    if (this.sampler) { this.sampler.play(sampleKey(name, opts), this.volume); return; }
    this.synth(name, opts);
  }

  /** WebAudio 合成 (tools/render-sfx.mjs 也用它离线渲染抖音版的音效文件) */
  synth(name, opts = {}) {
    switch (name) {
      case 'click':
        this.tone({ freq: 880, freqEnd: 1320, type: 'sine', dur: 0.08, vol: 0.09, attack: 0.004 });
        break;
      case 'start':
        [0, 2, 4].forEach((n, i) => this.chime(note(n + 2), { vol: 0.07, delay: i * 0.09, dur: 0.4 }));
        break;
      case 'drawStart':
        this.tone({ freq: 740, freqEnd: 990, type: 'sine', dur: 0.1, vol: 0.06 });
        break;
      case 'scribble': {
        // 画笔「闪闪」：很轻的高音小音符，随墨水减少逐渐降低
        const k = 1 - (opts.ratio != null ? opts.ratio : 1);
        this.tone({ freq: 1800 - k * 700 + Math.random() * 120, type: 'sine', dur: 0.09, vol: 0.014, attack: 0.01 });
        if (Math.random() < 0.3) this.noise({ dur: 0.05, vol: 0.008, freq: 5000, q: 1.2, attack: 0.01 });
        break;
      }
      case 'blocked':
        this.tone({ freq: 330, freqEnd: 280, type: 'triangle', dur: 0.12, vol: 0.06 });
        break;
      case 'inkEmpty':
        this.tone({ freq: 620, freqEnd: 420, type: 'sine', dur: 0.24, vol: 0.08 });
        break;
      case 'pop':
        // 线成形：柔软的「啵」+ 一个小叮
        this.tone({ freq: 260, freqEnd: 620, type: 'sine', dur: 0.14, vol: 0.13, attack: 0.006 });
        this.chime(note(7), { vol: 0.05, delay: 0.07, dur: 0.35 });
        break;
      case 'boing': {
        // 蜜蜂撞线：极轻的小「啵」，随机音高
        const f = 620 + Math.random() * 380;
        this.tone({ freq: f, freqEnd: f * 1.45, type: 'sine', dur: 0.06, vol: AudioConfig.bounce.volume, attack: 0.004 });
        break;
      }
      case 'whoosh':
        this.noise({ dur: 0.25, vol: 0.035, freq: 900, q: 0.6, attack: 0.06 });
        break;
      case 'thud':
        this.tone({ freq: 220, freqEnd: 150, type: 'sine', dur: 0.1, vol: 0.07 });
        break;
      case 'land':
        this.tone({ freq: 130, freqEnd: 70, type: 'sine', dur: 0.25, vol: 0.12 });
        this.noise({ dur: 0.22, vol: 0.06, freq: 260, q: 0.7, type: 'lowpass' });
        break;
      case 'rumble':
        this.noise({ dur: 0.45, vol: 0.05, freq: 180, q: 0.8, type: 'lowpass', attack: 0.08 });
        break;
      case 'rockHit':
        this.tone({ freq: 190, freqEnd: 120, type: 'sine', dur: 0.12, vol: 0.08 });
        this.noise({ dur: 0.08, vol: 0.04, freq: 500, q: 1 });
        break;
      case 'gasp':
        this.tone({ freq: 880, freqEnd: 1180, type: 'sine', dur: 0.12, vol: 0.035 });
        break;
      case 'tick':
        this.chime(opts.last ? 1568 : 1175, { vol: 0.06, dur: 0.18 });
        break;
      case 'victory': {
        // 胜利：八音盒小旋律 + 柔和的和弦
        const seq = [[0, 0], [2, 0.12], [4, 0.24], [7, 0.36], [5, 0.54], [7, 0.66], [9, 0.78]];
        seq.forEach(([n, d]) => this.chime(note(n), { vol: 0.09, delay: d, dur: 0.6 }));
        [0, 4, 7].forEach((n) => this.tone({ freq: note(n) / 2, type: 'triangle', dur: 1.2, vol: 0.03, delay: 0.78, attack: 0.05 }));
        this.sparkle(4, 0.9, 0.014);
        break;
      }
      case 'star': {
        const i = opts.index || 0;
        this.chime(note(5 + i * 2), { vol: 0.1, dur: 0.45 });
        break;
      }
      case 'hit':
        this.tone({ freq: 300, freqEnd: 190, type: 'sine', dur: 0.18, vol: 0.08 });
        break;
      case 'lose':
        // 失败：「啊哦～」两个下滑的柔和音 + 轻微颤音
        this.tone({ freq: note(4) * 0.75, freqEnd: note(3) * 0.75, type: 'triangle', dur: 0.32, vol: 0.08, delay: 0.25, attack: 0.03, vibrato: 0.01 });
        this.tone({ freq: note(2) * 0.75, freqEnd: note(0) * 0.62, type: 'triangle', dur: 0.7, vol: 0.08, delay: 0.6, attack: 0.04, vibrato: 0.015 });
        break;
      case 'hint':
        this.tone({ freq: 520, freqEnd: 1040, type: 'sine', dur: 0.3, vol: 0.06 });
        this.sparkle(3, 0.15);
        break;
      case 'warp':
        this.tone({ freq: 420, freqEnd: 1100, type: 'sine', dur: 0.2, vol: 0.05 });
        this.tone({ freq: 1100, freqEnd: 620, type: 'sine', dur: 0.16, vol: 0.025, delay: 0.1 });
        break;
      case 'spring':
        this.tone({ freq: 200, freqEnd: 640, type: 'sine', dur: 0.2, vol: 0.08, vibrato: 0.03 });
        break;
      case 'glass':
        this.noise({ dur: 0.22, vol: 0.04, freq: 4200, q: 0.8, type: 'highpass' });
        for (let k = 0; k < 4; k++) this.chime(1800 + Math.random() * 1600, { vol: 0.025, delay: 0.02 + k * 0.05, dur: 0.2 });
        break;
      default:
        break;
    }
  }
}
