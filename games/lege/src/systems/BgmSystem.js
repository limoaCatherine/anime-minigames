// 背景音乐：3 首原创循环曲 (菜单 / 普通关 / 地狱关，tools/compose_bgm.py 渲染的 ogg/mp3 文件)。
// - HTMLAudioElement (loop) 播放：file:// 双击运行、Electron 包内都可用；ogg 首尾无缝
// - 换曲时交叉淡入淡出；跨场景时同一首曲子不会重新开始
// - 角色语音播放时 (voice:start → voice:end) 平滑压低到 ×0.55，结束后平滑恢复
// - 通关 / 失败时短暂压低，让结算音效露出来
// - 浏览器禁止自动播放时，等第一次点击/按键再开始；窗口隐藏时暂停
import { AudioConfig } from '../config/AudioConfig.js';
import { platform } from '../platform/index.js';

const CFG = AudioConfig.bgm;

export class BgmSystem {
  constructor(events, mixer) {
    this.events = events;
    this.mixer = mixer;
    this.want = null;
    this.els = {};              // key -> { el, level, target }
    this.ext = '.mp3';
    this.duck = 1;
    this.voiceActive = false;
    this.voiceTime = 0;
    this.sting = 0;             // 结算压低剩余时间
    this.hidden = typeof document !== 'undefined' && !!document.hidden;
    this.blocked = false;
    this.lastError = null;
    this.ext = platform.audioExt();   // 网页优先 ogg；抖音 mp3
    events.on('input:down', () => this.unlock());
    events.on('input:key', () => this.unlock());
    events.on('mixer:change', () => this.sync());
    events.on('app:hidden', () => { this.hidden = true; this.sync(); });
    events.on('app:visible', () => { this.hidden = false; this.sync(); });
    events.on('voice:start', () => { this.voiceActive = true; this.voiceTime = 0; });
    events.on('voice:end', () => { this.voiceActive = false; });
    events.on('level:win', () => { this.sting = CFG.stingTime; });
    events.on('level:fail', () => { this.sting = CFG.stingTime; });
  }

  get playing() {
    const e = this.want && this.els[this.want];
    return e && !e.el.paused ? this.want : null;
  }
  get trackName() {
    const t = this.want && CFG.tracks[this.want];
    return t ? `正在放：《${t.title}》` : '—';
  }
  get shouldPlay() { return this.mixer.gain('bgm') > 0 && !this.hidden; }

  ensure(key) {
    if (this.els[key]) return this.els[key];
    // 抖音：LoopAudio (两路交叉淡化，mp3 也无缝)；网页：<audio loop>
    const el = platform.createLoopAudio ? platform.createLoopAudio() : platform.createAudio();
    if (!el) return undefined;
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.src = CFG.tracks[key].file + this.ext;
    el.addEventListener('error', () => {
      this.lastError = el.error ? el.error.code : 'error';
      console.warn('[BgmSystem] 背景音乐加载失败:', el.src);
    });
    this.els[key] = { el, level: 0 };
    return this.els[key];
  }

  /** 切换曲目 (null = 停止) */
  play(key) {
    if (key && !CFG.tracks[key]) return;
    this.want = key;
    if (key) this.ensure(key);
    this.sync();
  }

  unlock() { if (this.blocked || (this.want && this.shouldPlay && !this.playing)) this.sync(); }

  sync() {
    const e = this.want && this.els[this.want];
    if (!e) return;
    if (this.shouldPlay) {
      if (!e.el.paused) return;
      try {
        const pr = e.el.play();
        if (pr && pr.then) pr.then(() => { this.blocked = false; }).catch((err) => { if (err && err.name === 'NotAllowedError') this.blocked = true; });
      } catch (_) { this.blocked = true; }
    } else {
      for (const x of Object.values(this.els)) if (!x.el.paused) x.el.pause();
    }
  }

  update(dt) {
    if (this.voiceActive) {
      this.voiceTime += dt;
      if (this.voiceTime > CFG.maxDuckTime) this.voiceActive = false;
    }
    if (this.sting > 0) this.sting -= dt;
    const duckTarget = Math.min(this.voiceActive ? CFG.duck : 1, this.sting > 0 ? CFG.stingDuck : 1);
    const tau = duckTarget < this.duck ? CFG.duckAttack : CFG.duckRelease;
    this.duck += (duckTarget - this.duck) * (1 - Math.exp(-dt / tau));
    const vol = this.mixer.gain('bgm');
    for (const [key, x] of Object.entries(this.els)) {
      const active = key === this.want;
      const target = active ? 1 : 0;
      const t = active ? CFG.fadeIn : CFG.fadeOut;
      if (!x.el.paused) x.level += (target - x.level) * (1 - Math.exp(-dt / t));
      if (x.el.tick) x.el.tick();
      if (!active && x.level < 0.003 && !x.el.paused) {
        x.el.pause(); x.level = 0;
        // 抖音：InnerAudioContext 实例数有限，淡出完的曲目直接释放，下次再建
        if (x.el.destroy) { x.el.destroy(); delete this.els[key]; continue; }
      }
      const v = Math.max(0, Math.min(1, vol * this.duck * x.level));
      if (Math.abs(x.el.volume - v) > 0.0005) x.el.volume = v;
    }
  }

  state() {
    const e = this.want && this.els[this.want];
    const el = e && e.el;
    return {
      key: this.want, playing: this.playing, src: el ? el.src.split('/').pop() : null, blocked: this.blocked,
      time: el ? el.currentTime : 0, duration: el ? el.duration : 0, loop: el ? el.loop : false, loops: el && el.loops !== undefined ? el.loops : null,
      volume: el ? el.volume : 0, baseVolume: this.mixer.gain('bgm'), duck: this.duck, voiceActive: this.voiceActive, error: this.lastError,
    };
  }
}
