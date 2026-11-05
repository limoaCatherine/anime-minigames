// 补间动画：对任意对象的数值属性做插值 (卡牌飞行、槽位重排、按钮弹出等)。
export const Ease = {
  linear: (t) => t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  backOut: (t, s = 1.70158) => { const u = t - 1; return u * u * ((s + 1) * u + s) + 1; },
  backIn: (t, s = 1.70158) => t * t * ((s + 1) * t - s),
  bounceOut: (t) => {
    const n = 7.5625; const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d; return n * t * t + 0.984375;
  },
  elasticOut: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

export class Tween {
  constructor(target, to, { duration = 0.3, delay = 0, ease = Ease.cubicOut, onUpdate = null, onComplete = null, arc = 0 } = {}) {
    this.target = target;
    this.to = to;
    this.from = null;
    this.duration = Math.max(0.0001, duration);
    this.delay = delay;
    this.ease = typeof ease === 'string' ? Ease[ease] : ease;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.arc = arc;          // >0 时 y 方向额外抛物线偏移 (飞行弧线)
    this.elapsed = 0;
    this.done = false;
    this.killed = false;
  }

  update(dt) {
    if (this.done) return;
    if (this.delay > 0) { this.delay -= dt; if (this.delay > 0) return; dt = -this.delay; this.delay = 0; }
    if (!this.from) {
      this.from = {};
      for (const k in this.to) this.from[k] = this.target[k];
    }
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.duration);
    const e = this.ease(t);
    for (const k in this.to) this.target[k] = this.from[k] + (this.to[k] - this.from[k]) * e;
    if (this.arc && 'y' in this.to) this.target.y -= Math.sin(Math.PI * t) * this.arc;
    if (this.onUpdate) this.onUpdate(t);
    if (t >= 1) {
      this.done = true;
      if (this.onComplete) this.onComplete();
    }
  }

  kill() { this.done = true; this.killed = true; }
}

export class TweenManager {
  constructor() { this.tweens = []; }

  /** 创建补间；同一个对象上已有的补间会被替换 (除非 options.keep=true) */
  to(target, props, options = {}) {
    if (!options.keep) this.killOf(target);
    const tw = new Tween(target, props, options);
    this.tweens.push(tw);
    return tw;
  }

  killOf(target) {
    for (const t of this.tweens) if (t.target === target) t.kill();
  }

  isTweening(target) {
    return this.tweens.some((t) => t.target === target && !t.done);
  }

  update(dt) {
    // 先复制，避免回调里新增的补间在本帧被跳过/重复
    const list = this.tweens.slice();
    for (const t of list) t.update(dt);
    this.tweens = this.tweens.filter((t) => !t.done);
  }

  clear() { this.tweens = []; }
  get count() { return this.tweens.length; }
}
