// 抖音小游戏版无头测试：在 Node 里用「模拟 tt 对象 + @napi-rs/canvas」直接运行 build-douyin/ 的产物。
// 没有任何 window / document / DOM —— 如果代码里误用了浏览器 API，这里会直接报错。
// 覆盖：启动 / 菜单 / 安全区布局；触摸操作玩第 1 关 (找茬) 与一个解谜关；预渲染音效与分包音频；
//       激励视频 成功 / 中途关闭 / 无广告(1004)；录屏 + 高光剪辑 + 结算页分享；侧边栏复访领奖；
//       切后台自动暂停；存档在「重启」后保留 (第二个进程)；未填广告位 id 时没有任何看广告按钮 (免费精确提示 + 冷却、每关 1 次再试一次)。
// 用法：npm run build:douyin && node tools/test_douyin.mjs
// 依赖：@napi-rs/canvas (不在项目依赖里，避免进安装包；装在 /workspace/_scratch/ttmock 或 NAPI_CANVAS_DIR 指定的目录)
import { createRequire } from 'node:module';
import { promises as fs, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { centerOf } from '../src/core/geometry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bd = path.join(root, 'build-douyin');
const shots = path.join(root, 'tools/preview/douyin');
const phase = process.argv[2] || 'all';
const store = path.join(root, 'tools/preview/douyin/.storage.json');
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
  console.log(ok ? '\n抖音版测试全部通过 ✓' : '\n抖音版测试有失败 ✗');
  process.exit(ok ? 0 : 1);
}

// ———————————————————— 模拟 tt ————————————————————
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = { audioCtx: 0, played: [], missing: [], earlyAudio: [], adShows: 0, rec: [], share: [], nav: 0, storageWrites: 0, warn: [], unbalanced: [] };
const handlers = { show: [], hide: [], ts: [], tm: [], te: [], tc: [], share: null };
const SYS = { windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, pixelRatio: 3, statusBarHeight: 47, platform: 'ios',
  safeArea: { left: 0, right: 390, top: 47, bottom: 810, width: 390, height: 763 } };
