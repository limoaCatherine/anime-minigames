// 把 tt.createInnerAudioContext() 包装成 HTMLAudioElement 的常用子集，
// 让 BgmSystem / VoiceSystem 在网页和抖音上走同一套代码。
export class DyAudio {
  constructor(tt) {
    const a = tt.createInnerAudioContext();
    this.ctx = a;
    this.paused = true;
    this.ended = false;
    this.error = null;
    this.onended = null;
    this.preload = 'auto';
    this._src = '';
    this._vol = 1;
    this._loop = false;
    this._l = {};
    if ('obeyMuteSwitch' in a) a.obeyMuteSwitch = false;
    a.onCanplay(() => { this._emit('canplaythrough'); this._emit('loadeddata'); });
    a.onError((e) => { this.error = { code: e && e.errCode, message: e && e.errMsg }; this.paused = true; this._emit('error'); });
    a.onEnded(() => { this.paused = true; this.ended = true; if (this.onended) this.onended(); this._emit('ended'); });
    a.onPlay(() => { this.paused = false; });
    a.onPause(() => { this.paused = true; });
    a.onStop(() => { this.paused = true; });
  }

  get src() { return this._src; }
  set src(v) { this._src = v; this.ended = false; this.ctx.src = v; }
  get loop() { return this._loop; }
  set loop(v) { this._loop = !!v; this.ctx.loop = !!v; }
  get volume() { return this._vol; }
  set volume(v) { this._vol = Math.max(0, Math.min(1, v)); this.ctx.volume = this._vol; }
  get currentTime() { return this.ctx.currentTime || 0; }
  set currentTime(t) { try { this.ctx.seek(t); } catch (_) { /* 未加载完成时 seek 可能失败，忽略 */ } }
  get duration() { return this.ctx.duration || 0; }

  play() {
    this.paused = false;
    this.ended = false;
    try { this.ctx.play(); } catch (err) { this.paused = true; return Promise.reject(err); }
    return Promise.resolve();
  }
  pause() { this.paused = true; try { this.ctx.pause(); } catch (_) { /* ignore */ } }
  stop() { this.paused = true; try { this.ctx.stop(); } catch (_) { /* ignore */ } }
  load() { /* InnerAudioContext 设置 src 后自动预加载 */ }
  canPlayType() { return ''; }
  destroy() { try { this.ctx.destroy(); } catch (_) { /* ignore */ } }

  addEventListener(type, fn, opts) {
    (this._l[type] = this._l[type] || []).push({ fn, once: !!(opts && opts.once) });
  }
  removeEventListener(type, fn) { this._l[type] = (this._l[type] || []).filter((x) => x.fn !== fn); }
  _emit(type) {
    const list = this._l[type] || [];
    this._l[type] = list.filter((x) => !x.once);
    for (const x of list) { try { x.fn({ type, target: this }); } catch (_) { /* ignore */ } }
  }
}
