// 语音系统：在关卡事件 (开始 / 害怕 / 过关 / 三星 / 失败) 时播放主角的日语台词，并发出字幕事件。
// - 使用 HTMLAudioElement (抖音：InnerAudioContext，见 src/platform) 播放预生成的 mp3 (file:// 下也可用，不依赖 fetch/decodeAudioData)
// - 每组 3 句随机，不连续重复；全局冷却；高优先级可打断低优先级
// - 不刷屏：开场白只在每关第一次挑战时一定说，重试时按 startChance 概率说；「害怕」每次挑战最多说一次
// - 发出 voice:start / voice:end 事件 (BgmSystem 据此在台词播放时压低背景音乐)
// - 独立音量，遵守全局静音；单独的「语音开关」
// - 文件加载失败时退回浏览器 speechSynthesis (ja-JP)
import { VOICE_LINES, ALL_VOICE_LINES, VoiceConfig } from '../config/VoiceConfig.js';

export class VoiceSystem {
  constructor(events, save, audio, mixer, platform = null) {
    this.events = events;
    this.platform = platform;
    this.save = save;
    this.audio = audio;              // 用于读取全局静音状态
    this.mixer = mixer;              // 音量由 MixerSystem 决定 (总音量 × 语音声道)
    this.enabled = save.get('voiceOn', true);
    this.clips = new Map();          // file -> { el, state }
    this.cooldown = 0;
    this.groupTimers = {};
    this.lastIndex = {};
    this.current = null;             // { group, priority, el }
    this.lastPlay = null;            // 最近一次播放结果 (调试/测试用)
    this.history = [];               // 播放过的分组 (测试用)
    this.jaVoice = null;
    this.seenLevels = new Set();     // 本次运行中已经挑战过的关卡 (开场白频率控制)
    this.scaredCount = 0;            // 本次挑战已说「害怕」的次数
    this.random = Math.random;       // 可替换 (测试)

    events.on('level:start', (e) => {
      this.scaredCount = 0;
      const first = !this.seenLevels.has(e.id);
      this.seenLevels.add(e.id);
      if (first || this.random() < VoiceConfig.startChance) this.request('start', e);
    });
    events.on('heroine:scared', (e) => {
      if (this.scaredCount >= VoiceConfig.scaredPerAttempt) return;
      if (this.request('scared', e)) this.scaredCount++;
    });
    events.on('level:win', (e) => this.request(e.stars >= 3 ? 'stars3' : 'win', e, true));
    events.on('level:lose', (e) => this.request('lose', { x: e.hx, y: e.hy }, true));
    events.on('audio:mute', (muted) => { if (muted) this.stop(); });
    events.on('mixer:change', () => { if (this.current && this.current.el) this.current.el.volume = this.volume; });
    events.on('scene:changed', () => this.stop());
    events.on('ad:show', () => this.stop());
    events.on('app:hidden', () => this.stop());     // 切后台 (抖音 onHide) 时不在后台继续说话

    const synth = this.synth;
    if (synth) {
      const pick = () => {
        const voices = synth.getVoices() || [];
        const ja = voices.filter((v) => /^ja/i.test(v.lang));
        this.jaVoice = ja.find((v) => /female|nanami|haruka|ayumi|kyoko|mizuki/i.test(v.name)) || ja[0] || null;
      };
      pick();
      if ('onvoiceschanged' in synth) synth.onvoiceschanged = pick;
    }
  }

  /** speechSynthesis 兜底 (只有网页 / 桌面版有；抖音版为 null) */
  get synth() {
    return this.platform ? this.platform.speech : null;
  }

  /** 预加载全部语音，返回 Promise (失败/超时都会 resolve，不阻塞游戏) */
  preload(onProgress = () => {}, timeoutMs = 4000) {
    let done = 0;
    const total = ALL_VOICE_LINES.length;
    return Promise.all(ALL_VOICE_LINES.map((line) => new Promise((resolve) => {
      const clip = { el: null, state: 'loading' };
      this.clips.set(line.file, clip);
      let settled = false;
      const finish = (state) => {
        if (settled) return;
        settled = true;
        clip.state = state;
        onProgress(++done / total);
        resolve();
      };
      try {
        const el = this.platform && this.platform.createAudio();
        if (!el) { finish('failed'); return; }
        el.preload = 'auto';
        el.addEventListener('canplaythrough', () => finish('ready'), { once: true });
        el.addEventListener('loadeddata', () => finish('ready'), { once: true });
        el.addEventListener('error', () => {
          console.warn(`[VoiceSystem] 语音加载失败，将使用 speechSynthesis: ${line.file}`);
          finish('failed');
        }, { once: true });
        el.src = this.platform.resolveAsset(line.file);
        el.load();
        clip.el = el;
        setTimeout(() => finish('unknown'), timeoutMs);
      } catch (_) {
        finish('failed');
      }
    })));
  }

