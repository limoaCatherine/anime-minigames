// 语音系统 (合成类新标准)：
// - 同一时间只播一句；两句之间冷却 0.6 秒
// - 冲突按优先级：剧情台词 > 失败/通关 > 找对/点错/提示 > 闲聊。新请求优先级更高 → 打断当前；
//   否则在播放/冷却期间到达的请求直接丢弃 (不排队堆积)
// - 防重复：每个事件一个台词池，随机抽取；同一句在最近 5 次播放内不再出现
// - 每个角色的 intro 每关只说一次 (重试也不重复)；同一关内同一角色闲聊间隔 ≥ 20 秒
// - 播放 HTMLAudioElement (file:// 与 Electron app.asar 内均可用)；文件缺失时只显示字幕 (不用机械 TTS 兜底)
// - 发出 voice:line (字幕，静音时也显示) / voice:start / voice:end (BgmSystem 据此闪避)
import { VOICE_LINES, VoiceConfig } from '../config/VoiceConfig.js';
import { Platform } from '../platform/Platform.js';

export class VoiceSystem {
  constructor(events, mixer) {
    this.events = events;
    this.mixer = mixer;
    this.clips = new Map();       // id -> { el, state }
    this.pools = new Map();       // `${who}_${group}` -> lines[]
    for (const l of VOICE_LINES) {
      const k = `${l.who}_${l.group}`;
      if (!this.pools.has(k)) this.pools.set(k, []);
      this.pools.get(k).push(l);
    }
    this.recent = [];             // 最近播放的台词 id
    this.cooldown = 0;
    this.current = null;          // { line, priority, el }
    this.introduced = new Set();  // 本关已说过 intro 的角色
    this.lastIdle = {};           // who -> 本关最近一次闲聊的时间
    this.levelTime = 0;
    this.levelKey = null;
    this.log = [];                // 调试 / 测试：{ id, result }
    events.on('mixer:change', () => { if (this.current && this.current.el) this.current.el.volume = this.volume; });
    events.on('audio:mute', (m) => { if (m) this.stop(); });
  }

  get volume() { return this.mixer.gain('voice'); }

  preload(onProgress = () => {}, timeoutMs = 3000) {
    if (Platform.singleVoicePlayer) {
      // 抖音版：只建一个播放器，播哪句就切 src；语音在分包里，分包下载完之前只显示字幕
      this.single = Platform.createAudio();
      for (const line of VOICE_LINES) this.clips.set(line.id, { el: this.single, state: 'loading' });
      return Platform.audioReady().then(() => { for (const c of this.clips.values()) c.state = 'ready'; onProgress(1); },
        () => { for (const c of this.clips.values()) c.state = 'failed'; onProgress(1); });
    }
    let done = 0;
    const total = VOICE_LINES.length;
    return Promise.all(VOICE_LINES.map((line) => new Promise((resolve) => {
      const clip = { el: null, state: 'loading' };
      this.clips.set(line.id, clip);
      let settled = false;
      const finish = (state) => { if (settled) return; settled = true; clip.state = state; onProgress(++done / total); resolve(); };
      try {
        const el = Platform.createAudio();
        el.preload = 'auto';
        el.addEventListener('canplaythrough', () => finish('ready'), { once: true });
        el.addEventListener('loadeddata', () => finish('ready'), { once: true });
        el.addEventListener('error', () => finish('failed'), { once: true });
        el.src = Platform.assetPath(line.file);
        el.load();
        clip.el = el;
        setTimeout(() => finish('unknown'), timeoutMs);
      } catch (_) { finish('failed'); }
    })));
  }

  get loadedCount() { return [...this.clips.values()].filter((c) => c.state === 'ready').length; }

  /** 新关卡 (同一关重试不重置 intro 记录) */
  beginLevel(levelId, retry = false) {
    this.stop();
    this.cooldown = 0;
    this.levelTime = 0;
    this.lastIdle = {};
    if (!retry || this.levelKey !== levelId) this.introduced.clear();
    this.levelKey = levelId;
  }

