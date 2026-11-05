// 输入系统：平台层把鼠标 / 触摸 (网页 Pointer Events、抖音 tt.onTouchStart/Move/End) 统一成
// {id, clientX, clientY}，这里换算成逻辑坐标后通过事件总线派发 input:down / move / up / key。
export class InputSystem {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.pointer = { x: game.width / 2, y: game.height / 2, down: false };
    this.activePointerId = null;
    game.platform.bindInput(this.canvas, {
      down: (e) => this._down(e),
      move: (e) => this._move(e),
      up: (e) => this._up(e),
      // 1.2：指针捕获丢失 / 窗口失去焦点 / 抖音 onTouchCancel 时 up 可能永远不会来，
      // 以前 activePointerId 会一直占着，之后所有点击都被当成「第二根手指」忽略 -> 无法再画线 / 点按钮
      cancel: () => this.release(),
      key: (e) => game.events.emit('input:key', e),
    });
  }

  toLogical(e) {
    const p = this.game.toLogical(e.clientX, e.clientY);
    p.type = e.type;
    return p;
  }

  /** @returns {boolean} 是否接受了这根手指 (网页据此 setPointerCapture) */
  _down(e) {
    if (this.activePointerId !== null && this.activePointerId !== e.id) return false; // 只处理单指
    this.activePointerId = e.id;
    const p = this.toLogical(e);
    Object.assign(this.pointer, p, { down: true });
    this.game.events.emit('input:down', p);
    return true;
  }

  _move(e) {
    if (this.activePointerId !== null && this.activePointerId !== e.id) return;
    const p = this.toLogical(e);
    Object.assign(this.pointer, p);
    this.game.events.emit('input:move', p);
  }

  /** 强制结束当前按下的指针 (用最后已知位置发 input:up) */
  release() {
    if (this.activePointerId === null) return;
    this.activePointerId = null;
    this.pointer.down = false;
    this.game.events.emit('input:up', { x: this.pointer.x, y: this.pointer.y, type: this.pointer.type, cancelled: true });
  }

  _up(e) {
    if (this.activePointerId !== e.id) return;
    this.activePointerId = null;
    const p = this.toLogical(e);
    Object.assign(this.pointer, p, { down: false });
    this.game.events.emit('input:up', p);
  }
}
