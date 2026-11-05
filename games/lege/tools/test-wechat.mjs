// 微信小游戏版自动化测试 (不需要微信账号 / 真机)：
//   A. Node vm + 纯桩 wx (无 DOM、无 window/document)：证明包里没有残留的浏览器 API；启动 → 菜单 → 第 1 关通关、存档、
//      转发 / 朋友圈菜单注册、没有录屏和侧边栏调用
//   B. Chromium + wx 模拟层 (tools/wechat-mock/)：刘海/胶囊布局 (getWindowInfo)、触摸、分包、存档持久化、激励视频三种结果 + 复活、
//      未填广告位时免费「再试一次」、结算页「分享给好友」(wx.shareAppMessage)、右上角转发 / 分享到朋友圈参数、切后台暂停/静音、
//      BGM 无缝循环、音效文件播放
// 用法：npm run build:wechat && node tools/test-wechat.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wxDir = path.join(root, 'build-wechat');
const mockDir = path.join(root, 'tools/wechat-mock');
const shotDir = path.join(root, 'build/wechat-test');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; let fail = 0;
function check(ok, msg, extra = '') {
  if (ok) { pass++; console.log(`  ✔ ${msg}${extra ? ` (${extra})` : ''}`); } else { fail++; console.log(`  ✘ ${msg}${extra ? ` (${extra})` : ''}`); }
}
if (!fs.existsSync(path.join(wxDir, 'js/main.js'))) { console.error('先运行 npm run build:wechat'); process.exit(1); }
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

// ───────────────────────── 0. 工程文件 / 包体 ─────────────────────────
function testProject() {
  console.log('\n[0] 工程文件与包体');
  const gj = JSON.parse(fs.readFileSync(path.join(wxDir, 'game.json'), 'utf8'));
  check(gj.deviceOrientation === 'portrait' && gj.subpackages?.[0]?.name === 'audio' && gj.subpackages[0].root === 'assets/audio/', 'game.json：竖屏 + 分包 audio');
  check(fs.existsSync(path.join(wxDir, 'assets/audio/game.js')), '分包根目录有 game.js');
  const pc = JSON.parse(fs.readFileSync(path.join(wxDir, 'project.config.json'), 'utf8'));
  const cfgCtx = { module: { exports: {} }, GameGlobal: {} };
  vm.runInNewContext(fs.readFileSync(path.join(wxDir, 'wechat.config.js'), 'utf8'), cfgCtx);
  const cfg = cfgCtx.module.exports;
  check(pc.compileType === 'game' && pc.appid === cfg.appid, 'project.config.json：compileType game，appid 与 wechat.config.js 一致', pc.appid);
  check(cfg.rewardedAdUnitId === '' && cfg.freeReviveWithoutAd === true, 'wechat.config.js：广告位留空 (首发无广告)');
  const rep = JSON.parse(fs.readFileSync(path.join(root, 'build/wechat-size.json'), 'utf8'));
  const MB = 1024 * 1024;
  check(rep.main <= 4 * MB && rep.total <= 30 * MB, '包体：主包 ≤ 4 MB，总包 ≤ 30 MB', `主包 ${(rep.main / MB).toFixed(2)} MB，分包 ${(rep.audio / MB).toFixed(2)} MB，总 ${(rep.total / MB).toFixed(2)} MB`);
  const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } })(wxDir);
  check(!files.some((f) => /\.ogg$/i.test(f)) && !/\.ogg\b|audio\/ogg|vorbis/i.test(fs.readFileSync(path.join(wxDir, 'js/main.js'), 'utf8')), '只有 mp3：无 .ogg 文件、无 ogg 引用');
  const [sw, sh] = pngSize(path.join(wxDir, 'assets/share.png')); const [tw, th] = pngSize(path.join(wxDir, 'assets/share_timeline.png'));
  check(sw * 4 === sh * 5 && tw === th, '分享图：转发 5:4 + 朋友圈 1:1', `${sw}×${sh}, ${tw}×${th}`);
}

