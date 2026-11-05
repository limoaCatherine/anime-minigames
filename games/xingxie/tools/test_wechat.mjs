// 微信小游戏冒烟测试：在 Node vm 里 (没有 window / document / tt) 用 wx 模拟跑真正的构建产物 微信小游戏/game.js。
// 覆盖：工程文件 (game.json 分包 / project.config.json / 包体限制 / 上传白名单 / 无 ogg / 无抖音专有能力)、
//      启动 (onShow 先于画布、getWindowInfo 安全区 + 胶囊避让、主包资源、分包进度)、转发菜单 (发送给朋友 + 朋友圈)、
//      触摸开战、激励视频 (广告位空 → 隐藏 + 免费复活一次；填上 → wx.createRewardedVideoAd 看完 / 中途关 / 拉取失败)、
//      结算「分享给好友」(wx.shareAppMessage)、存档 (wx.setStorageSync) 与重启读档、前后台、BGM 双实例无缝循环。
// 用法：npm run test:wechat   (= npm run build:wechat && node tools/test_wechat.mjs)
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEnv } from './wx_mock.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, process.env.WECHAT_DIR || '微信小游戏');
let pass = 0; let fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } };

const gameJson = JSON.parse(fs.readFileSync(path.join(out, 'game.json'), 'utf8'));
const projCfg = JSON.parse(fs.readFileSync(path.join(out, 'project.config.json'), 'utf8'));
const code = fs.readFileSync(path.join(out, 'game.js'), 'utf8');
const decoded = code.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const size = JSON.parse(fs.readFileSync(path.join(root, 'build/wechat_size.json'), 'utf8'));
const MB = (n) => (n / 1024 / 1024).toFixed(2);

console.log('· 工程文件 / 包体');
ok(gameJson.deviceOrientation === 'portrait' && gameJson.showStatusBar === false, 'game.json 竖屏、不显示状态栏');
ok(Array.isArray(gameJson.subpackages) && gameJson.subpackages.length === 3 && gameJson.subpackages.every((p) => fs.existsSync(path.join(out, p.root, 'game.js'))), `subpackages ×${gameJson.subpackages.length}，每个分包根目录都有 game.js 入口`);
ok(projCfg.compileType === 'game' && (projCfg.appid === 'touristappid' || /^wx[0-9a-f]{16}$/.test(projCfg.appid)) && projCfg.projectname === '星屑轮舞', `project.config.json compileType=game, appid=${projCfg.appid}`);
ok(projCfg.packOptions.ignore.some((i) => i.value === '上架资料') && fs.existsSync(path.join(out, '上架资料/微信上架说明.md')), '上架资料随工程输出，并在 packOptions.ignore 中排除');
ok(size.main <= 4 * 1024 * 1024, `主包 ${MB(size.main)} MB ≤ 4 MB`);
ok(size.total <= 30 * 1024 * 1024, `主包 + 分包合计 ${MB(size.total)} MB ≤ 30 MB (${Object.entries(size.subs).map(([k, v]) => `${k} ${MB(v)}`).join(' / ')})`);
ok(size.badExt.length === 0, '代码包里只有上传白名单内的文件类型');
ok(!/getElementById|document\.createElement|localStorage/.test(code), '微信包里没有 DOM / localStorage 调用');
ok(!/getGameRecorderManager|checkScene|navigateToScene|channel:"video"/.test(code) && !/录屏|抖音/.test(decoded), '不含抖音专有的录屏 / 侧边栏 / 视频分享代码和文案');
{
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === '上架资料' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
  const files = walk(out);
  const ogg = files.filter((f) => /\.(ogg|oga)$/i.test(f));
  const refs = files.filter((f) => /\.(js|json|txt)$/i.test(f) && /\.ogg\b|audio\/ogg/i.test(fs.readFileSync(f, 'utf8')));
  const vb = files.filter((f) => /sub_(voice|bgm)/.test(f) && !f.endsWith('game.js'));
  ok(!ogg.length && !refs.length && vb.length > 0 && vb.every((f) => f.endsWith('.mp3')), `语音 / BGM 全是 mp3 (${vb.length})，无 ogg`);
  ok(fs.existsSync(path.join(out, 'assets/share/share_5x4.jpg')), '转发卡片图 assets/share/share_5x4.jpg 在主包');
}

