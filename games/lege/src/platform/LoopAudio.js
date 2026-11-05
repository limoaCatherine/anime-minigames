// 抖音版 BGM 无缝循环播放器 (只在抖音包里用；网页版 ogg + <audio loop> 本来就无缝)。
//
// InnerAudioContext 的 loop 播 mp3 时，编码器延迟 / 补零会在接缝处留下 25~50 ms 的空隙。
// 抖音包里的 BGM 由 tools/douyin_bgm.py 生成：文件 = 循环体 L 秒 + 循环开头的 TAIL 秒 (音乐的自然延续)。
// 这里用两个 InnerAudioContext 交替：当前这路播到 L 时，另一路从 0 开始，
// 当前这路继续播"延续段"，两路等功率交叉淡化 XFADE 秒 → 接缝处始终有声音，没有空隙。
// 对外接口模仿 HTMLAudioElement 的常用子集 (BgmSystem 不用区分平台)，每帧需要调用 tick()。
import { DyAudio } from './DyAudio.js';

export const TAIL = 0.5;    // 与 tools/douyin_bgm.py 一致
export const XFADE = 0.25;

export class LoopAudio {
  constructor(tt, now) {
    this.tt = tt;
    this.now = now;                 // () => 毫秒
    this.players = [new DyAudio(tt), null];   // 第二路在第一次接缝前才创建
    this.cur = 0;
    this.paused = true;
    this.loop = true;
    this.preload = 'auto';
    this.error = null;
    this._src = '';
    this._vol = 1;
    this._fade = null;              // { t0 }
    this._anchor = 0;               // 当前这路"播放位置 0"对应的时刻 (ms)
    this._l = {};
    this.loops = 0;
    this._wire(this.players[0]);
  }

  _wire(p) {
    p.addEventListener('error', () => { this.error = p.error; this._emit('error'); });
    p.addEventListener('canplaythrough', () => this._emit('canplaythrough'));
  }

  get src() { return this._src; }
  set src(v) {
    this._src = v;
    for (const p of this.players) if (p) p.src = v;
  }
  get volume() { return this._vol; }
  set volume(v) { this._vol = Math.max(0, Math.min(1, v)); this._applyVol(); }
  get duration() { return this.players[this.cur].duration; }
  /** 循环体长度 (秒) = 文件时长 - 尾巴 */
  get loopLength() { const d = this.duration; return d > TAIL + 1 ? d - TAIL : 0; }
  get currentTime() { return this.paused ? this.players[this.cur].currentTime : (this.now() - this._anchor) / 1000; }
  set currentTime(t) { this.players[this.cur].currentTime = t; this._anchor = this.now() - t * 1000; }

  _applyVol() {
    const f = this._fade;
    const a = this.players[this.cur]; const b = this.players[1 - this.cur];
    if (f) {
      const k = Math.min(1, (this.now() - f.t0) / 1000 / XFADE);
      a.volume = this._vol * Math.sin(k * Math.PI / 2);          // 新的一路淡入
      if (b) b.volume = this._vol * Math.cos(k * Math.PI / 2);   // 旧的一路淡出
    } else {
      a.volume = this._vol;
    }
  }

  play() {
    if (!this.paused) return Promise.resolve();
    this.paused = false;
    const a = this.players[this.cur];
    const t = a.currentTime || 0;
    this._anchor = this.now() - t * 1000;
    this._applyVol();
    return a.play();
  }

  pause() {
    this.paused = true;
    // 交叉淡化中被暂停：直接结束淡化，只保留新的一路
    if (this._fade) this._endFade();
    this.players[this.cur].pause();
  }

  _endFade() {
    this._fade = null;
    const old = this.players[1 - this.cur];
    if (old) old.stop();
    this._applyVol();
  }

  /** 每帧调用：到接缝时切到另一路并交叉淡化 */
  tick() {
    if (this.paused || !this.loop) return;
    if (this._fade) {
      this._applyVol();
      if (this.now() - this._fade.t0 >= XFADE * 1000) this._endFade();
      return;
    }
    const L = this.loopLength;
    if (!L) return;
    const a = this.players[this.cur];
    // 播放位置：自己的时钟 (InnerAudioContext.currentTime 在部分机型上 ~250 ms 才更新一次)；
    // 和 currentTime 偏差太大 (卡顿 / 被系统暂停过) 时以 currentTime 为准
    let pos = (this.now() - this._anchor) / 1000;
    const ct = a.currentTime;
    if (ct > 0 && Math.abs(ct - pos) > 0.4) { pos = ct; this._anchor = this.now() - ct * 1000; }
    if (pos < L - 0.008) return;
    if (!this.players[1]) { this.players[1] = new DyAudio(this.tt); this._wire(this.players[1]); this.players[1].src = this._src; }
    const nxt = 1 - this.cur;
    const b = this.players[nxt];
    try { b.currentTime = 0; } catch (_) { /* ignore */ }
    b.volume = 0;
    b.play();
    this.cur = nxt;
    this._anchor = this.now();
    this._fade = { t0: this.now() };
    this.loops++;
  }

  stop() { this.pause(); }
  load() {}
  canPlayType() { return ''; }
  destroy() { for (const p of this.players) if (p) p.destroy(); this.players = [this.players[0], null]; }

  addEventListener(type, fn, opts) { (this._l[type] = this._l[type] || []).push({ fn, once: !!(opts && opts.once) }); }
  removeEventListener(type, fn) { this._l[type] = (this._l[type] || []).filter((x) => x.fn !== fn); }
  _emit(type) {
    const list = this._l[type] || [];
    this._l[type] = list.filter((x) => !x.once);
    for (const x of list) { try { x.fn({ type, target: this }); } catch (_) { /* ignore */ } }
  }
}
