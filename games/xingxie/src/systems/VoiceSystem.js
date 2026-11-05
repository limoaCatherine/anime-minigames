// 语音系统：按战斗事件播放「当前角色」的日语台词，并发出字幕事件 (voice:line)。
// 规则 (与《美少女合成》新标准一致)：
// - 同一时间只播一句；两句之间至少隔 0.6 秒；高优先级可以打断低优先级
// - 角色台词限频：升级 8 秒一次 (且只有 60% 概率开口)，受伤 15 秒一次且血量低于 60% 才喊
// - Boss 登场 / 黎明前最后一搏：先播 Boss 的台词，结束后排队播角色的应对台词
// - 打倒精英 (70% 概率、20 秒一次)、羊王打哈欠溜走、诺克丝镜像分身也有台词
// - 每组 2~3 条变体随机播放，不连续重复同一条
// - 发出 voice:start / voice:end (BgmSystem 据此平滑压低 BGM 到 ×0.55)
// - 网页 / Electron：HTMLAudioElement 播放预生成 mp3，加载失败时退回 speechSynthesis
// - 抖音小游戏：语音在分包 sub_voice 里，只用 1 个 InnerAudioContext 轮流换 src (同一时间只有一句)；
//   分包没下载完时只显示字幕，不出声
import { VOICE_LINES, ALL_VOICE_LINES, VoiceConfig } from '../config/VoiceConfig.js';
import { platform } from '../core/platform/index.js';

export class VoiceSystem {
  constructor(events, save, audio, mixer) {
    this.events = events;
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
    this.random = Math.random;       // 可替换 (测试)

    this.who = 'hikari';               // 当前出战角色
    this.queue = null;                 // 排队的一句 { who, group, until }
    events.on('battle:start', (e) => { this.who = e.character; this.groupTimers = {}; setTimeout(() => this.request(this.who, 'start'), 700); });
    events.on('levelup:open', () => { if (this.random() < VoiceConfig.levelupChance) this.request(this.who, 'levelup'); });
    events.on('weapon:evolve', () => this.request(this.who, 'evolve', {}, true));
    events.on('boss:spawn', (e) => {
      this.request(e.type, 'appear', {}, true);
      this.queue = { who: this.who, group: 'boss', until: 9 };
    });
    events.on('boss:die', (e) => this.request(e.type, 'defeat', {}, true));
    events.on('boss:retreat', (e) => { if (e.reason === 'timeout') this.request(e.type, 'retreat', {}, true); });
    events.on('boss:skill', (e) => { if (e.skill === 'mirror') this.request(e.type, 'mirror', {}, true); });
    events.on('dawn:laststand', (e) => {
      // 诺克丝的台词优先级高于登场台词 (5.5)，可以打断；播完后排队播角色的「天快亮了」
      if (this.request(e.type, 'laststand', {}, true)) this.queue = { who: this.who, group: 'dawn', until: 8 };
      else this.request(this.who, 'dawn', {}, true);
    });
    events.on('enemy:die', (e) => { if (e.elite && !e.boss && this.random() < VoiceConfig.killChance) this.request(this.who, 'kill'); });
    events.on('player:hurt', (e) => { if (e.hp / e.maxHp < VoiceConfig.hurtBelow) this.request(this.who, 'hurt'); });
    events.on('battle:win', () => { this.queue = null; this.request(this.who, 'win', {}, true); });
    events.on('player:die', () => { this.queue = null; this.request(this.who, 'lose', {}, true); });
    events.on('audio:mute', (muted) => { if (muted) this.stop(); });
    events.on('app:hidden', () => this.stop());
    events.on('mixer:change', () => { if (this.current && this.current.el) this.current.el.volume = this.volume; });
    events.on('scene:changed', () => { this.queue = null; if (!this.current || this.current.priority < 6) this.stop(); });

    const speech = platform.speech;
    if (speech) {
      const pick = () => {
        const voices = speech.getVoices() || [];
        const ja = voices.filter((v) => /^ja/i.test(v.lang));
        this.jaVoice = ja.find((v) => /female|nanami|haruka|ayumi|kyoko|mizuki/i.test(v.name)) || ja[0] || null;
      };
      pick();
      if ('onvoiceschanged' in speech) speech.onvoiceschanged = pick;
    }
  }

