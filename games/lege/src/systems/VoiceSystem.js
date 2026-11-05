// 语音系统：AivisSpeech 预生成的角色台词 + 字幕事件 (改编自《美少女合成》的 VoiceSystem)。
// - 消除某种卡时由那位角色自己说一句；但不是每次都说 (间隔 ≥7 秒、35% 概率；每关第一次消除与连消必说)
// - 开局 / 危险 / 胜利 / 失败 / 复活 由「元气同学」负责
// - 同一时间只播一句；两句之间至少 0.6 秒；冲突时按优先级打断或丢弃
// - 发出 voice:start / voice:end (BgmSystem 据此压低背景音乐)
// - 使用 HTMLAudioElement 播放预生成的 mp3 (file:// 双击运行也能出声，不依赖 fetch/decodeAudioData)
// - 同一场合有多句台词时随机挑选，且不会连续重复同一句
// - 优先级：胜利 > 失败 > 开局/复活 > 危险 > 消除；高优先级可打断低优先级，同级播放中则丢弃 (不叠音)
// - 独立音量，遵守全局静音；单独的「语音开关」
// - 文件加载失败时退回浏览器 speechSynthesis (ja-JP)
import { VOICE_LINES, VoiceConfig, voiceFile } from '../config/VoiceConfig.js';
import { platform } from '../platform/index.js';

const synthApi = () => (typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null);