function boot(setup) {
  const env = createEnv();
  if (setup) setup(env);
  env.fileExists = (p) => {
    const f = path.join(out, p);
    if (!fs.existsSync(f)) return false;
    const sub = gameJson.subpackages.find((s) => p.startsWith(s.root));
    return !sub || env.loadedPacks.has(sub.name);
  };
  const ctx = vm.createContext({ ...env.globals });
  ctx.globalThis = ctx;
  vm.runInContext(code, ctx, { filename: 'game.js' });
  env.game = ctx.__ANIME_SURVIVOR__;
  return env;
}
const toScreen = (env, x, y) => { const L = env.game.platform._layoutCss; return [L.x + x * L.s, L.y + y * L.s]; };
const tap = async (env, x, y) => { const [cx, cy] = toScreen(env, x, y); env.touch('start', cx, cy); await env.advance(50); env.touch('end', cx, cy); await env.advance(50); };

console.log('· 启动 / 安全区 / 转发菜单 / 分包');
const env = boot((e) => { e.cfg.packDelay = 400; });
const g = env.game;
const idx = (n) => env.log.findIndex((l) => l.name === n);
ok(!!g && g.platform.name === 'wechat', '平台 = wechat (WXPlatform)');
ok(idx('onShow.listen') >= 0 && idx('onShow.listen') < idx('createCanvas.screen'), 'wx.onShow 同步注册 (早于创建上屏画布)');
ok(idx('getWindowInfo') >= 0, '窗口 / 安全区来自 wx.getWindowInfo');
const L = g.platform._layoutCss;
ok(g.canvas.width === 390 * 2 && g.canvas.height === 844 * 2, `上屏画布铺满屏幕 (${g.canvas.width}×${g.canvas.height})`);
ok(L.y >= 83 && L.y + 960 * L.s <= 810 + 0.5, `逻辑画面避开右上角胶囊 (bottom=83) 与底部安全区 (top=${L.y.toFixed(1)} bottom=${(L.y + 960 * L.s).toFixed(1)})`);
const sm = env.log.find((l) => l.name === 'showShareMenu');
ok(sm && sm.arg.menus.join(',') === 'shareAppMessage,shareTimeline', 'wx.showShareMenu 显示「发送给朋友」+「分享到朋友圈」');
const app = env.share.app && env.share.app();
const tl = env.share.timeline && env.share.timeline();
ok(app && app.title && app.imageUrl === 'assets/share/share_5x4.jpg' && /from=share/.test(app.query), `wx.onShareAppMessage 返回转发内容 (${app && app.title})`);
ok(tl && tl.title && /ch=timeline/.test(tl.query), `wx.onShareTimeline 返回朋友圈内容 (${tl && tl.title})`);
await env.advance(1500);
ok(g.scenes.currentName === 'menu', `主包资源读完进主菜单 (${g.scenes.currentName})`);
ok(!g.scenes.current.sidebarBtn.visible, '菜单不显示抖音「侧边栏有礼」');
ok(g.packs.started && g.packs.loading, '进菜单后后台下载分包');
const p0 = g.packs.progress; await env.advance(600);
ok(g.packs.progress > p0, `分包进度在走 (${(p0 * 100).toFixed(0)}% → ${(g.packs.progress * 100).toFixed(0)}%)`);

