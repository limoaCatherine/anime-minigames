// 抖音小游戏冒烟测试：在 Node vm 里 (没有 window / document) 用 tt 模拟跑真正的构建产物 build/douyin/game.js。
// 覆盖：启动 (画布 / 安全区 / 主包资源 / 分包进度 / 没下完也能开玩)、触摸开战、激励视频 (看完 / 中途关 / 拉取失败兜底)、
//      存档 (tt.setStorageSync)、录屏 (自动录 / 高光打点 / 剪辑 / 分享按钮)、前后台暂停、侧边栏复访、音效限频与并发、
//      无 ogg、BGM 无缝循环 (双实例交叉淡化 + 波形分析)、无广告位时隐藏广告按钮 / 免费再试一次。
// 用法：npm run test:douyin   (= npm run build:douyin && node tools/test_douyin.mjs)
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEnv } from './tt_mock.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, process.env.DOUYIN_DIR || '抖音小游戏');
let pass = 0; let fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } };

const gameJson = JSON.parse(fs.readFileSync(path.join(out, 'game.json'), 'utf8'));
const projCfg = JSON.parse(fs.readFileSync(path.join(out, 'project.config.json'), 'utf8'));
const code = fs.readFileSync(path.join(out, 'game.js'), 'utf8');

console.log('· 工程文件');
ok(gameJson.deviceOrientation === 'portrait', 'game.json 竖屏 (deviceOrientation: portrait)');
ok(Array.isArray(gameJson.subPackages) && gameJson.subPackages.length === 3 && gameJson.subPackages.every((p) => fs.existsSync(path.join(out, p.root, 'game.js'))), `subPackages ×${gameJson.subPackages.length}，每个分包根目录都有 game.js`);
ok(typeof projCfg.appid === 'string' && projCfg.appid.length > 0 && projCfg.setting && projCfg.setting.es6 === true, `project.config.json (appid=${projCfg.appid})`);
ok(projCfg.packOptions.ignore.some((i) => i.value === '上架资料') && fs.existsSync(path.join(out, '上架资料/上架说明.md')), '上架资料随工程输出，并在 packOptions.ignore 中排除');
ok(!/getElementById|document\.createElement|localStorage/.test(code), '抖音包里没有 DOM / localStorage 调用');
{
  // 抖音 iOS 不支持 ogg：工程里不能有任何 ogg 文件或引用；音频只用官方文档列出的双端格式 (mp3 / wav / aac / m4a)
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(out).filter((f) => !f.includes(`${path.sep}上架资料${path.sep}`));
  const oggFiles = files.filter((f) => /\.(ogg|oga)$/i.test(f));
  const textFiles = files.filter((f) => /\.(js|json|txt)$/i.test(f));
  const oggRefs = textFiles.filter((f) => /\.ogg\b|\.oga\b|audio\/ogg|vorbis/i.test(fs.readFileSync(f, 'utf8')));
  ok(oggFiles.length === 0 && oggRefs.length === 0, `没有 ogg 文件 (${oggFiles.length}) 也没有 ogg 引用 (${oggRefs.map((f) => path.relative(out, f)).join(',') || '无'})`);
  const audio = files.filter((f) => /\.(mp3|wav|aac|m4a|ogg|oga|opus|flac|webm)$/i.test(f));
  const bad = audio.filter((f) => !/\.(mp3|wav|aac|m4a)$/i.test(f));
  const voiceBgm = audio.filter((f) => /sub_(voice|bgm)/.test(f));
  ok(bad.length === 0 && voiceBgm.length > 0 && voiceBgm.every((f) => f.endsWith('.mp3')), `音频格式：语音 / BGM 全是 mp3 (${voiceBgm.length})，短音效 wav (${audio.filter((f) => f.endsWith('.wav')).length})，无其它格式`);
}

function boot(setup) {
  const env = createEnv();
  if (setup) setup(env);
  env.fileExists = (p) => {
    const f = path.join(out, p);
    if (!fs.existsSync(f)) return false;
    const sub = gameJson.subPackages.find((s) => p.startsWith(s.root));
    return !sub || env.loadedPacks.has(sub.name);
  };
  const ctx = vm.createContext({ ...env.globals });
  ctx.globalThis = ctx;
  vm.runInContext(code, ctx, { filename: 'game.js' });
  env.game = ctx.__ANIME_SURVIVOR__;
  return env;
}

