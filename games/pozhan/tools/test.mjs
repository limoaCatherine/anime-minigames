// 自动化回归测试：node tools/test.mjs  (先 npm run build)
// 用无头浏览器打开 dist/index.html，以真实鼠标操作 (点击 / 长按 / 滑动 / 拖拽 / 道具拖放) 通关全部关卡：
//   找茬 / 找不同：先点一次空白处 (验证扣理智)，再依次点击每个热区 (找不同交替点上下图)，有问答的答对。
//   脱困 / 拼字：用 PuzzleSystem 的 BFS 求出正经结局与沙雕结局的操作序列，逐步用鼠标执行。
// 每关检查：进入结算面板、结局类型正确、无控制台错误、无 game.errors。另外测菜单、选关、设置、制作人员面板。
import { chromium } from 'playwright';
import path from 'node:path';
import { LEVELS } from '../src/config/LevelConfig.js';
import { solvePuzzle, PuzzleState } from '../src/systems/PuzzleSystem.js';
import { centerOf, signedDist } from '../src/core/geometry.js';
import { SaveSystem } from '../src/systems/SaveSystem.js';
import { dailyLevelFor } from '../src/config/DailyConfig.js';
import { GameConfig } from '../src/config/GameConfig.js';

const URL = 'file://' + path.resolve('dist/index.html');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
let page = await browser.newPage({ viewport: { width: 540, height: 960 } });
let consoleErrors = [];
function hook(pg) {
  pg.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  pg.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
}
hook(page);
const mistakes = () => scene(() => window.__SPOTDIFF__.scenes.current.mistakes);
const gstate = () => scene(() => window.__SPOTDIFF__.scenes.current.state);

const sleep = (ms) => page.waitForTimeout(ms);
async function toPage(x, y) {
  return page.evaluate(([x, y]) => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [r.left + x * r.width / 540, r.top + y * r.height / 960]; }, [x, y]);
}
async function click(x, y) { const [px, py] = await toPage(x, y); await page.mouse.click(px, py); }
async function drag(x0, y0, x1, y1, steps = 12, holdMs = 0) {
  const [a, b] = await toPage(x0, y0); const [c, d] = await toPage(x1, y1);
  await page.mouse.move(a, b); await page.mouse.down();
  if (holdMs) await sleep(holdMs);
  for (let i = 1; i <= steps; i++) { await page.mouse.move(a + (c - a) * i / steps, b + (d - b) * i / steps); await sleep(16); }
  await page.mouse.up();
}
async function hold(x, y, ms = 1000) { const [a, b] = await toPage(x, y); await page.mouse.move(a, b); await page.mouse.down(); await sleep(ms); await page.mouse.up(); }
const scene = (fn, arg) => page.evaluate(fn, arg);
async function clickButton(pick) {
  // pick: (scene) => button {x,y}；在页面里找到按钮坐标再用鼠标点
  const pos = await page.evaluate(`(() => { const s = window.__SPOTDIFF__.scenes.current; const b = (${pick})(s); return b ? [b.x, b.y] : null; })()`);
  if (!pos) throw new Error('找不到按钮 ' + pick);
  await click(pos[0], pos[1]);
}
async function screenOf(nx, ny, view = 0) { return scene(([nx, ny, view]) => window.__SPOTDIFF__.scenes.current.toScreen(nx, ny, window.__SPOTDIFF__.scenes.current.views[view]), [nx, ny, view]); }
async function waitFor(expr, timeout = 8000) { await page.waitForFunction(expr, null, { timeout }); }

async function openLevel(id) {
  await page.goto(`${URL}?level=${id}`);
  await waitFor(() => window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current && window.__SPOTDIFF__.scenes.current.name === 'game' && window.__SPOTDIFF__.scenes.current.dialog);
  await sleep(400);
  await clickButton('(s) => s.dialog.btn');
  await waitFor(() => window.__SPOTDIFF__.scenes.current.state === 'play');
  await sleep(200);
}

async function endKind() {
  await waitFor(() => { const s = window.__SPOTDIFF__.scenes.current; return s.panel && s.panel.o && s.panel.o.kind; }, 12000);
  return scene(() => window.__SPOTDIFF__.scenes.current.panel.o.kind);
}

