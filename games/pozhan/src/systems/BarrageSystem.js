// 弹幕系统：找到破绽 / 点错 / 结局时，从右往左飘过的吐槽弹幕 (番剧观看感)。
// 弹幕只在场景视口上方的几条轨道里飘，不遮挡底栏与字幕。
import { GameConfig } from '../config/GameConfig.js';
import { BARRAGE_COLORS } from '../config/BarrageConfig.js';

export class BarrageSystem {
  constructor(events) {
    this.events = events;
    this.items = [];
    this.lanes = [0, 0, 0, 0, 0];       // 每条轨道最后一条弹幕的右端 x
    this.top = GameConfig.layout.scene.y + 14;
    this.laneH = 30;
    this.history = [];
  }

  clear() { this.items = []; this.lanes.fill(0); }

  /** @param {string} text  @param {{big?:boolean, color?:string, self?:boolean}} o */
  add(text, o = {}) {
    if (!text) return;
    if (this.crowdOn === false && !o.self) return;   // 暂停菜单里关掉「围观弹幕」后只保留自己的吐槽
    // 路人弹幕不刷屏：最近出现过的同一句直接跳过 (玩家自己的吐槽 self 除外)
    if (!o.self && this.history.slice(-10).includes(text)) return;
    const W = GameConfig.width;
    const size = o.big ? 22 : 17;
    const w = text.length * size * 0.98 + 20;
    // 选最空的轨道
    let lane = 0; let best = Infinity;
    for (let i = 0; i < this.lanes.length; i++) {
      const tail = this.lanes[i];
      if (tail < best) { best = tail; lane = i; }
    }
    const x = Math.max(W + 10, best + 24);
    const speed = (o.big ? 150 : 120) + Math.random() * 40;
    const item = { text, x, y: this.top + lane * this.laneH, w, size, speed, color: o.color || BARRAGE_COLORS[Math.floor(Math.random() * BARRAGE_COLORS.length)], self: !!o.self, lane };
    this.items.push(item);
    this.lanes[lane] = x + w;
    this.history.push(text);
    if (this.history.length > 50) this.history.shift();
    this.events.emit('barrage', { text });
  }

  update(dt) {
    for (const b of this.items) b.x -= b.speed * dt;
    this.items = this.items.filter((b) => b.x + b.w > -20);
    for (let i = 0; i < this.lanes.length; i++) this.lanes[i] = Math.max(0, this.lanes[i] - 130 * dt);
  }

  render(ctx) {
    ctx.save();
    ctx.textBaseline = 'middle';
    for (const b of this.items) {
      ctx.font = `bold ${b.size}px ${GameConfig.fontFamily}`;
      if (b.self) {
        // 玩家自己的吐槽：带边框 (像发出的弹幕)
        const w = ctx.measureText(b.text).width + 14;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x - 7, b.y - b.size * 0.7, w, b.size * 1.4);
      }
      ctx.globalAlpha = b.self ? 1 : 0.82;   // 路人弹幕半透明，不完全挡住下面的破绽
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(40,20,50,0.75)';
      ctx.strokeText(b.text, b.x, b.y);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, b.x, b.y);
    }
    ctx.restore();
  }
}
