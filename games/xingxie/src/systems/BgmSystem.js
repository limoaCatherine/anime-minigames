// 背景音乐：三首预先编好的成品曲 (tools/compose_bgm.py 渲染)，菜单 / 战斗 / Boss 之间交叉淡化切换。
// - 全局服务，跨场景连续播放；同一首不会因为换场景重新开始
// - 网页版 / exe：HTMLAudioElement (loop)，file:// 与 Electron app.asar 内都能播；优先 ogg (首尾无缝)
// - 独立开关 (存档 bgmOn)，遵守全局静音；窗口隐藏时暂停
// - 台词播放时平滑压低到 ×0.55 (voice:start → voice:end)
// - 浏览器拦截自动播放时，等第一次点击 / 按键再开始
// - 抖音小游戏：只用 mp3 (文件在分包 sub_bgm，分包下载完 pack:ready 之前不播)；mp3 编码器头尾有静音，
//   所以不用 loop=true，而是 TTLoopAudio 双实例在循环点交叉淡化 (见 tools/make_tt_bgm.py)
import { AudioConfig } from '../config/AudioConfig.js';
import { platform } from '../core/platform/index.js';
import { BGM_LOOP_INFO } from '../config/BgmSources.js';

const CFG = AudioConfig.bgm;

export class BgmSystem {
  constructor(events, save, audio, mixer) {
    this.events = events;
    this.save = save;
    this.audio = audio;
    this.mixer = mixer;
    this.enabled = save.get('bgmOn', true);
    this.hidden = platform.hidden;
    this.tracks = {};          // name -> { el, level, src }
    this.current = null;       // 当前曲名
    this.duck = 1;
    this.voiceActive = false;
    this.voiceTime = 0;
    this.blocked = false;

    events.on('input:down', () => this.unlock());
    events.on('input:key', () => this.unlock());
    events.on('audio:mute', () => this.sync());
    events.on('app:hidden', () => { this.hidden = true; this.sync(); });
    events.on('app:visible', () => { this.hidden = false; this.sync(); });
    events.on('voice:start', () => { this.voiceActive = true; this.voiceTime = 0; });
    events.on('voice:end', () => { this.voiceActive = false; });
    events.on('pack:ready', () => { if (this.current && !this.tracks[this.current]) { this.track(this.current); this.sync(); } });
  }

  track(name) {
    if (this.tracks[name]) return this.tracks[name];
    const def = CFG.tracks[name];
    if (!def) return null;
    const loopInfo = BGM_LOOP_INFO && BGM_LOOP_INFO[name];
    if (loopInfo && platform.createLoopAudio) {          // 抖音 / 微信：无缝循环 (双实例交叉淡化)
      const src = def.sources[0].src;
      if (!platform.srcReady(src)) return null;          // 分包还没下载完，pack:ready 后再建
      const el = platform.createLoopAudio(loopInfo);
      el.volume = 0; el.src = platform.resolve(src);
      el.addEventListener('error', () => console.warn('[BgmSystem] 背景音乐加载失败:', src));
      this.tracks[name] = { el, level: 0, src, title: def.title };
      return this.tracks[name];
    }
    const probe = platform.createAudio();
    if (!probe) return null;
    const pick = def.sources.find((s) => probe.canPlayType(s.type)) || def.sources[def.sources.length - 1];
    if (!platform.srcReady(pick.src)) return null;      // 抖音分包还没下载完，pack:ready 后再建
    const el = platform.isMiniGame ? probe : platform.createAudio();
    el.loop = true; el.preload = 'auto'; el.volume = 0; el.src = platform.resolve(pick.src);
    el.addEventListener('error', () => console.warn('[BgmSystem] 背景音乐加载失败:', pick.src));
    this.tracks[name] = { el, level: 0, src: pick.src, title: def.title };
    return this.tracks[name];
  }

  /** 切换曲目 (交叉淡化)；同一首则什么也不做 */
  play(name) {
    if (this.current === name) return;
    this.current = name;
    this.track(name);
    this.sync();
  }

  get shouldPlay() { return this.enabled && !this.audio.muted && !this.hidden; }

  get title() { return this.current && CFG.tracks[this.current] ? CFG.tracks[this.current].title : ''; }

  unlock() { if (this.blocked) { this.blocked = false; this.sync(); } else if (this.shouldPlay) this.sync(); }

  sync() {
    const cur = this.current && this.tracks[this.current];
    if (!cur) return;
    if (this.shouldPlay) {
      if (cur.el.paused) {
        try {
          const pr = cur.el.play();
          if (pr && pr.catch) pr.catch((err) => { if (err && err.name === 'NotAllowedError') this.blocked = true; });
        } catch (_) { this.blocked = true; }
      }
    } else {
      for (const t of Object.values(this.tracks)) if (!t.el.paused) t.el.pause();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    this.save.set('bgmOn', this.enabled);
    this.sync();
    this.events.emit('bgm:toggle', this.enabled);
    return this.enabled;
  }

  get volume() { return this.mixer ? this.mixer.gain('bgm') : CFG.volume; }

  update(dt) {
    if (this.voiceActive) { this.voiceTime += dt; if (this.voiceTime > CFG.maxDuckTime) this.voiceActive = false; }
    const duckTarget = this.voiceActive ? CFG.duck : 1;
    const tau = duckTarget < this.duck ? CFG.duckAttack : CFG.duckRelease;
    this.duck += (duckTarget - this.duck) * (1 - Math.exp(-dt / tau));
    for (const [name, t] of Object.entries(this.tracks)) {
      if (t.el.tick) t.el.tick(dt);
      if (t.el.paused) { if (name !== this.current) t.level = 0; continue; }
      const target = name === this.current ? 1 : 0;
      const k = target > t.level ? dt / CFG.crossfade : dt / (CFG.crossfade * 0.7);
      t.level = target > t.level ? Math.min(1, t.level + k) : Math.max(0, t.level - k);
      if (target === 0 && t.level <= 0.001) { t.el.pause(); continue; }
      const v = Math.max(0, Math.min(1, this.volume * this.duck * t.level));
      if (Math.abs(t.el.volume - v) > 0.0005) t.el.volume = v;
    }
  }

  state() {
    const cur = this.current && this.tracks[this.current];
    return { current: this.current, playing: !!cur && !cur.el.paused, blocked: this.blocked, duck: this.duck, voiceActive: this.voiceActive,
      volume: cur ? cur.el.volume : 0, time: cur ? cur.el.currentTime : 0, src: cur ? cur.src : null, enabled: this.enabled };
  }
}