let storage = existsSync(store) ? JSON.parse(readFileSync(store, 'utf8')) : {};
let subLoaded = false; let canvases = 0; let mainCanvas = null;
const adMode = { v: 'ok' };
let lastShow = { query: {}, scene: '011001', launch_from: '', location: '' };
const resolveFile = (p) => path.join(bd, String(p).replace(/^\.?\//, ''));

const recorder = (() => {
  const cb = { start: [], stop: [], error: [] }; let t0 = 0; let on = false;
  return {
    onStart: (f) => cb.start.push(f), onStop: (f) => cb.stop.push(f), onError: (f) => cb.error.push(f),
    onPause() {}, onResume() {},
    start(o) { log.rec.push(['start', o && o.duration]); on = true; t0 = Date.now(); setTimeout(() => cb.start.forEach((f) => f({})), 5); },
    stop() { log.rec.push(['stop']); if (!on) return; on = false; setTimeout(() => cb.stop.forEach((f) => f({ videoPath: 'ttfile://temp/record_' + t0 + '.mp4' })), 20); },
    pause() { log.rec.push(['pause']); }, resume() { log.rec.push(['resume']); },
    recordClip(o) { log.rec.push(['recordClip', o.timeRange]); setTimeout(() => o.success && o.success({ index: log.rec.length }), 1); },
    clipVideo(o) { log.rec.push(['clipVideo', o.path, o.timeRange]); setTimeout(() => o.success && o.success({ videoPath: 'ttfile://temp/clip.mp4' }), 10); },
  };
})();
let ad = null;

global.GameGlobal = global;
global.tt = {
  getSystemInfoSync: () => SYS,
  getMenuButtonBoundingClientRect: () => ({ top: 51, bottom: 83, left: 296, right: 383, width: 87, height: 32 }),
  getLaunchOptionsSync: () => ({ query: {}, scene: '011001' }),
  getEnvInfoSync: () => ({ microapp: { appId: 'tt_mock_appid' } }),
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
  createInnerAudioContext() {
    log.audioCtx++;
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
    const cb = { close: [], error: [] };
    ad = {
      unit: o.adUnitId,
      onClose: (f) => cb.close.push(f), onError: (f) => cb.error.push(f), onLoad() {},
      load: () => (adMode.v === 'error' ? Promise.reject({ errCode: 1004 }) : Promise.resolve()),
      show() {
        log.adShows++;
        if (adMode.v === 'error') { setTimeout(() => cb.error.forEach((f) => f({ errCode: 1004, errMsg: 'no ad' })), 5); return Promise.reject({ errCode: 1004 }); }
        setTimeout(() => cb.close.forEach((f) => f({ isEnded: adMode.v === 'ok', count: adMode.v === 'ok' ? 1 : 0 })), 30);
        return Promise.resolve();
      },
    };
    return ad;
  },
  getGameRecorderManager: () => recorder,
  shareAppMessage(o) { log.share.push(o); setTimeout(() => o.success && o.success({}), 5); },
  onShareAppMessage: (f) => { handlers.share = f; }, showShareMenu() {},
  checkScene: (o) => setTimeout(() => o.success({ isExist: true }), 5),
  navigateToScene(o) {
    log.nav++;
    setTimeout(() => {
      o.success && o.success({});
      handlers.hide.forEach((f) => f());
      setTimeout(() => { lastShow = { query: {}, scene: '021036', launch_from: 'homepage', location: 'sidebar_card' }; handlers.show.forEach((f) => f(lastShow)); }, 50);
    }, 10);
  },
};

// ———————————————————— 测试工具 ————————————————————
let pass = 0; let fail = 0;
function check(name, cond, extra = '') { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } }
async function until(fn, ms = 8000, step = 30) { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (_) { /* 等 */ } await sleep(step); } return false; }
let game;
const scene = () => game.scenes.current;
/** 逻辑坐标 (540×960) → 屏幕坐标 (390×844 的 clientX/Y)，走真实的 tt.onTouch* 通道 */
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
  // 第一次启动：直接调用 js/main.js 的 boot，传入带假广告位 id 的配置 → 走真实 tt 激励视频分支
  const cfg = { ...req(path.join(bd, 'platform-config.js')), appId: 'tt_mock_appid', rewardedAdUnitId: 'mock-ad-unit' };
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
check('侧边栏礼包入口 (checkScene isExist=true) 显示', await until(() => scene().sidebarBtn && scene().sidebarBtn.visible));
await shot(phase + '_menu');