// 逻辑坐标 → 屏幕坐标 (按 tt 的布局)
const toScreen = (env, x, y) => { const L = env.game.platform._layoutCss; return [L.x + x * L.s, L.y + y * L.s]; };
const tap = async (env, x, y) => { const [cx, cy] = toScreen(env, x, y); env.touch('start', cx, cy); await env.advance(50); env.touch('end', cx, cy); await env.advance(50); };

// ---------------------------------------------------------------- 启动
console.log('· 启动 / 安全区 / 分包');
const env = boot((e) => { e.cfg.packDelay = 400; });
const g = env.game;
ok(!!g && env.log[0] && env.log.some((l) => l.name === 'onShow.listen') && env.log.findIndex((l) => l.name === 'onShow.listen') < env.log.findIndex((l) => l.name === 'createCanvas.screen'), 'game.js 一开始就同步注册 tt.onShow (早于创建画布)');
const L = g.platform._layoutCss;
ok(g.canvas.width === 390 * 2 && g.canvas.height === 844 * 2, `上屏画布铺满屏幕 (${g.canvas.width}×${g.canvas.height}，dpr 上限 2)`);
ok(L.y >= 83 && L.y + 960 * L.s <= 810 + 0.5 && L.x >= 0, `逻辑画面避开胶囊 / 安全区 (top=${L.y.toFixed(1)} bottom=${(L.y + 960 * L.s).toFixed(1)})`);
await env.advance(1500);
ok(g.scenes.currentName === 'menu', `主包资源读完进主菜单 (${g.scenes.currentName})`);
ok(!env.images.some((s) => s.startsWith('sub_')) || env.loadedPacks.has('art'), '启动时不读分包里的图片');
ok(g.packs.started && g.packs.loading, `进菜单后后台下载分包 (进度 ${(g.packs.progress * 100).toFixed(0)}%，正在下载${g.packs.label})`);
const p0 = g.packs.progress;
await env.advance(600);
ok(g.packs.progress > p0, `分包进度在走 (${(p0 * 100).toFixed(0)}% → ${(g.packs.progress * 100).toFixed(0)}%)`);

// ---------------------------------------------------------------- 触摸开战 (分包还没下完)
console.log('· 触摸开战 (分包没下完也能玩)');
await tap(env, 270, 770);             // 开始守夜
await env.advance(800);
ok(g.scenes.currentName === 'character', `点「开始守夜」→ 选角 (${g.scenes.currentName})`);
ok(!!g.audio.sampler, '第一次触摸后启用预渲染音效播放器 (InnerAudioContext)');
const startBtn = g.scenes.current.buttons ? g.scenes.current.buttons.find((b) => /出发|开始|守夜/.test(b.label || '')) : null;
if (startBtn) await tap(env, startBtn.x, startBtn.y); else g.scenes.change('game', { character: 'hikari' });
await env.advance(900);
ok(g.scenes.currentName === 'game', `开战 (${g.scenes.currentName})`);
ok(!g.packs.done, '此时分包仍在下载 (不阻塞开战)');
ok(env.log.some((l) => l.name === 'rec.start' && l.arg.duration === 300), '开战自动录屏 (start duration=300)');
// 摇杆
const [jx, jy] = toScreen(env, 270, 600);
env.touch('start', jx, jy); await env.advance(50);
env.touch('move', jx + 60, jy); await env.advance(300);
const vx = g.scenes.current.world.input.x;
env.touch('end', jx + 60, jy); await env.advance(50);
ok(vx > 0.5, `tt.onTouch 驱动摇杆 (input.x=${vx.toFixed(2)})`);
ok(g.scenes.current.world.input.x === 0 || g.scenes.current.joy.vec.x === 0, '松手摇杆归零');