  /** 预加载全部语音，返回 Promise (失败/超时都会 resolve，不阻塞游戏) */
  preload(onProgress = () => {}, timeoutMs = 4000) {
    if (platform.isMiniGame) {
      // 抖音 / 微信：共用一个音频实例，播放时再换 src，不在启动时创建 137 个 InnerAudioContext
      if (!this.shared) this.shared = platform.createAudio();
      for (const line of ALL_VOICE_LINES) this.clips.set(line.file, { el: this.shared, state: 'lazy' });
      onProgress(1);
      return Promise.resolve();
    }
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
        const el = platform.createAudio();
        el.preload = 'auto';
        el.addEventListener('canplaythrough', () => finish('ready'), { once: true });
        el.addEventListener('loadeddata', () => finish('ready'), { once: true });
        el.addEventListener('error', () => {
          console.warn(`[VoiceSystem] 语音加载失败，将使用 speechSynthesis: ${line.file}`);
          finish('failed');
        }, { once: true });
        el.src = platform.resolve(line.file);
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
    const sp = platform.speech;
    return !!(sp && sp.speaking);
  }

  /** 请求播放 who 的某组台词；force=true 时无视全局冷却 (进化 / Boss / 结算) */
  request(who, group, pos = {}, force = false) {
    const list = VOICE_LINES[who] && VOICE_LINES[who][group];
    if (!list) return false;
    const key = `${who}.${group}`;
    if ((this.groupTimers[key] || 0) > 0) return false;
    const pri = VoiceConfig.priority[group] || 1;
    const playing = this.isPlaying();
    if (!force && this.cooldown > 0) return false;
    if (playing && this.current && pri <= this.current.priority && !(force && pri > this.current.priority)) return false;
    let i = Math.floor(this.random() * list.length);
    if (list.length > 1 && i === this.lastIndex[key]) i = (i + 1) % list.length;
    this.lastIndex[key] = i;
    this.groupTimers[key] = (VoiceConfig.groupCooldown || {})[group] || 0;
    this.play(who, group, i, pri, pos);
    return true;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (const k in this.groupTimers) if (this.groupTimers[k] > 0) this.groupTimers[k] -= dt;
    if (this.queue) {
      this.queue.until -= dt;
      if (this.queue.until <= 0) this.queue = null;
      else if (!this.isPlaying() && this.cooldown <= 0) { const q = this.queue; this.queue = null; this.request(q.who, q.group, {}, true); }
    }
  }

  play(who, group, index, priority, pos) {
    const line = VOICE_LINES[who][group][index];
    this.stop();
    this.cooldown = VoiceConfig.cooldown;
    this.history.push(`${who}.${group}`);
    this.events.emit('voice:line', { who, group, index, line, x: pos.x, y: pos.y }); // 字幕 (静音时也显示)
    if (this.silent) { this.lastPlay = { group, index, result: 'muted' }; return; }

    const clip = this.clips.get(line.file);
    if (platform.isMiniGame && !platform.srcReady(line.file)) { this.lastPlay = { group, index, result: 'pack-loading' }; return; }
    if (clip && clip.el && clip.state !== 'failed') {
      const el = clip.el;
      if (clip.state === 'lazy') el.src = platform.resolve(line.file);
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
    const synth = platform.speech;
    if (!synth) {
      this.lastPlay = { group, result: 'unsupported' };
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
    } else if (this.current && platform.speech) {
      try { platform.speech.cancel(); } catch (_) { /* ignore */ }
    }
    this.current = null;
    if (had) this.events.emit('voice:end', { group: had.group });
  }
}