function emptyPoint(lv, aspect) {
  const all = [...lv.spots, ...(lv.egg ? [lv.egg] : [])];
  for (let y = 0.95; y > 0.05; y -= 0.05) for (let x = 0.05; x < 0.96; x += 0.05) if (all.every((s) => signedDist(s, x, y, aspect) > 0.06)) return [x, y];
  return null;
}

async function playFind(lv) {
  const diff = lv.type === 'diff';
  const aspect = diff ? 342 / 540 : 700 / 540;
  const e = emptyPoint(lv, aspect);
  if (e) {
    const [x, y] = await screenOf(e[0], e[1], 0); await click(x, y); await sleep(450);
    const s = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.sanity, s.sanityMax, s.mistakes]; });
    if (s[2] !== 1) throw new Error(`点空白处没有扣理智 (mistakes=${s[2]})`);
  }
  const m0 = await mistakes();
  if (lv.egg) {
    const [cx, cy] = centerOf(lv.egg); const [x, y] = await screenOf(cx, cy, 0); await click(x, y); await sleep(420);
    await click(x, y); await sleep(420);   // v1.1：再点一次已找到的彩蛋，不扣分
    if (await mistakes() !== m0) throw new Error('重复点击已找到的彩蛋被扣分');
  }
  let i = 0;
  for (const sp of lv.spots) {
    const [cx, cy] = centerOf(sp);
    const [x, y] = await screenOf(cx, cy, diff ? i % 2 : 0);
    const last = i === lv.spots.length - 1;
    if (i === 1 && !diff) {
      // v1.1：长按出放大镜，松手时手指下是破绽就算找到
      await hold(x, y, 650);
    } else await click(x, y);
    if (last) {
      // v1.1：最后一处找到后的庆祝期间，乱点不扣分、Esc 不会把游戏卡在暂停里
      const st = await gstate();
      if (st !== 'clearing' && st !== 'quiz' && st !== 'end') throw new Error('最后一处找到后状态应为 clearing，实际 ' + st);
      const before = await mistakes();
      if (e) { const [ex, ey] = await screenOf(e[0], e[1], 0); await click(ex, ey); }
      await page.keyboard.press('Escape');
      if (await mistakes() !== before) throw new Error('最后一处找到后误触仍被扣分');
      if (await scene(() => !!window.__SPOTDIFF__.scenes.current.dialog && window.__SPOTDIFF__.scenes.current.state === 'pause')) throw new Error('庆祝期间按 Esc 打开了暂停 (会卡死)');
    }
    await sleep(420);
    if (i === 0) {
      await click(x, y); await sleep(380);   // 重复点已找到的破绽：不扣分
      if (await mistakes() !== m0) throw new Error('重复点击已找到的破绽被扣分');
    }
    i++;
  }
  const found = await scene(() => window.__SPOTDIFF__.scenes.current.found.size);
  if (found !== lv.spots.length) throw new Error(`只找到 ${found}/${lv.spots.length}`);
  if (lv.quiz) {
    await waitFor(() => window.__SPOTDIFF__.scenes.current.state === 'quiz');
    await sleep(300);
    await clickButton(`(s) => s.dialog.buttons[${lv.quiz.answer}]`);
  }
  return endKind();
}

async function zoneScreen(lv, id) { const z = lv.zones.find((q) => q.id === id); const [cx, cy] = centerOf(z); return screenOf(cx, cy, 0); }
async function slotCenter(i) { return scene((i) => { const r = window.__SPOTDIFF__.scenes.current.slotRect(i); return [r.x + r.w / 2, r.y + r.h / 2]; }, i); }