console.log('· 触摸开战');
await tap(env, 270, 770); await env.advance(800);
ok(g.scenes.currentName === 'character', `wx.onTouch 点「开始守夜」→ 选角 (${g.scenes.currentName})`);
ok(!!g.audio.sampler, '第一次触摸后启用预渲染音效 (InnerAudioContext)');
g.scenes.change('game', { character: 'hikari' }); await env.advance(900);
ok(g.scenes.currentName === 'game' && !g.packs.done, '开战 (分包仍在下载，不阻塞)');
const [jx, jy] = toScreen(env, 270, 600);
env.touch('start', jx, jy); await env.advance(50); env.touch('move', jx + 60, jy); await env.advance(300);
const vx = g.scenes.current.world.input.x; env.touch('end', jx + 60, jy); await env.advance(50);
ok(vx > 0.5, `摇杆 (input.x=${vx.toFixed(2)})`);
await env.advance(6000);
ok(g.packs.done && ['art', 'bgm', 'voice'].every((n) => g.platform.packReady(n)), '三个分包下载完成 (wx.loadSubpackage)');
ok(!env.log.some((l) => l.name === 'loadSubpackage.noComplete'), 'wx.loadSubpackage 传了 success / fail / complete');
const bgmEl = g.bgm.tracks.battle && g.bgm.tracks.battle.el;
ok(bgmEl && bgmEl.a && bgmEl.a.length === 2 && /^sub_bgm\/assets\/audio\/bgm\/bgm_battle\.mp3$/.test(bgmEl.src), `BGM：分包里的 mp3，双 InnerAudio 实例 (${bgmEl && bgmEl.src})`);
env.hide(); await env.advance(50);
ok(g.scenes.current.paused && bgmEl.a.every((x) => x.paused), 'wx.onHide → 战斗暂停、BGM 暂停');
env.show({}); await env.advance(50);
g.scenes.current.togglePause();

console.log('· 激励视频');
const w = g.scenes.current.world;
{
  const sc = g.scenes.current;
  ok(g.ads.mode === 'off' && !g.ads.enabled, 'PlatformConfig.wechat.rewardedAdUnitId 为空 → 不提供激励视频');
  sc.levelPanel.sync();
  ok(!sc.levelPanel.adBtn.visible, '三选一「看广告换一批」隐藏');
  w.p.hp = 0; w.state = 'dead'; sc.onDie();
  ok(sc.reviveOpen && sc.revivePanel.adBtn.label === '再试一次', '复活面板显示「再试一次」');
  sc.tryRevive(); sc.tryRevive(); await env.advance(100);
  ok(w.state === 'playing' && w.reviveUsed === 1 && env.ads.length === 0, '每局免费复活一次，不创建广告实例');
  w.p.hp = 0; w.state = 'dead'; sc.onDie();
  ok(!sc.reviveOpen && sc.ending && sc.ending.won === false, '同一局第二次死亡：不再弹复活，直接进入结算倒计时');
  sc.ending = null; w.reviveUsed = 0; w.state = 'playing'; w.p.hp = w.p.maxHp; sc.reviveOpen = false;
}
g.ads.adUnitId = 'adunit-test';
ok(g.ads.mode === 'wechat' && g.ads.enabled, '填了广告单元 ID → wx.createRewardedVideoAd');
w.p.hp = 0; w.state = 'dead'; g.scenes.current.onDie();
ok(g.scenes.current.revivePanel.adBtn.label === '看广告复活', '复活按钮恢复为「看广告复活」');
env.cfg.ad.mode = 'early'; g.scenes.current.tryRevive(); await env.advance(300);
ok(w.state === 'dead' && w.reviveUsed === 0, '中途关闭 (isEnded=false)：不复活');
env.cfg.ad.mode = 'showFail'; g.scenes.current.tryRevive(); await env.advance(300);
ok(w.state === 'dead' && g.ads.lastReason === 'error' && g.notice && /广告暂时没准备好/.test(g.notice.text), '拉取失败：兜底提示，不扣次数');
env.cfg.ad.mode = 'ended'; g.scenes.current.tryRevive(); await env.advance(300);
ok(w.state === 'playing' && w.reviveUsed === 1, '看完 (isEnded=true)：复活');
const adCreate = env.log.find((l) => l.name === 'ad.create');
ok(env.ads.length === 1 && adCreate && adCreate.arg.adUnitId === 'adunit-test', '激励视频全局单例，adUnitId 来自配置');
g.ads.adUnitId = '';

console.log('· 结算 / 分享给好友 / 存档');
const coins0 = g.save.coins;
g.scenes.current.finish(true); await env.advance(1200);
const rs = g.scenes.current;
ok(g.scenes.currentName === 'result', '进入结算');
ok(rs.shareBtn.visible && rs.shareBtn.label === '分享给好友' && !rs.adBtn.visible && rs.shareBtn.x === 270, '无广告位：只显示「分享给好友」并居中');
rs.shareVideo(); await env.advance(100);
const sh = env.log.find((l) => l.name === 'shareAppMessage');
ok(sh && sh.arg.title && sh.arg.imageUrl === 'assets/share/share_5x4.jpg' && !sh.arg.channel, 'wx.shareAppMessage 主动转发 (标题 + 5:4 卡片图，无抖音 channel 参数)');
ok(!rs.toast, '转发不回传结果 → 不弹「成功」提示');
const saved = JSON.parse(env.store['animeSurvivor.save.v1'] || '{}');
ok(saved.coins === g.save.coins && g.save.coins > coins0, `存档写入 wx.setStorageSync (coins=${saved.coins})`);

