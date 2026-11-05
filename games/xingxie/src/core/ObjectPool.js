// 通用对象池：活跃对象存放在紧凑数组里，回收时用末尾元素填补空位 (O(1) 删除)。
// 战斗中不 new 对象：敌人 / 子弹 / 宝石 / 粒子 / 伤害数字都从池里取。
export class ObjectPool {
  /** @param {{create:()=>object, reset?:(o:object)=>void, prewarm?:number, max?:number}} opts */
  constructor({ create, reset = null, prewarm = 0, max = Infinity }) {
    this.create = create;
    this.reset = reset;
    this.max = max;
    this.free = [];
    this.active = [];
    this.prewarm(prewarm);
  }

  prewarm(n) {
    for (let i = this.free.length; i < n; i++) {
      const o = this.create();
      o._pooled = true;
      o._idx = -1;
      this.free.push(o);
    }
  }

  /** 取一个对象；超过上限返回 null (调用方自行降级) */
  get() {
    if (this.active.length >= this.max) return null;
    const o = this.free.length ? this.free.pop() : this.create();
    o._pooled = false;
    o._idx = this.active.length;
    if (this.reset) this.reset(o);
    this.active.push(o);
    return o;
  }

  release(o) {
    if (o._pooled) return;
    const i = o._idx;
    const last = this.active.pop();
    if (last !== o) { this.active[i] = last; last._idx = i; }
    o._pooled = true;
    o._idx = -1;
    this.free.push(o);
  }

  releaseAll() {
    for (let i = this.active.length - 1; i >= 0; i--) this.release(this.active[i]);
  }

  get activeCount() { return this.active.length; }
}
