// 抖音小游戏版自动化测试 (不需要抖音账号 / 真机)：
//   A. Node vm + 纯桩 tt (无 DOM、无 window/document)：证明包里没有残留的浏览器 API；启动 → 菜单 → 第 1 关通关、存档、录屏调用
//   B. Chromium + tt 模拟层 (tools/douyin-mock/)：刘海/胶囊布局、触摸、分包、存档持久化、激励视频三种结果 + 复活、未填广告位时免费「再试一次」、
//      自动录屏 → 结算页分享录屏 (channel 'video')、录屏过短提示、分享给好友、切后台暂停/静音、侧边栏复访礼包、音效文件播放
// 用法：npm run build:douyin && node tools/test-douyin.mjs        (--store 另外生成商店截图到 docs/douyin/)
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dyDir = path.join(root, 'build-douyin');
const mockDir = path.join(root, 'tools/douyin-mock');
const shotDir = path.join(root, 'build/douyin-test');
const STORE = process.argv.includes('--store');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; let fail = 0;
function check(ok, msg, extra = '') {
  if (ok) { pass++; console.log(`  ✔ ${msg}${extra ? ` (${extra})` : ''}`); } else { fail++; console.log(`  ✘ ${msg}${extra ? ` (${extra})` : ''}`); }
}
if (!fs.existsSync(path.join(dyDir, 'js/main.js'))) { console.error('先运行 npm run build:douyin'); process.exit(1); }

