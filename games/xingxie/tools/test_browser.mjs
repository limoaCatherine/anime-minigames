// 浏览器流程自检 (Playwright，需先 npm run build)：node tools/test_browser.mjs
// 连续三局不刷新页面 / 暂停与切后台冻结 / 广告期间冻结 / 复活只一次 / 结算翻倍只能领一次 / 卡帧回前台 dt 截断 /
// 触摸：多指只认第一根、松手摇杆归零 / 选角立绘比例
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; let fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const G = (fn, arg) => page.evaluate(fn, arg);
const scene = () => G(() => window.__ANIME_SURVIVOR__.scenes.currentName);
const change = async (name, data) => { await G(([n, d]) => window.__ANIME_SURVIVOR__.scenes.change(n, d), [name, data || {}]); await sleep(900); };
const W = () => G(() => { const w = window.__ANIME_SURVIVOR__.scenes.current.world; return { t: w.time, st: w.state, e: w.enemies.pool.activeCount, b: w.projectiles.bullets ? w.projectiles.bullets.activeCount : 0, lv: w.p.level, x: w.p.x, y: w.p.y, ix: w.input.x, iy: w.input.y }; });

await page.goto(url);
for (let i = 0; i < 60 && (await scene()) !== 'menu'; i++) await sleep(200);
await page.mouse.click(10, 500); await sleep(500);
// 解锁全部角色，避免选角被锁
await G(() => { const s = window.__ANIME_SURVIVOR__.save; for (const k of ['hikari', 'kanon', 'rinne', 'momo', 'tsukimi', 'regina']) s.data.unlocked[k] = true; s.data.coins = 0; s.flush(); });
console.log('· 广告 (v1.3)：网页版没有广告位 → 不显示看广告按钮、不弹占位');
const ad0 = await G(() => { const a = window.__ANIME_SURVIVOR__.ads; return { enabled: a.enabled, mode: a.mode, fake: 'fake' in a }; });
ok(!ad0.enabled && ad0.mode === 'off' && !ad0.fake, `ads.enabled=false (mode=${ad0.mode})，无占位广告`);

console.log('· 选角立绘保持比例');
await change('character');
const card = await G(() => { const g = window.__ANIME_SURVIVOR__; const img = g.assets.get('char_hikari_card'); return img ? { w: img.width, h: img.height } : null; });
ok(card && card.h > card.w * 0.9, `半身卡是竖向构图 (${card && card.w}x${card && card.h})`);

console.log('· 连续三局 (不刷新页面)');
const coinsLog = [];
for (let r = 0; r < 3; r++) {
  await change('game', { character: ['hikari', 'kanon', 'regina'][r], difficulty: 'normal', seed: 11 + r });
  const s0 = await W();
  ok(s0.t < 1 && s0.e <= 3 && s0.lv === 1, `第 ${r + 1} 局开局干净 (t=${s0.t.toFixed(2)} 怪=${s0.e} Lv${s0.lv})`);
  await G(() => { window.__ANIME_SURVIVOR__.timeScale = 4; });
  for (let i = 0; i < 12; i++) { await G(() => { const w = window.__ANIME_SURVIVOR__.scenes.current.world; w.p.hp = w.p.maxHp; if (w.state === 'levelup') w.levelup.choose(0); if (w.state === 'chest') w.levelup.closeChest(); }); await sleep(250); }
  await G(() => { window.__ANIME_SURVIVOR__.timeScale = 1; });
  const before = await G(() => window.__ANIME_SURVIVOR__.save.data.coins);
  await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; sc.finish(false); sc.finish(false); });
  await sleep(600);
  const res = await G(() => ({ name: window.__ANIME_SURVIVOR__.scenes.currentName, coins: window.__ANIME_SURVIVOR__.scenes.current.coins, save: window.__ANIME_SURVIVOR__.save.data.coins, runs: window.__ANIME_SURVIVOR__.save.data.stats.runs }));
  ok(res.name === 'result' && res.save - before === res.coins, `结算只记一次 (+${res.coins})`);
  coinsLog.push(res);
  if (r === 0) {
    // 无广告：翻倍按钮隐藏、点了也没反应、不出任何浮层
    const n0 = await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; sc.doubleCoins(); return { vis: sc.adBtn.visible, inList: sc.activeButtons().filter((b) => b.visible).includes(sc.adBtn), coins: window.__ANIME_SURVIVOR__.save.data.coins, doubled: sc.doubled }; });
    await sleep(300);
    ok(!n0.vis && !n0.inList && !n0.doubled && n0.coins === res.save, '无广告位：结算翻倍按钮隐藏，调用无效');
    // 接入广告 (模拟 provider) 后按钮自动出现；翻倍连点两次只领一次
    await G(() => window.__ANIME_SURVIVOR__.ads.setProvider(() => new Promise((r) => setTimeout(() => r(true), 200))));
    const v1 = await G(() => window.__ANIME_SURVIVOR__.scenes.current.adBtn.visible);
    ok(v1, '有广告时翻倍按钮自动出现');
    await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; sc.doubleCoins(); sc.doubleCoins(); });
    for (let i = 0; i < 40 && !(await G(() => window.__ANIME_SURVIVOR__.scenes.current.doubled)); i++) await sleep(100);
    const d = await G(() => ({ doubled: window.__ANIME_SURVIVOR__.scenes.current.doubled, save: window.__ANIME_SURVIVOR__.save.data.coins, coins: window.__ANIME_SURVIVOR__.scenes.current.coins }));
    await G(() => window.__ANIME_SURVIVOR__.scenes.current.doubleCoins()); await sleep(300);
    const d2 = await G(() => window.__ANIME_SURVIVOR__.save.data.coins);
    ok(d.doubled && d2 === d.save, `翻倍领取一次 (${res.save} → ${d.save})，再点无效`);
    await G(() => window.__ANIME_SURVIVOR__.ads.setProvider(null));
  }
}
ok(coinsLog[2].runs === coinsLog[0].runs + 2, '三局都记入战绩');

