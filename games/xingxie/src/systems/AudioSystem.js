// 音效系统：网页 / 桌面版的短音效由 WebAudio 实时合成；抖音小游戏播放由同一套合成代码预渲染好的 wav
// (tools/render_sfx.mjs → assets/sfx，SfxSampler 播放)。自己订阅战斗事件，场景不用关心音效。
// 限频 / 并发规则在 play() 里统一处理，两种后端都遵守。
// 割草类的特殊规则 (AudioConfig)：
// - 命中音效：同一类型 50ms 内最多 1 次，命中类同时最多 5 个，音高 ±6% 随机
// - 经验宝石：连续拾取时音高沿五声音阶往上爬，停一会儿再从头开始
// - 不给单只怪发声：只有一层「怪群环境声」，音量跟随玩家附近的怪物密度 (setSwarm)
// - 升级三选一 / 武器进化 / Boss 登场 各有专门的音效 (配合角色语音)
// 浏览器要求用户交互后才能出声，所以在第一次点击 / 按键时解锁。
import { AudioConfig } from '../config/AudioConfig.js';
import { platform } from '../core/platform/index.js';
import { SfxSampler } from './SfxSampler.js';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const C5 = 523.25;
const note = (i) => C5 * Math.pow(2, PENTA[Math.max(0, Math.min(PENTA.length - 1, i))] / 12);
const SW = AudioConfig.swarm;
const HIT = AudioConfig.hit;

export class AudioSystem {
  constructor(events, save, mixer) {
    this.events = events;
    this.save = save;
    this.mixer = mixer;
    this.ctx = null;
    this.master = null;
    this.muted = !!save.get('muted', false);
    this.lastPlay = {};
    this.hitVoices = [];        // 正在响的命中类音效的结束时间
    this.gemStep = 0;
    this.gemLast = -1;
    this.swarm = null;
    this.swarmLevel = 0;
    this.count = {};
    this.noiseBuf = null;
    this.sampler = null;        // 抖音版：预渲染音效播放器

    events.on('mixer:change', () => { if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02); if (this.sampler) this.sampler.setVolume(this.muted ? 0 : this.volume); });
    events.on('input:down', () => this.unlock());
    events.on('input:key', () => this.unlock());

