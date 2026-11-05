// 输入系统：统一鼠标 / 触摸 (网页 Pointer Events，抖音 tt.onTouch*) 与键盘，转换为逻辑坐标后通过事件总线派发。
// 只跟踪一根手指；切后台 / 失焦时强制松手，避免摇杆卡住、之后的触摸全被忽略。
import { platform } from '../core/platform/index.js';

export class InputSystem {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.pointer = { x: game.width / 2, y: game.height / 2, down: false };
    this.activePointerId = null;

    platform.bindPointer({
      down: (id, cx, cy, type, capture) => this._down(id, cx, cy, type, capture),
      move: (id, cx, cy, type) => this._move(id, cx, cy, type),
      up: (id, cx, cy, type) => this._up(id, cx, cy, type),
      cancel: () => this.release(),
    });
    game.events.on('app:hidden', () => this.release());
    platform.onKeyDown((e) => {
      if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) return;
      game.events.emit('input:key', e);
    });
  }

  toLogical(cx, cy, type) {
    const p = platform.toLogical(cx, cy, this.game);
    return { x: p.x, y: p.y, type };
  }

  _down(id, cx, cy, type, capture) {
    if (this.activePointerId !== null && this.activePointerId !== id) return; // 只处理单指
    this.activePointerId = id;
    if (capture) capture();
    const p = this.toLogical(cx, cy, type);
    Object.assign(this.pointer, p, { down: true });
    this.game.events.emit('input:down', p);
  }

  _move(id, cx, cy, type) {
    if (this.activePointerId !== null && this.activePointerId !== id) return;
    const p = this.toLogical(cx, cy, type);
    Object.assign(this.pointer, p);
    this.game.events.emit('input:move', p);
  }

  release() {
    if (this.activePointerId === null) return;
    this.activePointerId = null;
    this.pointer.down = false;
    this.game.events.emit('input:up', { x: this.pointer.x, y: this.pointer.y, type: 'cancel' });
  }

  _up(id, cx, cy, type) {
    if (this.activePointerId !== id) return;
    this.activePointerId = null;
    const p = this.toLogical(cx, cy, type);
    Object.assign(this.pointer, p, { down: false });
    this.game.events.emit('input:up', p);
  }
}
