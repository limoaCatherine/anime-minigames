// 浏览器平台：DOM 画布 / Image / HTMLAudioElement / WebAudio / localStorage / Pointer Events / 键盘。
// 构造时不访问 DOM (Node 里的无头测试也会 import 存档系统 -> 平台模块)。
import { Platform } from './Platform.js';

const hasWindow = () => typeof window !== 'undefined';

export class WebPlatform extends Platform {
  constructor(name = 'web') {
    super(name);
    this.features = { keyboard: true, share: false, recorder: false, sidebar: false, autoplay: false };
  }

  createMainCanvas() { return document.getElementById('game'); }

  createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  createImage() {
    const img = new Image();
    img.decoding = 'async';
    return img;
  }

  createAudio() { return typeof Audio === 'undefined' ? null : new Audio(); }

  createAudioContext() {
    if (!hasWindow()) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  }

  get speech() { return hasWindow() && window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined' ? window.speechSynthesis : null; }

  createUtterance(text) { return new window.SpeechSynthesisUtterance(text); }

  get storage() {
    try { return hasWindow() ? window.localStorage : null; } catch (_) { return null; }
  }

  now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  raf(cb) { return requestAnimationFrame(cb); }

  viewport() {
    const w = window.innerWidth; const h = window.innerHeight;
    return { width: w, height: h, dpr: Math.min(window.devicePixelRatio || 1, 2.5), safeArea: { left: 0, top: 0, right: w, bottom: h }, fullscreen: false };
  }

  /** 网页：画布本身按 9:16 等比缩放 (CSS 尺寸)，由页面样式居中 */
  layout(canvas, view) {
    canvas.style.width = `${view.cssW}px`;
    canvas.style.height = `${view.cssH}px`;
  }

  canvasRect(canvas) { return canvas.getBoundingClientRect(); }

  isHidden() { return typeof document !== 'undefined' && !!document.hidden; }

  onResize(cb) {
    window.addEventListener('resize', cb);
    window.addEventListener('orientationchange', cb);
  }

  onVisibility(cb) { document.addEventListener('visibilitychange', () => cb(document.hidden)); }

  bindInput(canvas, h) {
    const ev = (e) => ({ id: e.pointerId, clientX: e.clientX, clientY: e.clientY, type: e.pointerType });
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (h.down(ev(e))) { try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
    });
    canvas.addEventListener('pointermove', (e) => h.move(ev(e)));
    window.addEventListener('pointerup', (e) => h.up(ev(e)));
    window.addEventListener('pointercancel', (e) => h.up(ev(e)));
    // 1.2：指针捕获丢失 / 窗口失去焦点 (Alt+Tab、系统弹窗) 时 pointerup 可能永远不会来
    canvas.addEventListener('lostpointercapture', (e) => h.up(ev(e)));
    window.addEventListener('blur', () => h.cancel());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) return;
      h.key(e);
    });
  }
}

/** 桌面版 (Electron)：与网页相同，只是允许无手势自动播放 */
export class ElectronPlatform extends WebPlatform {
  constructor() {
    super('electron');
    this.features.autoplay = true;
  }
}

export function detectWebPlatform() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /Electron\//.test(ua) ? new ElectronPlatform() : new WebPlatform();
}
