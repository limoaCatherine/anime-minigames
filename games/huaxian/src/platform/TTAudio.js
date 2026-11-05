// 抖音 InnerAudioContext 的 HTMLAudioElement 外观：让 VoiceSystem / BgmSystem / SfxSampler 不用关心平台。
// 只实现游戏用到的子集：src / loop / volume / currentTime / paused / ended / duration / error / preload / readyState
// play() -> Promise / pause() / load() / canPlayType() / addEventListener(canplaythrough|loadeddata|error|ended|play|pause) / onended
export class TTAudio {
  constructor(tt) {
    this._tt = tt;
    this._ctx = null;
    this._src = '';
    this._loop = false;
    this._vol = 1;
    this._ls = {};
    this.preload = 'auto';
    this.paused = true;
    this.ended = false;
    this.error = null;
    this.readyState = 0;
    this.onended = null;
  }

  _emit(name, arg) {
    const list = this._ls[name];
    if (!list) return;
    this._ls[name] = list.filter((l) => !l.once);
    for (const l of list) { try { l.fn.call(this, arg); } catch (err) { console.warn('[TTAudio]', err); } }
  }

  _ensure() {
    if (this._ctx) return this._ctx;
    const c = this._tt.createInnerAudioContext();
    c.autoplay = false;
    c.loop = this._loop;
    c.volume = this._vol;
    c.onCanplay(() => { if (this.readyState < 4) { this.readyState = 4; this._emit('loadeddata'); this._emit('canplaythrough'); } });
    c.onPlay(() => { this.paused = false; this.ended = false; this._emit('play'); });
    c.onPause(() => { this.paused = true; this._emit('pause'); });
    c.onStop(() => { this.paused = true; });
    c.onEnded(() => {
      this.paused = true; this.ended = true;
      this._emit('ended');
      if (typeof this.onended === 'function') this.onended();
    });
    c.onError((e) => {
      this.error = { code: (e && e.errCode) || 4, message: (e && e.errMsg) || 'error' };
      this.paused = true;
      this._emit('error', e);
    });
    this._ctx = c;
    return c;
  }

  get src() { return this._src; }
  set src(v) {
    this._src = v;
    this.ended = false;
    this.error = null;
    this.readyState = 0;
    this._ensure().src = v;
  }

  get loop() { return this._loop; }
  set loop(v) { this._loop = !!v; if (this._ctx) this._ctx.loop = this._loop; }

  get volume() { return this._vol; }
  set volume(v) { this._vol = Math.max(0, Math.min(1, Number(v) || 0)); if (this._ctx) this._ctx.volume = this._vol; }

  get currentTime() { return this._ctx ? this._ctx.currentTime || 0 : 0; }
  set currentTime(t) {
    if (!this._ctx) return;
    try { this._ctx.seek(Math.max(0, t)); } catch (_) { /* ignore */ }
  }

  get duration() { return this._ctx && this._ctx.duration ? this._ctx.duration : NaN; }

  play() {
    const c = this._ensure();
    this.paused = false;
    this.ended = false;
    try { c.play(); } catch (err) { this.paused = true; return Promise.reject(err); }
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    if (this._ctx) { try { this._ctx.pause(); } catch (_) { /* ignore */ } }
  }

  load() { this._ensure(); }

  /** 抖音 iOS 不支持 ogg：统一走 mp3 / wav / aac */
  canPlayType(type) { return /mpeg|mp3|wav|aac|mp4|m4a/i.test(type || '') ? 'probably' : ''; }

  addEventListener(name, fn, opts) {
    (this._ls[name] || (this._ls[name] = [])).push({ fn, once: !!(opts && opts.once) });
  }

  removeEventListener(name, fn) {
    if (this._ls[name]) this._ls[name] = this._ls[name].filter((l) => l.fn !== fn);
  }

  destroy() { if (this._ctx) { try { this._ctx.destroy(); } catch (_) { /* ignore */ } this._ctx = null; } }
}

