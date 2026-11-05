// 抖音小游戏版的无头冒烟测试：Node + 模拟的 tt 全局 (@napi-rs/canvas 提供真实的 Canvas 2D 与图片解码)。
// 在 vm 沙箱里运行 douyin/game.js (与真机相同的单文件)，没有 window / document / localStorage —— 这些名字被设成
// 访问陷阱，任何读取都会被记录并判为失败。时间 (Date.now / requestAnimationFrame / setTimeout) 由测试手动推进。
// 覆盖：启动 -> 加载分包 -> 主菜单 -> 触摸开始游戏 -> 选第 1 关 -> 按参考解法画线 -> 通关；录屏自动开始/停止、
// 结算面板分享录屏、右上角分享菜单；onHide/onShow 暂停 (作废当前一笔、计时器与音频暂停)；没有广告位时隐藏一切看广告界面 (提示免费、封顶 2 星)、
// 填了广告位时的激励视频流程；BGM 两路交替的无缝循环；
// 存档读写 (tt.setStorageSync) 与重启后恢复；侧边栏复访奖励；预渲染音效 / BGM / 语音走 InnerAudioContext。
// 也会把画面存成 docs/douyin-*.png，并可生成商店截图 (--store)。
// 用法：node tools/test-douyin.mjs [--store]
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, Image as NapiImage, GlobalFonts } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DY = path.join(root, 'douyin');
const STORE = process.argv.includes('--store');
for (const f of ['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']) {
  if (fs.existsSync(f)) GlobalFonts.registerFromPath(f, 'Noto Sans CJK SC');
}

let failed = 0;
const results = [];
const check = (ok, msg) => { results.push({ ok: !!ok, msg }); console.log(`  ${ok ? '✔' : '✘'} ${msg}`); if (!ok) failed++; };

