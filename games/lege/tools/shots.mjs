// 截图工具 (开发用)：node tools/shots.mjs <输出目录> [前缀]
// 依次截取：主菜单 / 选关地图 / 关卡信息 / 设置面板 / 制作人员 / 多个不同图案的关卡 (含地狱关) / 通关画面 / 失败画面
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'docs');
const prefix = process.argv[3] || 'anime-stack-v3-';
const only = process.argv[4] ? process.argv[4].split(',') : null;
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
const waitScene = (n) => page.waitForFunction((x) => { const g = window.__ANIME_STACK__; return g && g.scenes.currentName === x && !g.scenes.transitioning; }, n, { timeout: 15000 });
const dbg = (n, a) => page.evaluate(([n, a]) => window.__ANIME_STACK__.debug[n](a), [n, a]);
const shot = async (name) => {
  if (only && !only.includes(name)) return;
  const f = path.join(out, `${prefix}${name}.png`);
  await page.screenshot({ path: f });
  console.log('📸', f);
};
const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); };
const goGame = async (level) => {
  await page.evaluate((l) => window.__ANIME_STACK__.scenes.change('game', { level: l, seed: 20261011 }), level);
  await waitScene('game');
};

await waitScene('menu');
await dbg('setProgress', { unlocked: 9, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 2, 7: 3, 8: 2 } });
await page.evaluate(() => window.__ANIME_STACK__.scenes.change('menu'));
await waitScene('menu');
await sleep(1200);
await shot('menu');

await page.evaluate(() => window.__ANIME_STACK__.scenes.change('levels'));
await waitScene('levels');
await sleep(900);
await shot('levels');
const nodes = await dbg('levelNodes');
const n5 = nodes.find((n) => n.id === 5);
await tap(n5.x, n5.y);
await sleep(1100);
await shot('level-info');

await page.evaluate(() => window.__ANIME_STACK__.scenes.change('menu'));
await waitScene('menu');
await page.evaluate(() => window.__ANIME_STACK__.scenes.current.openSettings());
await sleep(600);
await shot('settings');
await page.evaluate(() => { const s = window.__ANIME_STACK__.scenes.current.settings; s.creditsBtn.onClick(); });
await sleep(500);
await shot('credits');
await page.evaluate(() => { window.__ANIME_STACK__.scenes.current.settings.credits = null; });

for (const lv of [1, 2, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 'daily']) {
  if (only && !only.includes(`level${lv}`) && !only.includes('levels-all')) continue;
  await goGame(lv);
  await sleep(2600);
  // 拿几张卡让卡槽里有东西 & 触发字幕
  for (let i = 0; i < 2; i++) {
    const h = await dbg('hint');
    if (h) await tap(h.x, h.y);
    await sleep(350);
  }
  await sleep(500);
  await shot(`level${lv}`);
}

// 暂停菜单
if (!only || only.includes('pause')) {
  await goGame(6);
  await sleep(2000);
  await page.evaluate(() => window.__ANIME_STACK__.scenes.current.pause());
  await sleep(500);
  await shot('pause');
}

// 消除瞬间：字幕条 (HUD 下方) + 爱心/星星粒子 + 连消横幅
if (!only || only.includes('clear')) {
  await goGame(2);
  await sleep(2400);
  let matches = 0;
  for (let i = 0; i < 40 && matches < 2; i++) {
    const before = await page.evaluate(() => window.__ANIME_STACK__.scenes.current.match.totalMatches);
    const h = await dbg('hint');
    if (!h) break;
    await tap(h.x, h.y);
    await sleep(140);
    const after = await page.evaluate(() => window.__ANIME_STACK__.scenes.current.match.totalMatches);
    if (after > before) matches++;
  }
  await sleep(380);
  await shot('clear');
}

// 通关画面：第 3 关按参考解通关
if (!only || only.includes('win')) {
  await dbg('setProgress', { unlocked: 3, stars: { 1: 3, 2: 3 } });
  await goGame(3);
  await sleep(2200);
  const order = await dbg('referenceOrder');
  for (const id of order) {
    const c = await dbg('cardById', id);
    if (c.state !== 'board') continue;
    await dbg('tryPick', id);
    await sleep(70);
  }
  await waitScene('result');
  await sleep(2600);
  await shot('win');
}
if (!only || only.includes('hell-win')) {
  await goGame(10);
  await sleep(2600);
  const order = await dbg('referenceOrder');
  for (const id of order) { await dbg('tryPick', id); await sleep(25); }
  await waitScene('result');
  await sleep(2600);
  await shot('hell-win');
}
if (!only || only.includes('fail')) {
  await goGame(8);
  await sleep(2200);
  for (let i = 0; i < 24; i++) {
    const h = await dbg('hint');
    if (!h) break;
    await dbg('tryPick', h.id);
    await sleep(90);
  }
  await sleep(600);
  for (let i = 0; i < 9; i++) {
    const c = await dbg('nonMatchingFree');
    if (!c) break;
    await dbg('tryPick', c.id);
    await sleep(120);
  }
  await sleep(900);
  await shot('revive');
  const btns = await dbg('buttons');
  const giveUp = btns.find((b) => String(b.label).includes('算了'));
  if (giveUp) await tap(giveUp.x, giveUp.y);
  await waitScene('result');
  await sleep(1400);
  await shot('fail');
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
