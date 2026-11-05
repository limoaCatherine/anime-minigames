// 自动化截图 + 报错 / 帧率检查：node tools/shots.mjs   (需先 npm run build)
// 输出 /workspace/anime-survivor-*.png
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOT_DIR || '/workspace';
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: Number(process.env.SHOT_SCALE || 1) });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const G = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/anime-survivor-${name}.png` }); console.log('shot', name); };
const scene = () => G(() => window.__ANIME_SURVIVOR__.scenes.currentName);
const change = async (name, data) => { await G(([n, d]) => window.__ANIME_SURVIVOR__.scenes.change(n, d), [name, data || {}]); await sleep(900); };

await page.goto(url);
for (let i = 0; i < 60 && (await scene()) !== 'menu'; i++) await sleep(200);
await page.mouse.click(10, 500);
await sleep(1200);
await shot('menu');
await G(() => window.__ANIME_SURVIVOR__.scenes.current.openSettings()); await sleep(300); await shot('settings');
await G(() => { const s = window.__ANIME_SURVIVOR__.scenes.current; s.showSettings = false; s.openCredits(); }); await sleep(400); await shot('credits');
await G(() => { window.__ANIME_SURVIVOR__.scenes.current.credits = null; });

await change('character'); await shot('character');
await G(() => { const s = window.__ANIME_SURVIVOR__.scenes.current; s.sel = 'regina'; s.refresh(); }); await sleep(300); await shot('character-locked');
await change('talent'); await shot('talent');

// ---- 战斗 ----
await change('game', { character: 'hikari', difficulty: 'normal', seed: 7 });
const tick = () => G(() => {
  const g = window.__ANIME_SURVIVOR__; const sc = g.scenes.current; const w = sc.world;
  w.p.maxHp = w.p.hp = 99999;
  if (w.state === 'levelup') w.levelup.choose(0);
  if (w.state === 'chest') w.levelup.closeChest();
  return { t: w.time, st: w.state, lv: w.p.level, e: w.enemies.pool.activeCount, fps: sc.fps.value };
});
await G(() => { window.__ANIME_SURVIVOR__.timeScale = 4; });
let info;
for (let i = 0; i < 60; i++) { info = await tick(); if (info.t > 95) break; await sleep(250); }
await G(() => { window.__ANIME_SURVIVOR__.timeScale = 1; });
console.log('after fast-forward', info);
await sleep(1500); await tick(); await shot('battle');

// 满屏压力：补到 300 只怪，测 6 秒帧率
await G(() => {
  const w = window.__ANIME_SURVIVOR__.scenes.current.world; const ids = ['slime', 'bat', 'bubble', 'doll'];
  for (let i = w.enemies.pool.activeCount; i < 300; i++) {
    const a = Math.random() * 6.283; const r = 140 + Math.random() * 360;
    w.enemies.spawn(ids[i % ids.length], w.p.x + Math.cos(a) * r, w.p.y + Math.sin(a) * r);
  }
});
const frames = await page.evaluate(() => new Promise((res) => {
  const g = window.__ANIME_SURVIVOR__; const w = g.scenes.current.world;
  const ts = []; let n = 0; const ec = [];
  const f = (t) => { ts.push(t); ec.push(w.enemies.pool.activeCount); w.p.maxHp = w.p.hp = 99999; if (w.state === 'levelup') w.levelup.choose(0); if (w.state === 'chest') w.levelup.closeChest(); if (++n < 360) requestAnimationFrame(f); else res({ ts, ec }); };
  requestAnimationFrame(f);
}));
const dts = frames.ts.slice(1).map((t, i) => t - frames.ts[i]);
const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
const sorted = dts.slice().sort((a, b) => a - b);
const stress = { avgFps: +(1000 / avg).toFixed(1), p95FrameMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), enemiesMin: Math.min(...frames.ec), enemiesMax: Math.max(...frames.ec) };
console.log('stress', stress);
await shot('swarm');

// 三选一
await G(() => { const w = window.__ANIME_SURVIVOR__.scenes.current.world; w.player.gainExp(w.player.p.expNext || 999); });
for (let i = 0; i < 20 && (await G(() => window.__ANIME_SURVIVOR__.scenes.current.world.state)) !== 'levelup'; i++) await sleep(100);
await sleep(600); await shot('levelup');
await G(() => window.__ANIME_SURVIVOR__.scenes.current.world.levelup.choose(0));

// Boss
await G(() => { const w = window.__ANIME_SURVIVOR__.scenes.current.world; w.enemies.pool.forEachActive ? 0 : 0; w.bosses.spawnBoss('nox'); });
for (let i = 0; i < 16; i++) { await tick(); await sleep(250); }
await shot('boss');
// 暂停
await G(() => window.__ANIME_SURVIVOR__.scenes.current.togglePause()); await sleep(400); await shot('pause');
await G(() => window.__ANIME_SURVIVOR__.scenes.current.togglePause());

// 结算 (胜利)
await G(() => window.__ANIME_SURVIVOR__.scenes.current.finish(true));
await sleep(2500); await shot('result-win');
// 结算 (失败)
await change('game', { character: 'momo', seed: 3 });
await G(() => { window.__ANIME_SURVIVOR__.timeScale = 4; }); await sleep(3000);
await G(() => { window.__ANIME_SURVIVOR__.timeScale = 1; window.__ANIME_SURVIVOR__.scenes.current.finish(false); });
await sleep(2500); await shot('result-lose');

const voice = await G(() => { const v = window.__ANIME_SURVIVOR__.voice; return { last: v.lastPlay, enabled: v.enabled }; });
console.log('voice', JSON.stringify(voice));
console.log('errors', errors.length ? errors : 'none');
await browser.close();