/** 创建一套模拟的抖音运行环境，返回 { ctx: vm 上下文, tt, env } */
function createEnv({ screen = { w: 390, h: 844, dpr: 2 }, safeTop = 47, safeBottom = 810, menuButton = true, storage = new Map(), config = { APPID: '', AD_UNIT_ID: '' }, launch = { scene: '990001', launch_from: '', location: '', query: {} }, adEnded = true } = {}) {
  const env = {
    clock: 1_000_000, timers: [], rafs: [], timerSeq: 1,
    handlers: {}, storage, loadedSubs: new Set(), audios: [], plays: [], modals: [], toasts: [], shares: [], rec: [],
    adShows: 0, globalAccess: [], images: [], shareMenu: 0, shareHandler: null, navigations: [], checkScene: 0,
  };
  const fileOk = (src) => {
    const p = path.join(DY, src);
    const m = /^subpackages\/([^/]+)\//.exec(src);
    if (m && !env.loadedSubs.has(m[1])) return { ok: false, why: `分包 ${m[1]} 尚未加载` };
    return fs.existsSync(p) ? { ok: true, p } : { ok: false, why: '文件不存在' };
  };
  const later = (fn, ms = 0) => { const id = env.timerSeq++; env.timers.push({ id, at: env.clock + ms, fn }); return id; };

  class TTImage extends NapiImage {
    set src(v) {
      this._ttsrc = v;
      env.images.push(v);
      const r = fileOk(v);
      later(() => {
        if (!r.ok) { this.loadError = r.why; if (this.onerror) this.onerror(new Error(r.why)); return; }
        try { super.src = fs.readFileSync(r.p); } catch (err) { if (this.onerror) this.onerror(err); }
      }, 1);
    }
    get src() { return this._ttsrc; }
  }

  let mainCanvas = null;
  const recorder = {
    _on: {},
    onStart(f) { this._on.start = f; }, onStop(f) { this._on.stop = f; }, onError(f) { this._on.error = f; },
    start(o) { env.rec.push({ op: 'start', duration: o && o.duration, at: env.clock }); later(() => this._on.start && this._on.start({}), 5); },
    stop() { env.rec.push({ op: 'stop', at: env.clock }); later(() => this._on.stop && this._on.stop({ videoPath: 'ttfile://temp/record_1.mp4' }), 5); },
  };
  const tt = {
    createCanvas() {
      const c = createCanvas(300, 150);
      if (!mainCanvas) mainCanvas = c;
      return c;
    },
    createImage() { return new TTImage(); },
    getSystemInfoSync() {
      return {
        platform: 'ios', system: 'iOS 17.0', appName: 'Douyin', SDKVersion: '3.30.0',
        screenWidth: screen.w, screenHeight: screen.h, windowWidth: screen.w, windowHeight: screen.h, pixelRatio: screen.dpr,
        safeArea: { left: 0, right: screen.w, top: safeTop, bottom: safeBottom, width: screen.w, height: safeBottom - safeTop },
      };
    },
    getMenuButtonBoundingClientRect: menuButton ? () => ({ left: screen.w - 95, right: screen.w - 8, top: safeTop + 4, bottom: safeTop + 36, width: 87, height: 32 }) : undefined,
    onTouchStart(f) { env.handlers.touchstart = f; }, onTouchMove(f) { env.handlers.touchmove = f; },
    onTouchEnd(f) { env.handlers.touchend = f; }, onTouchCancel(f) { env.handlers.touchcancel = f; },
    onHide(f) { env.handlers.hide = f; }, onShow(f) { env.handlers.show = f; },
    getStorageSync(k) { return storage.has(k) ? storage.get(k) : ''; },
    setStorageSync(k, v) { storage.set(k, v); },
    removeStorageSync(k) { storage.delete(k); },
    loadSubpackage({ name, success, fail }) {
      const task = { onProgressUpdate(f) { later(() => f({ progress: 100, totalBytesWritten: 1, totalBytesExpectedToWrite: 1 }), 5); } };
      env.rec.push({ op: `loadSubpackage:${name}` });
      later(() => { if (!['images', 'audio'].includes(name)) { fail && fail({ errMsg: 'no such subpackage' }); return; } env.loadedSubs.add(name); success && success({}); }, 30);
      return task;
    },
    createInnerAudioContext() {
      const a = {
        src_: '', loop: false, volume: 1, autoplay: false, duration: 1, paused: true, _on: {}, plays: 0, pos: 0, startedAt: 0,
        // 播放位置随模拟时钟推进
        get currentTime() { return this.paused ? this.pos : this.pos + (env.clock - this.startedAt) / 1000; },
        set src(v) {
          this.src_ = v;
          this.pos = 0;
          if (/bgm_main_loop\.mp3$/.test(v)) this.duration = env.bgmLoop.loopLength + env.bgmLoop.tail;
          const r = fileOk(v);
          later(() => (r.ok ? this._on.canplay && this._on.canplay() : this._on.error && this._on.error({ errCode: 10004, errMsg: r.why })), 3);
        },
        get src() { return this.src_; },
        play() {
          const r = fileOk(this.src_);
          if (!r.ok) { later(() => this._on.error && this._on.error({ errCode: 10004, errMsg: r.why }), 1); return; }
          if (!this.paused) return;
          this.paused = false; this.startedAt = env.clock; this.plays++; env.plays.push({ src: this.src_, volume: this.volume, at: env.clock });
          if (/bgm_main_loop/.test(this.src_)) {
            const myStart = this.startedAt;
            later(() => { if (!this.paused && this.startedAt === myStart) { this.pos = this.duration; this.paused = true; this._on.ended && this._on.ended(); } }, (this.duration - this.pos) * 1000);
          }
          later(() => this._on.play && this._on.play(), 1);
          if (!this.loop && /voice\//.test(this.src_)) later(() => { if (!this.paused) { this.paused = true; this._on.ended && this._on.ended(); } }, 1200);
        },
        pause() { if (!this.paused) { this.pos = this.currentTime; this.paused = true; later(() => this._on.pause && this._on.pause(), 1); } },
        stop() { this.pos = 0; this.paused = true; },
        seek(t) { const was = !this.paused; if (was) { this.pause(); } this.pos = t; if (was) this.play(); },
        destroy() {},
        onCanplay(f) { this._on.canplay = f; }, onPlay(f) { this._on.play = f; }, onPause(f) { this._on.pause = f; },
        onStop(f) { this._on.stop = f; }, onEnded(f) { this._on.ended = f; }, onError(f) { this._on.error = f; },
      };
      env.audios.push(a);
      return a;
    },
    createRewardedVideoAd({ adUnitId }) {
      env.adUnitId = adUnitId;
      const ad = {
        _close: [],
        onClose(f) { this._close.push(f); }, offClose(f) { this._close = this._close.filter((x) => x !== f); },
        onError() {}, load() { return Promise.resolve(); },
        show() { env.adShows++; later(() => this._close.slice().forEach((f) => f({ isEnded: env.adEnded })), 200); return Promise.resolve(); },
      };
      return ad;
    },
    showModal(o) { env.modals.push(o); later(() => o.success && o.success({ confirm: true, cancel: false }), 50); },
    showToast(o) { env.toasts.push(o); },
    showShareMenu() { env.shareMenu++; },
    onShareAppMessage(f) { env.shareHandler = f; },
    shareAppMessage(o) { env.shares.push(o); later(() => o.success && o.success({}), 20); },
    getGameRecorderManager() { return recorder; },
    checkScene(o) { env.checkScene++; later(() => o.success && o.success({ isExist: true }), 5); },
    navigateToScene(o) { env.navigations.push(o.scene); later(() => o.success && o.success({}), 5); },
    getLaunchOptionsSync() { return launch; },
  };
  env.adEnded = adEnded;
  env.bgmLoop = JSON.parse(fs.readFileSync(path.join(DY, 'build-info.json'), 'utf8')).loops['subpackages/audio/bgm/bgm_main_loop.mp3'];

  const sandbox = {
    tt, console,
    Date: class extends Date { static now() { return env.clock; } },
    setTimeout: (fn, ms) => later(fn, ms || 0),
    clearTimeout: (id) => { env.timers = env.timers.filter((t) => t.id !== id); },
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (cb) => { env.rafs.push(cb); return env.rafs.length; },
    cancelAnimationFrame: () => {},
    // 注意：不要把宿主的 Object / Array 等内建对象传进沙箱 (跨 realm 后 Matter.Common.isPlainObject 会判断失败)
    require: (p) => {
      if (p === './config.js') return config;
      throw new Error(`require(${p}) 不存在`);
    },
  };
  sandbox.GameGlobal = sandbox;
  // 访问陷阱：抖音里不存在的浏览器全局
  for (const name of ['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'Image', 'Audio', 'AudioContext', 'webkitAudioContext', 'performance', 'speechSynthesis', 'location', 'XMLHttpRequest', 'fetch', 'self']) {
    Object.defineProperty(sandbox, name, { get() { env.globalAccess.push(name); return undefined; }, configurable: true });
  }
  const ctx = vm.createContext(sandbox);
  env.mainCanvas = () => mainCanvas;
  return { ctx, tt, env };
}

/** 推进模拟时间：每帧 16.7ms，执行到期的 setTimeout 与 requestAnimationFrame，并让 Promise 回调跑完 */
async function step(env, frames = 1) {
  for (let i = 0; i < frames; i++) {
    env.clock += 1000 / 60;
    for (;;) {
      env.timers.sort((a, b) => a.at - b.at);
      const t = env.timers[0];
      if (!t || t.at > env.clock) break;
      env.timers.shift();
      t.fn();
      await new Promise((r) => setImmediate(r));
    }
    const rafs = env.rafs.splice(0);
    for (const cb of rafs) cb(env.clock);
    await new Promise((r) => setImmediate(r));
  }
}

async function until(env, pred, maxFrames = 600) {
  for (let i = 0; i < maxFrames; i++) { if (pred()) return true; await step(env, 1); }
  return pred();
}

function boot(opts = {}) {
  const e = createEnv(opts);
  const code = fs.readFileSync(path.join(DY, 'game.js'), 'utf8');
  vm.runInContext(code, e.ctx, { filename: 'douyin/game.js' });
  e.game = e.ctx.__ANIME_DRAWLINE__;
  return e;
}

// 触摸：逻辑坐标 -> 屏幕坐标
function screenPt(game, x, y) { const v = game.view; return { clientX: v.ox + x * v.scale, clientY: v.oy + y * v.scale }; }
function touch(e, type, x, y, id = 0) {
  const p = screenPt(e.game, x, y);
  const t = { identifier: id, ...p, pageX: p.clientX, pageY: p.clientY };
  e.env.handlers[type]({ touches: type === 'touchend' ? [] : [t], changedTouches: [t], timeStamp: e.env.clock });
}
async function tap(e, x, y) { touch(e, 'touchstart', x, y); await step(e.env, 2); touch(e, 'touchend', x, y); await step(e.env, 2); }
async function drag(e, pts, framesPerSeg = 2) {
  touch(e, 'touchstart', pts[0].x, pts[0].y);
  await step(e.env, 1);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12));
    for (let k = 1; k <= n; k++) { touch(e, 'touchmove', a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n); if (k % 3 === 0) await step(e.env, 1); }
    await step(e.env, framesPerSeg > 1 ? 1 : 0);
  }
  const last = pts[pts.length - 1];
  touch(e, 'touchend', last.x, last.y);
  await step(e.env, 2);
}
const scene = (e) => e.game.scenes.current;
async function snap(e, name, dir = path.join(root, 'docs')) {
  const c = e.env.mainCanvas();
  const p = path.join(dir, `${name}.png`);
  fs.writeFileSync(p, c.toBuffer('image/png'));
  return p;
}

