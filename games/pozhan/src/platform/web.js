// 浏览器 / Electron 平台实现 (v1.1 及以前的行为原样搬到这里)。
const hasWindow = typeof window !== 'undefined';

export const WebPlatform = {
  name: 'web',
  features: { record: false, share: false, sidebar: false, keyboard: true, wheel: true },
  singleVoicePlayer: false,
  sfxMode: 'webaudio',

  getMainCanvas() { return document.getElementById('game'); },
  createCanvas(w = 1, h = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  createImage() { const img = new Image(); img.decoding = 'async'; return img; },
  createAudio() { return new Audio(); },
  createAudioContext() { const AC = window.AudioContext || window.webkitAudioContext; return AC ? new AC() : null; },
  assetPath(p) { return p; },
  prepare() { return Promise.resolve(); },
  audioReady() { return Promise.resolve(); },

  now() { return performance.now(); },
  raf(cb) { return requestAnimationFrame(cb); },
  query() {
    if (!hasWindow || !window.location) return {};
    const q = new URLSearchParams(window.location.search); const o = {};
    for (const [k, v] of q) o[k] = v;
    return o;
  },

  storageGet(key) { return window.localStorage.getItem(key); },
  storageSet(key, value) { window.localStorage.setItem(key, value); },

  /** 等比缩放到窗口 (9:16)，CSS 居中；返回 {scale, ox, oy}：逻辑坐标 → 画布像素 */
  layoutCanvas(canvas, W, H) {
    const vw = window.innerWidth || W; const vh = window.innerHeight || H;
    const s = Math.min(vw / W, vh / H);
    const cssW = Math.floor(W * s); const cssH = Math.floor(H * s);
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    return { scale: canvas.width / W, ox: 0, oy: 0, fullW: canvas.width, fullH: canvas.height, letterbox: false };
  },
  onResize(cb) { window.addEventListener('resize', cb); window.addEventListener('orientationchange', cb); },
  onHide(cb) { document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); }); },
  onShow(cb) { document.addEventListener('visibilitychange', () => { if (!document.hidden) cb({}); }); },

  /** 客户端坐标 → 逻辑坐标 */
  toLogical(game, clientX, clientY) {
    const r = game.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * game.width, y: ((clientY - r.top) / r.height) * game.height };
  },

  /** 绑定指针 / 滚轮 / 键盘，统一喂给 InputSystem */
  bindInput(input) {
    const c = input.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      input.pointerDown(e.pointerId, e.clientX, e.clientY, e.pointerType || 'mouse');
    });
    c.addEventListener('pointermove', (e) => input.pointerMove(e.pointerId, e.clientX, e.clientY));
    window.addEventListener('pointerup', (e) => input.pointerUp(e.pointerId, e.clientX, e.clientY, false));
    window.addEventListener('pointercancel', (e) => input.pointerUp(e.pointerId, e.clientX, e.clientY, true));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); input.wheel(e.clientX, e.clientY, e.deltaY); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      input.key(e);
    });
  },

  // —— 商业化 / 社交：网页 / 桌面版没有广告位 → ads.enabled = false，提示与复活走免费规则 (见 GameConfig.ad) ——
  adsAvailable() { return false; },
  rewardedAd: null,
  shareApp: null,
  recorder: null,
  shareVideo: null,
  sidebar: null,
};
