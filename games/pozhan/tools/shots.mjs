// 宣传 / 验收截图：node tools/shots.mjs  →  /workspace/anime-spotdiff-*.png
import { chromium } from 'playwright';
import path from 'node:path';
import { levelById } from '../src/config/LevelConfig.js';
import { solvePuzzle } from '../src/systems/PuzzleSystem.js';
import { centerOf } from '../src/core/geometry.js';

const URL = 'file://' + path.resolve('dist/index.html');
const OUT = process.env.SHOTS_DIR || '/workspace';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { const f = `${OUT}/anime-spotdiff-${name}.png`; await page.screenshot({ path: f }); console.log(f); };
const ev = (fn, a) => page.evaluate(fn, a);
async function toPage(x, y) { return ev(([x, y]) => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + x * r.width / 540, r.top + y * r.height / 960]; }, [x, y]); }
async function click(x, y) { const [a, b] = await toPage(x, y); await page.mouse.click(a, b); }
async function drag(x0, y0, x1, y1, n = 14, pre = 0) { const [a, b] = await toPage(x0, y0); const [c, d] = await toPage(x1, y1); await page.mouse.move(a, b); await page.mouse.down(); if (pre) await sleep(pre); for (let i = 1; i <= n; i++) { await page.mouse.move(a + (c - a) * i / n, b + (d - b) * i / n); await sleep(16); } await page.mouse.up(); }
async function btn(expr) { const p = await ev(`(() => { const s = window.__SPOTDIFF__.scenes.current; const b = (${expr})(s); return [b.x, b.y]; })()`); await click(p[0], p[1]); }
const wait = (fn, t = 10000) => page.waitForFunction(fn, null, { timeout: t });
async function scr(nx, ny, v = 0) { return ev(([nx, ny, v]) => { const s = window.__SPOTDIFF__.scenes.current; return s.toScreen(nx, ny, s.views[v]); }, [nx, ny, v]); }
async function open(id) {
  await page.goto(`${URL}?level=${id}`);
  await wait(() => { const s = window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current; return s && s.name === 'game' && s.dialog; });
  await sleep(500);
}
async function start() { await btn('(s) => s.dialog.btn'); await wait(() => window.__SPOTDIFF__.scenes.current.state === 'play'); await sleep(300); }
async function findSome(lv, n) { let i = 0; for (const sp of lv.spots.slice(0, n)) { const [cx, cy] = centerOf(sp); const [x, y] = await scr(cx, cy, lv.type === 'diff' ? i % 2 : 0); await click(x, y); await sleep(380); i++; } }

// 菜单
await page.goto(URL);
await wait(() => { const s = window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current; return s && s.name === 'menu'; });
// 预置一些进度，选关页更有内容
await ev(() => { const g = window.__SPOTDIFF__; for (const [i, id] of ['L01', 'L02', 'L03', 'L04', 'L05', 'L06'].entries()) g.save.submit(id, i + 1, { win: true, stars: 3 - (i % 2), time: 60 }); g.save.addAchievement('silly_L03'); });
await page.goto(URL);
await wait(() => { const s = window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current; return s && s.name === 'menu'; });
await sleep(1500); await shot('menu');
await btn('(s) => s.levelsBtn'); await sleep(900); await shot('levels');
// 设置 + 制作人员
await page.goto(URL); await wait(() => { const s = window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current; return s && s.name === 'menu'; }); await sleep(600);
await btn('(s) => s.settingsBtn'); await sleep(700); await shot('settings');
await btn('(s) => s.settings.creditsBtn'); await sleep(800); await shot('credits');