// 音效：限频 + 并发
console.log('· 音效 (预渲染 wav)');
const smp = g.audio.sampler;
const n0 = smp.played.length;
for (let i = 0; i < 10; i++) g.audio.play('hit', {});
ok(smp.played.length - n0 === 1, `同一时刻 10 次命中音效只响 1 次 (50ms 限频)`);
for (let i = 0; i < 12; i++) { await env.advance(52, 52); g.audio.play(['hit', 'crit', 'pop'][i % 3], {}); }
ok(smp.hitPool.length <= 5, `命中类 InnerAudioContext ≤ 5 个 (${smp.hitPool.length})`);
ok(smp.hitPool.every((a) => /^assets\/sfx\/.+\.wav$/.test(a.src)), '命中音效来自主包 assets/sfx/*.wav');
g.audio.play('levelup'); g.audio.play('chest');
ok(smp.pool.length <= 3, `其它音效实例 ≤ 3 (${smp.pool.length})`);
const totalAudio = env.audios.length;
ok(totalAudio <= 12, `全部 InnerAudioContext 数量 ${totalAudio} (Android 同时播放上限 10，实际同时在响更少)`);

// ---------------------------------------------------------------- 分包下完
console.log('· 分包下载完成');
await env.advance(6000);
ok(g.packs.done && ['art', 'bgm', 'voice'].every((n) => g.platform.packReady(n)), '三个分包都下载完成');
const order = env.log.filter((l) => l.name === 'loadSubpackage').map((l) => l.arg);
ok(order.join(',') === 'art,bgm,voice', `依次下载 ${order.join(' → ')}`);
ok(!!g.assets.get('char_hikari_card'), '立绘分包好后读入半身卡');
const bgmEl = g.bgm.tracks.battle && g.bgm.tracks.battle.el;
ok(bgmEl && /^sub_bgm\/assets\/audio\/bgm\/bgm_battle\.mp3$/.test(bgmEl.src), `BGM 分包好后开始播放 (${bgmEl && bgmEl.src})`);
g.events.emit('weapon:evolve', { name: 'test' });
await env.advance(100);
ok(g.voice.shared && /^sub_voice\/assets\/audio\/voice\/.+\.mp3$/.test(g.voice.shared.src), `语音用分包里的 mp3 (${g.voice.shared && g.voice.shared.src})`);

// ---------------------------------------------------------------- 录屏高光
console.log('· 录屏高光 / 前后台');
g.events.emit('boss:die', { type: 'sheepKing', name: '羊王', boss: true });
await env.advance(50);
ok(env.log.some((l) => l.name === 'rec.clip' && l.arg.timeRange[0] === 4 && l.arg.timeRange[1] === 3), 'Boss 击破 recordClip([4,3])');
await env.advance(11000);
for (let i = 0; i < 50; i++) g.events.emit('enemy:die', { x: 0, y: 0 });
await env.advance(50);
ok(g.share.log.includes('clip:mass'), '3 秒内割倒 ≥45 只 → 满屏割草打点');
env.hide(); await env.advance(50);
ok(g.scenes.current.paused, 'tt.onHide → 战斗自动暂停');
ok(env.rec.state === 'pause', 'tt.onHide → 录屏暂停');
ok(!bgmEl || bgmEl.paused, 'tt.onHide → BGM 暂停');
env.show({}); await env.advance(50);
ok(env.rec.state === 'rec', 'tt.onShow → 录屏继续');
g.scenes.current.togglePause();

