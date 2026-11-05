// 输入系统：统一鼠标 / 触摸 (网页 Pointer Events / 抖音 tt.onTouch*，由 platform 层绑定)、滚轮与键盘，转换为逻辑坐标后通过事件总线派发。
// - 单指：input:down / input:move / input:up (主指针)
// - 双指捏合：input:pinch { scale, cx, cy } (第二根手指按下时开始，主指针的点击会被取消)
// - 滚轮：input:wheel { x, y, dy }
import { Platform } from '../platform/Platform.js';

export class InputSystem {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.pointer = { x: game.width / 2, y: game.height / 2, down: false };
    this.primary = null;
    this.touches = new Map();   // pointerId -> {x, y}
    this.pinchDist = 0;

    Platform.bindInput(this);
  }

  /** 平台层传入的客户端坐标 → 逻辑坐标 */
  toLogical(clientX, clientY, type = 'touch') {
    const p = Platform.toLogical(this.game, clientX, clientY);
    return { x: p.x, y: p.y, type };
  }

  wheel(clientX, clientY, dy) { this.game.events.emit('input:wheel', { ...this.toLogical(clientX, clientY), dy }); }
  key(e) { this.game.events.emit('input:key', e); }

  _dist() {
    const [a, b] = [...this.touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  pointerDown(id, cx, cy, type) {
    const e = { pointerId: id };
    const p = this.toLogical(cx, cy, type);
    this.touches.set(e.pointerId, p);
    if (this.touches.size === 2) {
      // 第二根手指：进入捏合缩放，取消主指针的点击
      this.pinchDist = this._dist();
      if (this.primary !== null) this.game.events.emit('input:cancel', p);
      return;
    }
    if (this.primary !== null) return;
    this.primary = e.pointerId;
    Object.assign(this.pointer, p, { down: true });
    this.game.events.emit('input:down', p);
  }

  pointerMove(id, cx, cy) {
    const e = { pointerId: id };
    const p = this.toLogical(cx, cy);
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, p);
    if (this.touches.size === 2) {
      const d = this._dist();
      if (this.pinchDist > 0 && d > 0) {
        const [a, b] = [...this.touches.values()];
        this.game.events.emit('input:pinch', { scale: d / this.pinchDist, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 });
      }
      this.pinchDist = d;
      return;
    }
    if (this.primary !== null && this.primary !== e.pointerId) return;
    Object.assign(this.pointer, p);
    this.game.events.emit('input:move', p);
  }

  pointerUp(id, cx, cy, cancelled = false) {
    const e = { pointerId: id };
    if (!this.touches.has(id) && this.primary !== id) return;
    const p = this.toLogical(cx, cy);
    const wasPinch = this.touches.size >= 2;
    this.touches.delete(e.pointerId);
    if (this.primary !== e.pointerId) return;
    this.primary = null;
    Object.assign(this.pointer, p, { down: false });
    this.game.events.emit(wasPinch || cancelled ? 'input:cancel' : 'input:up', p);
  }
}