if (phase === 'p1') {
  const bundle = readFileSync(path.join(bd, 'js/main.js'), 'utf8');
  const bad = bundle.match(/\b(window|document|localStorage|navigator|location)\.[A-Za-z]+|new (Image|Audio)\(/g) || [];
  check('静态扫描：游戏代码里没有 window / document / localStorage / new Image / new Audio', bad.length === 0, bad.slice(0, 5).join(','));
  // —— 侧边栏复访 ——
  console.log('\n[侧边栏复访]');
  await tapBtn(scene().sidebarBtn);
  check('点礼包 → 面板显示「去首页侧边栏」', !!btnByLabel(scene().dialog && scene().dialog.buttons, /去首页侧边栏/));
  await shot('p1_sidebar_go');
  await tapBtn(btnByLabel(scene().dialog.buttons, /去首页侧边栏/));
  check('调用 tt.navigateToScene({scene:"sidebar"})', await until(() => log.nav === 1));
  check('从侧边栏回来 (onShow: homepage / sidebar_card) → 面板变成「立即领奖」', await until(() => btnByLabel(scene().dialog && scene().dialog.buttons, /立即领奖/)));
  await shot('p1_sidebar_claim');
  await tapBtn(btnByLabel(scene().dialog.buttons, /立即领奖/));
  check('领到 2 张提示券并写入存档', game.save.get('hintTickets') === 2 && storage.spotdiff_save !== undefined || game.save.get('hintTickets') === 2, String(game.save.get('hintTickets')));
  await tapBtn(scene().sidebarBtn);
  check('当天再打开显示「今天已经领过」，没有领奖按钮', !btnByLabel(scene().dialog.buttons, /立即领奖/));
  await tapBtn(btnByLabel(scene().dialog.buttons, /关闭/));

  // —— 第 1 关：触摸玩通 + 录屏 + 分享 ——
  console.log('\n[第 1 关：触摸玩通 / 录屏 / 分享]');
  await tapBtn(scene().startBtn);
  const s = await playFind('L01');
  check('开局自动开始录屏 (duration 300)', log.rec.some((r) => r[0] === 'start' && r[1] === 300));
  check(`触摸点出全部 ${s.level.spots.length} 处`, await until(() => s.found.size === s.level.spots.length, 3000), `${s.found.size}`);
  const sfx = log.played.filter((p) => p.src.startsWith('sfx/'));
  check('找对音效走预渲染文件，五声音阶逐级升高 (correct_0 → correct_1 …)', sfx.some((p) => /sfx\/correct_0_\d\.mp3/.test(p.src)) && sfx.some((p) => /sfx\/correct_1_\d\.mp3/.test(p.src)), sfx.map((p) => p.src).join(' '));
  check('最后一处播放 final 琶音', sfx.some((p) => /sfx\/final_\d+_\d\.mp3/.test(p.src)));
  check('音效音量 = 混音标准 sfx 0.12', sfx.every((p) => Math.abs(p.vol - 0.12) < 0.03), sfx.map((p) => p.vol).join(','));
  check('刁钻点 / 最后一处触发 recordClip 高光 [4,2]', log.rec.some((r) => r[0] === 'recordClip' && r[1][0] === 4 && r[1][1] === 2));
  check('结算面板出现', await until(() => scene().panel && scene().panel.buttons, 6000));
  const share = () => btnByLabel(scene().panel.buttons, /分享本局录屏|录屏生成中|录屏太短/);
  check('结算页有「分享录屏」按钮', !!share());
  check('录屏结束后剪辑高光 (clipVideo) 并启用按钮', await until(() => share() && share().enabled && share().label === '分享本局录屏', 9000), share() && share().label);
  await sleep(500);
  await shot('p1_result_share');
  await tapBtn(share());
  const so = log.share[0] || {};
  check('分享 channel=video，videoPath 为剪辑后的视频，带话题', so.channel === 'video' && so.extra && so.extra.videoPath === 'ttfile://temp/clip.mp4' && Array.isArray(so.extra.videoTopics), JSON.stringify(so));
  check('分享不发奖励 (提示券数不变)', game.save.get('hintTickets') === 2);
  check('第 1 关通关写入存档 (解锁第 2 关)', game.save.get('unlocked') >= 2);

  // —— 第 2 关：提示 / 提示券 / 激励视频 ——
  console.log('\n[提示与激励视频]');
  await tapBtn(btnByLabel(scene().panel.buttons, /下一关/));
  await until(() => scene().level && scene().level.id === 'L02' && scene().dialog);
  await sleep(300); await tapBtn(scene().dialog.btn); await until(() => scene().state === 'play');
  const g2 = scene();
  await tapBtn(g2.hintBtn); check('第一次提示免费', g2.freeHints === 0 && !!g2.hint);
  g2.hint = null; await tapBtn(g2.hintBtn); check('之后先用侧边栏提示券 (精确提示，不看广告)', game.save.get('hintTickets') === 1 && g2.hint && g2.hint.exact && log.adShows === 0);
  g2.hint = null; await tapBtn(g2.hintBtn); g2.hint = null;
  check('提示券用完', game.save.get('hintTickets') === 0 && log.adShows === 0);
  adMode.v = 'cancel'; await tapBtn(g2.hintBtn); await sleep(300);
  check('激励视频中途关闭 → 不给提示，回到游戏', log.adShows === 1 && !g2.hint && g2.adHints === 0 && g2.state === 'play');
  check('看广告期间暂停录屏、结束后恢复', log.rec.some((r) => r[0] === 'pause') && log.rec.some((r) => r[0] === 'resume'));
  adMode.v = 'error'; await tapBtn(g2.hintBtn); await sleep(400);
  check('无广告 (1004) → 提示「暂时没有可看的广告」，不卡住', g2.state === 'play' && !g2.hint && /暂时没有可看的广告/.test(JSON.stringify(game.subtitle.log.slice(-3).concat([game.subtitle.cur]))), JSON.stringify(game.subtitle.cur || {}).slice(0, 80));
  await shot('p1_ad_error');
  adMode.v = 'ok'; await tapBtn(g2.hintBtn); await sleep(300);
  check('看完激励视频 → 精确提示，adHints=1', g2.hint && g2.hint.exact && g2.adHints === 1);
  check('真实广告分支使用配置里的广告位 id', ad && ad.unit === 'mock-ad-unit');
  await shot('p1_hint');

  // —— 切后台 ——
  console.log('\n[切后台]');
  g2.hint = null;
  handlers.hide.forEach((f) => f());
  await sleep(100);
  check('tt.onHide → 自动暂停', g2.state === 'pause' && g2.dialog && /暂停/.test(g2.dialog.title || ''));
  handlers.show.forEach((f) => f({ query: {}, scene: '011001' }));
  await sleep(100);
  check('tt.onShow → 停留在暂停面板，等玩家点继续', g2.state === 'pause');
  await shot('p1_pause');

  // —— 解谜关：触摸开局 + 渲染 (完整解法由网页版 tools/test.mjs 覆盖，核心代码相同) ——
  console.log('\n[解谜关]');
  game.scenes.change('game', { levelId: 'L03' }, { transition: false });
  await until(() => scene().level && scene().level.id === 'L03' && scene().dialog);
  await sleep(200); await tapBtn(scene().dialog.btn); await until(() => scene().state === 'play');
  const s3 = scene();
  check(`L03 (${s3.type}) 正常开局`, s3.state === 'play' && game.errors.length === 0, game.errors[0]);
  await shot('p1_puzzle');
  game.save.set('hintTickets', 0);
  check('全程没有运行时错误', game.errors.length === 0, game.errors.slice(0, 2).join('\n'));
  check('图片全部找到', log.missing.filter((m) => !/\.mp3$/.test(m)).length === 0, log.missing.join(','));
  check('音频文件全部存在 (预渲染音效 / 分包配音 / BGM)', log.missing.length === 0, log.missing.join(','));
  const voices = log.played.filter((p) => p.src.startsWith('audio/voice/'));
  check('配音来自分包 audio/voice/', voices.length > 0, String(voices.length));
  check(`InnerAudioContext 实例数有上限 (${log.audioCtx} 个：BGM 2 首×2 + 配音 1 + 音效池 5 以内)`, log.audioCtx <= 10);
  check('画布 save/restore 成对 (没有多余的 restore)', log.unbalanced.length === 0, log.unbalanced.slice(0, 2).join(' | '));
  check('被动分享 (右上角菜单) 已注册', typeof handlers.share === 'function' && handlers.share().title);
  game.scenes.change('menu', {}, { transition: false });
  await sleep(200);
} else {
  console.log('\n[重启后：存档持久化 / 未配置广告位]');
  check('存档保留：第 1 关已通关、解锁第 2 关', game.save.get('unlocked') >= 2 && game.save.data.cleared && game.save.data.cleared.L01, JSON.stringify(game.save.data.cleared));
  check('存档保留：今天的侧边栏礼包已领 (不能重复领)', !!game.save.get('sidebarClaimDay'));
  check('菜单按钮显示「继续 · 第 2 关」', /继续/.test(scene().startBtn.label), scene().startBtn.label);
  await tapBtn(scene().startBtn);
  await until(() => scene().name === 'game' && scene().dialog); await sleep(200); await tapBtn(scene().dialog.btn); await until(() => scene().state === 'play');
  const g = scene(); g.freeHints = 0; g.freeCd = 50;
  check('未填广告位 id → ads.enabled = false', game.ads.enabled === false);
  await tapBtn(g.hintBtn); await sleep(200);
  check('提示 → 直接给免费精确提示 (不调用 tt 激励视频)，计入 adHints', g.hint && g.hint.exact && g.adHints === 1 && !ad && g.state === 'play');
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