export class VoiceSystem {
  constructor(events, mixer) {
    this.events = events;
    this.mixer = mixer;
    this.clips = new Map();          // id -> { el, state }
    this.cooldown = 0;
    this.current = null;             // { line, el, priority }
    this.lastByGroup = {};
    this.lastPlay = null;            // 最近一次播放结果 (调试/测试用)
    this.history = [];               // 最近播放的台词 id (测试用)
    this.jaVoice = null;
    this.sinceLast = 99;             // 距上一句语音的秒数
    this.clearsThisLevel = 0;

    events.on('match', (e) => this.onClear(e));
    events.on('slot:warn', () => this.request('warn'));
    events.on('level:start', (e) => { this.clearsThisLevel = 0; this.request(e.hell ? 'startBoss' : 'start'); });
    events.on('level:win', (e) => this.request(e.hell ? 'winBoss' : 'win'));
    events.on('level:fail', () => this.request('lose'));
    events.on('revive', () => this.request('revive'));
    events.on('app:hidden', () => this.stop());   // 切到后台 / 来电：立刻停
    events.on('mixer:change', () => {
      if (this.volume <= 0) this.stop();
      else if (this.current && this.current.el) this.current.el.volume = this.volume;
    });

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const pick = () => {
        const voices = window.speechSynthesis.getVoices() || [];
        const ja = voices.filter((v) => /^ja/i.test(v.lang));
        this.jaVoice = ja.find((v) => /female|nanami|haruka|ayumi|kyoko|mizuki/i.test(v.name)) || ja[0] || null;
      };
      pick();
      if ('onvoiceschanged' in window.speechSynthesis) window.speechSynthesis.onvoiceschanged = pick;
    }
  }

  /** 预加载全部语音，返回 Promise (失败/超时都会 resolve，不阻塞游戏) */
  preload(onProgress = () => {}, timeoutMs = 4000) {
    // 抖音：InnerAudioContext 实例数有限 → 全部台词共用 1 个播放器，播放时再换 src
    if (platform.sharedVoicePlayer) {
      this.shared = platform.createAudio();
      for (const line of VOICE_LINES) this.clips.set(line.id, { el: this.shared, state: this.shared ? 'ready' : 'failed', src: voiceFile(line) });
      onProgress(1);
      return Promise.resolve();
    }
    let done = 0;
    const total = VOICE_LINES.length;
    return Promise.all(VOICE_LINES.map((line) => new Promise((resolve) => {
      const clip = { el: null, state: 'loading' };
      this.clips.set(line.id, clip);
      let settled = false;
      const finish = (state) => {
        if (settled) return;
        settled = true;
        clip.state = state;
        onProgress(++done / total);
        resolve();
      };
      try {
        const el = platform.createAudio();
        if (!el) { finish('failed'); return; }
        el.preload = 'auto';
        el.addEventListener('canplaythrough', () => finish('ready'), { once: true });
        el.addEventListener('loadeddata', () => finish('ready'), { once: true });
        el.addEventListener('error', () => {
          console.warn(`[VoiceSystem] 语音加载失败，将使用 speechSynthesis: ${voiceFile(line)}`);
          finish('failed');
        }, { once: true });
        el.src = voiceFile(line);
        el.load();
        clip.el = el;
        setTimeout(() => finish('unknown'), timeoutMs);
      } catch (_) {
        finish('failed');
      }
    })));
  }

  get loadedCount() {
    return [...this.clips.values()].filter((c) => c.state === 'ready').length;
  }

  get enabled() { return this.mixer.isOn('voice'); }
  get volume() { return this.mixer.gain('voice'); }
  get silent() { return this.volume <= 0; }

  toggle() { return this.setEnabled(!this.enabled); }
  setEnabled(on) { this.mixer.setOn('voice', on); if (!on) this.stop(); return this.enabled; }

  /** 消除时是否让这位角色说话 (频率限制，避免每次消除都说) */
  onClear(e) {
    this.clearsThisLevel++;
    const first = this.clearsThisLevel === 1;
    const combo = (e.combo || 1) >= 2;
    if (!first && !combo) {
      if (this.sinceLast < VoiceConfig.clearGap) return false;
      if (Math.random() > VoiceConfig.clearChance) return false;
    } else if (!first && this.sinceLast < 2.5) return false;
    return this.request('clear', { cardType: e.type, who: e.type });
  }

  isPlaying() {
    if (!this.current) return false;
    if (this.current.el) return !this.current.el.paused && !this.current.el.ended;
    const s = synthApi();
    return !!(s && s.speaking);
  }

  /** 从某个场合随机挑一句 (不与上一句重复) */
  pickLine(group, who = null) {
    let list = VOICE_LINES.filter((l) => l.group === group);
    if (who !== null && who !== undefined) {
      const mine = list.filter((l) => l.who === who);
      if (mine.length) list = mine;
    }
    if (!list.length) return null;
    let cand = list.filter((l) => l.id !== this.lastByGroup[group]);
    if (!cand.length) cand = list;
    const line = cand[Math.floor(Math.random() * cand.length)];
    this.lastByGroup[group] = line.id;
    return line;
  }

  request(group, extra = {}) {
    const priority = VoiceConfig.priority[group] || 1;
    const playing = this.isPlaying();
    if (playing && this.current && priority <= this.current.priority) return false;
    if (!playing && this.cooldown > 0 && priority <= 1) return false;
    const line = this.pickLine(group, extra.who);
    if (!line) return false;
    this.play(line, priority, extra);
    return true;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.sinceLast += dt;
  }

  play(line, priority, extra) {
    this.stop();
    this.cooldown = VoiceConfig.cooldown;
    this.sinceLast = 0;
    this.history.push(line.id);
    if (this.history.length > 50) this.history.shift();
    this.events.emit('voice:line', { line, ...extra });          // 字幕 (静音时也显示)
    if (this.silent) { this.lastPlay = { id: line.id, result: 'muted' }; this.current = null; return; }

    const clip = this.clips.get(line.id);
    if (clip && clip.el && clip.state !== 'failed') {
      const el = clip.el;
      if (clip.src && el.src !== clip.src) el.src = clip.src;   // 共用播放器 (抖音)
      this.current = { line, el, priority };
      el.onended = () => this.finish(el);
      try {
        el.currentTime = 0;
        el.volume = this.volume;
        const pr = el.play();
        this.lastPlay = { id: line.id, result: 'audio-pending' };
        this.events.emit('voice:start', { id: line.id });
        if (pr && pr.then) {
          pr.then(() => { this.lastPlay = { id: line.id, result: 'audio' }; })
            .catch((err) => {
              this.lastPlay = { id: line.id, result: `audio-blocked:${err && err.name}` };
              if (err && err.name !== 'AbortError') this.speak(line, priority);
            });
        }
      } catch (_) {
        this.speak(line, priority);
      }
      return;
    }
    this.speak(line, priority);
  }

  speak(line, priority) {
    const synth = synthApi();
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      this.lastPlay = { id: line.id, result: 'unsupported' };
      return;
    }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(line.tts);
      u.lang = 'ja-JP';
      if (this.jaVoice) u.voice = this.jaVoice;
      u.rate = VoiceConfig.speechRate;
      u.pitch = VoiceConfig.speechPitch;
      u.volume = this.volume;
      const cur = { line, el: null, priority };
      u.onend = () => { if (this.current === cur) { this.current = null; this.events.emit('voice:end', { id: line.id }); } };
      synth.speak(u);
      this.current = cur;
      this.events.emit('voice:start', { id: line.id });
      this.lastPlay = { id: line.id, result: 'speech' };
    } catch (_) {
      this.lastPlay = { id: line.id, result: 'unsupported' };
    }
  }

  finish(el) {
    if (this.current && this.current.el === el) {
      const { line } = this.current;
      this.current = null;
      this.events.emit('voice:end', { id: line.id });
    }
  }

  stop() {
    const had = this.current;
    if (this.current && this.current.el) {
      try { this.current.el.pause(); } catch (_) { /* ignore */ }
    } else if (this.current && synthApi()) {
      try { synthApi().cancel(); } catch (_) { /* ignore */ }
    }
    this.current = null;
    if (had) this.events.emit('voice:end', { id: had.line.id });
  }
}
