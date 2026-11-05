// 微信小游戏版无头测试：在 Node 里用「模拟 wx 对象 + @napi-rs/canvas」直接运行 build-wechat/ 的产物。
// 没有任何 window / document / DOM —— 如果代码里误用了浏览器 API，这里会直接报错。
// 覆盖：工程文件 (game.json subpackages / project.config.json compileType / 包体积)；启动 / 菜单 / 安全区布局 (getWindowInfo + 胶囊)；
//       触摸玩通第 1 关；预渲染音效 (WebAudio 实现的 InnerAudioContext 池) 与分包音频；结算页「分享给好友」(无奖励)；
//       右上角转发 + 朋友圈；激励视频 成功 / 中途关闭 / 无广告(1004)，且关闭了 1004 兜底分享页；
//       没有抖音专属功能 (侧边栏 / 录屏)；切后台自动暂停；存档在「重启」后保留；
//       未填广告位 id：没有任何看广告按钮，免费精确提示 + 冷却，每关 1 次「再试一次」。
// 用法：npm run build:wechat && node tools/test_wechat.mjs
// 依赖：@napi-rs/canvas (同 test_douyin.mjs)
import { createRequire } from 'node:module';
import { promises as fs, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { centerOf } from '../src/core/geometry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bd = path.join(root, 'build-wechat');
const shots = path.join(root, 'tools/preview/wechat');
const phase = process.argv[2] || 'all';
const store = path.join(root, 'tools/preview/wechat/.storage.json');
const req = createRequire(import.meta.url);
let napi;
for (const d of [root, process.env.NAPI_CANVAS_DIR, '/workspace/_scratch/ttmock'].filter(Boolean)) {
  try { napi = createRequire(path.join(d, 'x.js'))('@napi-rs/canvas'); break; } catch (_) { /* next */ }
}
if (!napi) { console.error('缺少 @napi-rs/canvas：在任意目录 npm i @napi-rs/canvas 后用 NAPI_CANVAS_DIR 指定'); process.exit(2); }

if (phase === 'all') {
  await fs.mkdir(shots, { recursive: true });
  await fs.rm(store, { force: true });
  let ok = true;
  for (const ph of ['p1', 'p2']) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ph], { stdio: 'inherit', timeout: 240000 });
    if (r.status !== 0) ok = false;
  }
  console.log(ok ? '\n微信版测试全部通过 ✓' : '\n微信版测试有失败 ✗');
  process.exit(ok ? 0 : 1);
}

// ———————————————————— 模拟 wx ————————————————————
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = { audioCtx: 0, webAudioCtx: 0, adOpts: null, shareMenu: null, sysInfoCalls: 0, played: [], missing: [], earlyAudio: [], adShows: 0, rec: [], share: [], nav: 0, storageWrites: 0, warn: [], unbalanced: [] };
const handlers = { show: [], hide: [], ts: [], tm: [], te: [], tc: [], share: null, timeline: null };
const SYS = { windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, pixelRatio: 3, statusBarHeight: 47, platform: 'ios',
  safeArea: { left: 0, right: 390, top: 47, bottom: 810, width: 390, height: 763 } };
let storage = existsSync(store) ? JSON.parse(readFileSync(store, 'utf8')) : {};
let subLoaded = false; let canvases = 0; let mainCanvas = null;
const adMode = { v: 'ok' };