console.log('· 暂停 / 切后台：时间、刷怪、子弹全停');
await change('game', { character: 'hikari', seed: 5 });
await sleep(1500);
await G(() => window.__ANIME_SURVIVOR__.scenes.current.togglePause());
const p1 = await W(); await sleep(1200); const p2 = await W();
ok(p1.t === p2.t && p1.e === p2.e && p1.x === p2.x, `暂停中 world 不动 (t=${p1.t.toFixed(2)})`);
await G(() => window.__ANIME_SURVIVOR__.scenes.current.togglePause());
await sleep(400);
await G(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
const h1 = await W(); await sleep(1000); const h2 = await W();
const hp = await G(() => ({ paused: window.__ANIME_SURVIVOR__.scenes.current.paused, voice: window.__ANIME_SURVIVOR__.voice.isPlaying(), bgmHidden: window.__ANIME_SURVIVOR__.bgm.hidden }));
ok(hp.paused && h1.t === h2.t, '切后台自动暂停');
ok(!hp.voice && hp.bgmHidden, '切后台语音停、BGM 静音');
await G(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
await G(() => window.__ANIME_SURVIVOR__.scenes.current.togglePause());

console.log('· 卡顿 2 秒后回来：dt 截断，不会一下子跳很多步');
const j0 = await W();
await G(() => { const t = performance.now(); while (performance.now() - t < 2000) { /* 卡住主线程 */ } });
await G(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const j1 = await W();
ok(j1.t - j0.t < 0.25, `卡 2 秒后 world 只前进 ${(j1.t - j0.t).toFixed(3)}s`);

console.log('· 无广告位：换一批只剩免费按钮；复活 = 每局免费「再试一次」');
const lp = await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; sc.levelPanel.sync(); return { ad: sc.levelPanel.adBtn.visible, x: sc.levelPanel.refreshBtn.x }; });
ok(!lp.ad && lp.x === 270, '三选一「看广告换一批」隐藏，免费换一批居中');
const die = () => G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; const w = sc.world; w.p.invuln = 0; w.p.shield = 0; w.player.hurt(99999); });
await die(); await sleep(300);
const dead = await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; return { st: sc.world.state, open: sc.reviveOpen, label: sc.revivePanel.adBtn.label, tag: sc.revivePanel.adBtn.tag }; });
ok(dead.st === 'dead' && dead.open && dead.label === '再试一次' && !dead.tag, `死亡后弹「${dead.label}」，没有广告角标`);
await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; sc.tryRevive(); sc.tryRevive(); }); await sleep(300);
const rv = await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; const w = sc.world; return { st: w.state, used: w.reviveUsed, busy: sc.adBusy, hp: w.p.hp }; });
ok(rv.st === 'playing' && rv.used === 1 && !rv.busy && rv.hp > 0, '免费再试一次：立即复活，连点只算一次，不走广告');
await die(); await sleep(300);
const d2 = await G(() => ({ open: window.__ANIME_SURVIVOR__.scenes.current.reviveOpen, ending: !!window.__ANIME_SURVIVOR__.scenes.current.ending }));
ok(!d2.open && d2.ending, '第二次死亡不再弹复活，直接结算');
await sleep(2500);