// ───────────────────────── A. Node vm ─────────────────────────
async function testNode() {
  console.log('\n[A] Node vm + 桩 wx (无 DOM)');
  const calls = [];
  const log = (n, a) => calls.push({ n, a });
  const errors = [];
  const ctxProxy = (canvas) => {
    const state = { font: '10px sans-serif' };
    return new Proxy(state, {
      get(t, k) {
        if (k === 'canvas') return canvas;
        if (k in t) return t[k];
        if (k === 'measureText') return (s) => ({ width: String(s).length * (parseFloat(/(\d+(\.\d+)?)px/.exec(t.font || '')?.[1]) || 10) * 0.6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' || k === 'createConicGradient') return () => ({ addColorStop() {} });
        if (k === 'getImageData' || k === 'createImageData') return (x, y, w, h) => ({ width: w || 1, height: h || 1, data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) });
        if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        if (k === 'isPointInPath') return () => false;
        return () => {};
      },
      set(t, k, v) { t[k] = v; return true; },
    });
  };
  let canvases = 0;
  const mkCanvas = () => { const c = { width: 300, height: 150, id: canvases++ }; const cx = ctxProxy(c); c.getContext = () => cx; return c; };
  const storage = {};
  const showH = []; const hideH = []; const touch = {};
  let shareH = null; let timelineH = null;
  const safe = { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 };
  const wx = {
    getSystemInfoSync: () => { log('getSystemInfoSync'); return { windowWidth: 390, windowHeight: 844, pixelRatio: 3, statusBarHeight: 47, safeArea: safe, platform: 'ios' }; },
    getWindowInfo: () => { log('getWindowInfo'); return { windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, pixelRatio: 3, statusBarHeight: 47, safeArea: safe }; },
    getDeviceInfo: () => ({ platform: 'ios', pixelRatio: 3 }),
    getMenuButtonBoundingClientRect: () => ({ top: 51, bottom: 83, left: 293, right: 380, width: 87, height: 32 }),
    getLaunchOptionsSync: () => ({ scene: 1001, query: {} }),
    createCanvas: () => { log('createCanvas'); return mkCanvas(); },
    createImage: () => {
      const img = { width: 0, height: 0, onload: null, onerror: null };
      let src = '';
      Object.defineProperty(img, 'src', { get: () => src, set: (v) => {
        src = v; log('image', v);
        setTimeout(() => { const ok = fs.existsSync(path.join(wxDir, v)); if (ok) { img.width = /bg/.test(v) ? 1080 : 160; img.height = /bg/.test(v) ? 1920 : 176; img.onload && img.onload(); } else img.onerror && img.onerror(new Error('404 ' + v)); }, 1);
      } });
      return img;
    },
    createInnerAudioContext: () => {
      log('audioCtx');
      const h = {}; const on = (k) => (f) => { (h[k] = h[k] || []).push(f); };
      let src = '';
      return { get src() { return src; }, set src(v) { src = v; if (!fs.existsSync(path.join(wxDir, v))) errors.push('missing audio ' + v); setTimeout(() => (h.canplay || []).forEach((f) => f()), 1); },
        loop: false, volume: 1, currentTime: 0, duration: 1, play() { log('play', src); }, pause() {}, stop() {}, seek() {}, destroy() {},
        onCanplay: on('canplay'), onPlay: on('play'), onPause: on('pause'), onStop: on('stop'), onEnded: on('ended'), onError: on('error') };
    },
    setInnerAudioOption: (o) => log('setInnerAudioOption', o),
    getStorageSync: (k) => (k in storage ? storage[k] : ''),
    setStorageSync: (k, v) => { log('setStorage', k); storage[k] = v; },
    onTouchStart: (f) => { touch.start = f; }, onTouchMove: (f) => { touch.move = f; }, onTouchEnd: (f) => { touch.end = f; }, onTouchCancel: (f) => { touch.cancel = f; },
    onShow: (f) => showH.push(f), onHide: (f) => hideH.push(f),
    loadSubpackage: (o) => { log('loadSubpackage', o.name); setTimeout(() => o.success({}), 5); return { onProgressUpdate() {} }; },
    shareAppMessage: (o) => log('share', o),
    onShareAppMessage: (f) => { shareH = f; log('onShareAppMessage'); },
    onShareTimeline: (f) => { timelineH = f; log('onShareTimeline'); },
    showShareMenu: (o) => log('showShareMenu', o),
  };
  // 有任何对 wx 上不存在的方法的调用 (例如抖音专属 API) 都记下来
  const wxProxy = new Proxy(wx, { get(t, k) { if (!(k in t) && typeof k === 'string') log('missing-api', k); return t[k]; } });
  const sandbox = { wx: wxProxy, console: { log() {}, info() {}, warn() {}, error: (...a) => errors.push(a.join(' ')) }, setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} } };
  sandbox.GameGlobal = sandbox;
  const ctx = vm.createContext(sandbox);
  const onErr = (e) => errors.push(String(e && e.stack || e));
  process.on('uncaughtException', onErr);
  vm.runInContext(fs.readFileSync(path.join(wxDir, 'wechat.config.js'), 'utf8'), ctx, { filename: 'wechat.config.js' });
  try { vm.runInContext(fs.readFileSync(path.join(wxDir, 'js/main.js'), 'utf8'), ctx, { filename: 'js/main.js' }); } catch (e) { onErr(e); }
  const G = () => sandbox.__ANIME_STACK__;
  const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (_) {} await sleep(20); } return false; };
  check(!!G(), '包在无 DOM 环境里启动 (GameGlobal.__ANIME_STACK__)');
  check(G() && G().platform.name === 'wechat', '选中 WechatPlatform', G() && G().platform.name);
  check(await until(() => G().scenes.currentName === 'menu'), '启动 → 菜单');
  check(calls.some((c) => c.n === 'loadSubpackage' && c.a === 'audio'), 'wx.loadSubpackage("audio")');
  check(typeof sandbox.window === 'undefined' && typeof sandbox.document === 'undefined', '沙箱里没有 window / document');
  check(calls.some((c) => c.n === 'getWindowInfo'), '屏幕信息用 wx.getWindowInfo');
  const menu = calls.find((c) => c.n === 'showShareMenu');
  check(menu && JSON.stringify(menu.a.menus) === '["shareAppMessage","shareTimeline"]', 'wx.showShareMenu({menus:["shareAppMessage","shareTimeline"]})');
  const sp = shareH && shareH(); const tp = timelineH && timelineH();
  check(sp && /美少女/.test(sp.title) && sp.imageUrl === 'assets/share.png' && fs.existsSync(path.join(wxDir, sp.imageUrl)), 'wx.onShareAppMessage → 转发标题 + share.png', sp && sp.title);
  check(tp && tp.title && tp.imageUrl === 'assets/share_timeline.png' && fs.existsSync(path.join(wxDir, tp.imageUrl)) && /^[\w=&]*$/.test(tp.query), 'wx.onShareTimeline → 朋友圈标题 + 1:1 图 + query', tp && `${tp.title} · ${tp.query}`);
  check(calls.some((c) => c.n === 'setInnerAudioOption'), 'wx.setInnerAudioOption (不受静音键影响)');
  G().scenes.change('game', { level: 1 });
  check(await until(() => G().scenes.currentName === 'game' && !G().scenes.current.dealing), '进入第 1 关');
  const h = G().debug.hint(); const v = G().view;
  touch.start({ changedTouches: [{ identifier: 1, clientX: v.cssOffsetX + h.x * v.cssScale, clientY: v.cssOffsetY + h.y * v.cssScale }] });
  touch.end({ changedTouches: [{ identifier: 1, clientX: v.cssOffsetX + h.x * v.cssScale, clientY: v.cssOffsetY + h.y * v.cssScale }] });
  await sleep(400);
  check(G().debug.state().slotCount >= 1 || G().debug.state().remaining < G().debug.state().total, 'wx.onTouchStart/End 触摸点牌 → 卡进槽');
  for (const id of G().debug.referenceOrder()) { G().debug.tryPick(id); await sleep(5); }
  check(await until(() => G().scenes.currentName === 'result', 20000), '第 1 关按参考解通关 → 结算');
  const saved = JSON.parse(Object.values(storage)[0] || '{}');
  check(saved.cleared && saved.cleared[1] === true && saved.unlocked >= 2, 'wx.setStorageSync 存档：第 1 关已通关、解锁第 2 关');
  check(calls.some((c) => c.n === 'play' && /assets\/sfx\/.+\.mp3$/.test(c.a)), '音效走预渲染 mp3 (InnerAudioContext)');
  const missing = [...new Set(calls.filter((c) => c.n === 'missing-api').map((c) => c.a))];
  const bad = missing.filter((k) => /Recorder|Scene|navigateTo|checkScene/.test(k));
  check(bad.length === 0, '没有调用录屏 / 侧边栏等抖音专属 API', `探测过但不存在的可选 API：${missing.join(', ') || '无'}`);
  hideH.forEach((f) => f());
  await sleep(50);
  check(G().music.hidden === true, 'wx.onHide → BGM 暂停');
  showH.forEach((f) => f({}));
  await sleep(50);
  check(errors.length === 0, '无异常 / 无 console.error', errors.slice(0, 3).join(' | '));
  process.off('uncaughtException', onErr);
  sandbox.__ANIME_STACK__.running = false;
}