const resolveFile = (p) => path.join(bd, String(p).replace(/^\.?\//, ''));

let ad = null;

global.GameGlobal = global;
global.wx = {
  getWindowInfo: () => SYS,
  getSystemInfoSync: () => { log.sysInfoCalls++; return SYS; },
  getAccountInfoSync: () => ({ miniProgram: { appId: 'wx_mock_appid', envVersion: 'develop' } }),
  getMenuButtonBoundingClientRect: () => ({ top: 51, bottom: 83, left: 296, right: 383, width: 87, height: 32 }),
  getLaunchOptionsSync: () => ({ query: {}, scene: 1001 }),
  onShow: (f) => handlers.show.push(f), onHide: (f) => handlers.hide.push(f), onWindowResize() {},
  onTouchStart: (f) => handlers.ts.push(f), onTouchMove: (f) => handlers.tm.push(f), onTouchEnd: (f) => handlers.te.push(f), onTouchCancel: (f) => handlers.tc.push(f),
  createCanvas() {
    const c = napi.createCanvas(1, 1); canvases++;
    if (!mainCanvas) {
      mainCanvas = c;
      // 检查 save/restore 是否成对 (全屏画布模式下多一次 restore 会把安全区偏移弄丢)
      const ctx = c.getContext('2d'); const sv = ctx.save.bind(ctx); const rs = ctx.restore.bind(ctx); let d = 0;
      ctx.save = () => { d++; sv(); };
      ctx.restore = () => { d--; if (d < 0) { log.unbalanced.push(new Error().stack.split('\n')[2].trim()); d = 0; } rs(); };
    }
    return c;
  },
  createImage() {
    const img = new napi.Image();
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(img), 'src');
    let s = '';
    Object.defineProperty(img, 'src', { get: () => s, set: (v) => { s = v; if (!existsSync(resolveFile(v))) { log.missing.push(v); setTimeout(() => img.onerror && img.onerror(new Error('404')), 1); return; } d.set.call(img, resolveFile(v)); } });
    return img;
  },
  createInnerAudioContext(o) {
    log.audioCtx++; if (o && o.useWebAudioImplement) log.webAudioCtx++;
    const cbs = { play: [], ended: [], error: [], canplay: [] }; let src = '';
    return {
      volume: 1, loop: false, currentTime: 0, duration: 1,
      get src() { return src; },
      set src(v) { src = v; },
      onPlay: (f) => cbs.play.push(f), onPause() {}, onStop() {}, onEnded: (f) => cbs.ended.push(f), onCanplay: (f) => cbs.canplay.push(f), onError: (f) => cbs.error.push(f),
      play() {
        if (!src) return;
        if (src.startsWith('audio/') && !subLoaded) { log.earlyAudio.push(src); cbs.error.forEach((f) => f({ errCode: 10004 })); return; }
        if (!existsSync(resolveFile(src))) { log.missing.push(src); cbs.error.forEach((f) => f({ errCode: 10002 })); return; }
        log.played.push({ src, vol: this.volume, t: Date.now() });
        cbs.play.forEach((f) => f());
        const dur = src.includes('/bgm/') ? 1e9 : 400;
        setTimeout(() => cbs.ended.forEach((f) => f()), dur > 1e8 ? 2 ** 30 : dur);
      },
      pause() {}, stop() {}, seek() {}, destroy() {},
    };
  },
  loadSubpackage(o) { setTimeout(() => { subLoaded = true; o.success && o.success({}); }, 150); return { onProgressUpdate() {} }; },
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; log.storageWrites++; writeFileSync(store, JSON.stringify(storage)); },
  createRewardedVideoAd(o) {
    if (ad) return ad;
    log.adOpts = o;
    const cb = { close: [], error: [] };
    ad = {
      unit: o.adUnitId,
      onClose: (f) => cb.close.push(f), onError: (f) => cb.error.push(f), onLoad() {},
      load: () => (adMode.v === 'error' ? Promise.reject({ errCode: 1004 }) : Promise.resolve()),
      show() {
        log.adShows++;
        if (adMode.v === 'error') { setTimeout(() => cb.error.forEach((f) => f({ errCode: 1004, errMsg: 'no ad' })), 5); return Promise.reject({ errCode: 1004 }); }
        setTimeout(() => cb.close.forEach((f) => f({ isEnded: adMode.v === 'ok' })), 30);
        return Promise.resolve();
      },
    };
    return ad;
  },
  shareAppMessage(o) { log.share.push(o); },   // 微信不回调分享结果
  onShareAppMessage: (f) => { handlers.share = f; },
  onShareTimeline: (f) => { handlers.timeline = f; },
  showShareMenu(o) { log.shareMenu = o; },
  getUpdateManager: () => ({ onCheckForUpdate() {}, onUpdateReady() {}, onUpdateFailed() {}, applyUpdate() {} }),
  showModal() {},
};

