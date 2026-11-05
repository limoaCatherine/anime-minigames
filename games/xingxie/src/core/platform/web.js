// 网页 / Electron 平台实现：DOM canvas + Pointer Events + localStorage + HTMLAudio + visibilitychange。
// 不提供录屏 / 分享 / 侧边栏 / 分包 (对应接口返回 null 或 false，调用方据此隐藏按钮)。
const hasWin = () => typeof window !== 'undefined';
const hasDoc = () => typeof document !== 'undefined';

export class WebPlatform {
  constructor() {
    this.name = 'web';
    this.isTT = false;
    this.isMiniGame = false;
    this.canvas = null;
  }

  // —— 画布 / 图片 ——
  getMainCanvas() {
    if (!this.canvas && hasDoc()) this.canvas = document.getElementById('game');
    return this.canvas;
  }
  createCanvas(w = 1, h = 1) {
    if (!hasDoc()) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  createImage() { return new Image(); }

  /** 按窗口大小 (去掉安全区 padding) 等比缩放逻辑分辨率；网页版画布本身就是游戏区域，偏移为 0 */
  layout(lw, lh) {
    const canvas = this.getMainCanvas();
    let padX = 0; let padY = 0;
    try {
      const cs = getComputedStyle(document.body);
      padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    } catch (_) { /* ignore */ }
    const vw = Math.max(1, ((hasWin() && window.innerWidth) || lw) - padX);
    const vh = Math.max(1, ((hasWin() && window.innerHeight) || lh) - padY);
    const scale = Math.min(vw / lw, vh / lh);
    const cssW = Math.floor(lw * scale);
    const cssH = Math.floor(lh * scale);
    const dpr = Math.min((hasWin() && window.devicePixelRatio) || 1, 2);
    if (canvas) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
    }
    const w = canvas ? canvas.width : lw;
    const h = canvas ? canvas.height : lh;
    return { canvasW: w, canvasH: h, scale: w / lw, offX: 0, offY: 0 };
  }

  /** 客户端坐标 → 逻辑坐标 */
  toLogical(clientX, clientY, game) {
    const r = this.getMainCanvas().getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * game.width, y: ((clientY - r.top) / r.height) * game.height };
  }

  onResize(cb) {
    if (!hasWin()) return;
    window.addEventListener('resize', cb);
    window.addEventListener('orientationchange', cb);
  }

  // —— 输入：单指 Pointer ——
  bindPointer(h) {
    const c = this.getMainCanvas();
    if (!c) return;
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); h.down(e.pointerId, e.clientX, e.clientY, e.pointerType, () => { try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }); });
    c.addEventListener('pointermove', (e) => h.move(e.pointerId, e.clientX, e.clientY, e.pointerType));
    window.addEventListener('pointerup', (e) => h.up(e.pointerId, e.clientX, e.clientY, e.pointerType));
    window.addEventListener('pointercancel', (e) => h.up(e.pointerId, e.clientX, e.clientY, e.pointerType));
    c.addEventListener('lostpointercapture', (e) => h.up(e.pointerId, e.clientX, e.clientY, e.pointerType));
    window.addEventListener('blur', () => h.cancel());
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  onKeyDown(cb) {
    if (!hasWin()) return;
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      cb(e);
    });
  }
  onKeyUp(cb) { if (hasWin()) window.addEventListener('keyup', cb); }
  onBlur(cb) { if (hasWin()) window.addEventListener('blur', cb); }

  // —— 生命周期 ——
  get hidden() { return hasDoc() && !!document.hidden; }
  onShow(cb) { if (hasDoc()) document.addEventListener('visibilitychange', () => { if (!document.hidden) cb({}); }); }
  onHide(cb) { if (hasDoc()) document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); }); }

  // —— 时间 / 帧 ——
  now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  raf(cb) { return (hasWin() && window.requestAnimationFrame) ? window.requestAnimationFrame(cb) : setTimeout(() => cb(this.now()), 16); }
  query(name) { try { return new RegExp(`[?&]${name}\\b`).test(location.search); } catch (_) { return false; } }

  // —— 存储 ——
  storageGet(key) { if (!hasWin() || !window.localStorage) throw new Error('no storage'); return window.localStorage.getItem(key); }
  storageSet(key, value) { if (!hasWin() || !window.localStorage) throw new Error('no storage'); window.localStorage.setItem(key, value); }
  get storageAvailable() { try { return hasWin() && !!window.localStorage; } catch (_) { return false; } }

  // —— 音频 ——
  /** HTMLAudioElement；tt 版返回同样接口的包装 */
  createAudio() { return typeof Audio !== 'undefined' ? new Audio() : null; }
  get audioContextClass() { return hasWin() ? (window.AudioContext || window.webkitAudioContext || null) : null; }
  get speech() { return hasWin() && window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined' ? window.speechSynthesis : null; }
  resolve(src) { return src; }

  // —— 平台能力 (网页版没有) ——
  get rewardedAdApi() { return null; }
  get recorder() { return null; }
  get canShareVideo() { return false; }
  shareVideo() { return Promise.resolve(false); }
  get packs() { return null; }
  loadPack(name, onProgress) { if (onProgress) onProgress(1); return Promise.resolve(true); }
  packReady() { return true; }
  srcReady() { return true; }
  packFor() { return null; }
  checkSidebar() { return Promise.resolve(false); }
  get launchedFromSidebar() { return false; }
  navigateToSidebar() { return Promise.resolve(false); }
  toast() {}
  vibrate() {}
}