async function main() {
  console.log('抖音小游戏版 (douyin/game.js) 模拟 tt 冒烟测试');
  if (!fs.existsSync(path.join(DY, 'game.js'))) { console.log('  ✘ 缺少 douyin/game.js，请先运行 node tools/build-douyin.mjs'); process.exit(1); }

  // —— 0. 静态检查 ——
  const code = fs.readFileSync(path.join(DY, 'game.js'), 'utf8');
  const bare = (w) => (code.match(new RegExp(`(?<![\\w$."'])${w}(?![\\w$])`, 'g')) || []).length;
  check(bare('window') === 0 && bare('localStorage') === 0 && bare('sessionStorage') === 0, `game.js 不含 window / localStorage / sessionStorage 标识符 (${bare('window')}/${bare('localStorage')}/${bare('sessionStorage')})`);
  const docRefs = bare('document');
  check(docRefs <= 1 && /Mouse\.create: element was undefined, defaulting to document\.body/.test(code), `game.js 中 "document" 只出现在 Matter.js 的一条警告字符串里 (${docRefs} 处)`);
  const gj = JSON.parse(fs.readFileSync(path.join(DY, 'game.json'), 'utf8'));
  check(gj.deviceOrientation === 'portrait' && Array.isArray(gj.subPackages) && gj.subPackages.length === 2, 'game.json：竖屏 + 2 个分包 (images / audio)');
  const pc = JSON.parse(fs.readFileSync(path.join(DY, 'project.config.json'), 'utf8'));
  check(pc.compileType === 'game' && !!pc.appid, `project.config.json：compileType=game，appid=${pc.appid}`);
  const info = JSON.parse(fs.readFileSync(path.join(DY, 'build-info.json'), 'utf8'));
  check(info.sizes.main <= 4 * 1024 * 1024 && info.sizes.total <= 20 * 1024 * 1024, `体积：主包 ${(info.sizes.main / 1048576).toFixed(2)} MB ≤ 4 MB，总计 ${(info.sizes.total / 1048576).toFixed(2)} MB ≤ 20 MB`);

  // —— 1. 启动 ——
  const storage = new Map();
  const e = boot({ storage });
  const g = e.game;
  check(!!g, '在没有 window/document 的沙箱里启动 Game');
  const v = g.view;
  check(v.fullscreen && Math.abs(v.cssH - 960 * v.scale) < 0.01 && v.oy >= 47 + 36, `画面放进安全区：缩放 ${v.scale.toFixed(3)}，偏移 (${v.ox.toFixed(1)}, ${v.oy.toFixed(1)})，在刘海/胶囊按钮下方`);
  check(e.env.mainCanvas().width === 780 && e.env.mainCanvas().height === 1688, `上屏画布按 DPR 铺满屏幕 (${e.env.mainCanvas().width}×${e.env.mainCanvas().height})`);
  const toMenu = await until(e.env, () => g.scenes.current && g.scenes.current.name === 'menu', 600);
  check(toMenu, '加载完成进入主菜单');
  check(e.env.loadedSubs.has('images') && e.env.loadedSubs.has('audio'), '启动时先加载 images / audio 分包 (tt.loadSubpackage)');
  const imgKeys = ['heroine_idle', 'heroine_scared', 'heroine_happy', 'heroine_lose', 'enemy_bee', 'enemy_hive', 'enemy_boss', 'enemy_auntie', 'bg_level', 'bg_menu'];
  const realImgs = imgKeys.filter((k) => { const im = g.assets.getImage(k); return im && im._ttsrc && im.width > 0; });
  check(realImgs.length === imgKeys.length, `全部 ${imgKeys.length} 张图片经 tt.createImage 从主包 / 分包加载 (非占位图)：${realImgs.length}`);
  check(g.voice.loadedCount === 15, `语音 15 句从 audio 分包预加载完成 (${g.voice.loadedCount})`);
  check(g.bgm.src && e.env.audios.some((a) => /subpackages\/audio\/bgm\/bgm_main_loop\.mp3$/.test(a.src)), 'BGM 选择 mp3 (抖音 iOS 不支持 ogg)，从 audio 分包加载 (无缝循环版 bgm_main_loop.mp3)');
  check(!!e.env.shareHandler && e.env.shareMenu === 1, 'tt.showShareMenu + tt.onShareAppMessage 已注册 (右上角菜单分享)');
  const menuShare = e.env.shareHandler && e.env.shareHandler({});
  check(menuShare && /画线守护美少女/.test(menuShare.title) && menuShare.imageUrl === 'assets/share.jpg', `菜单分享内容：「${menuShare && menuShare.title}」`);
  await step(e.env, 30);
  const menuShot = await snap(e, 'douyin-menu');
  check(!scene(e).sidebarBtn && !g.ads.enabled && g.hints.free, 'AD_UNIT_ID 为空：广告关闭 (ads.enabled=false)，提示免费，不显示「侧边栏奖励 (免广告提示)」入口');
  await tap(e, 270, 930);
  await step(e.env, 20);
  check(!!scene(e).credits, '「制作人员」面板 (出品：狸猫 / リダ 署名 + URL / 许可)');
  await snap(e, 'douyin-credits');
  await tap(e, 270, 742);
  await step(e.env, 5);
  check(!scene(e).credits, '关闭制作人员面板');

  // —— 2. 触摸：开始游戏 -> 选第 1 关 ——
  await tap(e, 270, 812);
  check(await until(e.env, () => scene(e).name === 'levels', 120), '触摸「开始游戏」进入选关 (tt.onTouchStart/End)');
  check(e.env.plays.some((p) => /assets\/sfx\/click\.mp3$/.test(p.src)), '按钮音效：预渲染的 click.mp3 经 InnerAudioContext 播放');
  check(e.env.plays.some((p) => /bgm_main_loop\.mp3$/.test(p.src)) && g.bgm.playing, 'BGM 开始播放');
  // BGM 无缝循环：把正在播放的那一路拨到循环点前 0.3 秒，看是否在 loopLength 处交替、交叉淡化、全程不断音
  {
    const el = g.bgm.el;
    const L = e.env.bgmLoop.loopLength;
    check(el && typeof el.tick === 'function' && Math.abs(el.duration - L) < 1e-6, `BGM 使用两路交替的无缝循环播放器 (循环长度 ${L.toFixed(3)} 秒，文件多带 ${e.env.bgmLoop.tail} 秒开头)`);
    const first = el.cur;
    first.currentTime = L - 0.3;
    let gapFrames = 0; let minSum = 9; let maxSum = 0; let overlap = 0;
    for (let i = 0; i < 60; i++) {
      await step(e.env, 1);
      const ca = el.a._ctx; const cb = el.b._ctx;
      const playing = [ca, cb].filter((c) => c && !c.paused);
      if (!playing.length) gapFrames++;
      if (playing.length === 2) overlap++;
      const sum = playing.reduce((t, c) => t + c.volume, 0) / (el.volume || 1);
      if (el.volume > 0.001) { minSum = Math.min(minSum, sum); maxSum = Math.max(maxSum, sum); }
    }
    check(el.loops === 1 && el.cur !== first && first.paused && !el.cur.paused && el.currentTime < 1.5, `到循环点交替到另一路 (循环 ${el.loops} 次，新的一路播放到 ${el.currentTime.toFixed(2)} 秒，旧的一路已停)`);
    check(gapFrames === 0 && overlap > 0 && minSum > 0.99 && maxSum < 1.01, `接缝处不断音：两路重叠 ${overlap} 帧，线性交叉淡化总音量 ${minSum.toFixed(3)}~${maxSum.toFixed(3)}`);
    // 兜底：帧循环停住时，当前一路播完 (ended) 也会立刻接上另一路
    const before = el.loops;
    el.cur.currentTime = L + e.env.bgmLoop.tail - 0.05;
    el.tick = () => {};                       // 模拟这段时间没有帧回调
    await step(e.env, 10);
    delete el.tick;
    check(el.loops === before + 1 && !el.cur.paused, '兜底：没有帧回调时，一路播完 (onEnded) 立刻接上另一路');
  }
  await step(e.env, 40);
  await tap(e, 70, 452);
  check(await until(e.env, () => scene(e).name === 'game' && scene(e).level && scene(e).level.id === 1, 120), '触摸第 1 关进入关卡');
  await step(e.env, 60);

  // —— 3. 画线中切后台：作废这一笔并暂停 ——
  const sc = scene(e);
  touch(e, 'touchstart', 150, 600);
  await step(e.env, 1);
  for (let x = 160; x <= 300; x += 10) { touch(e, 'touchmove', x, 600); await step(e.env, 1); }
  const drawing = sc.world.drawing.active || (sc.world.drawing.points && sc.world.drawing.points.length > 1);
  e.env.handlers.hide();
  await step(e.env, 5);
  const lines = sc.world.lines ? sc.world.lines.length : (sc.world.line ? 1 : 0);
  check(drawing && sc.fsm.is('paused') && !sc.world.line && lines === 0, `tt.onHide：画到一半的线作废 (未提交)，关卡暂停 (fsm=${sc.fsm.name})`);
  check(!g.bgm.playing, 'tt.onHide：BGM 暂停');
  touch(e, 'touchend', 300, 600);
  e.env.handlers.show({ scene: '990001', launch_from: '', location: '' });
  await step(e.env, 30);
  check(sc.fsm.is('paused'), 'tt.onShow：保持暂停，等玩家点「继续」(与网页版一致)');
  check(g.bgm.playing, 'tt.onShow：BGM 淡入继续');
  sc.togglePause();
  await step(e.env, 10);

  // —— 4. 按参考解法画线通关 ——
  const sol = sc.level.solution;
  await drag(e, sol);
  check(sc.fsm.is('survive'), `按参考解法用触摸画线 (${sol.length} 个点)，线成形开始生存倒计时`);
  await step(e.env, 10);
  check(e.env.rec.some((r) => r.op === 'start'), `生存倒计时开始自动录屏 (GameRecorderManager.start duration=${(e.env.rec.find((r) => r.op === 'start') || {}).duration}s)`);
  // 倒计时中切后台：计时器暂停
  const tBefore = sc.world.time.toFixed(3);
  e.env.handlers.hide();
  await step(e.env, 120);
  const tAfter = sc.world.time.toFixed(3);
  check(sc.fsm.is('paused') && tBefore === tAfter && +tBefore > 0, `倒计时中 tt.onHide：计时暂停 (已坚持 ${tBefore}s，后台 2 秒后仍是 ${tAfter}s)`);
  check(g.audio.swarmLevel === 0, 'tt.onHide：蜂群嗡嗡声静音');
  e.env.handlers.show({});
  await step(e.env, 5);
  sc.togglePause();
  const won = await until(e.env, () => sc.fsm.is('won') || sc.fsm.is('lost'), 60 * 30);
  check(won && sc.fsm.is('won'), `第 1 关通关 (${sc.fsm.name}，${sc.world.result && sc.world.result.stars} 星)`);
  check(e.env.plays.some((p) => /swarm_loop\.wav$/.test(p.src)), '倒计时中蜂群嗡嗡声：无缝循环 wav (音量随蜜蜂距离平滑)');
  check(e.env.plays.some((p) => /victory\.mp3$/.test(p.src)) && e.env.plays.some((p) => /pop\.mp3$/.test(p.src)), '胜利 / 线成形音效 (预渲染 mp3)');
  check(e.env.plays.some((p) => /voice\/(win|stars3)_\d\.mp3$/.test(p.src)), '过关语音 (audio 分包)');
  await until(e.env, () => !!sc.panel, 200);
  await step(e.env, 120);
  check(e.env.rec.some((r) => r.op === 'stop') && g.platform.hasVideo, '胜利 1.5 秒后停止录屏，得到 videoPath');
  check(sc.panel && sc.panel.shareBtn && sc.panel.shareBtn.label === '分享录屏', `结算面板显示「${sc.panel && sc.panel.shareBtn && sc.panel.shareBtn.label}」按钮`);
  const winShot = await snap(e, 'douyin-win');
  await tap(e, 270, 790);
  await step(e.env, 30);
  const vs = e.env.shares.find((s) => s.channel === 'video');
  check(vs && vs.extra && vs.extra.videoPath === 'ttfile://temp/record_1.mp4' && g.platform.lastShare && g.platform.lastShare.ok, '点击分享 -> tt.shareAppMessage({channel:"video", extra:{videoPath}})');
  const saved = JSON.parse(storage.get('animeDrawLine.save.v2') || '{}');
  check(saved.levels && saved.levels[1] && saved.levels[1].stars >= 1, `存档写入 tt.setStorageSync (第 1 关 ${saved.levels && saved.levels[1] && saved.levels[1].stars} 星)`);

  // —— 5. 没有广告位：失败 -> 提示 (不弹任何广告 / 占位，没有「广告」角标，免费但封顶 2 星) ——
  await tap(e, 270 - 70, 690);      // 重玩
  await until(e.env, () => scene(e).name === 'game' && scene(e).fsm.is('draw'), 200);
  await step(e.env, 30);
  const sc2 = scene(e);
  check(sc2.hud.hint.tag === null, `HUD 提示按钮没有「广告」角标 (tag=${sc2.hud.hint.tag})`);
  await drag(e, [{ x: 30, y: 200 }, { x: 90, y: 200 }]);
  const lost = await until(e.env, () => sc2.fsm.is('lost'), 60 * 20);
  check(lost, `线没护住 -> 失败 (${sc2.world.result && sc2.world.result.by})`);
  await until(e.env, () => !!sc2.panel, 200);
  await step(e.env, 60);
  const panelHint = sc2.panel.buttons.find((b) => b.label === '提示');
  check(panelHint && panelHint.tag === null, `失败面板「提示」按钮没有「广告」角标 (tag=${panelHint && panelHint.tag})`);
  const modalsBefore = e.env.modals.length;
  await tap(e, 200, 690);           // 失败面板「提示」
  await until(e.env, () => scene(e).hints && scene(e).hints.visible, 300);
  await step(e.env, 30);
  check(e.env.modals.length === modalsBefore && e.env.adShows === 0 && g.ads.stats.shown === 0, `点提示：没有弹窗、没有广告 (showModal ${e.env.modals.length - modalsBefore} 次，激励视频 ${e.env.adShows} 次)`);
  check(scene(e).hints.visible && scene(e).world.hintUsed && !g.save.hintUnlocked(1), '提示直接显示 (免费；不写入「已解锁」，每次都免费)');
  const playShot = await snap(e, 'douyin-hint');
  const sc3 = scene(e);
  await drag(e, sc3.level.solution);
  await until(e.env, () => sc3.fsm.is('won') || sc3.fsm.is('lost'), 60 * 30);
  check(sc3.fsm.is('won') && sc3.world.result.stars <= 2, `看过免费提示后通关：本次封顶 2 星 (${sc3.world.result && sc3.world.result.stars} 星，原本可得 3 星)`);
  await until(e.env, () => !!sc3.panel, 200);
  await step(e.env, 30);
  g.scenes.change('game', { level: 2 });
  await until(e.env, () => scene(e).name === 'game' && scene(e).level.id === 2 && scene(e).fsm.is('draw'), 200);
  await step(e.env, 20);
  await tap(e, 450, 44);            // HUD 提示按钮
  await step(e.env, 10);
  check(scene(e).hints.visible && e.env.modals.length === modalsBefore && e.env.adShows === 0, '画线中点 HUD 提示：直接显示，同样没有任何广告界面');

  // —— 7. 运行期没有访问任何浏览器全局 ——
  const acc = [...new Set(e.env.globalAccess)];
  check(acc.length === 0, `运行期间没有读取 window / document / localStorage / Image / Audio / AudioContext / performance 等浏览器全局 (${acc.join(', ') || '无'})`);
  const sfx = Object.keys(g.audio.sampler ? g.audio.sampler.played : {});
  check(!!g.audio.sampler && !g.audio.ctx && sfx.length >= 8, `音效后端：预渲染样本 (无 WebAudio)，本局播放过 ${sfx.length} 种：${sfx.slice(0, 12).join(' ')}`);

  // —— 8. 重启：存档恢复 ——
  const e2 = boot({ storage, config: { APPID: 'tt0000000000000000', AD_UNIT_ID: 'test-ad-unit' } });
  await until(e2.env, () => e2.game.scenes.current && e2.game.scenes.current.name === 'menu', 600);
  check(e2.game.save.stars(1) >= 1, `重启后从 tt.getStorageSync 恢复存档 (第 1 关 ${e2.game.save.stars(1)} 星)`);
  // —— 9. 真实广告位：激励视频流程 ——
  const g2 = e2.game;
  check(g2.ads.enabled && !g2.hints.free, 'config.js 填了 AD_UNIT_ID -> 广告启用');
  g2.scenes.change('game', { level: 3 });
  await until(e2.env, () => g2.scenes.current.name === 'game' && g2.scenes.current.level.id === 3 && g2.scenes.current.fsm.is('draw'), 200);
  await step(e2.env, 20);
  const s3 = g2.scenes.current;
  check(s3.hud.hint.tag === '广告', `HUD 提示按钮显示「广告」角标 (tag=${s3.hud.hint.tag})`);
  await tap(e2, 450, 44);
  await until(e2.env, () => s3.hints.visible, 120);
  check(s3.hints.visible && e2.env.adShows === 1 && g2.save.hintUnlocked(3) && e2.env.modals.length === 0 && s3.hud.hint.tag === '免费', '点提示 -> tt.createRewardedVideoAd 播放 -> 看完 (isEnded=true) 解锁第 3 关提示，角标变「免费」，没有占位弹窗');
  const pOk = e2.game.ads.showRewardedAd('hint');
  await step(e2.env, 30);
  const ok1 = await pOk;
  check(ok1 === true && e2.env.adUnitId === 'test-ad-unit' && e2.env.adShows === 2, 'ads.showRewardedAd()：广告位 test-ad-unit，isEnded=true -> true');
  e2.env.adEnded = false;
  const pNo = e2.game.ads.showRewardedAd('hint');
  await step(e2.env, 30);
  check((await pNo) === false && e2.game.ads.lastResult.reason === 'closed-early', '中途关闭广告 (isEnded=false) -> 不发奖励');

  // —— 10. 侧边栏复访 (只有广告启用时才有意义：奖励是免广告提示) ——
  await step(e2.env, 10);
  check(g2.platform.sidebarAvailable && e2.env.checkScene === 1, 'tt.checkScene({scene:"sidebar"}) -> 可用');
  g2.scenes.change('menu');
  await until(e2.env, () => g2.scenes.current.name === 'menu', 120);
  await step(e2.env, 5);
  check(!!g2.scenes.current.sidebarBtn, '主菜单显示「侧边栏奖励」按钮');
  e2.env.handlers.hide();
  e2.env.handlers.show({ scene: '021036', launch_from: 'homepage', location: 'sidebar_card', query: {} });
  await step(e2.env, 5);
  const r1 = await g2.platform.sidebarAction();
  check(g2.platform.fromSidebar && r1 === 'claimed' && g2.ads.freeCredits === 1, '从侧边栏进入 (launch_from=homepage, location=sidebar_card) -> 领取免广告提示 ×1');
  const shownBefore = g2.ads.stats.shown;
  const okFree = await g2.ads.showRewardedAd('hint');
  check(okFree && g2.ads.stats.shown === shownBefore && g2.ads.stats.free === 1, '免广告提示生效 (不播放广告)');
  const pr = g2.platform.sidebarAction();
  await step(e2.env, 20);
  check((await pr) === 'navigate' && e2.env.navigations.includes('sidebar'), '当天再次点击：弹窗 -> tt.navigateToScene({scene:"sidebar"})');
  check(e2.env.toasts.length >= 1, 'tt.showToast 提示');
  check([...new Set(e2.env.globalAccess)].length === 0, '第二次启动同样没有访问浏览器全局');

  // —— 11. 商店截图 (1080×1920，无安全区留边) ——
  if (STORE) {
    const out = path.join(DY, 'store');
    fs.mkdirSync(out, { recursive: true });
    const s = boot({ screen: { w: 540, h: 960, dpr: 2 }, safeTop: 0, safeBottom: 960, menuButton: false, storage: new Map(storage) });
    const sg = s.game;
    await until(s.env, () => sg.scenes.current && sg.scenes.current.name === 'menu', 600);
    await step(s.env, 60);
    await snap(s, 'shot1_menu', out);
    sg.scenes.change('levels', { chapter: 0 });
    await step(s.env, 60);
    await snap(s, 'shot2_levels', out);
    const shots = [[7, 'shot3_play'], [23, 'shot4_boss'], [31, 'shot5_win']];
    for (const [id, name] of shots) {
      sg.scenes.change('game', { level: id });
      await step(s.env, 50);
      const ss = sg.scenes.current;
      if (name === 'shot5_win') {
        await drag(s, ss.level.solution);
        await until(s.env, () => !!ss.panel, 60 * 30);
        await step(s.env, 90);
      } else {
        await drag(s, ss.level.solution);
        await step(s.env, name === 'shot4_boss' ? 150 : 110);
      }
      await snap(s, name, out);
    }
    console.log(`  商店截图 -> ${path.relative(root, out)}/`);
  }

  console.log(`\n截图：${[menuShot, winShot, playShot].map((p) => path.relative(root, p)).join('  ')}`);
  fs.writeFileSync(path.join(root, 'docs/douyin-test-results.json'), JSON.stringify({ at: new Date().toISOString(), passed: results.filter((r) => r.ok).length, failed, results }, null, 2));
  console.log(failed ? `\n失败 ${failed} 项` : `\n全部 ${results.length} 项通过`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error('测试异常:', err); process.exit(1); });