// ———————————————————— 测试工具 ————————————————————
let pass = 0; let fail = 0;
function check(name, cond, extra = '') { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } }
async function until(fn, ms = 8000, step = 30) { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (_) { /* 等 */ } await sleep(step); } return false; }
let game;
const scene = () => game.scenes.current;
/** 逻辑坐标 (540×960) → 屏幕坐标 (390×844 的 clientX/Y)，走真实的 wx.onTouch* 通道 */
function client(x, y) { const c = game.layout.css; return [c.ox + x * c.s, c.oy + y * c.s]; }
let tid = 1;
async function tap(x, y, hold = 60) {
  const [cx, cy] = client(x, y); const t = { identifier: tid++, clientX: cx, clientY: cy };
  handlers.ts.forEach((f) => f({ touches: [t], changedTouches: [t] }));
  await sleep(hold);
  handlers.te.forEach((f) => f({ touches: [], changedTouches: [t] }));
  await sleep(60);
}
const tapBtn = (b) => tap(b.x, b.y);
async function shot(name) { await sleep(900); await fs.writeFile(path.join(shots, name + '.png'), await mainCanvas.encode('png')); }
const btnByLabel = (list, re) => (list || []).find((b) => re.test(b.label || ''));

async function playFind(levelId) {
  await until(() => scene().name === 'game' && scene().level.id === levelId && scene().dialog);
  await sleep(300);
  await tapBtn(scene().dialog.btn);
  await until(() => scene().state === 'play');
  const s = scene();
  for (const sp of s.level.spots) {
    const [nx, ny] = centerOf(sp);
    const [x, y] = s.toScreen(nx, ny, s.views[0]);
    await tap(x, y);
    await sleep(420);
  }
  if (await until(() => s.state === 'quiz', 2000)) { await sleep(300); await tapBtn(s.dialog.buttons[s.level.quiz.answer]); }
  return s;
}
// ———————————————————— 启动 ————————————————————
const t0 = Date.now();
if (phase === 'p1') {
  // 第一次启动：直接调用 js/main.js 的 boot，传入带假广告位 id 的配置 → 走真实 wx 激励视频分支
  const cfg = { ...req(path.join(bd, 'platform-config.js')), rewardedAdUnitId: 'adunit-mock' };
  game = req(path.join(bd, 'js/main.js')).boot(cfg);
} else {
  // 第二次启动 (= 重启)：走真正的 game.js 入口 + 原样的 platform-config.js (广告位为空)
  req(path.join(bd, 'game.js'));
  game = global.__SPOTDIFF__;
}
console.log(`\n[${phase === 'p1' ? '第一次启动' : '重启后'}]`);
check('game.js 启动并进入主菜单', await until(() => scene() && scene().name === 'menu', 15000), scene() && scene().name);
console.log(`    启动到菜单 ${Date.now() - t0} ms`);
check('上屏画布 = 第一次 createCanvas，尺寸 = 屏幕 × dpr(封顶 2)', mainCanvas.width === 780 && mainCanvas.height === 1688, `${mainCanvas.width}x${mainCanvas.height}`);
const css = game.layout.css;
check('内容避开刘海和胶囊按钮 (顶部 ≥ 胶囊底部)', css.oy >= 83 && css.top >= 83, JSON.stringify(css));
check('内容不压到 Home 指示条', css.oy + 960 * css.s <= 810 + 0.5);
await until(() => subLoaded && game.music && log.played.some((p) => p.src.includes('bgm_menu')), 4000);
check('音频分包后台加载完成后播放菜单 BGM (audio/bgm/bgm_menu.mp3)', log.played.some((p) => p.src === 'audio/bgm/bgm_menu.mp3'));
check('分包加载完成前没有尝试播放分包里的音频', log.earlyAudio.length === 0, log.earlyAudio.join(','));
check('没有抖音专属的侧边栏礼包入口', !(scene().sidebarBtn && scene().sidebarBtn.visible));
check('布局用 wx.getWindowInfo (不调用已废弃的 getSystemInfoSync)', log.sysInfoCalls === 0, String(log.sysInfoCalls));
await shot(phase + '_menu');