async function playPath(lv, moves) {
  const sim = new PuzzleState(lv);
  for (const m of moves) {
    if (m.type === 'combine') {
      const ia = sim.inv.indexOf(m.a); let ib = sim.inv.indexOf(m.b); if (m.a === m.b) ib = sim.inv.indexOf(m.b, ia + 1);
      const [x0, y0] = await slotCenter(ia); const [x1, y1] = await slotCenter(ib);
      await drag(x0, y0, x1, y1);
    } else if (m.type === 'drop') {
      const [x0, y0] = await slotCenter(sim.inv.indexOf(m.item)); const [x1, y1] = await zoneScreen(lv, m.zone);
      await drag(x0, y0, x1, y1, 16);
    } else {
      const z = lv.zones.find((q) => q.id === m.zone);
      const [x, y] = await zoneScreen(lv, m.zone);
      if (m.action === 'tap') await click(x, y);
      else if (m.action === 'hold') await hold(x, y, 1050);
      else if (m.action === 'swipe') { const d = { right: [110, 0], left: [-110, 0], up: [0, -110], down: [0, 110] }[z.dir || 'right']; await drag(x - d[0] / 2, y - d[1] / 2, x + d[0] / 2, y + d[1] / 2, 8); }
      else if (m.action === 'drag') { const [x1, y1] = await zoneScreen(lv, m.to); await drag(x, y, x1, y1, 16, 60); }
    }
    sim.perform(m);
    if (sim.ended) {
      // v1.1：结局演出期间输入锁定 (不扣分 / 不能暂停卡死)
      const st = await gstate();
      if (st !== 'ending' && st !== 'end') throw new Error('触发结局后状态应为 ending，实际 ' + st);
      const before = await mistakes();
      await click(270, 300); await page.keyboard.press('Escape');
      if (await mistakes() !== before) throw new Error('结局演出期间仍会扣分');
      if (await gstate() === 'pause') throw new Error('结局演出期间能打开暂停');
    }
    await sleep(520);
    const flags = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return s.puzzle ? [...s.puzzle.flags].sort().join(',') + '|' + [...s.puzzle.inv].sort().join(',') : ''; });
    if (!sim.ended && flags !== sim.key()) throw new Error(`第 ${moves.indexOf(m) + 1} 步 ${JSON.stringify(m)} 后状态不一致：游戏 ${flags} / 预期 ${sim.key()}`);
  }
  return endKind();
}

const results = [];
async function run(name, fn) {
  consoleErrors = [];
  const t0 = Date.now();
  try {
    const info = await fn();
    const gameErrors = await scene(() => (window.__SPOTDIFF__ && window.__SPOTDIFF__.errors) || []).catch(() => []);
    const errs = [...consoleErrors.filter((e) => !/favicon/.test(e)), ...gameErrors.map((e) => 'game: ' + JSON.stringify(e))];
    results.push({ name, ok: !errs.length, info: info + (errs.length ? ' | 错误：' + errs.join(' ; ') : ''), ms: Date.now() - t0 });
  } catch (e) {
    const st = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return `scene=${s.name} state=${s.state}` + (s.puzzle ? ` flags=${[...s.puzzle.flags]} inv=${s.puzzle.inv} ended=${s.puzzle.ended}` : ''); }).catch(() => '');
    await page.screenshot({ path: `/workspace/_scratch/spotdiff/fail_${name.split(' ')[0]}.png` }).catch(() => {});
    results.push({ name, ok: false, info: e.message.split('\n')[0] + ' | ' + st, ms: Date.now() - t0 });
  }
  const r = results[results.length - 1];
  console.log(`${r.ok ? '✓' : '✗'} ${name}  ${r.info}  (${(r.ms / 1000).toFixed(1)}s)`);
}

// —— 菜单 / 选关 / 设置 / 制作人员 ——
if (!only) {
  await run('菜单 → 选关 → 第 1 关', async () => {
    await page.goto(URL);
    await waitFor(() => window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current && window.__SPOTDIFF__.scenes.current.name === 'menu');
    await sleep(600);
    await clickButton('(s) => s.levelsBtn');
    await waitFor(() => window.__SPOTDIFF__.scenes.current.name === 'levels');
    await sleep(500);
    return '选关页打开';
  });
  await run('设置面板 + 音量滑条', async () => {
    await page.goto(URL);
    await waitFor(() => window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current && window.__SPOTDIFF__.scenes.current.name === 'menu');
    await sleep(500);
    await clickButton('(s) => s.settingsBtn');
    await sleep(400);
    const open = await scene(() => !!window.__SPOTDIFF__.scenes.current.settings);
    if (!open) throw new Error('设置面板没打开');
    await clickButton('(s) => s.settings.creditsBtn');
    await sleep(400);
    const cr = await scene(() => !!window.__SPOTDIFF__.scenes.current.settings.credits);
    if (!cr) throw new Error('制作人员面板没打开');
    const v = await scene(() => { const m = window.__SPOTDIFF__.audio.mixer; return ['voice', 'sfx', 'bgm'].map((k) => `${k}=${m.gain(k).toFixed(2)}`).join(' '); });
    return '设置/制作人员可打开；默认音量 ' + v;
  });
}