// ---------------------------------------------------------------- 激励视频
console.log('· 激励视频 (v1.3：广告位 ID 留空 → 隐藏看广告按钮，复活免费一次)');
const w = g.scenes.current.world;
{
  const sc = g.scenes.current;
  ok(g.ads.mode === 'off' && !g.ads.enabled, '未填广告位 ID → 不提供激励视频 (mode=off)，不弹占位');
  sc.levelPanel.sync();
  ok(!sc.levelPanel.adBtn.visible && !sc.levelPanel.buttons.includes(sc.levelPanel.adBtn), '三选一「看广告换一批」隐藏');
  w.p.hp = 0; w.state = 'dead'; sc.onDie();
  ok(sc.reviveOpen && sc.revivePanel.adBtn.label === '再试一次' && !sc.revivePanel.adBtn.tag, '复活面板显示「再试一次」(无广告角标)');
  sc.tryRevive(); sc.tryRevive(); await env.advance(100);
  ok(w.state === 'playing' && w.reviveUsed === 1 && !env.log.some((l) => /^ad\./.test(l.name)) && env.ads.length === 0, '免费复活一次：不创建 / 不调用任何广告');
  w.reviveUsed = 0;                    // 测试用：重置复活次数，接着测有广告的情况
}
g.ads.adUnitId = 'test-ad-unit';      // 模拟已在 PlatformConfig 填好
ok(g.ads.mode === 'douyin' && g.ads.enabled, '填了广告位 → 自动恢复 tt.createRewardedVideoAd');
w.p.hp = 0; w.state = 'dead'; g.scenes.current.onDie();
ok(g.scenes.current.revivePanel.adBtn.label === '看广告复活', '有广告位时复活按钮恢复为「看广告复活」');
env.cfg.ad.mode = 'early';
g.scenes.current.tryRevive(); await env.advance(300);
ok(w.state === 'dead' && w.reviveUsed === 0, '中途关闭 (isEnded=false)：不复活、不扣次数');
env.cfg.ad.mode = 'showFail';
g.scenes.current.tryRevive(); await env.advance(300);
ok(w.state === 'dead' && w.reviveUsed === 0 && g.ads.lastReason === 'error', '拉取失败：兜底返回 false，不扣次数');
ok(g.notice && /广告暂时没准备好/.test(g.notice.text), `失败时给出提示 (${g.notice && g.notice.text})`);
env.cfg.ad.mode = 'ended';
g.scenes.current.tryRevive(); await env.advance(300);
ok(w.state === 'playing' && w.reviveUsed === 1, '看完 (isEnded=true)：复活一次');
ok(env.ads.length === 1, '激励视频实例全局只创建一个');
// 换一批 (升级三选一里的看广告刷新)
{
  const sc = g.scenes.current;
  w.player.gainExp(w.player.p.expNext || 999);
  for (let i = 0; i < 30 && w.state !== 'levelup'; i++) await env.advance(50);
  await env.advance(1200);
  const lv = w.levelup;
  const before = JSON.stringify(lv.offer.map((c) => c.id));
  env.cfg.ad.mode = 'early';
  sc.levelPanel.refresh(true); await env.advance(300);
  const afterEarly = JSON.stringify(lv.offer.map((c) => c.id));
  const usedEarly = w.refreshAdUsed;
  env.cfg.ad.mode = 'ended';
  sc.levelPanel.refresh(true); await env.advance(300);
  const shows = env.log.filter((l) => l.name === 'ad.show').length;
  ok(w.state === 'levelup' && afterEarly === before && usedEarly === 0, '「换一批」广告没看完：卡牌不变、不扣广告次数');
  ok(shows >= 5 && g.ads.lastReason === 'ended' && w.refreshAdUsed === 1, `「换一批」看完：刷新并记 1 次广告刷新 (refreshAdUsed=${w.refreshAdUsed})`);
  if (w.state === 'levelup') lv.choose(0);
  await env.advance(200);
}

// ---------------------------------------------------------------- 结算 / 分享 / 存档
console.log('· 结算 / 录屏分享 / 存档');
const coinsBefore = g.save.coins;
g.scenes.current.finish(true);
await env.advance(1200);
ok(g.scenes.currentName === 'result', '进入结算');
ok(env.log.some((l) => l.name === 'rec.stop'), '一局结束停止录屏');
ok(env.log.some((l) => l.name === 'rec.clipVideo' && l.arg.clipRange.length >= 2), '按打点剪辑集锦 (clipVideo)');
const rs = g.scenes.current;
ok(rs.shareBtn.visible && g.share.videoPath === 'ttfile://temp/record_clip.mp4', '拿到录屏后出现「分享精彩录屏」');
rs.shareVideo(); await env.advance(100);
const sh = env.log.find((l) => l.name === 'shareAppMessage');
ok(sh && sh.arg.channel === 'video' && sh.arg.extra.videoPath === 'ttfile://temp/record_clip.mp4' && sh.arg.extra.videoTopics.includes('星屑轮舞'), 'tt.shareAppMessage(channel: video, videoPath, 话题 #星屑轮舞)');
{
  const id = g.ads.adUnitId; g.ads.adUnitId = ''; rs.layoutShare();
  ok(!rs.adBtn.visible && rs.shareBtn.visible && rs.shareBtn.x === 270, '无广告位：结算「看广告翻倍」隐藏，分享按钮居中');
  g.ads.adUnitId = id; rs.layoutShare();
  ok(rs.adBtn.visible && rs.shareBtn.visible && rs.adBtn.x < rs.shareBtn.x, '有广告位：翻倍与分享并排');
}
rs.doubleCoins(); await env.advance(300);
ok(rs.doubled, '结算翻倍 (激励视频看完)');
const saved = JSON.parse(env.store['animeSurvivor.save.v1'] || '{}');
ok(saved.coins === g.save.coins && g.save.coins > coinsBefore, `存档写入 tt.setStorageSync (coins=${saved.coins})`);