// ───────────────────────── A. Node vm ─────────────────────────
async function testNode() {
  console.log('\n[A] Node vm + 桩 tt (无 DOM)');
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
  const mkCanvas = () => { const c = { width: 300, height: 150, id: canvases++ }; const cx = ctxProxy(c); c.getContext = () => cx; c.toTempFilePathSync = () => 'ttfile://tmp.png'; return c; };
  const storage = {};
  const showH = []; const hideH = []; const touch = {};
  const recH = { start: [], stop: [], error: [] };
  let recStarted = 0;
  const tt = {
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, pixelRatio: 3, statusBarHeight: 47, safeArea: { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 }, platform: 'ios' }),
    getMenuButtonBoundingClientRect: () => ({ top: 51, bottom: 83, left: 293, right: 380, width: 87, height: 32 }),
    getLaunchOptionsSync: () => ({ scene: '021001', query: {} }),
    createCanvas: () => { log('createCanvas'); return mkCanvas(); },
    createImage: () => {
      const img = { width: 0, height: 0, onload: null, onerror: null };
      let src = '';
      Object.defineProperty(img, 'src', { get: () => src, set: (v) => {
        src = v; log('image', v);
        setTimeout(() => { const ok = fs.existsSync(path.join(dyDir, v)); if (ok) { img.width = /bg/.test(v) ? 1080 : 160; img.height = /bg/.test(v) ? 1920 : 176; img.onload && img.onload(); } else img.onerror && img.onerror(new Error('404 ' + v)); }, 1);
      } });
      return img;
    },
    createInnerAudioContext: () => {
      log('audioCtx');
      const h = {}; const on = (k) => (f) => { (h[k] = h[k] || []).push(f); };
      let src = '';
      return { get src() { return src; }, set src(v) { src = v; if (!fs.existsSync(path.join(dyDir, v))) errors.push('missing audio ' + v); setTimeout(() => (h.canplay || []).forEach((f) => f()), 1); },
        loop: false, volume: 1, currentTime: 0, duration: 1, play() { log('play', src); }, pause() {}, stop() {}, seek() {}, destroy() {},
        onCanplay: on('canplay'), onPlay: on('play'), onPause: on('pause'), onStop: on('stop'), onEnded: on('ended'), onError: on('error') };
    },
    getStorageSync: (k) => (k in storage ? storage[k] : ''),
    setStorageSync: (k, v) => { log('setStorage', k); storage[k] = v; },
    onTouchStart: (f) => { touch.start = f; }, onTouchMove: (f) => { touch.move = f; }, onTouchEnd: (f) => { touch.end = f; }, onTouchCancel: (f) => { touch.cancel = f; },
    onShow: (f) => showH.push(f), onHide: (f) => hideH.push(f),
    loadSubpackage: (o) => { log('loadSubpackage', o.name); setTimeout(() => o.success({}), 5); return { onProgressUpdate() {} }; },
    getGameRecorderManager: () => ({
      start: (o) => { recStarted++; log('rec.start', o); setTimeout(() => recH.start.forEach((f) => f()), 1); },
      stop: () => { log('rec.stop'); setTimeout(() => recH.stop.forEach((f) => f({ videoPath: 'ttfile://temp/v.mp4' })), 1); },
      onStart: (f) => recH.start.push(f), onStop: (f) => recH.stop.push(f), onError: (f) => recH.error.push(f),
    }),
    shareAppMessage: (o) => { log('share', o.channel || 'card'); o.success && o.success(); },
    onShareAppMessage: (f) => log('onShareAppMessage', f()),
    checkScene: (o) => o.success({ isExist: true }),
    navigateToScene: (o) => { log('navigateToScene', o.scene); o.success && o.success(); },
  };
  const sandbox = { tt, console: { log() {}, info() {}, warn() {}, error: (...a) => errors.push(a.join(' ')) }, setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} } };
  sandbox.GameGlobal = sandbox;
  const ctx = vm.createContext(sandbox);
  const onErr = (e) => errors.push(String(e && e.stack || e));
  process.on('uncaughtException', onErr);
  vm.runInContext(fs.readFileSync(path.join(dyDir, 'douyin.config.js'), 'utf8'), ctx, { filename: 'douyin.config.js' });
  try { vm.runInContext(fs.readFileSync(path.join(dyDir, 'js/main.js'), 'utf8'), ctx, { filename: 'js/main.js' }); } catch (e) { onErr(e); }
  const G = () => sandbox.__ANIME_STACK__;
  const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (_) {} await sleep(20); } return false; };
  check(!!G(), '包在无 DOM 环境里启动 (GameGlobal.__ANIME_STACK__)');
  check(await until(() => G().scenes.currentName === 'menu'), '启动 → 菜单');
  check(calls.some((c) => c.n === 'loadSubpackage' && c.a === 'audio'), '加载分包 audio');
  check(typeof sandbox.window === 'undefined' && typeof sandbox.document === 'undefined', '沙箱里没有 window / document');
  G().scenes.change('game', { level: 1 });
  check(await until(() => G().scenes.currentName === 'game' && !G().scenes.current.dealing), '进入第 1 关');
  check(recStarted === 1, '开局自动录屏 tt.getGameRecorderManager().start', JSON.stringify(calls.find((c) => c.n === 'rec.start')?.a));
  // 模拟触摸：点一张能拿的牌
  const h = G().debug.hint(); const v = G().view;
  touch.start({ changedTouches: [{ identifier: 1, clientX: v.cssOffsetX + h.x * v.cssScale, clientY: v.cssOffsetY + h.y * v.cssScale }] });
  touch.end({ changedTouches: [{ identifier: 1, clientX: v.cssOffsetX + h.x * v.cssScale, clientY: v.cssOffsetY + h.y * v.cssScale }] });
  await sleep(400);
  check(G().debug.state().slotCount >= 1 || G().debug.state().remaining < G().debug.state().total, 'tt.onTouchStart/End 触摸点牌 → 卡进槽');
  for (const id of G().debug.referenceOrder()) { G().debug.tryPick(id); await sleep(5); }
  check(await until(() => G().scenes.currentName === 'result', 20000), '第 1 关按参考解通关 → 结算');
  check(calls.some((c) => c.n === 'rec.stop'), '结算时停止录屏');
  const saved = JSON.parse(Object.values(storage)[0] || '{}');
  check(saved.cleared && saved.cleared[1] === true && saved.unlocked >= 2, 'tt.setStorageSync 存档：第 1 关已通关、解锁第 2 关');
  check(calls.some((c) => c.n === 'play' && /assets\/sfx\/.+\.mp3$/.test(c.a)), '音效走预渲染 mp3 (InnerAudioContext)');
  hideH.forEach((f) => f());
  await sleep(50);
  check(G().music.hidden === true, 'tt.onHide → BGM 暂停');
  showH.forEach((f) => f({}));
  await sleep(50);
  check(errors.length === 0, '无异常 / 无 console.error', errors.slice(0, 3).join(' | '));
  process.off('uncaughtException', onErr);
  // 让游戏循环停下来：清掉沙箱定时器的方法——直接把 raf 置空
  sandbox.__ANIME_STACK__.running = false;
}