for (const lv of LEVELS) {
  if (only && !only.includes(lv.id)) continue;
  if (lv.type === 'find' || lv.type === 'diff') {
    await run(`${lv.id} ${lv.title}`, async () => {
      await openLevel(lv.id);
      const k = await playFind(lv);
      if (k !== 'win') throw new Error('结局不是通关：' + k);
      const st = await scene(() => window.__SPOTDIFF__.scenes.current.panel.o.stars);
      if (st !== 3) throw new Error(`只错 1 次、没看广告应为 3 星，实际 ${st} 星`);
      return `通关 ${lv.spots.length} 处${lv.quiz ? ' + 问答' : ''}，${st} 星`;
    });
    if (lv.quiz) await run(`${lv.id} 问答答错 → 沙雕结局`, async () => {
      await openLevel(lv.id);
      const save = lv.quiz.answer; lv.quiz.answer = (save + 1) % lv.quiz.options.length;
      try { const k = await playFind({ ...lv, spots: lv.spots }); if (k !== 'silly') throw new Error('应进入沙雕结局，实际 ' + k); } finally { lv.quiz.answer = save; }
      // v1.1：沙雕结局可以「重新作答」，不用重找 12 处
      await sleep(600);
      await clickButton('(s) => s.panel.buttons.find((b) => b.label === "重新作答")');
      await waitFor(() => window.__SPOTDIFF__.scenes.current.state === 'quiz');
      await sleep(300);
      await clickButton(`(s) => s.dialog.buttons[${lv.quiz.answer}]`);
      const k2 = await endKind();
      if (k2 !== 'win') throw new Error('重新作答答对后应通关，实际 ' + k2);
      return '沙雕结局 → 重新作答 → 通关';
    });
  } else {
    const sol = solvePuzzle(lv);
    for (const end of ['win', 'silly']) {
      await run(`${lv.id} ${lv.title} [${end === 'win' ? '正经结局' : '沙雕结局'}]`, async () => {
        await openLevel(lv.id);
        const k = await playPath(lv, sol.endings[end]);
        if (k !== end) throw new Error(`结局应为 ${end}，实际 ${k}`);
        return `${sol.endings[end].length} 步`;
      });
    }
  }
}

