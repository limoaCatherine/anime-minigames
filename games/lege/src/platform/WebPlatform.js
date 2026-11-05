// 网页 / Electron 平台：行为与 v3.1 完全一致 (DOM Canvas、<img>、HTMLAudioElement、localStorage、Pointer Events)。
// 抖音专属能力 (录屏、视频分享、侧边栏) 在这里都是"不支持"，界面会自动隐藏对应按钮。
export class WebPlatform {
  constructor() {
    this.name = 'web';
    this.isDouyin = false;
    this.isMiniGame = false;
    this.sfxMode = 'synth';          // 音效用 WebAudio 实时合成
    this.sharedVoicePlayer = false;  // 每句语音一个 <audio>
    this.capabilities = { share: false, record: false, sidebar: false, rewardedAd: false };
  }

  getMainCanvas() { return document.getElementById('game'); }

  createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  createImage() { const img = new Image(); img.decoding = 'async'; return img; }

  /** 返回 HTMLAudioElement (无 Audio 时返回 null) */
  createAudio() { return typeof Audio !== 'undefined' ? new Audio() : null; }

  /** BGM 优先 ogg (无缝)，不支持时 mp3 */
  audioExt() {
    if (typeof Audio === 'undefined') return '.mp3';
    const probe = new Audio();
    return probe.canPlayType('audio/ogg; codecs="vorbis"') ? '.ogg' : '.mp3';
  }

  // 存储 (异常交给 SaveSystem 处理 → 退化为内存存档)
  storageGet(key) { return window.localStorage.getItem(key); }
  storageSet(key, value) { window.localStorage.setItem(key, value); }

  now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  raf(fn) { return requestAnimationFrame(fn); }

  /** 窗口尺寸 (CSS 像素) 与安全区 */
  viewport() {
    return { width: window.innerWidth || 540, height: window.innerHeight || 960, dpr: window.devicePixelRatio || 1, insetTop: 0, insetBottom: 0 };
  }

  /** 网页：CSS 把画布缩放到 9:16 居中，画布内容无偏移 */
  layout(canvas, logicalW, logicalH) {
    const v = this.viewport();
    const scale = Math.min(v.width / logicalW, v.height / logicalH);
    const cssW = Math.floor(logicalW * scale);
    const cssH = Math.floor(logicalH * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const dpr = Math.min(v.dpr, 2.5);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    return { pixelScale: canvas.width / logicalW, offsetX: 0, offsetY: 0, cssScale: scale, cssOffsetX: 0, cssOffsetY: 0 };
  }

  onResize(fn) {
    window.addEventListener('resize', fn);
    window.addEventListener('orientationchange', fn);
  }

  onVisibility(fn) {
    document.addEventListener('visibilitychange', () => fn(!document.hidden));
  }

  /** 网页输入由 InputSystem 直接绑定 Pointer Events (保留 v3 行为) */
  bindTouch() { return false; }

  loadSubpackage() { return Promise.resolve(true); }

  // 抖音专属能力的空实现
  /** 网页 / 桌面版：占位广告 (AdService 画「广告占位」倒计时) */
  get adMode() { return 'placeholder'; }
  showRewardedAd() { return null; }        // null = 本平台没有真实广告 → AdService 使用占位广告
  share() { return Promise.resolve(false); }
  startRecord() { return false; }
  stopRecord() { return Promise.resolve(null); }
  shareVideo() { return Promise.resolve(false); }
  checkSidebar() { return Promise.resolve(false); }
  launchedFromSidebar() { return false; }
  navigateToSidebar() { return Promise.resolve(false); }
  onShow() {}
  vibrate() {}
  toast() {}
}