// ───────────────────────── B. Chromium + tt 模拟 ─────────────────────────
function serve() {
  const types = { '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.html': 'text/html; charset=utf-8' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = u === '/' || u === '/index.html' ? path.join(mockDir, 'index.html') : u === '/tt-mock.js' ? path.join(mockDir, 'tt-mock.js') : path.join(dyDir, u);
    if (!f.startsWith(dyDir) && !f.startsWith(mockDir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    const size = fs.statSync(f).size;
    const type = types[path.extname(f)] || 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {   // 支持 Range，音频才能 seek
      const start = m[1] ? +m[1] : 0; const end = m[2] ? +m[2] : size - 1;
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      return fs.createReadStream(f, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));   // 随机空闲端口
}

async function testBrowser(base) {
  console.log('\n[B] Chromium + tt 模拟层 (刘海屏 390×844)');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const dbg = (name, ...a) => page.evaluate(([n, a]) => window.__ANIME_STACK__.debug[n](...a), [name, a]);
  const scene = () => G(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName);
  const wait = async (fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
  const tap = async (x, y) => {
    const v = await G(() => window.__ANIME_STACK__.view);
    await page.mouse.click(v.cssOffsetX + x * v.cssScale, v.cssOffsetY + y * v.cssScale);
    await sleep(120);
  };
  const btn = async (re) => { const list = await dbg('buttons'); return list.find((b) => new RegExp(re).test(b.label || '')) || null; };
  const tapBtn = async (re) => { const b = await btn(re); if (!b) return false; await tap(b.x, b.y); return true; };
  const calls = (name) => G((n) => window.__ttMock.calls.filter((c) => c.name === n), name);
  fs.mkdirSync(shotDir, { recursive: true });
  const shot = (n) => page.screenshot({ path: path.join(shotDir, n) });

  await page.goto(`${base}/index.html?adUnit=mock-unit-123`);
  check(await wait(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === 'menu'), '启动 → 菜单');
  const boot = await G(() => ({ names: window.__ttMock.calls.map((c) => c.name), canvases: window.__ttMock.calls.filter((c) => c.name === 'createCanvas').map((c) => c.args) }));
  check(boot.canvases[0] === 'main', '第一个 tt.createCanvas 是上屏画布', boot.canvases.length + ' 个画布');
  check(boot.names.includes('onShow') && boot.names.indexOf('onShow') < boot.names.indexOf('createCanvas'), 'game.js 启动时同步注册 tt.onShow (侧边栏复访要求)');
  check(boot.names.includes('loadSubpackage'), 'tt.loadSubpackage("audio")');
  check(boot.names.includes('onShareAppMessage') && boot.names.includes('showShareMenu'), '右上角菜单分享 onShareAppMessage');
  const share0 = await G(() => window.__ttMock.shareHandler && window.__ttMock.shareHandler());
  check(share0 && /美少女/.test(share0.title) && share0.imageUrl === 'assets/share.png', '被动分享卡片：标题 + share.png', share0 && share0.title);
  const view = await G(() => window.__ANIME_STACK__.view);
  check(view.cssOffsetY >= 84 && view.cssOffsetY + 960 * view.cssScale <= 844 - 34 + 0.5, '画面避开刘海 / 胶囊 (顶 ≥ 84) 和底部手势条', `top ${view.cssOffsetY.toFixed(1)} 缩放 ${view.cssScale.toFixed(3)}`);
  await sleep(800);
  await shot('01-menu.png');
  check(await wait(() => window.__ANIME_STACK__.debug.buttons().some((b) => b.label === '侧边栏礼包')), '菜单出现「侧边栏礼包」入口 (checkScene isExist=true)');

  // —— 侧边栏复访 ——
  await tapBtn('^侧边栏礼包$');
  check(!!(await btn('去侧边栏')), '未从侧边栏进入：弹窗提供「去侧边栏」');
  await shot('02-sidebar-dialog.png');
  await tapBtn('去侧边栏');
  check((await calls('navigateToScene')).length === 1, 'tt.navigateToScene({scene:"sidebar"})');
  await G(() => window.__ttMock.emitShow({ launch_from: 'homepage', location: 'sidebar_card', scene: '021036' }));
  await tapBtn('^侧边栏礼包$');
  check(!!(await btn('领取奖励')), '从侧边栏回来 (onShow launch_from=homepage, location=sidebar_card)：可「领取奖励」');
  await tapBtn('领取奖励');
  const sv = await dbg('save');
  check(sv.bonusMoveOut === 1 && /^\d{4}-?\d{2}-?\d{2}$/.test(String(sv.sidebarClaimed)), '领取后写入存档 (今日已领 + 下一局移出 +1)', `${sv.sidebarClaimed}`);
  await tapBtn('^侧边栏礼包$');
  check(!!(await btn('好的')), '同一天再点：提示今天领过');
  await tapBtn('好的');

  // —— 开局：触摸「开始游戏」→ 第 1 关 ——
  await tapBtn('开始游戏|继续');
  check(await wait(() => window.__ANIME_STACK__.scenes.currentName === 'game' && !window.__ANIME_STACK__.scenes.current.dealing), '触摸「开始游戏」→ 第 1 关');
  const st = await dbg('state');
  check(st.props.moveOut === 2, '侧边栏奖励生效：本局「移出」2 次', JSON.stringify(st.props));
  check((await dbg('save')).bonusMoveOut === 0, '奖励只生效一局 (存档清零)');
  const rs = await calls('recorder.start');
  check(rs.length === 1 && rs[0].args.duration === 290, '开局自动录屏 recorder.start({duration:290})');
  await sleep(300);
  check(await G(() => window.__ANIME_STACK__.platform.record.state === 'recording'), '录屏中 (onStart)，HUD 显示「录屏中」');
  // 触摸点牌
  const h = await dbg('hint');
  await tap(h.x, h.y);
  await sleep(400);
  check((await dbg('state')).slotCount === 1, '触摸点一张牌 → 进卡槽');
  await shot('03-game.png');
  // 切后台
  await G(() => window.__ttMock.emitHide());
  await sleep(100);
  const hid = await G(() => ({ fsm: window.__ANIME_STACK__.scenes.current.fsm.name, bgm: window.__ANIME_STACK__.music.hidden }));
  check(hid.fsm === 'paused' && hid.bgm === true, 'tt.onHide → 游戏暂停 + 声音停', JSON.stringify(hid));
  await G(() => window.__ttMock.emitShow({}));
  await sleep(100);
  check(await G(() => window.__ANIME_STACK__.music.hidden === false), 'tt.onShow → 声音恢复，停在暂停页等玩家点继续');
  await tapBtn('^继续$');
  check((await dbg('state')).fsm === 'playing', '点「继续」回到游戏', JSON.stringify(await dbg('buttons')).slice(0, 200));
  // 激励视频：三种结果
  const ad = async (mode) => G(async (m) => { window.__ttMock.ad = m; const ok = await window.__ANIME_STACK__.ads.showRewardedAd('test'); return { ok, r: window.__ANIME_STACK__.ads.lastResult }; }, mode);
  const a1 = await ad('ended'); check(a1.ok === true && a1.r.reason === 'ended', '激励视频看完 (isEnded=true) → 发奖励');
  const a2 = await ad('early'); check(a2.ok === false && a2.r.reason === 'closed-early', '中途关闭 (isEnded=false) → 不发奖励');
  const a3 = await ad('error'); check(a3.ok === false && a3.r.reason === 'error', 'onError / 无填充 → 不发奖励 (rewardOnAdError=false)');
  check((await calls('createRewardedVideoAd')).length >= 1 && (await calls('createRewardedVideoAd'))[0].args.adUnitId === 'mock-unit-123', 'tt.createRewardedVideoAd 用配置里的 adUnitId');
  check((await dbg('state')).fsm === 'paused', '真广告播放时游戏暂停、声音停 (app:hidden)');
  await tapBtn('^继续$');
  // 通关 (录屏需 ≥3 秒)
  await sleep(2500);
  for (const id of await dbg('referenceOrder')) { await dbg('tryPick', id); await sleep(15); }
  check(await wait(() => window.__ANIME_STACK__.scenes.currentName === 'result', null, 20000), '第 1 关通关 → 结算', JSON.stringify(await dbg('state')));
  check((await calls('recorder.stop')).length >= 1, '结算时 recorder.stop()');
  check(await wait(() => window.__ANIME_STACK__.debug.buttons().some((b) => b.label === '分享通关录屏')), '结算页出现「分享通关录屏」');
  await sleep(1200);
  await shot('04-result.png');
  await tapBtn('分享通关录屏');
  await sleep(200);
  const sh = (await calls('shareAppMessage')).pop();
  check(sh && sh.args.channel === 'video' && /^ttfile:/.test(sh.args.extra.videoPath) && sh.args.extra.videoTopics.includes('美少女了个美'), 'tt.shareAppMessage({channel:"video", extra:{videoPath, videoTopics}})');
  await tapBtn('分享给好友');
  await sleep(200);
  const sh2 = (await calls('shareAppMessage')).pop();
  check(sh2 && !sh2.args.channel && /第|你行吗/.test(sh2.args.title), '「分享给好友」普通分享卡片', sh2 && sh2.args.title);
  // 录屏过短：下一关秒过
  await tapBtn('下一关');
  check(await wait(() => window.__ANIME_STACK__.scenes.currentName === 'game' && !window.__ANIME_STACK__.scenes.current.dealing), '下一关 (录屏重新开始)');
  check((await calls('recorder.start')).length === 2, '第 2 关重新自动录屏');
  await G(() => { window.__ttMock.recSeconds = 1; });
  for (const id of await dbg('referenceOrder')) { await dbg('tryPick', id); await sleep(10); }
  check(await wait(() => window.__ANIME_STACK__.scenes.currentName === 'result', null, 20000), '第 2 关通关');
  check(await wait(() => window.__ANIME_STACK__.debug.buttons().some((b) => b.label === '录屏失败')), '录屏 < 3 秒：按钮变「录屏失败」并提示');
  const toast = await G(() => window.__ANIME_STACK__.scenes.current.toastText);
  check(/低于 3 秒/.test(toast || ''), '提示文案', toast);
  await G(() => { window.__ttMock.recSeconds = null; });
  // 复活 (真实广告流程)
  await G(() => window.__ANIME_STACK__.scenes.change('game', { level: 3 }));
  await wait(() => window.__ANIME_STACK__.scenes.currentName === 'game' && !window.__ANIME_STACK__.scenes.current.dealing);
  for (let i = 0; i < 12; i++) {
    const s = await dbg('state'); if (s.fsm !== 'playing') break;
    const c = await dbg('nonMatchingFree'); if (!c) break;
    await dbg('tryPick', c.id); await sleep(250);
  }
  check(await wait(() => window.__ANIME_STACK__.debug.buttons().some((b) => b.label === '看广告复活'), null, 5000), '卡槽满 → 复活弹窗');
  await G(() => { window.__ttMock.ad = 'early'; });
  await tapBtn('看广告复活');
  await sleep(700);
  const early = await G(() => ({ fsm: window.__ANIME_STACK__.scenes.current.fsm.name, toast: (window.__ANIME_STACK__.scenes.current.toasts[0] || {}).text }));
  check(early.fsm === 'failed' && /没看完/.test(early.toast || ''), '没看完广告 → 不复活 + 提示', JSON.stringify(early));
  await G(() => { const s = window.__ANIME_STACK__.scenes.current; window.__ttMock.ad = 'ended'; s.startRevive(); });
  await sleep(800);
  const rv = await dbg('state');
  check(rv.fsm === 'playing' && rv.props.revive === 0 && rv.slotCount <= 4, '看完广告 → 复活 (挪走 3 张)', JSON.stringify({ fsm: rv.fsm, slot: rv.slotCount }));
  // BGM 无缝循环：跳到接缝前 0.5 秒，看两路交叉淡化
  const lp0 = await G(() => { const m = window.__ANIME_STACK__.music; const e = m.els[m.want].el; const L = e.loopLength; e.currentTime = L - 0.5; return { L, src: e.src, cls: e.constructor.name, loops: e.loops }; });
  await sleep(1000);
  const lp1 = await G(() => { const m = window.__ANIME_STACK__.music; const e = m.els[m.want].el; return { loops: e.loops, cur: e.cur, fading: !!e._fade, a: !e.players[e.cur].paused, b: e.players[1 - e.cur] ? e.players[1 - e.cur].paused : null, t: e.currentTime, bt: e.players[e.cur].currentTime }; });
  check(lp0.L > 30 && lp1.loops === lp0.loops + 1 && lp1.a && lp1.b === true && !lp1.fading && lp1.t < 1, 'BGM 到接缝：第二路从 0 开始、交叉淡化后旧的一路停止 (LoopAudio)', JSON.stringify({ L: +lp0.L.toFixed(3), ...lp1 }));
  // 音频
  const au = await G(() => ({ n: window.__ttMock.calls.filter((c) => c.name === 'createInnerAudioContext').length - window.__ttMock.calls.filter((c) => c.name === 'audio.destroy').length, total: window.__ttMock.calls.filter((c) => c.name === 'createInnerAudioContext').length, plays: window.__ttMock.calls.filter((c) => c.name === 'audio.play').map((c) => c.args) }));
  check(au.n <= 10, `同时存在的 InnerAudioContext ${au.n} 个 ≤ 10 (BGM 当前曲 2 路 + 语音 1 + 音效 6)`, `累计创建 ${au.total}`);
  check(au.plays.some((p) => /^bgm_(menu|game)\.mp3$/.test(p)), 'BGM 播放 (mp3，分包内)');
  check(au.plays.some((p) => /^(pick|clear)_\d\.mp3$/.test(p)), '音效播放预渲染 mp3', au.plays.filter((p) => /_\d\.mp3/.test(p)).slice(0, 3).join(','));
  check(au.plays.some((p) => /^(c\d\d|start|win|warn|revive|lose)_\d\.mp3$/.test(p)), '角色语音播放 (共用 1 个播放器)');
  // 存档持久化：重新打开
  await page.reload();
  await wait(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === 'menu');
  const sv2 = await dbg('save');
  check(sv2.unlocked >= 3 && sv2.cleared[1] && sv2.cleared[2], '重启后存档还在 (tt.getStorageSync)', `解锁到第 ${sv2.unlocked} 关`);
  check(errors.length === 0, '无页面错误', errors.slice(0, 3).join(' | '));
  // 首发版：没填广告位 ID → 免费「再试一次」，没有任何广告界面
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(String(e)));
  await p2.goto(`${base}/index.html?fresh=1`);
  await p2.evaluate(() => localStorage.removeItem('__tt_storage'));
  await p2.reload();
  await p2.waitForFunction(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === 'menu', null, { timeout: 15000 });
  const d2 = (n, ...a) => p2.evaluate(([n, a]) => window.__ANIME_STACK__.debug[n](...a), [n, a]);
  check(await p2.evaluate(() => window.__ANIME_STACK__.platform.adMode === 'free'), '未填 rewardedAdUnitId → adMode = free');
  await p2.evaluate(() => window.__ANIME_STACK__.scenes.current.showHelp());
  const help = await p2.evaluate(() => window.__ANIME_STACK__.scenes.current.dialog.lines.join('|'));
  check(!/广告/.test(help) && /再试一次/.test(help), '玩法说明里不提广告', help.split('|').find((l) => /塞满/.test(l)));
  await p2.evaluate(() => window.__ANIME_STACK__.scenes.change('game', { level: 3 }));
  await p2.waitForFunction(() => window.__ANIME_STACK__.scenes.currentName === 'game' && !window.__ANIME_STACK__.scenes.current.dealing, null, { timeout: 15000 });
  for (let i = 0; i < 12; i++) {
    const s = await d2('state'); if (s.fsm !== 'playing') break;
    const c = await d2('nonMatchingFree'); if (!c) break;
    await d2('tryPick', c.id); await sleep(250);
  }
  await sleep(300);
  const dlg = await p2.evaluate(() => { const d = window.__ANIME_STACK__.scenes.current.dialog; return d ? { lines: d.lines.join('|'), btns: d.buttons.map((b) => b.label) } : null; });
  check(dlg && dlg.btns.includes('再试一次') && !/广告/.test(dlg.lines + dlg.btns.join('')), '卡槽满 → 「再试一次」弹窗，没有任何广告字样', dlg && `${dlg.btns.join('/')} · ${dlg.lines}`);
  const b2 = (await d2('buttons')).find((b) => b.label === '再试一次');
  const v2 = await p2.evaluate(() => window.__ANIME_STACK__.view);
  await p2.mouse.click(v2.cssOffsetX + b2.x * v2.cssScale, v2.cssOffsetY + b2.y * v2.cssScale);
  await sleep(700);
  const st2 = await d2('state');
  const noAd = await p2.evaluate(() => ({ created: window.__ttMock.calls.some((c) => c.name === 'createRewardedVideoAd'), overlay: !!window.__ANIME_STACK__.scenes.current.adOverlay, fake: window.__ANIME_STACK__.ads.isShowingFake, shown: window.__ANIME_STACK__.ads.stats.shown }));
  check(st2.fsm === 'playing' && st2.props.revive === 0 && st2.slotCount <= 4, '点「再试一次」→ 直接复活 (挪走 3 张)', JSON.stringify({ fsm: st2.fsm, slot: st2.slotCount }));
  check(!noAd.created && !noAd.overlay && !noAd.fake && noAd.shown === 0, '全程没有创建广告、没有占位广告画面', JSON.stringify(noAd));
  for (let i = 0; i < 12; i++) {
    const s = await d2('state'); if (s.fsm !== 'playing') break;
    const c = await d2('nonMatchingFree'); if (!c) break;
    await d2('tryPick', c.id); await sleep(250);
  }
  await p2.waitForFunction(() => window.__ANIME_STACK__.scenes.currentName === 'result', null, { timeout: 8000 }).catch(() => {});
  check(await p2.evaluate(() => window.__ANIME_STACK__.scenes.currentName === 'result'), '同一关第二次塞满 → 直接失败结算 (每关只送一次)');
  await p2.screenshot({ path: path.join(shotDir, '05-free-revive-fail.png') });
  check(errs2.length === 0, '无页面错误 (免费复活模式)', errs2.join(' | '));
  await browser.close();
}

// ───────────────────────── 商店素材截图 ─────────────────────────
async function storeShots(base) {
  console.log('\n[商店素材] 1080×1920 截图 / 图标 / 宣传图');
  const out = path.join(root, 'docs/douyin');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  await page.goto(`${base}/index.html?notch=0`);
  await page.waitForFunction(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === 'menu', null, { timeout: 15000 });
  await page.evaluate(() => { localStorage.clear(); window.__ANIME_STACK__.debug.setProgress({ unlocked: 6, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 2 } }); window.__ANIME_STACK__.scenes.change('menu'); });
  await sleep(1800);
  await page.screenshot({ path: path.join(out, 'screenshot_1_menu.png') });
  await page.evaluate(() => window.__ANIME_STACK__.scenes.change('game', { level: 4 }));
  await sleep(2600);
  const dbg = (n, ...a) => page.evaluate(([n, a]) => window.__ANIME_STACK__.debug[n](...a), [n, a]);
  const ord = await dbg('referenceOrder');
  for (const id of ord.slice(0, 10)) { await dbg('tryPick', id); await sleep(260); }
  await sleep(500);
  await page.screenshot({ path: path.join(out, 'screenshot_2_game.png') });
  await page.evaluate(() => window.__ANIME_STACK__.scenes.change('game', { level: 10 }));
  await sleep(2800);
  const o2 = await dbg('referenceOrder');
  for (const id of o2.slice(0, 5)) { await dbg('tryPick', id); await sleep(200); }
  await sleep(600);
  await page.screenshot({ path: path.join(out, 'screenshot_3_boss.png') });
  await page.evaluate(() => window.__ANIME_STACK__.scenes.change('game', { level: 2 }));
  await sleep(2400);
  for (const id of await dbg('referenceOrder')) { await dbg('tryPick', id); await sleep(12); }
  await page.waitForFunction(() => window.__ANIME_STACK__.scenes.currentName === 'result', null, { timeout: 20000 });
  await sleep(2600);
  await page.screenshot({ path: path.join(out, 'screenshot_4_win.png') });
  await page.evaluate(() => window.__ANIME_STACK__.scenes.change('levels'));
  await sleep(1500);
  await page.screenshot({ path: path.join(out, 'screenshot_5_levels.png') });
  await browser.close();
  console.log('  → docs/douyin/screenshot_1..5 (1080×1920)');
}

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
try {
  if (STORE) await storeShots(base);
  else { await testNode(); await testBrowser(base); }
} finally { srv.close(); }
if (!STORE) {
  console.log(`\n结果：${pass} 项通过，${fail} 项失败`);
  process.exit(fail ? 1 : 0);
}
process.exit(0);