// —— v1.1 回归：手势公平 / 提示冷却 / 后台暂停 / 每日一图 / 星级 / 横屏 ——
if (!only || only.includes('extra')) {
  const L01 = LEVELS[0];
  await run('放大后拖动画面 (平移) 不扣分', async () => {
    await openLevel('L01');
    await clickButton('(s) => s.zoomBtn'); await sleep(450);
    const cam0 = await scene(() => ({ ...window.__SPOTDIFF__.scenes.current.cam }));
    await drag(200, 500, 330, 380, 14); await sleep(300);
    await drag(330, 380, 260, 520, 14); await sleep(300);
    const cam1 = await scene(() => ({ ...window.__SPOTDIFF__.scenes.current.cam }));
    if (await mistakes() !== 0) throw new Error('平移被算成点错');
    if (Math.abs(cam1.cx - cam0.cx) + Math.abs(cam1.cy - cam0.cy) < 0.01) throw new Error('平移没有生效');
    return `缩放 ${cam0.z.toFixed(2)}×，平移后 mistakes=0`;
  });
  await run('放大镜松手没对准：不扣分', async () => {
    await openLevel('L01');
    const e = emptyPoint(L01, 700 / 540); const [x, y] = await screenOf(e[0], e[1], 0);
    await hold(x, y, 700); await sleep(300);
    if (await mistakes() !== 0) throw new Error('放大镜松手被扣分');
    return '长按空白处松手 mistakes=0';
  });
  await run('免费提示冷却 + 提示中重复点提示按钮', async () => {
    await openLevel('L01');
    await clickButton('(s) => s.hintBtn'); await sleep(300);
    const a = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.freeHints, Math.round(s.freeCd), !!s.hint]; });
    if (a[0] !== 0 || a[1] !== GameConfig.hint.freeCooldown || !a[2]) throw new Error('免费提示后状态不对 ' + a);
    await clickButton('(s) => s.hintBtn'); await sleep(300);   // 提示还亮着：不应再给一次提示
    const again = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.adHints, s.exactCd]; });
    if (again[0] !== 0 || again[1] !== 0) throw new Error('提示还亮着时又消耗了精确提示 ' + again);
    await scene(() => { window.__SPOTDIFF__.scenes.current.freeCd = 0.4; });
    await sleep(900);
    const b = await scene(() => window.__SPOTDIFF__.scenes.current.freeHints);
    if (b !== 1) throw new Error('冷却结束没有回复免费提示');
    return `冷却 ${GameConfig.hint.freeCooldown}s 后免费提示 +1`;
  });
  await run('没配广告位：免费精确提示 + 冷却，界面没有任何「广告」字样', async () => {
    await openLevel('L02');
    if (await scene(() => window.__SPOTDIFF__.ads.enabled)) throw new Error('网页版不应启用广告');
    await scene(() => { const s = window.__SPOTDIFF__.scenes.current; s.freeHints = 0; s.freeCd = 60; });
    await clickButton('(s) => s.hintBtn'); await sleep(400);
    const r = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.adHints, !!(s.hint && s.hint.exact), s.state, Math.round(s.exactCd)]; });
    if (r[0] !== 1 || !r[1] || r[2] !== 'play' || r[3] !== GameConfig.hint.noAdExactCooldown) throw new Error('免费精确提示结果不对 ' + r);
    await scene(() => { window.__SPOTDIFF__.scenes.current.hint = null; });
    await clickButton('(s) => s.hintBtn'); await sleep(300);
    const r2 = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.adHints, !!s.hint]; });
    if (r2[0] !== 1 || r2[1]) throw new Error('冷却中又给了提示 ' + r2);
    // 画面上不能出现「广告」：用 fillText 钩子收集一帧里画出的所有文字
    const texts = await scene(() => new Promise((res) => {
      const ctx = window.__SPOTDIFF__.ctx || document.getElementById('game').getContext('2d'); const seen = [];
      const orig = ctx.fillText; ctx.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
      setTimeout(() => { ctx.fillText = orig; res(seen); }, 300);
    }));
    if (texts.some((t) => /广告/.test(t))) throw new Error('画面上出现了广告字样：' + texts.filter((t) => /广告/.test(t)).join(','));
    if (!texts.some((t) => /精确/.test(t))) throw new Error('提示按钮没显示精确提示冷却');
    return `精确提示 → 冷却 ${GameConfig.hint.noAdExactCooldown}s；画面无「广告」字样`;
  });
  await run('没配广告位：理智归零 → 每关 1 次「再试一次」', async () => {
    await openLevel('L01');
    await scene(() => { const s = window.__SPOTDIFF__.scenes.current; s.sanity = 1; s.fail(); });
    await sleep(300);
    const labels = await scene(() => window.__SPOTDIFF__.scenes.current.dialog.buttons.map((b) => b.label));
    if (labels.some((l) => /广告/.test(l)) || !labels.includes('再试一次')) throw new Error('失败弹窗按钮不对 ' + labels.join('/'));
    await clickButton('(s) => s.dialog.buttons.find((b) => b.label === "再试一次")'); await sleep(300);
    const r = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.state, s.sanity === s.sanityMax, s.revives, s.computeStars()]; });
    if (r[0] !== 'play' || !r[1] || r[2] !== 1 || r[3] > 2) throw new Error('再试一次结果不对 ' + r);
    await scene(() => window.__SPOTDIFF__.scenes.current.fail()); await sleep(300);
    const l2 = await scene(() => window.__SPOTDIFF__.scenes.current.dialog.buttons.map((b) => b.label));
    if (l2.includes('再试一次')) throw new Error('同一关给了第二次再试一次');
    return '再试一次 → 理智回满、最多 2 星；第二次归零只能重开';
  });
  await run('填了广告位 (注入 provider)：看广告入口自动恢复', async () => {
    await openLevel('L02');
    await scene(() => { const g = window.__SPOTDIFF__; g.ads.setProvider(() => new Promise((r) => setTimeout(() => r(true), 50))); const s = g.scenes.current; s.freeHints = 0; s.freeCd = 60; });
    await clickButton('(s) => s.hintBtn'); await sleep(500);
    const r = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.adHints, !!(s.hint && s.hint.exact), s.state, s.exactCd]; });
    await scene(() => { const s = window.__SPOTDIFF__.scenes.current; s.sanity = 1; s.fail(); });
    await sleep(200);
    const labels = await scene(() => window.__SPOTDIFF__.scenes.current.dialog.buttons.map((b) => b.label));
    await scene(() => window.__SPOTDIFF__.ads.setProvider(null));
    if (r[0] !== 1 || !r[1] || r[2] !== 'play' || r[3] !== 0) throw new Error('广告提示结果不对 ' + r);
    if (!labels.includes('看广告：理智回满') || labels.includes('再试一次')) throw new Error('有广告时失败弹窗不对 ' + labels.join('/'));
    return '广告提示 → 精确提示 (无冷却)；失败弹窗「看广告：理智回满」';
  });
  await run('BGM 只用 mp3，循环接缝双播放器交叉淡化', async () => {
    await openLevel('L01');
    await clickButton('(s) => s.hintBtn');   // 一次点击解锁自动播放
    await waitFor(() => window.__SPOTDIFF__.music.state().playing === 'game', 6000);
    const st0 = await scene(() => window.__SPOTDIFF__.music.state());
    if (!/\.mp3$/.test(st0.src) || st0.players !== 2) throw new Error('BGM 状态不对 ' + JSON.stringify(st0));
    if (!(st0.duration > st0.loopEnd + 0.3)) throw new Error('mp3 没带交叉淡化尾巴 ' + st0.duration + ' / ' + st0.loopEnd);
    await scene(() => { const m = window.__SPOTDIFF__.music; const x = m.els[m.want]; x.pl[x.cur].currentTime = m.state().loopEnd - 0.4; });
    await waitFor(() => window.__SPOTDIFF__.music.state().loops >= 1, 4000);
    await sleep(600);
    const st1 = await scene(() => { const m = window.__SPOTDIFF__.music; const x = m.els[m.want]; return { ...m.state(), oldPaused: x.pl[1 - x.cur].paused, newT: x.pl[x.cur].currentTime }; });
    if (st1.crossfading || !st1.oldPaused || !(st1.newT > 0.2 && st1.newT < 2) || !st1.playing) throw new Error('接缝后状态不对 ' + JSON.stringify(st1));
    return `loopEnd ${st0.loopEnd.toFixed(2)}s / 文件 ${st0.duration.toFixed(2)}s；接缝后新播放器在 ${st1.newT.toFixed(2)}s，旧播放器已停`;
  });
  await run('切到后台自动暂停', async () => {
    await openLevel('L01');
    await scene(() => window.__SPOTDIFF__.events.emit('app:hidden'));
    await sleep(200);
    const st = await gstate();
    if (st !== 'pause') throw new Error('没有自动暂停：' + st);
    await scene(() => window.__SPOTDIFF__.events.emit('app:visible'));
    await clickButton('(s) => s.dialog.buttons[0]'); await sleep(200);
    if (await gstate() !== 'play') throw new Error('继续后没回到 play');
    return 'app:hidden → 暂停 → 继续';
  });
  await run('理智归零后立刻暂停：不会绕过失败', async () => {
    await openLevel('L01');
    const e = emptyPoint(L01, 700 / 540);
    for (let k = 0; k < 3; k++) { const [x, y] = await screenOf(e[0] + k * 0.0, e[1], 0); await click(x, y); await sleep(420); }
    await page.keyboard.press('Escape');
    await waitFor(() => { const s = window.__SPOTDIFF__.scenes.current; return s.state === 'fail'; }, 3000);
    return '理智归零 → 失败弹窗 (Esc 无效)';
  });
  await run('复活后最多 2 星', async () => {
    await openLevel('L01');
    const s = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; s.revives = 1; s.mistakes = 0; return s.computeStars(); });
    const s2 = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; s.revives = 0; s.mistakes = 1; return s.computeStars(); });
    const s3 = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; s.mistakes = 4; return s.computeStars(); });
    if (s !== 2 || s2 !== 3 || s3 !== 1) throw new Error(`星级不对：复活=${s} 错1=${s2} 错4=${s3}`);
    return '复活→2 星；错 1 次→3 星；错 4 次→1 星';
  });
  await run('每日一图：当天固定 + 成绩按天结算', async () => {
    const save = new SaveSystem('t');
    save.data.cleared = { L01: true };
    const a = dailyLevelFor('2026-10-11', save);
    save.data.cleared = Object.fromEntries(LEVELS.map((l) => [l.id, true]));   // 白天又通关了一堆
    const b = dailyLevelFor('2026-10-11', save);
    if (a.id !== b.id) throw new Error(`同一天换图了 ${a.id} → ${b.id}`);
    const c = dailyLevelFor('2026-10-12', save);
    if (save.get('dailyPick').date !== '2026-10-12') throw new Error('第二天没有重新抽');
    save.submitDaily('2026-10-11', 3);
    save.submitDaily('2026-10-12', 1);
    if (save.get('dailyStars') !== 1) throw new Error('新的一天沿用了昨天的星数：' + save.get('dailyStars'));
    save.submitDaily('2026-10-12', 2); save.submitDaily('2026-10-12', 1);
    if (save.get('dailyStars') !== 2) throw new Error('同一天没有保留最好成绩');
    return `当天 ${a.id} 不变；次日 ${c.id}；星数按天`;
  });
  await run('横屏窗口 (1280×720) 点击坐标准确', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const old = page; page = await ctx2.newPage(); hook(page);
    try {
      await openLevel('L01');
      const rect = await scene(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.width, r.height]; });
      if (Math.abs(rect[0] / rect[1] - 540 / 960) > 0.01) throw new Error('画面比例不是 9:16：' + rect);
      for (const sp of L01.spots.slice(0, 3)) { const [cx, cy] = centerOf(sp); const [x, y] = await screenOf(cx, cy, 0); await click(x, y); await sleep(420); }
      const f = await scene(() => window.__SPOTDIFF__.scenes.current.found.size);
      if (f !== 3 || await mistakes() !== 0) throw new Error(`横屏点击偏了：found=${f}`);
      await page.setViewportSize({ width: 900, height: 1000 }); await sleep(300);
      const [cx, cy] = centerOf(L01.spots[3]); const [x, y] = await screenOf(cx, cy, 0); await click(x, y); await sleep(420);
      if (await scene(() => window.__SPOTDIFF__.scenes.current.found.size) !== 4) throw new Error('改变窗口大小后点击偏了');
      return `画布 ${rect.map(Math.round).join('×')}，改窗口大小后仍准确`;
    } finally { await ctx2.close(); page = old; }
  });
  if (!only) await run('关掉重开：进度 / 星级 / 成就仍在', async () => {
    await page.goto(URL);
    await waitFor(() => window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current && window.__SPOTDIFF__.scenes.current.name === 'menu');
    const d = await scene(() => { const s = window.__SPOTDIFF__.save; return [s.get('unlocked'), Object.keys(s.get('cleared')).length, Object.keys(s.get('achievements')).length, s.get('stars').L01]; });
    if (d[0] < LEVELS.length || d[1] < LEVELS.length || !d[2] || d[3] !== 3) throw new Error('重开后存档丢了 ' + d);
    return `解锁 ${d[0]} 关、通关 ${d[1]} 关、成就 ${d[2]} 个，L01 ${d[3]} 星`;
  });
  await run('L08 咒语没凑齐点魔法少女：先警告', async () => {
    const lv = LEVELS.find((l) => l.id === 'L08');
    await openLevel('L08');
    const [x, y] = await zoneScreen(lv, 'c_星'); await click(x, y); await sleep(450);
    const [gx, gy] = await zoneScreen(lv, 'girl_warn'); await click(gx, gy); await sleep(600);
    const st = await scene(() => { const s = window.__SPOTDIFF__.scenes.current; return [s.state, [...s.puzzle.flags].includes('warned')]; });
    if (st[0] !== 'play' || !st[1]) throw new Error('第一次点就结束了 ' + st);
    return '第一次点只警告，不直接进沙雕结局';
  });
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} 通过`);
await browser.close();
process.exit(bad.length ? 1 : 0);