console.log('· 重启读档 / 分包失败重试 / 旧基础库');
const env2 = boot((e) => { Object.assign(e.store, env.store); e.cfg.packFail = { voice: 1 }; delete e.wx.getWindowInfo; });
await env2.advance(1500);
ok(env2.game.save.coins === g.save.coins, `重启后 wx.getStorageSync 读回存档 (coins=${env2.game.save.coins})`);
ok(env2.log.some((l) => l.name === 'getSystemInfoSync'), '没有 getWindowInfo 的旧基础库退回 getSystemInfoSync');
await env2.advance(15000);
ok(env2.game.platform.packReady('voice') && env2.log.filter((l) => l.name === 'loadSubpackage' && l.arg === 'voice').length === 2, '语音分包第一次失败，隔几秒自动重试成功');
const env3 = boot((e) => { delete e.wx.loadSubpackage; e.loadedPacks = new Set(['art', 'bgm', 'voice']); });
await env3.advance(1500);
ok(env3.game.packs.done && env3.game.scenes.currentName === 'menu', '没有 wx.loadSubpackage (基础库 < 2.1.0，整包下发)：直接可用');

console.log('· BGM 无缝循环');
const env4 = boot((e) => {
  e.loadedPacks = new Set(['art', 'bgm', 'voice']);
  const man = fs.readFileSync(path.join(root, 'src/config/BgmLoopManifest.js'), 'utf8');
  e.loops = JSON.parse(man.slice(man.indexOf('{'), man.lastIndexOf('}') + 1));
  e.durationOf = (src) => { const m = /bgm_(\w+)\.mp3$/.exec(src || ''); return m ? e.loops[m[1]].loop + e.loops[m[1]].overrun : 0.15; };
});
await env4.advance(1500);
{
  const info = env4.loops.menu; const el = env4.game.bgm.tracks.menu && env4.game.bgm.tracks.menu.el;
  const [A, B] = el.a.map((x) => x.ctx);
  await env4.advance((info.loop - 2) * 1000);
  for (let i = 0; i < 200 && el.swaps === 0; i++) await env4.advance(16);
  ok(el.swaps === 1 && !B.paused && Math.abs(A.currentTime - info.loop) < 0.05 && !A.endedAt, `循环点 ${info.loop.toFixed(3)}s 另一实例从头接上 (旧实例未播完)`);
  let both = false; let minP = 9; let maxP = 0;
  for (let i = 0; i < 20 && el.fade; i++) { const v = el.volume; const p = (A.volume ** 2 + B.volume ** 2) / (v * v || 1); if (!A.paused && !B.paused) both = true; minP = Math.min(minP, p); maxP = Math.max(maxP, p); await env4.advance(16); }
  ok(both && minP > 0.95 && maxP < 1.05, `等功率交叉淡化 (功率和 ${minP.toFixed(2)}~${maxP.toFixed(2)})`);
  {
    const crypto = await import('node:crypto');
    const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    ok(['menu', 'battle', 'boss'].every((n) => h(path.join(out, `sub_bgm/assets/audio/bgm/bgm_${n}.mp3`)) === h(path.join(root, `assets/douyin/bgm/bgm_${n}.mp3`))), 'BGM 文件与已做波形检查的循环版 (assets/douyin/bgm) 完全一致');
  }
}

const errs = [...env.errors, ...env2.errors, ...env3.errors, ...env4.errors];
ok(!env.log.some((l) => /^(rec\.|getGameRecorderManager|checkScene|navigateToScene)/.test(l.name)), '运行中没有调用任何抖音专有接口');
console.log(`\nerrors: ${errs.length ? errs.slice(0, 5).join('\n') : 'none'}`);
ok(errs.length === 0, '运行无报错');
console.log(`通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
