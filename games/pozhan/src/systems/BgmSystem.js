// 背景音乐：2 首原创循环曲 (菜单 / 关卡，tools/compose_bgm.py 渲染的 mp3)。
// - 全平台只用 mp3 (iOS 播不了 ogg)。mp3 首尾有编码填充，直接 loop 会有一小段空隙，所以：
//   每首曲子用两个播放器 A / B 轮流放；A 播到 loopEnd 时 B 从 0 开始，两者在 crossfade (0.15 秒) 内等功率交叉淡化。
//   文件在 loopEnd 之后多接了 0.5 秒「开头」，交叉的那段两边是同一段音乐，接缝听不出来。
//   currentTime 在小游戏里更新得比较粗，这里用 Platform.now() 外推，误差只会让交叉稍早 / 稍晚几十毫秒。
// - 换曲时交叉淡入淡出；跨场景时同一首曲子不会重新开始
// - 角色语音播放时 (voice:start → voice:end) 平滑压低到 ×0.55，结束后平滑恢复
// - 通关 / 失败时短暂压低，让结算音效露出来
// - 浏览器禁止自动播放时，等第一次点击/按键再开始；窗口隐藏时暂停
import { AudioConfig } from '../config/AudioConfig.js';
import { Platform } from '../platform/Platform.js';

const CFG = AudioConfig.bgm;

export class BgmSystem {
  constructor(events, mixer) {
    this.events = events;
    this.mixer = mixer;
    this.want = null;
    this.els = {};              // key -> { pl: [A, B], cur, level, xf, clock }
    this.duck = 1;
    this.voiceActive = false;
    this.voiceTime = 0;
    this.sting = 0;             // 结算压低剩余时间
    this.hidden = false;
    this.blocked = false;
    this.lastError = null;
    this.loops = 0;             // 已经过的循环接缝次数 (测试用)
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

  cur(x) { return x.pl[x.cur]; }
  get playing() {
    const e = this.want && this.els[this.want];
    return e && !this.cur(e).paused ? this.want : null;
  }
  get trackName() {
    const t = this.want && CFG.tracks[this.want];
    return t ? `正在放：《${t.title}》` : '—';
  }
  get shouldPlay() { return this.mixer.gain('bgm') > 0 && !this.hidden; }

  ensure(key) {
    if (this.els[key] || !Platform.createAudio) return this.els[key];
    if (Platform.isAudioReady && !Platform.isAudioReady()) {
      // 小游戏版：BGM 在音频分包里，下载完再开始放
      if (!this.waiting) { this.waiting = true; Platform.audioReady().then(() => { this.waiting = false; if (this.want) { this.ensure(this.want); this.sync(); } }, () => {}); }
      return null;
    }
    const x = { pl: [], cur: 0, level: 0, xf: null, clock: { ct: -1, at: 0 } };
    for (let i = 0; i < 2; i++) {
      const el = Platform.createAudio();
      el.loop = false;
      el.preload = 'auto';
      el.volume = 0;
      el.src = Platform.assetPath(CFG.tracks[key].file);
      el.addEventListener('error', () => {
        this.lastError = el.error ? el.error.code : 'error';
        console.warn('[BgmSystem] 背景音乐加载失败:', el.src);
      });
      // 兜底：如果错过了接缝 (例如后台节流)，播完时立刻接上另一个
      el.addEventListener('ended', () => { if (this.want === key && x.pl[x.cur] === el && this.shouldPlay) this.seam(x, true); });
      x.pl.push(el);
    }
    this.els[key] = x;
    return x;
  }

  /** 切换曲目 (null = 停止) */
  play(key) {
    if (key && !CFG.tracks[key]) return;
    this.want = key;
    if (key) this.ensure(key);
    this.sync();
  }

  unlock() { if (this.blocked || (this.want && this.shouldPlay && !this.playing)) this.sync(); }

  start(el) {
    try {
      const pr = el.play();
      if (pr && pr.then) pr.then(() => { this.blocked = false; }).catch((err) => { if (err && err.name === 'NotAllowedError') this.blocked = true; });
    } catch (_) { this.blocked = true; }
  }

  sync() {
    const e = this.want && this.els[this.want];
    if (!e) return;
    if (this.shouldPlay) {
      const el = this.cur(e);
      if (!el.paused) return;
      this.start(el);
    } else {
      for (const x of Object.values(this.els)) {
        if (x.xf) this.endXf(x);
        for (const el of x.pl) if (!el.paused) el.pause();
      }
    }
  }

  /** 外推的播放位置 (秒) */
  pos(x) {
    const el = this.cur(x); const ct = el.currentTime || 0; const now = Platform.now() / 1000;
    if (ct !== x.clock.ct) { x.clock.ct = ct; x.clock.at = now; return ct; }
    return el.paused ? ct : ct + Math.min(0.5, now - x.clock.at);
  }

  /** 到达 loopEnd：另一个播放器从头开始，进入交叉淡化 */
  seam(x, immediate = false) {
    const old = this.cur(x); const nxt = x.pl[1 - x.cur];
    try { nxt.currentTime = 0; } catch (_) { /* 未加载完 */ }
    nxt.volume = immediate ? old.volume : 0;
    this.start(nxt);
    x.cur = 1 - x.cur; x.clock = { ct: -1, at: 0 };
    x.xf = immediate ? null : { old, t: 0 };
    this.loops++;
  }

  endXf(x) {
    const f = x.xf; x.xf = null;
    if (!f) return;
    try { f.old.pause(); f.old.currentTime = 0; } catch (_) { /* ignore */ }
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
      const el = this.cur(x);
      const target = active ? 1 : 0;
      const t = active ? CFG.fadeIn : CFG.fadeOut;
      if (!el.paused) x.level += (target - x.level) * (1 - Math.exp(-dt / t));
      if (!active && x.level < 0.003 && !el.paused) { this.endXf(x); el.pause(); x.level = 0; }
      // 循环接缝
      const loopEnd = CFG.tracks[key].loopEnd;
      if (active && !el.paused && !x.xf && loopEnd && this.pos(x) >= loopEnd) this.seam(x);
      const v = Math.max(0, Math.min(1, vol * this.duck * x.level));
      let gNew = 1; let gOld = 0;
      if (x.xf) {
        x.xf.t += dt;
        const p = Math.min(1, x.xf.t / CFG.crossfade);
        gNew = Math.sin(p * Math.PI / 2); gOld = Math.cos(p * Math.PI / 2);   // 等功率
        if (Math.abs(x.xf.old.volume - v * gOld) > 0.0005) x.xf.old.volume = v * gOld;
        if (p >= 1) this.endXf(x);
      }
      const vn = v * gNew;
      if (Math.abs(el.volume - vn) > 0.0005) el.volume = vn;
    }
  }

  state() {
    const e = this.want && this.els[this.want];
    const el = e && this.cur(e);
    return {
      key: this.want, playing: this.playing, src: el ? el.src.split('/').pop() : null, blocked: this.blocked,
      time: el ? el.currentTime : 0, duration: el ? el.duration : 0, loopEnd: this.want ? CFG.tracks[this.want].loopEnd : 0,
      players: e ? e.pl.length : 0, crossfading: !!(e && e.xf), loops: this.loops,
      volume: el ? el.volume : 0, baseVolume: this.mixer.gain('bgm'), duck: this.duck, voiceActive: this.voiceActive, error: this.lastError,
    };
  }
}