console.log('· 有广告 (模拟 provider)：广告期间冻结；没看完不复活；看完复活一次');
let adResult = false;
await page.exposeFunction('__adResult', () => adResult);
await G(() => window.__ANIME_SURVIVOR__.ads.setProvider(() => new Promise((r) => setTimeout(async () => r(await window.__adResult()), 400))));
await change('game', { character: 'hikari', seed: 6 });
await sleep(600);
const lp2 = await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; sc.levelPanel.sync(); return sc.levelPanel.adBtn.visible; });
ok(lp2, '有广告时「看广告换一批」恢复');
await die(); await sleep(300);
const lbl = await G(() => window.__ANIME_SURVIVOR__.scenes.current.revivePanel.adBtn.label);
ok(lbl === '看广告复活', '有广告时复活按钮为「看广告复活」');
await G(() => window.__ANIME_SURVIVOR__.scenes.current.tryRevive()); await sleep(100);
const wt0 = await G(() => window.__ANIME_SURVIVOR__.scenes.current.world.time);
const a1 = await G(() => window.__ANIME_SURVIVOR__.scenes.current.adBusy);
ok(a1, '广告进行中 adBusy');
await sleep(700);
const f1 = await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; return { st: sc.world.state, used: sc.world.reviveUsed, busy: sc.adBusy, open: sc.reviveOpen, t: sc.world.time }; });
ok(f1.st === 'dead' && f1.used === 0 && !f1.busy && f1.open && f1.t === wt0, '广告没看完：不复活、不扣次数、可以再试');
adResult = true;
await G(() => { const sc = window.__ANIME_SURVIVOR__.scenes.current; sc.tryRevive(); sc.tryRevive(); });
for (let i = 0; i < 30 && (await G(() => window.__ANIME_SURVIVOR__.scenes.current.world.state)) === 'dead'; i++) await sleep(100);
const rv2 = await G(() => { const w = window.__ANIME_SURVIVOR__.scenes.current.world; return { st: w.state, used: w.reviveUsed }; });
ok(rv2.st === 'playing' && rv2.used === 1, '看完广告复活一次');
await G(() => window.__ANIME_SURVIVOR__.ads.setProvider(null));

console.log('· 触摸：多指只认第一根，松手摇杆归零');
await change('game', { character: 'hikari', seed: 9 });
await sleep(800);
const cdp = await ctx.newCDPSession(page);
const box = await page.locator('canvas').boundingBox();
const P = (x, y, id) => ({ x: box.x + x * box.width / 540, y: box.y + y * box.height / 960, id });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(270, 700, 1)] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(350, 700, 1)] });
await sleep(150);
const t1 = await W();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(350, 700, 1), P(150, 400, 2)] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(350, 700, 1), P(100, 300, 2)] });
await sleep(150);
const t2 = await W();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [P(100, 300, 2)] });   // 第二根手指抬起 (CDP 的 touchEnd 列的是抬起的点)
await sleep(150);
const t3 = await W();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [P(350, 700, 1)] });
await sleep(150);
const t4 = await W();
ok(t1.ix > 0.5, `第一根手指右拖 → 向右走 (${t1.ix.toFixed(2)})`);
ok(t2.ix > 0.5, `第二根手指不抢摇杆 (${t2.ix.toFixed(2)})`);
ok(t3.ix > 0.5, `第二根抬起，第一根还在 → 继续走 (${t3.ix.toFixed(2)})`);
ok(t4.ix === 0 && t4.iy === 0, '全部松手 → 立即停下');

console.log(`\nerrors: ${errors.length ? errors.join('\n') : 'none'}`);
ok(errors.length === 0, '无报错');
console.log(`通过 ${pass}，失败 ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
