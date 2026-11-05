// 浏览器里模拟微信小游戏运行环境 (由 tools/douyin-mock/tt-mock.js 改写) (只用于自动化测试 / 截图，不进正式包)。
// 用 DOM 实现 wx.* 的一个子集；所有调用记录在 window.__wxMock.calls，测试脚本可以改 __wxMock.ad / emitShow 等。
(function () {
  const Q = new URLSearchParams(location.search);
  const W = innerWidth; const H = innerHeight;
  const notch = Q.get('notch') !== '0';            // 模拟刘海屏 (顶部 44 / 底部 34 安全区 + 右上角胶囊)
  const safeTop = notch ? 44 : 0; const safeBottom = notch ? 34 : 0;
  const M = window.__wxMock = {
    calls: [], storage: {}, ad: 'ended', adDelay: 300, recSeconds: null,
    touchHandlers: { start: [], move: [], end: [], cancel: [] },
    showHandlers: [], hideHandlers: [], shareHandler: null, timelineHandler: null, audios: [],
    sidebarExists: true, subpackageFail: false,
    log(name, args) { M.calls.push({ name, args: args === undefined ? null : JSON.parse(JSON.stringify(args, (k, v) => (typeof v === 'function' ? '[fn]' : v))) }); },
    count(name) { return M.calls.filter((c) => c.name === name).length; },
    last(name) { const l = M.calls.filter((c) => c.name === name); return l[l.length - 1] || null; },
    emitShow(res) { M.log('emit:onShow', res); for (const f of M.showHandlers) f(res || {}); },
    emitHide() { M.log('emit:onHide'); for (const f of M.hideHandlers) f(); },
  };
  try { M.storage = JSON.parse(localStorage.getItem('__wx_storage') || '{}'); } catch (_) { M.storage = {}; }
  const persist = () => localStorage.setItem('__wx_storage', JSON.stringify(M.storage));
  const later = (fn, ms = 0) => setTimeout(fn, ms);
  let mainCanvas = null;

  // 胶囊按钮 (只画在页面上方便看布局；不画进游戏画布)
  if (notch && Q.get('capsule') !== '0') {
    const cap = document.createElement('div');
    cap.style.cssText = `position:fixed;z-index:9;top:${safeTop + 4}px;right:10px;width:87px;height:32px;border-radius:16px;background:rgba(255,255,255,.75);border:1px solid rgba(0,0,0,.15);font:14px sans-serif;display:flex;align-items:center;justify-content:center;color:#333`;
    cap.textContent = '•••  ◉';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(cap));
    if (document.body) document.body.appendChild(cap);
  }

  function makeAudioCtx() {
    const el = new Audio();
    const h = { canplay: [], play: [], pause: [], stop: [], ended: [], error: [] };
    const fire = (k, a) => h[k].forEach((f) => f(a));
    el.addEventListener('canplaythrough', () => fire('canplay'));
    el.addEventListener('play', () => fire('play'));
    el.addEventListener('pause', () => fire('pause'));
    el.addEventListener('ended', () => fire('ended'));
    el.addEventListener('error', () => fire('error', { errCode: 10001, errMsg: 'mock audio error' }));
    const a = {
      get src() { return el.getAttribute('src') || ''; }, set src(v) { el.src = v; },
      get loop() { return el.loop; }, set loop(v) { el.loop = v; },
      get volume() { return el.volume; }, set volume(v) { el.volume = v; },
      get currentTime() { return el.currentTime; }, get duration() { return el.duration || 0; }, get paused() { return el.paused; },
      autoplay: false, obeyMuteSwitch: true,
      play() { M.log('audio.play', a.src.split('/').pop()); el.play().catch(() => {}); },
      pause() { el.pause(); }, stop() { el.pause(); try { el.currentTime = 0; } catch (_) {} fire('stop'); },
      seek(t) { el.currentTime = t; }, destroy() { M.log('audio.destroy'); el.pause(); el.removeAttribute('src'); },
      onCanplay: (f) => h.canplay.push(f), onPlay: (f) => h.play.push(f), onPause: (f) => h.pause.push(f), onStop: (f) => h.stop.push(f),
      onEnded: (f) => h.ended.push(f), onError: (f) => h.error.push(f),
      _el: el,
    };
    M.audios.push(a);
    return a;
  }

  let ad = null;
    window.wx = {
    getSystemInfoSync() {
      M.log('getSystemInfoSync');
      return { platform: 'devtools', brand: 'mock', model: 'mock', system: 'iOS 17', SDKVersion: '3.8.0', version: '8.0.50', appName: 'WeChat',
        pixelRatio: devicePixelRatio, screenWidth: W, screenHeight: H, windowWidth: W, windowHeight: H, statusBarHeight: safeTop,
        safeArea: { left: 0, right: W, top: safeTop, bottom: H - safeBottom, width: W, height: H - safeTop - safeBottom } };
    },
    getMenuButtonBoundingClientRect() { return notch ? { top: safeTop + 4, bottom: safeTop + 36, left: W - 97, right: W - 10, width: 87, height: 32 } : { top: 0, bottom: 0, left: W, right: W, width: 0, height: 0 }; },
    getWindowInfo() {
      M.log('getWindowInfo');
      return { pixelRatio: devicePixelRatio, screenWidth: W, screenHeight: H, windowWidth: W, windowHeight: H, statusBarHeight: safeTop, screenTop: 0,
        safeArea: { left: 0, right: W, top: safeTop, bottom: H - safeBottom, width: W, height: H - safeTop - safeBottom } };
    },
    getDeviceInfo() { return { platform: 'android', brand: 'mock', model: 'mock', system: 'Android 14', pixelRatio: devicePixelRatio }; },
    getLaunchOptionsSync() { M.log('getLaunchOptionsSync'); return { scene: 1001, query: {} }; },
    setInnerAudioOption(o) { M.log('setInnerAudioOption', o); },
    getPerformance() { return performance; },
    createCanvas() {
      M.log('createCanvas', mainCanvas ? 'offscreen' : 'main');
      const c = document.createElement('canvas');
      if (!mainCanvas) {
        mainCanvas = c;
        c.id = 'game';
        c.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;touch-action:none`;
        const add = () => document.body.appendChild(c);
        if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
        const tch = (e) => ({ identifier: e.pointerId, clientX: e.clientX, clientY: e.clientY });
        const send = (k, e) => { const ev = { touches: k === 'end' ? [] : [tch(e)], changedTouches: [tch(e)], timeStamp: e.timeStamp }; M.touchHandlers[k].forEach((f) => f(ev)); };
        c.addEventListener('pointerdown', (e) => send('start', e));
        c.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') send('move', e); });
        c.addEventListener('pointerup', (e) => send('end', e));
        c.addEventListener('pointercancel', (e) => send('cancel', e));
      }
      return c;
    },
    createImage() { return new Image(); },
    createInnerAudioContext() { M.log('createInnerAudioContext'); return makeAudioCtx(); },
    getStorageSync(k) { M.log('getStorageSync', k); return k in M.storage ? M.storage[k] : ''; },
    setStorageSync(k, v) { M.log('setStorageSync', k); M.storage[k] = v; persist(); },
    onTouchStart: (f) => M.touchHandlers.start.push(f), onTouchMove: (f) => M.touchHandlers.move.push(f),
    onTouchEnd: (f) => M.touchHandlers.end.push(f), onTouchCancel: (f) => M.touchHandlers.cancel.push(f),
    onShow(f) { M.log('onShow'); M.showHandlers.push(f); },
    onHide(f) { M.log('onHide'); M.hideHandlers.push(f); },
    onAudioInterruptionBegin() {}, onAudioInterruptionEnd() {},
    onWindowResize() {},
    loadSubpackage(o) {
      M.log('loadSubpackage', o.name);
      const t = { cbs: [], onProgressUpdate(f) { t.cbs.push(f); } };
      [30, 70, 100].forEach((p, i) => later(() => t.cbs.forEach((f) => f({ progress: p, totalBytesWritten: p, totalBytesExpectedToWrite: 100 })), 40 * (i + 1)));
      later(() => (M.subpackageFail ? o.fail && o.fail({ errMsg: 'mock fail' }) : o.success && o.success({})), 160);
      return t;
    },
    createRewardedVideoAd(o) {
      M.log('createRewardedVideoAd', o);
      if (ad) return ad;
      const h = { close: [], error: [], load: [] };
      ad = {
        show() {
          M.log('ad.show', M.ad);
          if (M.ad === 'error') { later(() => h.error.forEach((f) => f({ errCode: 1004, errMsg: 'mock: no fill' }))); return Promise.reject(new Error('no fill')); }
          later(() => h.close.forEach((f) => f({ isEnded: M.ad === 'ended', count: 1 })), M.adDelay);
          return Promise.resolve();
        },
        load() { M.log('ad.load'); return M.ad === 'error' ? Promise.reject(new Error('no fill')) : Promise.resolve(); },
        onClose: (f) => h.close.push(f), offClose: (f) => { h.close = h.close.filter((x) => x !== f); },
        onError: (f) => h.error.push(f), offError: (f) => { h.error = h.error.filter((x) => x !== f); },
        onLoad: (f) => h.load.push(f), destroy() {},
        _h: h,
      };
      return ad;
    },
    // 微信 shareAppMessage 没有 success/fail 回调
    shareAppMessage(o) { M.log('shareAppMessage', o); },
    onShareAppMessage(f) { M.log('onShareAppMessage'); M.shareHandler = f; },
    onShareTimeline(f) { M.log('onShareTimeline'); M.timelineHandler = f; },
    showShareMenu(o) { M.log('showShareMenu', o); },
    vibrateShort() {}, showToast(o) { M.log('showToast', o.title); },
  };
  window.GameGlobal = window;
})();