// ---------------------------------------------------------------- 侧边栏
console.log('· 侧边栏复访');
g.scenes.change('menu'); await env.advance(800);
const ms = g.scenes.current;
ok(env.log.some((l) => l.name === 'checkScene' && l.arg.scene === 'sidebar') && ms.sidebarBtn.visible, 'checkScene(sidebar).isExist → 菜单显示「侧边栏有礼」');
await tap(env, ms.sidebarBtn.x, ms.sidebarBtn.y);
ok(!!ms.sidebarPanel && ms.sidebarPanel.action.label === '去侧边栏', '不是从侧边栏进来 → 按钮是「去侧边栏」');
await tap(env, ms.sidebarPanel.action.x, ms.sidebarPanel.action.y); await env.advance(50);
ok(env.log.some((l) => l.name === 'navigateToScene' && l.arg.scene === 'sidebar'), '调用 tt.navigateToScene({scene: sidebar})');
env.show({ scene: '021036', launch_from: 'homepage', location: 'sidebar_card' }); await env.advance(50);
ms.sidebarPanel.sync();
const c0 = g.save.coins;
ok(ms.sidebarPanel.action.label.startsWith('领取'), '从侧边栏回来 (launch_from=homepage, location=sidebar_card) → 可领取');
await tap(env, ms.sidebarPanel.action.x, ms.sidebarPanel.action.y);
ok(g.save.coins === c0 + 30 && JSON.parse(env.store['animeSurvivor.save.v1']).sidebarDay.length === 10, `领取 +30 星屑币，日期写入存档`);
ok(!g.sidebar.claim() && g.save.coins === c0 + 30, '同一天不能重复领');

// ---------------------------------------------------------------- 重启读档 + 分包失败重试
console.log('· 重启读档 / 分包失败');
const env2 = boot((e) => { Object.assign(e.store, env.store); e.cfg.packFail = { bgm: 1 }; e.cfg.sidebarExist = false; });
await env2.advance(1500);
ok(env2.game.save.coins === g.save.coins, `重启后从 tt.getStorageSync 读回存档 (coins=${env2.game.save.coins})`);
ok(!env2.game.scenes.current.sidebarBtn.visible, 'checkScene isExist=false → 不显示侧边栏入口');
await env2.advance(15000);
ok(env2.game.platform.packReady('bgm') && env2.log.filter((l) => l.name === 'loadSubpackage' && l.arg === 'bgm').length === 2, 'BGM 分包第一次失败，隔几秒自动重试成功');

// 低版本没有 loadSubpackage：整包下发，直接可用
const env3 = boot((e) => { delete e.tt.loadSubpackage; e.loadedPacks = new Set(['art', 'bgm', 'voice']); });
await env3.advance(1500);
ok(env3.game.packs.done && env3.game.scenes.currentName === 'menu', '没有 tt.loadSubpackage 的旧客户端：视为整包，直接可用');