  get volume() {
    return this.mixer ? this.mixer.gain('voice') : VoiceConfig.volume;
  }

  get loadedCount() {
    return [...this.clips.values()].filter((c) => c.state === 'ready').length;
  }

  get silent() {
    return !this.enabled || this.audio.muted;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.save.set('voiceOn', this.enabled);
    if (!this.enabled) this.stop();
    return this.enabled;
  }

  isPlaying() {
    if (!this.current) return false;
    if (this.current.el) return !this.current.el.paused && !this.current.el.ended;
    return !!(this.synth && this.synth.speaking);
  }

  /** 请求播放某组台词；force=true 时无视全局冷却 (结算语音) */
  request(group, pos = {}, force = false) {
    const list = VOICE_LINES[group];
    if (!list) return false;
    if ((this.groupTimers[group] || 0) > 0) return false;
    const pri = VoiceConfig.priority[group] || 1;
    const playing = this.isPlaying();
    if (!force && this.cooldown > 0) return false;
    if (playing && this.current && pri <= this.current.priority && !force) return false;
    // 随机选一句，不与上次相同
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.lastIndex[group]) i = (i + 1) % list.length;
    this.lastIndex[group] = i;
    this.groupTimers[group] = (VoiceConfig.groupCooldown || {})[group] || 0;
    this.play(group, i, pri, pos);
    return true;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (const k in this.groupTimers) if (this.groupTimers[k] > 0) this.groupTimers[k] -= dt;
  }

  play(group, index, priority, pos) {
    const line = VOICE_LINES[group][index];
    this.stop();
    this.cooldown = VoiceConfig.cooldown;
    this.history.push(group);
    this.events.emit('voice:line', { group, index, line, x: pos.x, y: pos.y }); // 字幕 (静音时也显示)
    if (this.silent) { this.lastPlay = { group, index, result: 'muted' }; return; }

    const clip = this.clips.get(line.file);
    if (clip && clip.el && clip.state !== 'failed') {
      const el = clip.el;
      const cur = { group, priority, el };
      this.current = cur;
      el.onended = () => { if (this.current === cur) { this.current = null; this.events.emit('voice:end', { group }); } };
      this.events.emit('voice:start', { group });
      try {
        el.currentTime = 0;
        el.volume = this.volume;
        const pr = el.play();
        this.lastPlay = { group, index, result: 'audio-pending' };
        if (pr && pr.then) {
          pr.then(() => { this.lastPlay = { group, index, result: 'audio' }; })
            .catch((err) => {
              this.lastPlay = { group, index, result: `audio-blocked:${err && err.name}` };
              if (err && err.name !== 'AbortError') this.speak(line, group, priority);
            });
        }
      } catch (_) {
        this.speak(line, group, priority);
      }
      return;
    }
    this.speak(line, group, priority);
  }

  speak(line, group, priority) {
    const synth = this.synth;
    if (!synth) {
      this.lastPlay = { group, result: 'unsupported' };
      return;
    }
    try {
      synth.cancel();
      const u = this.platform.createUtterance(line.tts);
      u.lang = 'ja-JP';
      if (this.jaVoice) u.voice = this.jaVoice;
      u.rate = VoiceConfig.speechRate;
      u.pitch = VoiceConfig.speechPitch;
      u.volume = this.volume;
      const cur = { group, priority, el: null };
      u.onend = () => { if (this.current === cur) { this.current = null; this.events.emit('voice:end', { group }); } };
      synth.speak(u);
      this.current = cur;
      this.events.emit('voice:start', { group });
      this.lastPlay = { group, result: 'speech' };
    } catch (_) {
      this.lastPlay = { group, result: 'unsupported' };
    }
  }

  stop() {
    const had = this.current;
    if (this.current && this.current.el) {
      try { this.current.el.pause(); } catch (_) { /* ignore */ }
    } else if (this.current && this.synth) {
      try { this.synth.cancel(); } catch (_) { /* ignore */ }
    }
    this.current = null;
    if (had) this.events.emit('voice:end', { group: had.group });
  }
}
