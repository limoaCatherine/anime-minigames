// 可复现的伪随机数 (mulberry32)。关卡模拟只用它，不用 Math.random，
// 这样同一条线 + 同一种子 => 完全相同的结果，便于自动化验证关卡可解。
export class Random {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
  }

  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) { return a + (b - a) * this.next(); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}
