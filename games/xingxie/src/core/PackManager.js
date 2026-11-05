// 分包管理 (抖音小游戏)：主菜单出现后在后台依次下载 立绘 → 背景音乐 → 语音 分包，带总进度；
// 没下载完也能直接开玩 (立绘先不显示 / 不放 BGM / 语音只出字幕)。网页版没有分包，一开始就是 done。
// 每个分包下载好后发 pack:ready { name, ok }；立绘分包好了再把半身卡图片读进 AssetLoader。
import { DouyinConfig } from '../config/PlatformConfig.js';
import { IMAGES } from '../config/AssetConfig.js';
import { platform } from './platform/index.js';

export class PackManager {
  constructor(game) {
    this.game = game;
    this.list = platform.packs ? platform.packs.slice() : [];
    this.state = {};            // name -> 'wait' | 'loading' | 'ready' | 'failed'
    this.part = {};             // name -> 0..1
    this.list.forEach((p) => { this.state[p.name] = 'wait'; this.part[p.name] = 0; });
    this.started = false;
    this.retryIn = -1;
    this.retried = {};
  }

  get done() { return this.list.every((p) => this.state[p.name] === 'ready' || (this.state[p.name] === 'failed' && this.retried[p.name])); }
  get loading() { return this.started && !this.done; }
  get progress() {
    if (!this.list.length) return 1;
    const total = this.list.reduce((a, p) => a + p.weight, 0);
    return this.list.reduce((a, p) => a + p.weight * (this.state[p.name] === 'ready' ? 1 : this.part[p.name]), 0) / total;
  }
  get label() {
    const cur = this.list.find((p) => this.state[p.name] === 'loading');
    return cur ? { art: '立绘', bgm: '音乐', voice: '语音' }[cur.name] || cur.name : '';
  }

  /** 主包里的图片 (启动时就读)；分包里的 (半身卡) 等分包好了再读 */
  static mainImages() { return IMAGES.filter((i) => platform.srcReady(i.src) || !platform.packFor(i.src)); }

  start() {
    if (this.started || !this.list.length) return;
    this.started = true;
    this._next();
  }

  _next() {
    const p = this.list.find((x) => this.state[x.name] === 'wait');
    if (!p) return;
    this.state[p.name] = 'loading';
    platform.loadPack(p.name, (v) => { this.part[p.name] = v; }).then((ok) => {
      this.state[p.name] = ok ? 'ready' : 'failed';
      if (ok) this.part[p.name] = 1;
      this._onReady(p, ok);
      this._next();
    });
  }

  _onReady(p, ok) {
    if (ok && p.name === 'art') {
      const imgs = IMAGES.filter((i) => platform.packFor(i.src) && platform.packFor(i.src).name === 'art');
      this.game.assets.loadImages(imgs).then(() => this.game.events.emit('pack:images', { name: p.name }));
    }
    if (!ok && !this.retried[p.name]) this.retryIn = DouyinConfig.packRetryDelay;
    this.game.events.emit('pack:ready', { name: p.name, ok });
  }

  update(dt) {
    if (this.retryIn < 0) return;
    this.retryIn -= dt;
    if (this.retryIn > 0) return;
    this.retryIn = -1;
    for (const p of this.list) {
      if (this.state[p.name] === 'failed' && !this.retried[p.name]) { this.retried[p.name] = true; this.state[p.name] = 'wait'; }
    }
    if (!this.list.some((p) => this.state[p.name] === 'loading')) this._next();
  }
}