  isPlaying() { return !!this.current && (!this.current.el || (!this.current.el.paused && !this.current.el.ended)); }

  update(dt) {
    this.levelTime += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.current && this.current.el && (this.current.el.ended || (this.current.el.paused && this.current.started))) this.finish();
    if (this.current && !this.current.el) {
      this.current.t -= dt;
      if (this.current.t <= 0) this.finish();
    }
  }

  /**
   * 请求说一句台词。返回实际播放的台词 (被丢弃时返回 null)。
   * @param {string} who 角色
   * @param {string} group 事件 (intro / found / wrong / hint / win / lose / idle …)
   */
  say(who, group, opts = {}) {
    const pool = this.pools.get(`${who}_${group}`);
    if (!pool || !pool.length) return null;
    const priority = opts.priority ?? VoiceConfig.priority[group] ?? 1;
    if (group === 'intro' && VoiceConfig.introOncePerLevel) {
      if (this.introduced.has(who)) return null;
    }
    if (group === 'idle') {
      const last = this.lastIdle[who];
      if (last !== undefined && this.levelTime - last < VoiceConfig.idleGap) return null;
    }
    const busy = this.isPlaying() || this.cooldown > 0;
    if (busy) {
      const curP = this.current ? this.current.priority : 0;
      if (!(this.isPlaying() && priority > curP) && !(!this.isPlaying() && priority > (this.lastPriority || 0))) {
        this.log.push({ id: `${who}_${group}`, result: 'dropped' });
        return null;
      }
    }
    // 抽取：避开最近 5 次播放过的句子
    const fresh = pool.filter((l) => !this.recent.includes(l.id));
    const cand = fresh.length ? fresh : pool;
    const line = cand[Math.floor(Math.random() * cand.length)];
    if (group === 'intro') this.introduced.add(who);
    if (group === 'idle') this.lastIdle[who] = this.levelTime;
    this.play(line, priority);
    return line;
  }

  play(line, priority) {
    this.stop(true);
    this.recent.push(line.id);
    while (this.recent.length > VoiceConfig.recentWindow) this.recent.shift();
    this.lastPriority = priority;
    this.events.emit('voice:line', { line, who: line.who });
    const clip = this.clips.get(line.id);
    const silent = this.volume <= 0;
    if (silent || !clip || !clip.el || clip.state === 'failed' || (this.single && clip.state !== 'ready')) {
      // 无声：仍占用"说话时间"，避免字幕叠在一起
      this.current = { line, priority, el: null, t: Math.min(2.2, 0.35 + line.zh.length * 0.12) };
      this.log.push({ id: line.id, result: silent ? 'muted' : 'subtitle-only' });
      return;
    }
    const el = clip.el;
    this.current = { line, priority, el, started: false };
    try {
      if (this.single) el.src = Platform.assetPath(line.file);   // 单播放器：换 src 即从头播放
      else el.currentTime = 0;
      el.volume = this.volume;
      const pr = el.play();
      this.events.emit('voice:start', { id: line.id });
      this.log.push({ id: line.id, result: 'audio' });
      const cur = this.current;
      if (pr && pr.then) pr.then(() => { cur.started = true; }).catch(() => { if (this.current === cur) { this.current.el = null; this.current.t = 1.5; } });
      else cur.started = true;
    } catch (_) {
      this.current.el = null; this.current.t = 1.5;
    }
  }

  finish() {
    const had = this.current;
    this.current = null;
    this.cooldown = VoiceConfig.cooldown;
    if (had && had.el) this.events.emit('voice:end', { id: had.line.id });
  }

  stop(interrupt = false) {
    const had = this.current;
    if (had && had.el) { try { had.el.pause(); } catch (_) { /* ignore */ } }
    this.current = null;
    if (had && had.el) this.events.emit('voice:end', { id: had.line.id, interrupted: interrupt });
  }
}