// ───────────────────────── B. Chromium + wx 模拟 ─────────────────────────
function serve() {
  const types = { '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.html': 'text/html; charset=utf-8' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = u === '/' || u === '/index.html' ? path.join(mockDir, 'index.html') : u === '/wx-mock.js' ? path.join(mockDir, 'wx-mock.js') : path.join(wxDir, u);
    if (!f.startsWith(wxDir) && !f.startsWith(mockDir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    const size = fs.statSync(f).size;
    const type = types[path.extname(f)] || 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? +m[1] : 0; const end = m[2] ? +m[2] : size - 1;
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      return fs.createReadStream(f, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function fillSlots(evalFn, dbg) {
  for (let i = 0; i < 12; i++) {
    const s = await dbg('state'); if (s.fsm !== 'playing') break;
    const c = await dbg('nonMatchingFree'); if (!c) break;
    await dbg('tryPick', c.id); await sleep(250);
  }
}

async function testBrowser(base) {
  console.log('\n[B] Chromium + wx 模拟层 (刘海屏 390×844)');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const dbg = (name, ...a) => page.evaluate(([n, a]) => window.__ANIME_STACK__.debug[n](...a), [name, a]);
  const wait = async (fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
  const tap = async (x, y) => {
    const v = await G(() => window.__ANIME_STACK__.view);
    await page.mouse.click(v.cssOffsetX + x * v.cssScale, v.cssOffsetY + y * v.cssScale);
    await sleep(120);
  };
  const btn = async (re) => { const list = await dbg('buttons'); return list.find((b) => new RegExp(re).test(b.label || '')) || null; };
  const tapBtn = async (re) => { const b = await btn(re); if (!b) return false; await tap(b.x, b.y); return true; };
  const calls = (name) => G((n) => window.__wxMock.calls.filter((c) => c.name === n), name);
  fs.mkdirSync(shotDir, { recursive: true });
  const shot = (n) => page.screenshot({ path: path.join(shotDir, n) });

  await page.goto(`${base}/index.html?adUnit=adunit-mock123`);
  check(await wait(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === 'menu'), '启动 → 菜单');
  const boot = await G(() => ({ names: window.__wxMock.calls.map((c) => c.name), canvases: window.__wxMock.calls.filter((c) => c.name === 'createCanvas').map((c) => c.args) }));
  check(boot.canvases[0] === 'main', '第一个 wx.createCanvas 是上屏画布', boot.canvases.length + ' 个画布');
  check(boot.names.includes('loadSubpackage'), 'wx.loadSubpackage("audio")');
  check(boot.names.includes('onShareAppMessage') && boot.names.includes('onShareTimeline') && boot.names.includes('showShareMenu'), '右上角菜单：转发 + 分享到朋友圈');
  const tl = await G(() => window.__wxMock.timelineHandler && window.__wxMock.timelineHandler());
  check(tl && tl.imageUrl === 'assets/share_timeline.png', '朋友圈分享参数', tl && tl.title);
  const view = await G(() => window.__ANIME_STACK__.view);
  check(view.cssOffsetY >= 84 && view.cssOffsetY + 960 * view.cssScale <= 844 - 34 + 0.5, '画面避开刘海 / 胶囊 (顶 ≥ 84) 和底部手势条', `top ${view.cssOffsetY.toFixed(1)} 缩放 ${view.cssScale.toFixed(3)}`);
  await sleep(1200);
  await shot('01-menu.png');
  check(!(await btn('侧边栏')), '菜单没有「侧边栏礼包」(微信无侧边栏)');

  await tapBtn('开始游戏|继续');
  check(await wait(() => window.__ANIME_STACK__.scenes.currentName === 'game' && !window.__ANIME_STACK__.scenes.current.dealing), '触摸「开始游戏」→ 第 1 关');
  check(await G(() => window.__ANIME_STACK__.scenes.current.recording === false && window.__ANIME_STACK__.platform.capabilities.record === false), '不录屏 (微信无抖音式录屏分享)');
  const h = await dbg('hint');
  await tap(h.x, h.y);
  await sleep(400);
  check((await dbg('state')).slotCount === 1, '触摸点一张牌 → 进卡槽');
  await shot('02-game.png');
  await G(() => window.__wxMock.emitHide());
  await sleep(100);
  const hid = await G(() => ({ fsm: window.__ANIME_STACK__.scenes.current.fsm.name, bgm: window.__ANIME_STACK__.music.hidden }));
  check(hid.fsm === 'paused' && hid.bgm === true, 'wx.onHide → 游戏暂停 + 声音停', JSON.stringify(hid));
  await G(() => window.__wxMock.emitShow({}));
  await sleep(100);
  check(await G(() => window.__ANIME_STACK__.music.hidden === false), 'wx.onShow → 声音恢复');
  await tapBtn('^继续$');
  check((await dbg('state')).fsm === 'playing', '点「继续」回到游戏');
  const ad = async (mode) => G(async (m) => { window.__wxMock.ad = m; const ok = await window.__ANIME_STACK__.ads.showRewardedAd('test'); return { ok, r: window.__ANIME_STACK__.ads.lastResult }; }, mode);
  check(await G(() => window.__ANIME_STACK__.platform.adMode === 'rewarded'), '填了广告位 → adMode = rewarded');
  const a1 = await ad('ended'); check(a1.ok === true && a1.r.reason === 'ended', '激励视频看完 (isEnded=true) → 发奖励');
  const a2 = await ad('early'); check(a2.ok === false && a2.r.reason === 'closed-early', '中途关闭 (isEnded=false) → 不发奖励');
  const a3 = await ad('error'); check(a3.ok === false && a3.r.reason === 'error', 'onError / 无填充 → 不发奖励');
  const cr = await calls('createRewardedVideoAd');
  check(cr.length >= 1 && cr[0].args.adUnitId === 'adunit-mock123', 'wx.createRewardedVideoAd 用配置里的 adUnitId');
  await tapBtn('^继续$');
  for (const id of await dbg('referenceOrder')) { await dbg('tryPick', id); await sleep(15); }
  check(await wait(() => window.__ANIME_STACK__.scenes.currentName === 'result', null, 20000), '第 1 关通关 → 结算');
  await sleep(1200);
  const rb = (await dbg('buttons')).map((b) => b.label);
  check(rb.includes('分享给好友') && !rb.some((l) => /录屏/.test(l)), '结算页：「分享给好友」，没有录屏按钮', rb.join('/'));
  await shot('03-result.png');
  await tapBtn('分享给好友');
  await sleep(200);
  const sh = (await calls('shareAppMessage')).pop();
  check(sh && /你行吗/.test(sh.args.title) && sh.args.imageUrl === 'assets/share.png' && !sh.args.channel, 'wx.shareAppMessage({title, imageUrl})', sh && sh.args.title);
  // 复活 (真实广告流程)
  await G(() => window.__ANIME_STACK__.scenes.change('game', { level: 3 }));
  await wait(() => window.__ANIME_STACK__.scenes.currentName === 'game' && !window.__ANIME_STACK__.scenes.current.dealing);
  await fillSlots(G, dbg);
  check(await wait(() => window.__ANIME_STACK__.debug.buttons().some((b) => b.label === '看广告复活'), null, 5000), '卡槽满 → 「看广告复活」弹窗');
  await G(() => { window.__wxMock.ad = 'ended'; });
  await tapBtn('看广告复活');
  await sleep(900);
  const rv = await dbg('state');
  check(rv.fsm === 'playing' && rv.props.revive === 0 && rv.slotCount <= 4, '看完广告 → 复活 (挪走 3 张)', JSON.stringify({ fsm: rv.fsm, slot: rv.slotCount }));
  // BGM 无缝循环
  const lp0 = await G(() => { const m = window.__ANIME_STACK__.music; const e = m.els[m.want].el; const L = e.loopLength; e.currentTime = L - 0.5; return { L, loops: e.loops }; });
  await sleep(1000);
  const lp1 = await G(() => { const m = window.__ANIME_STACK__.music; const e = m.els[m.want].el; return { loops: e.loops, fading: !!e._fade, a: !e.players[e.cur].paused, b: e.players[1 - e.cur] ? e.players[1 - e.cur].paused : null, t: e.currentTime }; });
  check(lp0.L > 30 && lp1.loops === lp0.loops + 1 && lp1.a && lp1.b === true && !lp1.fading && lp1.t < 1, 'BGM 到接缝：两路交叉淡化无缝循环 (LoopAudio)', JSON.stringify(lp1));
  const au = await G(() => ({ n: window.__wxMock.calls.filter((c) => c.name === 'createInnerAudioContext').length - window.__wxMock.calls.filter((c) => c.name === 'audio.destroy').length, plays: window.__wxMock.calls.filter((c) => c.name === 'audio.play').map((c) => c.args) }));
  check(au.n <= 10, `同时存在的 InnerAudioContext ${au.n} 个 ≤ 10`);
  check(au.plays.some((p) => /^bgm_(menu|game)\.mp3$/.test(p)), 'BGM 播放 (mp3，分包内)');
  check(au.plays.some((p) => /^(pick|clear)_\d\.mp3$/.test(p)), '音效播放预渲染 mp3');
  check(au.plays.some((p) => /^(c\d\d|start|win|warn|revive|lose)_\d\.mp3$/.test(p)), '角色语音播放');
  await page.reload();
  await wait(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === 'menu');
  const sv2 = await dbg('save');
  check(sv2.unlocked >= 2 && sv2.cleared[1], '重启后存档还在 (wx.getStorageSync)', `解锁到第 ${sv2.unlocked} 关`);
  check(errors.length === 0, '无页面错误', errors.slice(0, 3).join(' | '));

  // 首发版：没填广告位 ID → 免费「再试一次」
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(String(e)));
  await p2.goto(`${base}/index.html?fresh=1`);
  await p2.evaluate(() => localStorage.removeItem('__wx_storage'));
  await p2.reload();
  await p2.waitForFunction(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === 'menu', null, { timeout: 15000 });
  const d2 = (n, ...a) => p2.evaluate(([n, a]) => window.__ANIME_STACK__.debug[n](...a), [n, a]);
  check(await p2.evaluate(() => window.__ANIME_STACK__.platform.adMode === 'free'), '未填 rewardedAdUnitId → adMode = free');
  await p2.evaluate(() => window.__ANIME_STACK__.scenes.current.showHelp());
  const help = await p2.evaluate(() => window.__ANIME_STACK__.scenes.current.dialog.lines.join('|'));
  check(!/广告/.test(help) && /再试一次/.test(help), '玩法说明里不提广告');
  await p2.evaluate(() => window.__ANIME_STACK__.scenes.change('game', { level: 3 }));
  await p2.waitForFunction(() => window.__ANIME_STACK__.scenes.currentName === 'game' && !window.__ANIME_STACK__.scenes.current.dealing, null, { timeout: 15000 });
  await fillSlots(null, d2);
  await sleep(300);
  const dlg = await p2.evaluate(() => { const d = window.__ANIME_STACK__.scenes.current.dialog; return d ? { lines: d.lines.join('|'), btns: d.buttons.map((b) => b.label) } : null; });
  check(dlg && dlg.btns.includes('再试一次') && !/广告/.test(dlg.lines + dlg.btns.join('')), '卡槽满 → 「再试一次」弹窗，没有任何广告字样', dlg && dlg.btns.join('/'));
  await p2.screenshot({ path: path.join(shotDir, '04-free-revive.png') });
  const b2 = (await d2('buttons')).find((b) => b.label === '再试一次');
  const v2 = await p2.evaluate(() => window.__ANIME_STACK__.view);
  await p2.mouse.click(v2.cssOffsetX + b2.x * v2.cssScale, v2.cssOffsetY + b2.y * v2.cssScale);
  await sleep(700);
  const st2 = await d2('state');
  const noAd = await p2.evaluate(() => ({ created: window.__wxMock.calls.some((c) => c.name === 'createRewardedVideoAd'), overlay: !!window.__ANIME_STACK__.scenes.current.adOverlay, shown: window.__ANIME_STACK__.ads.stats.shown }));
  check(st2.fsm === 'playing' && st2.props.revive === 0 && st2.slotCount <= 4, '点「再试一次」→ 直接复活 (挪走 3 张)');
  check(!noAd.created && !noAd.overlay && noAd.shown === 0, '全程没有创建广告', JSON.stringify(noAd));
  await fillSlots(null, d2);
  await p2.waitForFunction(() => window.__ANIME_STACK__.scenes.currentName === 'result', null, { timeout: 8000 }).catch(() => {});
  check(await p2.evaluate(() => window.__ANIME_STACK__.scenes.currentName === 'result'), '同一关第二次塞满 → 直接失败结算 (每关只送一次)');
  check(errs2.length === 0, '无页面错误 (免费复活模式)', errs2.join(' | '));
  await browser.close();
}

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
try {
  testProject();
  await testNode();
  await testBrowser(base);
} finally { srv.close(); }
console.log(`\n结果：${pass} 项通过，${fail} 项失败`);
process.exit(fail ? 1 : 0);