if (phase === 'p1') {
  const bundle = readFileSync(path.join(bd, 'js/main.js'), 'utf8');
  const bad = bundle.match(/\b(window|document|localStorage|navigator|location)\.[A-Za-z]+|new (Image|Audio)\(/g) || [];
  check('静态扫描：游戏代码里没有 window / document / localStorage / new Image / new Audio', bad.length === 0, bad.slice(0, 5).join(','));
  check('静态扫描：没有打包进抖音专属代码 (录屏 / 侧边栏)', !/getGameRecorderManager|navigateToScene|checkScene/.test(bundle));
  // —— 工程文件 ——
  console.log('\n[工程文件]');
  const gj = JSON.parse(readFileSync(path.join(bd, 'game.json'), 'utf8'));
  check('game.json：竖屏 + subpackages 声明 audio 分包', gj.deviceOrientation === 'portrait' && Array.isArray(gj.subpackages) && gj.subpackages[0].root === 'audio/' && existsSync(path.join(bd, 'audio/game.js')));
  const pj = JSON.parse(readFileSync(path.join(bd, 'project.config.json'), 'utf8'));
  check('project.config.json：compileType=game，有 appid / projectname', pj.compileType === 'game' && !!pj.appid && !!pj.projectname, JSON.stringify({ c: pj.compileType, a: pj.appid }));
  const size = JSON.parse(readFileSync(path.join(root, 'build-wechat-size.json'), 'utf8'));
  check(`主包 ${(size.main / 1048576).toFixed(2)} MB ≤ 4 MB，总包 ${(size.total / 1048576).toFixed(2)} MB ≤ 30 MB`, size.main <= 4 * 1048576 && size.total <= 30 * 1048576);
  const allFiles = []; const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else allFiles.push(p); } }; walk(bd);
  check('工程里没有 ogg 文件', !allFiles.some((f) => /\.ogg$/i.test(f)));
  check('upload.bat 调用 cli.bat upload --project … -v … -d …', /cli\.bat"?\r?\n/.test(readFileSync(path.join(bd, 'upload.bat'), 'latin1')) && /upload --project "%~dp0\." -v \d+\.\d+\.\d+ -d /.test(readFileSync(path.join(bd, 'upload.bat'), 'latin1')));

  // —— 第 1 关：触摸玩通 + 分享给好友 ——
  console.log('\n[第 1 关：触摸玩通 / 分享给好友]');
  await tapBtn(scene().startBtn);
  const s = await playFind('L01');
  check(`触摸点出全部 ${s.level.spots.length} 处`, await until(() => s.found.size === s.level.spots.length, 3000), `${s.found.size}`);
  const sfx = log.played.filter((p) => p.src.startsWith('sfx/'));
  check('找对音效走预渲染文件，五声音阶逐级升高 (correct_0 → correct_1 …)', sfx.some((p) => /sfx\/correct_0_\d\.mp3/.test(p.src)) && sfx.some((p) => /sfx\/correct_1_\d\.mp3/.test(p.src)), sfx.map((p) => p.src).join(' '));
  check('音效池用 useWebAudioImplement 的 InnerAudioContext (5 个)', log.webAudioCtx === 5, String(log.webAudioCtx));
  check('音效音量 = 混音标准 sfx 0.12', sfx.every((p) => Math.abs(p.vol - 0.12) < 0.03), sfx.map((p) => p.vol).join(','));
  check('结算面板出现', await until(() => scene().panel && scene().panel.buttons, 6000));
  const share = () => btnByLabel(scene().panel.buttons, /分享给好友/);
  check('结算页有「分享给好友」，没有抖音的「分享录屏」', !!share() && !btnByLabel(scene().panel.buttons, /录屏/));
  await sleep(500);
  await shot('p1_result_share');
  await tapBtn(share());
  const so = log.share[0] || {};
  check('wx.shareAppMessage 带标题和 5:4 分享图 images/share_card.jpg', !!so.title && so.imageUrl === 'images/share_card.jpg' && existsSync(path.join(bd, 'images/share_card.jpg')), JSON.stringify(so));
  check('分享不发奖励 (提示券 / 免费提示都不变)', !game.save.get('hintTickets'));
  check('第 1 关通关写入存档 (解锁第 2 关)', game.save.get('unlocked') >= 2);
  check('右上角菜单开启转发 + 朋友圈', log.shareMenu && JSON.stringify(log.shareMenu.menus) === JSON.stringify(['shareAppMessage', 'shareTimeline']));
  check('onShareAppMessage / onShareTimeline 已注册', typeof handlers.share === 'function' && handlers.share().title && typeof handlers.timeline === 'function' && handlers.timeline().title);

  // —— 第 2 关：提示 / 提示券 / 激励视频 ——
  console.log('\n[提示与激励视频]');
  await tapBtn(btnByLabel(scene().panel.buttons, /下一关/));
  await until(() => scene().level && scene().level.id === 'L02' && scene().dialog);
  await sleep(300); await tapBtn(scene().dialog.btn); await until(() => scene().state === 'play');
  const g2 = scene();
  await tapBtn(g2.hintBtn); check('第一次提示免费', g2.freeHints === 0 && !!g2.hint);
  g2.hint = null;
  check('配了广告位 → 提示按钮角标「▶广告」', game.ads.enabled === true);
  adMode.v = 'cancel'; await tapBtn(g2.hintBtn); await sleep(300);
  check('激励视频中途关闭 → 不给提示，回到游戏', log.adShows === 1 && !g2.hint && g2.adHints === 0 && g2.state === 'play');
  adMode.v = 'error'; await tapBtn(g2.hintBtn); await sleep(400);
  check('无广告 (1004) → 提示「暂时没有可看的广告」，不卡住', g2.state === 'play' && !g2.hint && /暂时没有可看的广告/.test(JSON.stringify(game.subtitle.log.slice(-3).concat([game.subtitle.cur]))), JSON.stringify(game.subtitle.cur || {}).slice(0, 80));
  await shot('p1_ad_error');
  adMode.v = 'ok'; await tapBtn(g2.hintBtn); await sleep(300);
  check('看完激励视频 → 精确提示，adHints=1', g2.hint && g2.hint.exact && g2.adHints === 1);
  check('真实广告分支使用配置里的广告位 id，并关闭 1004 兜底分享页', ad && ad.unit === 'adunit-mock' && log.adOpts && log.adOpts.disableFallbackSharePage === true);
  g2.hint = null; g2.sanity = 1; g2.fail(); await sleep(150);
  check('配了广告位 → 理智归零弹「看广告：理智回满」', !!btnByLabel(g2.dialog.buttons, /看广告/));
  await tapBtn(btnByLabel(g2.dialog.buttons, /看广告/)); await sleep(300);
  check('看完广告 → 理智回满继续', g2.state === 'play' && g2.sanity === g2.sanityMax && g2.revives === 1);
  await shot('p1_hint');

  // —— 切后台 ——
  console.log('\n[切后台]');
  g2.hint = null;
  handlers.hide.forEach((f) => f());
  await sleep(100);
  check('wx.onHide → 自动暂停', g2.state === 'pause' && g2.dialog && /暂停/.test(g2.dialog.title || ''));
  handlers.show.forEach((f) => f({ query: {}, scene: 1001 }));
  await sleep(100);
  check('wx.onShow → 停留在暂停面板，等玩家点继续', g2.state === 'pause');
  await shot('p1_pause');

  // —— 解谜关：触摸开局 + 渲染 (完整解法由网页版 tools/test.mjs 覆盖，核心代码相同) ——
  console.log('\n[解谜关]');
  game.scenes.change('game', { levelId: 'L03' }, { transition: false });
  await until(() => scene().level && scene().level.id === 'L03' && scene().dialog);
  await sleep(200); await tapBtn(scene().dialog.btn); await until(() => scene().state === 'play');
  const s3 = scene();
  check(`L03 (${s3.type}) 正常开局`, s3.state === 'play' && game.errors.length === 0, game.errors[0]);
  await shot('p1_puzzle');
  check('全程没有运行时错误', game.errors.length === 0, game.errors.slice(0, 2).join('\n'));
  check('图片全部找到', log.missing.filter((m) => !/\.mp3$/.test(m)).length === 0, log.missing.join(','));
  check('音频文件全部存在 (预渲染音效 / 分包配音 / BGM)', log.missing.length === 0, log.missing.join(','));
  const voices = log.played.filter((p) => p.src.startsWith('audio/voice/'));
  check('配音来自分包 audio/voice/', voices.length > 0, String(voices.length));
  check(`InnerAudioContext 实例数有上限 (${log.audioCtx} 个：BGM 2 首×2 + 配音 1 + 音效池 5 以内)`, log.audioCtx <= 10);
  check('画布 save/restore 成对 (没有多余的 restore)', log.unbalanced.length === 0, log.unbalanced.slice(0, 2).join(' | '));
  game.scenes.change('menu', {}, { transition: false });
  await sleep(200);
} else {
  console.log('\n[重启后：存档持久化 / 未配置广告位]');
  check('存档保留：第 1 关已通关、解锁第 2 关', game.save.get('unlocked') >= 2 && game.save.data.cleared && game.save.data.cleared.L01, JSON.stringify(game.save.data.cleared));
  check('菜单按钮显示「继续 · 第 2 关」', /继续/.test(scene().startBtn.label), scene().startBtn.label);
  await tapBtn(scene().startBtn);
  await until(() => scene().name === 'game' && scene().dialog); await sleep(200); await tapBtn(scene().dialog.btn); await until(() => scene().state === 'play');
  const g = scene(); g.freeHints = 0; g.freeCd = 50;
  check('未填广告位 id → ads.enabled = false', game.ads.enabled === false);
  await tapBtn(g.hintBtn); await sleep(200);
  check('提示 → 直接给免费精确提示 (不调用 wx 激励视频)，计入 adHints', g.hint && g.hint.exact && g.adHints === 1 && !ad && g.state === 'play');
  check('精确提示进入冷却', g.exactCd > 40);
  g.hint = null; await tapBtn(g.hintBtn); await sleep(200);
  check('冷却中再点：不给提示，字幕提示冷却秒数', !g.hint && g.adHints === 1 && /冷却中/.test(JSON.stringify(game.subtitle.log.slice(-3).concat([game.subtitle.cur]))));
  await shot('p2_hint_cooldown');
  g.sanity = 1; g.fail();
  await sleep(200);
  const labels = (g.dialog.buttons || []).map((b) => b.label);
  check('理智归零：没有「看广告」按钮，有「再试一次」', !labels.some((l) => /广告/.test(l)) && labels.includes('再试一次'), labels.join('/'));
  await shot('p2_retry');
  await tapBtn(btnByLabel(g.dialog.buttons, /再试一次/)); await sleep(200);
  check('再试一次 → 理智回满、继续游戏 (revives=1)', g.state === 'play' && g.sanity === g.sanityMax && g.revives === 1);
  g.fail(); await sleep(200);
  const labels2 = (g.dialog.buttons || []).map((b) => b.label);
  check('同一关第二次归零：不再有「再试一次」', !labels2.includes('再试一次') && !labels2.some((l) => /广告/.test(l)), labels2.join('/'));
  check('星级上限 2 星 (用了精确提示 / 再试一次)', g.computeStars() <= 2);
  check('全程没有运行时错误', game.errors.length === 0, game.errors.slice(0, 2).join('\n'));
}
console.log(`\n  ${phase}: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