    // 战斗事件 → 音效
    events.on('enemy:hit', (e) => this.play(e.crit ? 'crit' : 'hit', e));
    events.on('enemy:die', (e) => this.play(e.boss ? 'bossDie' : e.elite ? 'eliteDie' : 'pop'));
    events.on('gem:pickup', (e) => this.play('gem', e));
    events.on('weapon:fire', (e) => this.play(`fire_${e.form}`));
    events.on('meteor:impact', (e) => this.play(e.giant ? 'bigBoom' : 'boom'));
    events.on('explode', () => this.play('boom'));
    events.on('slam', () => this.play('slam'));
    events.on('zone:warn', (e) => { if (e.kind !== 'meteor') this.play('warn'); });
    events.on('levelup:open', () => this.play('levelup'));
    events.on('levelup:refresh', () => this.play('refresh'));
    events.on('card:pick', () => this.play('pick'));
    events.on('card:skip', () => this.play('click'));
    events.on('weapon:evolve', () => this.play('evolve'));
    events.on('chest:open', (r) => this.play(r.type === 'evolve' ? 'chestBig' : 'chest'));
    events.on('chest:drop', () => this.play('chestDrop'));
    events.on('boss:spawn', () => this.play('bossWarn'));
    events.on('elite:spawn', () => this.play('eliteWarn'));
    events.on('wave:event', () => this.play('horn'));
    events.on('player:hurt', () => this.play('hurt'));
    events.on('player:block', () => this.play('block'));
    events.on('player:shield', () => this.play('shield'));
    events.on('player:heal', () => this.play('heal'));
    events.on('pickup:magnet', () => this.play('magnet'));
    events.on('player:revive', () => this.play('revive'));
    events.on('player:die', () => { this.setSwarm(0); this.play('lose'); });
    events.on('battle:win', () => { this.setSwarm(0); this.play('victory'); });
    events.on('enemy:charge', () => this.play('charge'));
    events.on('scene:changed', () => this.setSwarm(0));
    events.on('app:hidden', () => this.setSwarm(0));
  }

  get volume() { return this.mixer ? this.mixer.gain('sfx') : AudioConfig.sfxVolume; }
  get ready() { return ((this.ctx && this.master) || this.sampler) && !this.muted; }
  get synthReady() { return this.ctx && this.master && !this.muted; }
  /** 音效时钟 (秒)：有 AudioContext 用它，否则用平台时间 */
  clock() { return this.ctx ? this.ctx.currentTime : platform.now() / 1000; }

  unlock() {
    try {
      if (!this.ctx && !this.sampler && SfxSampler.supported()) {
        this.sampler = new SfxSampler(platform);
        this.sampler.setVolume(this.muted ? 0 : this.volume);
        return;
      }
      if (this.sampler) return;
      if (!this.ctx) {
        const AC = platform.audioContextClass;
        if (!AC) return;
        this.ctx = new AC();
        AudioSystem.buildGraph(this, this.ctx, this.muted ? 0 : this.volume);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) {
      console.warn('[AudioSystem] 无法初始化音频:', err);
    }
  }

  /** 总线：master 增益 → 柔和低通 → 压缩器 → 输出，外加共用白噪声缓冲 (离线渲染音效时也用这一份) */
  static buildGraph(sys, ctx, gain, dest = ctx.destination) {
    sys.master = ctx.createGain();
    sys.master.gain.value = gain;
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass'; soft.frequency.value = 8000; soft.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    sys.master.connect(soft); soft.connect(comp); comp.connect(dest);
    const len = ctx.sampleRate;
    sys.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = sys.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.save.set('muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    if (this.sampler) this.sampler.setVolume(this.muted ? 0 : this.volume);
    if (this.muted) this.setSwarm(0);
    this.events.emit('audio:mute', this.muted);
    return this.muted;
  }

  tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, attack = 0.006, vibrato = 0 }) {
    if (!this.synthReady) return;
    const ctx = this.ctx; const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur * 0.85);
    if (vibrato) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
      const lg = ctx.createGain(); lg.gain.value = freq * vibrato;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.12, vol = 0.2, freq = 1800, q = 1, delay = 0, type = 'bandpass', attack = 0.004, freqEnd = null }) {
    if (!this.synthReady || !this.noiseBuf) return;
    const ctx = this.ctx; const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.setValueAtTime(freq, t); filter.Q.value = q;
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  chime(freq, { vol = 0.1, delay = 0, dur = 0.5 } = {}) {
    this.tone({ freq, type: 'sine', dur, vol, delay, attack: 0.004 });
    this.tone({ freq: freq * 2.76, type: 'sine', dur: dur * 0.35, vol: vol * 0.12, delay, attack: 0.002 });
  }

  sparkle(count = 3, delay = 0, vol = 0.018) {
    for (let k = 0; k < count; k++) this.tone({ freq: 2000 + Math.random() * 1400, type: 'sine', dur: 0.12, vol, delay: delay + k * 0.05, attack: 0.004 });
  }

  /** 命中类音效的并发控制 */
  hitSlot(dur) {
    const now = this.clock();
    this.hitVoices = this.hitVoices.filter((t) => t > now);
    if (this.hitVoices.length >= HIT.maxVoices) return false;
    this.hitVoices.push(now + dur);
    return true;
  }

  /** 怪群环境声强度 0..1 (由 GameScene 按附近怪物数量计算) */
  setSwarm(level) {
    const lv = Math.max(0, Math.min(1, level || 0));
    if (this.swarm && Math.abs(lv - this.swarmLevel) < 0.02 && lv > 0) return;
    this.swarmLevel = lv;
    if (this.sampler) { this.sampler.setSwarm(this.muted ? 0 : lv); return; }
    if (!this.ctx || !this.noiseBuf) return;
    const target = this.muted ? 0 : lv * SW.maxGain;
    if (target <= 0.0004 && !this.swarm) return;
    const ctx = this.ctx;
    if (!this.swarm) {
      // 低通噪声 (远处的沙沙声) + 很低的三角波嗡鸣，慢慢起伏
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = SW.lowpass; nf.Q.value = 0.7;
      const ng = ctx.createGain(); ng.gain.value = 0.6;
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = SW.base;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = SW.base * 1.5 * 1.004;
      const og = ctx.createGain(); og.gain.value = 0.35;
      const trem = ctx.createGain(); trem.gain.value = 0.85;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6;
      const lg = ctx.createGain(); lg.gain.value = 0.15;
      lfo.connect(lg); lg.connect(trem.gain);
      const out = ctx.createGain(); out.gain.value = 0;
      src.connect(nf); nf.connect(ng); ng.connect(trem);
      o1.connect(og); o2.connect(og); og.connect(trem);
      trem.connect(out); out.connect(this.master);
      const nodes = [src, o1, o2, lfo];
      nodes.forEach((n) => n.start());
      this.swarm = { nodes, out, nf };
    }
    const now = ctx.currentTime;
    const cur = this.swarm.out.gain.value;
    this.swarm.out.gain.setTargetAtTime(target, now, target > cur ? SW.attack : SW.release);
    this.swarm.nf.frequency.setTargetAtTime(SW.lowpass * (0.8 + 0.6 * lv), now, 0.4);
    if (target <= 0.0004) {
      const s = this.swarm;
      this.swarm = null;
      setTimeout(() => { try { s.nodes.forEach((n) => n.stop()); } catch (_) { /* ignore */ } }, 3000);
    }
  }

  play(name, opts = {}) {
    this.count[name] = (this.count[name] || 0) + 1;
    if (!this.ready) return;
    const now = this.clock();
    const gap = GAPS[name] != null ? GAPS[name] : 0.03;
    if (this.lastPlay[name] && now - this.lastPlay[name] < gap) return;
    this.lastPlay[name] = now;
    // 命中类：同时最多 HIT.maxVoices 个
    if (HIT_DUR[name] && !this.hitSlot(HIT_DUR[name])) return;
    const o = { ...opts };
    if (name === 'gem') {
      if (now - this.gemLast > AudioConfig.gem.comboWindow) this.gemStep = 0;
      else this.gemStep = Math.min(AudioConfig.gem.maxStep, this.gemStep + 1);
      this.gemLast = now;
      o.gemStep = this.gemStep;
    }
    if (this.sampler) { this.sampler.play(name, o); return; }
    this.synth(name, o);
  }

  /** 合成一个音效 (不做限频)；tools/render_sfx.mjs 也用它离线渲染抖音版的 wav */
  synth(name, opts = {}) {
    const j = () => 1 + (Math.random() * 2 - 1) * HIT.pitchJitter;

    switch (name) {
      case 'click': this.tone({ freq: 880, freqEnd: 1320, dur: 0.08, vol: 0.09, attack: 0.004 }); break;
      case 'hit': {
        const f = (opts.boss || opts.elite ? 180 : 240) * j();
        this.tone({ freq: f, freqEnd: f * 0.6, type: 'triangle', dur: 0.07, vol: 0.09 });
        this.noise({ dur: 0.04, vol: 0.035, freq: 2400 * j(), q: 1.2 });
        break;
      }
      case 'crit': {
        const f = 520 * j();
        this.tone({ freq: f, freqEnd: f * 1.6, type: 'square', dur: 0.06, vol: 0.035 });
        this.noise({ dur: 0.07, vol: 0.06, freq: 3800 * j(), q: 1.5 });
        break;
      }
      case 'pop': {
        const f = 700 * j();
        this.tone({ freq: f, freqEnd: f * 1.8, dur: 0.07, vol: 0.05 });
        this.noise({ dur: 0.06, vol: 0.025, freq: 5000 * j(), q: 0.8, type: 'highpass' });
        break;
      }
      case 'eliteDie':
        this.tone({ freq: 160, freqEnd: 60, type: 'triangle', dur: 0.4, vol: 0.14 });
        this.noise({ dur: 0.35, vol: 0.08, freq: 900, q: 0.6, freqEnd: 200 });
        this.sparkle(4, 0.12, 0.02);
        break;
      case 'bossDie':
        this.tone({ freq: 120, freqEnd: 40, type: 'triangle', dur: 1.2, vol: 0.18 });
        this.noise({ dur: 1.0, vol: 0.12, freq: 1200, q: 0.5, freqEnd: 120, attack: 0.01 });
        [0, 2, 4, 7, 9, 12].forEach((n, i) => this.chime(note(n + 2), { vol: 0.06, delay: 0.5 + i * 0.08, dur: 0.6 }));
        break;
      case 'gem': {
        const big = opts.type === 'red' || opts.type === 'rainbow';
        this.tone({ freq: note(opts.gemStep || 0) * (big ? 1 : 2), type: 'sine', dur: big ? 0.25 : 0.09, vol: big ? 0.07 : 0.04, attack: 0.003 });
        if (big) this.sparkle(2, 0.05, 0.015);
        break;
      }
      case 'fire_projectile': this.tone({ freq: 1400 * j(), freqEnd: 1900, dur: 0.05, vol: 0.022 }); break;
      case 'fire_slash': this.noise({ dur: 0.14, vol: 0.06, freq: 2500, q: 0.8, freqEnd: 900, attack: 0.01 }); break;
      case 'fire_orbit': this.tone({ freq: 660, freqEnd: 990, dur: 0.18, vol: 0.04, vibrato: 0.02 }); break;
      case 'fire_chain':
        this.noise({ dur: 0.12, vol: 0.05, freq: 3200, q: 3, type: 'bandpass' });
        this.tone({ freq: 90, freqEnd: 60, type: 'sawtooth', dur: 0.1, vol: 0.02 });
        break;
      case 'fire_boomerang': this.noise({ dur: 0.22, vol: 0.03, freq: 1200, q: 2, freqEnd: 2200, attack: 0.05 }); break;
      case 'fire_zone': this.chime(note(4) / 2, { vol: 0.04, dur: 0.4 }); break;
      case 'fire_homing': this.noise({ dur: 0.1, vol: 0.025, freq: 4500, q: 1, type: 'highpass', attack: 0.02 }); break;
      case 'fire_frost': this.tone({ freq: 2200 * j(), freqEnd: 2900, dur: 0.08, vol: 0.02 }); this.tone({ freq: 3300, dur: 0.06, vol: 0.012, delay: 0.03 }); break;
      case 'fire_meteor': this.noise({ dur: 0.45, vol: 0.03, freq: 800, q: 0.8, freqEnd: 2400, attack: 0.3 }); break;
      case 'boom':
        this.tone({ freq: 110 * j(), freqEnd: 45, type: 'sine', dur: 0.28, vol: 0.13 });
        this.noise({ dur: 0.25, vol: 0.06, freq: 600, q: 0.6, type: 'lowpass' });
        break;
      case 'bigBoom':
        this.tone({ freq: 80, freqEnd: 30, type: 'sine', dur: 0.8, vol: 0.2 });
        this.noise({ dur: 0.7, vol: 0.12, freq: 900, q: 0.5, type: 'lowpass', freqEnd: 150 });
        break;
      case 'slam':
        this.tone({ freq: 90, freqEnd: 40, type: 'triangle', dur: 0.35, vol: 0.16 });
        this.noise({ dur: 0.3, vol: 0.07, freq: 400, q: 0.6, type: 'lowpass' });
        break;
      case 'warn': this.tone({ freq: 880, dur: 0.08, vol: 0.04, type: 'square' }); this.tone({ freq: 880, dur: 0.08, vol: 0.04, type: 'square', delay: 0.12 }); break;
      case 'charge': this.tone({ freq: 300, freqEnd: 700, type: 'sawtooth', dur: 0.4, vol: 0.02 }); break;
      // —— 升级三选一：上行琶音 + 闪光 ——
      case 'levelup':
        [0, 2, 4, 7, 9].forEach((n, i) => this.chime(note(n + 3), { vol: 0.08, delay: i * 0.05, dur: 0.45 }));
        this.sparkle(5, 0.25, 0.018);
        break;
      case 'refresh': this.noise({ dur: 0.18, vol: 0.04, freq: 2000, q: 1, freqEnd: 5000 }); this.chime(note(5), { vol: 0.05, delay: 0.1, dur: 0.3 }); break;
      case 'pick':
        this.chime(note(7), { vol: 0.09, dur: 0.35 });
        this.chime(note(9), { vol: 0.07, delay: 0.07, dur: 0.4 });
        break;
      // —— 武器进化：低音 + 上行大琶音 + 和弦 ——
      case 'evolve':
        this.tone({ freq: 65, freqEnd: 130, type: 'triangle', dur: 0.8, vol: 0.12 });
        [0, 2, 4, 5, 7, 9, 10, 12].forEach((n, i) => this.chime(note(n), { vol: 0.08, delay: 0.1 + i * 0.06, dur: 0.7 }));
        [0, 4, 7].forEach((n) => this.tone({ freq: note(n), type: 'triangle', dur: 1.4, vol: 0.04, delay: 0.62, attack: 0.05 }));
        this.sparkle(6, 0.7, 0.02);
        break;
      case 'chest': this.tone({ freq: 220, freqEnd: 330, type: 'triangle', dur: 0.15, vol: 0.08 }); [4, 7, 9].forEach((n, i) => this.chime(note(n), { vol: 0.07, delay: 0.12 + i * 0.07 })); break;
      case 'chestBig': this.tone({ freq: 220, freqEnd: 330, type: 'triangle', dur: 0.15, vol: 0.08 }); this.sparkle(6, 0.1, 0.02); break;
      case 'chestDrop': this.tone({ freq: 400, freqEnd: 260, type: 'triangle', dur: 0.2, vol: 0.08 }); this.sparkle(3, 0.1, 0.018); break;
      // —— Boss 登场：低沉的长音 + 两声警报 + 锣 ——
      case 'bossWarn':
        this.tone({ freq: 55, freqEnd: 52, type: 'sawtooth', dur: 2.2, vol: 0.05, attack: 0.4 });
        this.tone({ freq: 110, type: 'triangle', dur: 2.0, vol: 0.06, attack: 0.3 });
        for (let k = 0; k < 2; k++) this.tone({ freq: 620, freqEnd: 420, type: 'square', dur: 0.4, vol: 0.035, delay: 0.2 + k * 0.55 });
        this.noise({ dur: 1.6, vol: 0.08, freq: 300, q: 0.8, type: 'lowpass', delay: 1.2, attack: 0.005 });
        this.tone({ freq: 98, freqEnd: 92, type: 'sine', dur: 1.8, vol: 0.12, delay: 1.2, attack: 0.005 });
        break;
      case 'eliteWarn': this.tone({ freq: 330, freqEnd: 220, type: 'square', dur: 0.3, vol: 0.03 }); this.tone({ freq: 82, type: 'triangle', dur: 0.6, vol: 0.08 }); break;
      case 'horn': this.tone({ freq: 220, type: 'sawtooth', dur: 0.5, vol: 0.03, attack: 0.08 }); this.tone({ freq: 330, type: 'sawtooth', dur: 0.5, vol: 0.02, attack: 0.08, delay: 0.05 }); break;
      case 'hurt': this.tone({ freq: 300, freqEnd: 160, type: 'triangle', dur: 0.16, vol: 0.12 }); this.noise({ dur: 0.1, vol: 0.05, freq: 1200, q: 0.8 }); break;
      case 'block': this.chime(1600, { vol: 0.07, dur: 0.3 }); this.noise({ dur: 0.1, vol: 0.04, freq: 4000, q: 2 }); break;
      case 'shield': this.chime(note(9), { vol: 0.05, dur: 0.4 }); break;
      case 'heal': this.chime(note(5), { vol: 0.05, dur: 0.3 }); this.chime(note(7), { vol: 0.04, delay: 0.08, dur: 0.3 }); break;
      case 'magnet': this.tone({ freq: 300, freqEnd: 1200, dur: 0.5, vol: 0.06, vibrato: 0.03 }); break;
      case 'revive': [0, 4, 7, 12].forEach((n, i) => this.chime(note(n), { vol: 0.09, delay: i * 0.08, dur: 0.6 })); this.tone({ freq: 70, freqEnd: 140, type: 'triangle', dur: 0.5, vol: 0.14 }); break;
      case 'tick': this.chime(1175, { vol: 0.05, dur: 0.15 }); break;
      case 'coin': this.chime(1568 * j(), { vol: 0.04, dur: 0.12 }); break;
      case 'buy': [0, 4, 7].forEach((n, i) => this.chime(note(n + 4), { vol: 0.07, delay: i * 0.06, dur: 0.35 })); break;
      case 'deny': this.tone({ freq: 330, freqEnd: 260, type: 'triangle', dur: 0.15, vol: 0.06 }); break;
      case 'victory': {
        const seq = [[0, 0], [2, 0.12], [4, 0.24], [7, 0.36], [9, 0.54], [7, 0.66], [12, 0.82]];
        seq.forEach(([n, d]) => this.chime(note(n), { vol: 0.09, delay: d, dur: 0.6 }));
        [0, 4, 7].forEach((n) => this.tone({ freq: note(n) / 2, type: 'triangle', dur: 1.4, vol: 0.035, delay: 0.82, attack: 0.05 }));
        this.sparkle(5, 1.0, 0.016);
        break;
      }
      case 'lose':
        this.tone({ freq: note(4) * 0.75, freqEnd: note(3) * 0.75, type: 'triangle', dur: 0.35, vol: 0.08, delay: 0.1, attack: 0.03, vibrato: 0.01 });
        this.tone({ freq: note(2) * 0.75, freqEnd: note(0) * 0.6, type: 'triangle', dur: 0.8, vol: 0.08, delay: 0.45, attack: 0.04, vibrato: 0.015 });
        break;
      default: break;
    }
  }
}

// 命中类音效占用并发槽的时长 (秒)
export const HIT_DUR = { hit: 0.07, crit: 0.1, pop: 0.08, boom: 0.2 };

const GAPS = {
  hit: HIT.gap, crit: HIT.gap, pop: HIT.gap, gem: AudioConfig.gem.gap, boom: 0.06,
  fire_projectile: 0.12, fire_frost: 0.12, fire_homing: 0.15, fire_chain: 0.1, fire_slash: 0.1, fire_boomerang: 0.15, fire_zone: 0.3, fire_orbit: 0.3, fire_meteor: 0.4,
  hurt: 0.15, warn: 0.3, charge: 0.4, heal: 0.6, coin: 0.04, horn: 1, eliteWarn: 1, chestDrop: 0.3, shield: 0.5,
};