/**
 * 无缝循环的背景音乐 (抖音)：InnerAudioContext 的 loop=true 依赖播放器，mp3 编码器在文件首尾补的静音
 * (LAME 前 1105 / 后约 940 个采样，约 46 ms) 大多数播放器不会去掉，接缝处会有一小段空白；而且循环重新开始本身也可能有延迟。
 * 所以构建时把音乐做成「完整一遍 + 开头 tail 秒」(tools/build-douyin.mjs)，这里用两个 InnerAudioContext 交替：
 * 当前这个播到 loopLength 时，另一个从 0 开始播放；两者此后播放的是同一段音乐，再用线性 (等增益) 交叉淡化切过去。
 * 需要每帧调用 tick(dt) (BgmSystem.update)。对外仍是 HTMLAudio 的外观。
 */
export class TTLoopAudio {
  constructor(tt, { loopLength, tail = 1.5, fade = 0.3, delay = 0.12 } = {}) {
    this.L = loopLength;
    this.tail = tail;
    this.fadeTime = fade;
    this.fadeDelay = delay;           // 新的一路开始后等一小会儿再淡化 (跳过它开头的编码器静音 / 播放启动延迟)
    this.a = new TTAudio(tt);
    this.b = new TTAudio(tt);
    this.cur = this.a;
    this.next = this.b;
    this._vol = 1;
    this.loop = true;
    this.preload = 'auto';
    this.paused = true;
    this.ended = false;
    this.fading = null;
    this.loops = 0;                   // 已经循环的次数 (测试)
    this._ls = {};
    const onEnded = (who) => () => {
      // 兜底：帧循环停住 (卡顿) 导致没来得及切换，当前这一路播完了 -> 立刻接上另一路
      if (this.paused || who !== this.cur || this.fading) return;
      this._swap(true);
    };
    this.a.addEventListener('ended', onEnded(this.a));
    this.b.addEventListener('ended', onEnded(this.b));
    this.a.addEventListener('error', (e) => this._emit('error', e));
  }

  _emit(name, arg) { for (const fn of this._ls[name] || []) { try { fn.call(this, arg); } catch (_) { /* ignore */ } } }
  addEventListener(name, fn) { (this._ls[name] || (this._ls[name] = [])).push(fn); }
  removeEventListener(name, fn) { if (this._ls[name]) this._ls[name] = this._ls[name].filter((f) => f !== fn); }

  get error() { return this.a.error; }
  get src() { return this.a.src; }
  set src(v) { this.a.src = v; this.b.src = v; }
  get volume() { return this._vol; }
  set volume(v) { this._vol = Math.max(0, Math.min(1, Number(v) || 0)); this._apply(); }
  get duration() { return this.L; }
  get currentTime() { return Math.max(0, this.cur.currentTime) % this.L; }
  set currentTime(t) { this.cur.currentTime = t; }
  canPlayType(type) { return this.a.canPlayType(type); }
  load() { this.a.load(); this.b.load(); }

  _apply() {
    const f = this.fading;
    if (!f) { this.cur.volume = this._vol; return; }
    const k = Math.max(0, Math.min(1, (f.t - this.fadeDelay) / this.fadeTime));
    f.to.volume = this._vol * k;
    f.from.volume = this._vol * (1 - k);
  }

  play() {
    this.paused = false;
    if (this.fading) { this.fading.from.play(); }
    this._apply();
    return this.cur.play();
  }

  pause() {
    this.paused = true;
    this.a.pause();
    this.b.pause();
    if (this.fading) this._finishFade();
  }

  _swap(immediate = false) {
    const from = this.cur; const to = this.next;
    to.currentTime = 0;
    to.volume = immediate ? this._vol : 0;
    const p = to.play();
    if (p && p.catch) p.catch(() => {});
    this.cur = to; this.next = from;
    this.loops++;
    if (immediate) { from.pause(); from.currentTime = 0; this.fading = null; this._apply(); return; }
    this.fading = { from, to, t: 0 };
    this._apply();
  }

  _finishFade() {
    const f = this.fading;
    this.fading = null;
    f.from.pause();
    f.from.currentTime = 0;
    this._apply();
  }

  tick(dt) {
    if (this.paused) return;
    if (this.fading) {
      this.fading.t += dt;
      this._apply();
      if (this.fading.t >= this.fadeDelay + this.fadeTime) this._finishFade();
      return;
    }
    if (this.cur.currentTime >= this.L) this._swap();
  }

  destroy() { this.a.destroy(); this.b.destroy(); }
}