// ---------------------------------------------------------------- BGM 无缝循环
console.log('· BGM 无缝循环 (mp3 编码器头尾静音 → 双实例交叉淡化)');
const env4 = boot((e) => {
  e.loadedPacks = new Set(['art', 'bgm', 'voice']);
  const man = fs.readFileSync(path.join(root, 'src/config/BgmLoopManifest.js'), 'utf8');
  e.loops = JSON.parse(man.slice(man.indexOf('{'), man.lastIndexOf('}') + 1));
  // 抖音版 BGM 文件 = 一个循环 + overrun 秒
  e.durationOf = (src) => { const m = /bgm_(\w+)\.mp3$/.exec(src || ''); return m ? e.loops[m[1]].loop + e.loops[m[1]].overrun : 0.15; };
});
await env4.advance(1500);
{
  const g4 = env4.game; const info = env4.loops.menu;
  const t = g4.bgm.tracks.menu; const el = t && t.el;
  ok(el && el.a && el.a.length === 2 && el.a.every((x) => !x.ctx.loop), '菜单 BGM 用 TTLoopAudio：两个 InnerAudio、都不用 loop=true');
  const [A, B] = el.a.map((x) => x.ctx);
  await env4.advance((info.loop - 2) * 1000);
  ok(!A.paused && B.paused && el.swaps === 0, `循环点前只有一个实例在播 (pos=${el.currentTime.toFixed(2)}s)`);
  let fadeSeen = false; let minPow = 9; let maxPow = 0; let swapAt = null;
  for (let i = 0; i < 200 && el.swaps === 0; i++) await env4.advance(16);
  swapAt = A.currentTime;
  ok(el.swaps === 1 && !B.paused && B.currentTime < 0.05 && Math.abs(swapAt - info.loop) < 0.05, `循环点 ${info.loop.toFixed(3)}s 处另一实例从头开始 (旧实例在 ${swapAt.toFixed(3)}s，仍在 overrun 区间内)`);
  ok(!A.endedAt, '切换时旧实例还没播完 (不会因为文件尾的编码器静音出现空白)');
  for (let i = 0; i < 20 && el.fade; i++) {
    const v = el.volume; const p = (A.volume ** 2 + B.volume ** 2) / (v * v || 1);
    if (!A.paused && !B.paused) fadeSeen = true;
    minPow = Math.min(minPow, p); maxPow = Math.max(maxPow, p);
    await env4.advance(16);
  }
  ok(fadeSeen && minPow > 0.95 && maxPow < 1.05, `交叉淡化 ${info.xfade}s：两实例同时在播，等功率 (功率和 ${minPow.toFixed(2)}~${maxPow.toFixed(2)})`);
  await env4.advance(300);
  ok(A.paused && !B.paused && !el.fade, '淡化结束后旧实例停止');
  env4.hide(); await env4.advance(50);
  ok(A.paused && B.paused, '切后台两个实例都暂停');
  env4.show({}); await env4.advance(50);
  await env4.advance(info.loop * 1000 + 500);
  ok(el.swaps === 2 && !A.paused && B.paused, '第二次循环同样无缝切换');
}
// 波形检查：模拟底层播放器不裁编码器静音的最坏情况，循环点附近没有静音段
{
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('python3', [path.join(root, 'tools/bgm_loop_check.py')], { encoding: 'utf8' });
  const rep = fs.existsSync(path.join(root, 'build/bgm_loop_report.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'build/bgm_loop_report.json'), 'utf8')) : null;
  const crypto = await import('node:crypto');
  const same = rep && Object.entries(rep.tracks).every(([n, t]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(out, `sub_bgm/assets/audio/bgm/bgm_${n}.mp3`))).digest('hex') === t.tt_file_sha256);
  if (r.status !== 0 && r.error) console.log('   (需要 python3 + numpy + ffmpeg)', r.error.message);
  const summary = rep ? Object.entries(rep.tracks).map(([n, t]) => `${n} 最差 ${Math.min(...Object.values(t.cases).map((c) => c.worst_vs_ref_db))}dB / 对照 loop=true 接缝静音 ${t.baseline_loop_true.silent_ms_at_seam}ms`).join('；') : '无报告';
  ok(r.status === 0 && rep && rep.ok && same, `波形分析：三首循环点 ±0.5s 内无静音段、音量不掉 (${summary})`);
}

const errs = [...env.errors, ...env2.errors, ...env3.errors, ...env4.errors];
console.log(`\nerrors: ${errs.length ? errs.slice(0, 5).join('\n') : 'none'}`);
ok(errs.length === 0, '运行无报错');
console.log(`通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