// 开场卡
const L01 = levelById('L01');
await open('L01'); await shot('intro');
// 找不合理 进行中 (含一次误触)
await start(); await findSome(L01, 4); await click(270, 300); await sleep(250); await shot('play-L01');
// 找不合理 L06 进行中 + 放大镜
const L06 = levelById('L06');
await open('L06'); await start(); await findSome(L06, 6); await sleep(1200); await shot('play-L06');
// 找不同 进行中
const L10 = levelById('L10');
await open('L10'); await start(); await findSome(L10, 5); await sleep(900); await shot('play-L10-diff');
// 换装：有道具、披风已穿上
const L12 = levelById('L12');
await open('L12'); await start();
const slot = async (i) => ev((i) => { const r = window.__SPOTDIFF__.scenes.current.slotRect(i); return [r.x + r.w / 2, r.y + r.h / 2]; }, i);
const zone = async (id) => { const z = L12.zones.find((q) => q.id === id); const [cx, cy] = centerOf(z); return scr(cx, cy); };
for (const id of ['curtain', 'pin', 'tie', 'flags', 'leeks']) { const [x, y] = await zone(id); await click(x, y); await sleep(500); }
{ const a = await slot(0); const b = await slot(1); await drag(a[0], a[1], b[0], b[1]); await sleep(600); }
{ const inv = await ev(() => window.__SPOTDIFF__.scenes.current.puzzle.inv); const a = await slot(inv.indexOf('cape')); const z = await zone('back'); await drag(a[0], a[1], z[0], z[1]); await sleep(700); }
{ const inv = await ev(() => window.__SPOTDIFF__.scenes.current.puzzle.inv); const a = await slot(inv.indexOf('flagL')); const z = await zone('handL'); await drag(a[0], a[1], z[0], z[1]); await sleep(2200); }
await shot('play-L12-dressup');
// 脱困：史莱姆 (BFS 走到一半)
const L07 = levelById('L07');
await open('L07'); await start();
{
  const path7 = solvePuzzle(L07).endings.win; const { PuzzleState } = await import('../src/systems/PuzzleSystem.js'); const sim = new PuzzleState(L07);
  for (const m of path7.slice(0, 4)) {
    if (m.type === 'drop') { const a = await slot(sim.inv.indexOf(m.item)); const z = L07.zones.find((q) => q.id === m.zone); const [cx, cy] = centerOf(z); const b = await scr(cx, cy); await drag(a[0], a[1], b[0], b[1]); }
    else if (m.type === 'act') { const z = L07.zones.find((q) => q.id === m.zone); const [cx, cy] = centerOf(z); const [x, y] = await scr(cx, cy); if (m.action === 'hold') { const [a, b] = await toPage(x, y); await page.mouse.move(a, b); await page.mouse.down(); await sleep(1000); await page.mouse.up(); } else await click(x, y); }
    sim.perform(m); await sleep(700);
  }
  await sleep(1500); await shot('play-L07-puzzle');
}
// 拼字关
const L08 = levelById('L08');
await open('L08'); await start(); await sleep(300); await shot('play-L08-word');
// 通关画面 (L11 找齐)
const L11 = levelById('L11');
await open('L11'); await start(); await findSome(L11, L11.spots.length);
await wait(() => { const s = window.__SPOTDIFF__.scenes.current; return s.panel; }, 8000); await sleep(1800); await shot('win');
// 问答 (L13)
const L13 = levelById('L13');
await open('L13'); await start(); await findSome(L13, L13.spots.length);
await wait(() => window.__SPOTDIFF__.scenes.current.state === 'quiz'); await sleep(600); await shot('quiz');
// 沙雕结局 (答错)
await btn('(s) => s.dialog.buttons[0]');
await wait(() => { const s = window.__SPOTDIFF__.scenes.current; return s.panel; }, 8000); await sleep(1500); await shot('silly');
// 看广告提示
await open('L09'); await start();
await ev(() => { const s = window.__SPOTDIFF__.scenes.current; s.freeHints = 0; });
await btn('(s) => s.hintBtn'); await sleep(1500); await shot('ad-hint');

// v1.1：免费提示冷却倒计时 + 两行字幕
await open('L02'); await start();
await btn('(s) => s.hintBtn'); await sleep(400);
await ev(() => window.__SPOTDIFF__.subtitle.show('zero7', '咒语还没齐，现在念会出事的。真要念就再点一次。', 6));
await sleep(500); await shot('v11-hint-cooldown');
// v1.1：暂停菜单 (围观弹幕开关)
await btn('(s) => s.backBtn'); await sleep(600); await shot('v11-pause');
// v1.1：横屏桌面窗口
await page.setViewportSize({ width: 1280, height: 720 });
await open('L10'); await start(); await findSome(L10, 3); await sleep(800); await shot('v11-landscape');

console.log(errors.length ? '控制台错误：\n' + errors.join('\n') : '无控制台错误');
await browser.close();
