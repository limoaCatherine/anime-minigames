// 自动化冒烟测试 (Playwright + Chromium 无头浏览器)
// 用法: npm run build && node tools/test.mjs [额外截图目录]
// 覆盖: dist 双击版 (file://) 加载无报错、图片/语音加载、菜单 -> 选关 -> 第 1 关、
//       禁画区阻挡、鼠标真实画线 -> 线成形 -> 蜜蜂撞线 -> 坚持 8 秒 -> 胜利面板 + 星级存档 + 解锁下一关、
//       锁定关卡不可进入、暂停停表、失败流程 (哭泣/失败面板)、提示 (桩广告 -> 显示虚线)、语音与字幕、
//       开发版源码 (本地服务器) 可运行。
//       旧版 (20 关 v1) 存档迁移、章节页签 / 箭头 / 滑动翻页、进入第 3 / 4 章关卡并用参考解法通关。
//       声音：语音 mp3 播放、BGM 跨场景连续播放与无缝循环、台词闪避、默认音量、旧音量迁移、开场白频率、蜂群单一嗡嗡声。
// 截图: docs/screenshot-{menu,play,win,lose,levelselect,ch3,ch4,credits}.png；
//       若传入目录，另存为 <目录>/anime-drawline-<名字>.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extraDir = process.argv[2] || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) failures++;
}
async function shot(page, name) {
  const p = path.join(root, 'docs', `screenshot-${name}.png`);
  await page.screenshot({ path: p });
  if (extraDir) fs.copyFileSync(p, path.join(extraDir, `anime-drawline-${name}.png`));
  return extraDir ? path.join(extraDir, `anime-drawline-${name}.png`) : p;
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  await page.goto(url);
  return { page, errors };
}

const G = (page, fn, arg) => page.evaluate(fn, arg);
async function waitScene(page, name, timeout = 10000) {
  await page.waitForFunction((n) => {
    const g = window.__ANIME_DRAWLINE__;
    return g && g.scenes.currentName === n && !g.scenes.transitioning;
  }, name, { timeout });
}
async function toPage(page, x, y) {
  return page.evaluate(([lx, ly]) => {
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.left + (lx / 540) * r.width, y: r.top + (ly / 960) * r.height };
  }, [x, y]);
}
async function tap(page, x, y) {
  const p = await toPage(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
}
/** 用真实鼠标事件沿折线拖动 (每段细分成若干步) */
async function dragPath(page, pts) {
  const s = await toPage(page, pts[0].x, pts[0].y);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  for (let i = 1; i < pts.length; i++) {
    const p = await toPage(page, pts[i].x, pts[i].y);
    await page.mouse.move(p.x, p.y, { steps: 4 });
  }
  await page.mouse.up();
}
const scene = (page) => G(page, () => {
  const s = window.__ANIME_DRAWLINE__.scenes.current;
  return { fsm: s.fsm && s.fsm.name, state: s.world && s.world.state, time: s.world && s.world.time, result: s.result, panel: !!s.panel };
});

async function testDist(browser) {
  console.log('\n[1] dist/index.html (file://, 双击方式)');
  const voiceDir = path.join(root, 'dist/assets/audio/voice');
  const voices = fs.existsSync(voiceDir) ? fs.readdirSync(voiceDir).filter((f) => f.endsWith('.mp3')) : [];
  check(voices.length === 15 && voices.every((f) => fs.statSync(path.join(voiceDir, f)).size > 2000), `15 个语音文件存在于 dist (${voices.length})`);

  const { page, errors } = await openPage(browser, pathToFileURL(path.join(root, 'dist/index.html')).href);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitScene(page, 'menu');
  const load = await G(page, () => {
    const g = window.__ANIME_DRAWLINE__;
    return {
      imgs: [...g.assets.images.values()].filter((i) => i instanceof HTMLImageElement && i.naturalWidth > 0).length,
      voices: g.voice.loadedCount,
    };
  });
  check(load.imgs === 10, `10 张图片加载成功 (${load.imgs})`);
  check(load.voices === 15, `15 条语音预加载成功 (${load.voices})`);
  await sleep(500);
  const menuShot = await shot(page, 'menu');
  check(true, `菜单截图: ${menuShot}`);

  // 菜单 -> 选关
  await tap(page, 270, 812);
  await waitScene(page, 'levels');
  check(true, '点击「开始游戏」进入选关');
  check(await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.chapter) === 0, '新存档默认打开第 1 章');
  await tap(page, 270, 452); // 第 3 关 (锁定)
  await sleep(500);
  check(await G(page, () => window.__ANIME_DRAWLINE__.scenes.currentName) === 'levels', '锁定的第 3 关无法进入');
  await tap(page, 70, 452); // 第 1 关
  await waitScene(page, 'game');
  let st = await scene(page);
  check(st.fsm === 'draw' && st.state === 'draw', `进入第 1 关，处于画线阶段 (${st.fsm})`);
  await G(page, () => {
    const g = window.__ANIME_DRAWLINE__;
    window.__ev = { bounce: 0, voice: [], commit: 0, ticks: [] };
    g.events.on('bee:bounce', () => window.__ev.bounce++);
    g.events.on('voice:line', (e) => window.__ev.voice.push(e.group));
    g.events.on('line:commit', () => window.__ev.commit++);
    g.events.on('timer:tick', (e) => window.__ev.ticks.push(e.seconds));
  });
  await sleep(400);
  const v0 = await G(page, () => window.__ANIME_DRAWLINE__.voice.lastPlay);
  check(v0 && v0.group === 'start' && v0.result === 'audio', `开局语音「start」用 mp3 播放 (${JSON.stringify(v0)})`);
  const bgm0 = await G(page, () => window.__ANIME_DRAWLINE__.bgm.state());
  check(bgm0.playing && bgm0.loop && /bgm_main\.(ogg|mp3)$/.test(bgm0.src) && !bgm0.error, `背景音乐在第一次点击后开始循环播放 (${bgm0.src}, t=${bgm0.time.toFixed(2)}s / ${bgm0.duration.toFixed(1)}s)`);
  check(bgm0.voiceActive && bgm0.duck < 0.9 && bgm0.duck > 0.5, `台词播放时 BGM 闪避 (duck=${bgm0.duck.toFixed(2)})`);
  const vols = await G(page, () => ({ sfx: window.__ANIME_DRAWLINE__.audio.volume, voice: window.__ANIME_DRAWLINE__.voice.volume, bgm: window.__ANIME_DRAWLINE__.bgm.volume }));
  check(Math.abs(vols.sfx - 0.12) < 1e-9 && Math.abs(vols.voice - 0.3) < 1e-9 && Math.abs(vols.bgm - 0.15) < 1e-9, `默认音量：音效 ${vols.sfx} / 语音 ${vols.voice} / 音乐 ${vols.bgm}`);

  // 禁画区：从左往右横穿主角 -> 线停在主角前面
  const zone = await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; return s.world.heroine.zone(0); });
  await dragPath(page, [{ x: 150, y: 760 }, { x: 390, y: 760 }]);
  st = await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; return { n: s.world.drawing.points.length, state: s.world.state, maxX: Math.max(...(s.world.line ? s.world.line.points : s.world.drawing.points).map((p) => p.x)) }; });
  check(st.maxX < zone.x, `线不能穿过主角 (线最右 x=${Math.round(st.maxX)} < 主角左边 ${Math.round(zone.x)})`);
  // 这条短线已提交 -> 重新开始本关
  await tap(page, 90, 44);
  await waitScene(page, 'game');

  await G(page, () => { window.__ev.voice = []; });
  // 真实鼠标画出参考解法 (罩子)
  const sol = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.level.solution);
  await dragPath(page, sol);
  st = await scene(page);
  const ink = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.world.inkUsed);
  check(st.state === 'survive', `松手后线成形，开始倒计时 (用墨 ${Math.round(ink)})`);
  await sleep(2800);
  const playShot = await shot(page, 'play');
  const mid = await G(page, () => ({ bees: window.__ANIME_DRAWLINE__.scenes.current.world.hazards.count('bee'), bounce: window.__ev.bounce, expr: window.__ANIME_DRAWLINE__.scenes.current.world.heroine.expression }));
  check(mid.bees >= 10 && mid.bounce > 0, `关卡中截图: ${playShot} (蜜蜂 ${mid.bees} 只, 撞线 ${mid.bounce} 次, 表情 ${mid.expr})`);
  const sw = await G(page, () => { const a = window.__ANIME_DRAWLINE__.audio; return { level: a.swarmLevel, node: !!a.swarm, gain: a.swarm ? a.swarm.out.gain.value : 0, boing: a.count.boing || 0 }; });
  check(sw.node && sw.level > 0 && sw.level <= 1 && sw.gain <= 0.05 + 1e-6, `蜂群只有一个低音量嗡嗡声 (强度 ${sw.level.toFixed(2)}，增益 ${sw.gain.toFixed(4)} ≤ 0.05)`);
  await page.waitForFunction(() => window.__ANIME_DRAWLINE__.scenes.current.panel, null, { timeout: 15000 });
  await sleep(1600);
  st = await scene(page);
  check(st.fsm === 'won' && st.result.win && st.result.stars === 3, `坚持到最后 -> 胜利，${st.result && st.result.stars} 星`);
  const ev = await G(page, () => window.__ev);
  check(ev.ticks.join(',') === '3,2,1', `最后 3 秒滴答 (${ev.ticks.join(',')})`);
  check(ev.voice.includes('stars3'), `三星语音 + 字幕 (${ev.voice.join(' -> ')})`);
  check(ev.voice.filter((g) => g === 'scared').length <= 1, `「害怕」台词每次挑战最多一次 (${ev.voice.filter((g) => g === 'scared').length})`);
  const bgm1 = await G(page, () => window.__ANIME_DRAWLINE__.bgm.state());
  check(bgm1.playing && bgm1.time > bgm0.time + 3, `重开关卡 / 结算时 BGM 连续播放不中断 (${bgm0.time.toFixed(1)}s -> ${bgm1.time.toFixed(1)}s)`);
  const winShot = await shot(page, 'win');
  check(true, `胜利截图: ${winShot}`);
  const save = await G(page, () => JSON.parse(localStorage.getItem('animeDrawLine.save.v2')));
  check(save && save.levels[1] && save.levels[1].stars === 3, `星级写入 localStorage (${JSON.stringify(save.levels)})`);

  // 下一关 -> 第 2 关已解锁；暂停停表
  await tap(page, 270, 612);
  await waitScene(page, 'game');
  st = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.level.id);
  check(st === 2, `「下一关」进入第 2 关 (${st})`);
  await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; s.debugDraw(s.level.solution); });
  await sleep(700);
  await tap(page, 506, 44);
  const t1 = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.world.time);
  await sleep(800);
  const p1 = await G(page, () => ({ t: window.__ANIME_DRAWLINE__.scenes.current.world.time, fsm: window.__ANIME_DRAWLINE__.scenes.current.fsm.name }));
  check(p1.fsm === 'paused' && Math.abs(p1.t - t1) < 1e-6, `暂停时倒计时停止 (${t1.toFixed(2)}s)`);
  await tap(page, 384, 650);   // 暂停面板「音量」
  await sleep(250);
  check(await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.pausePanel.showSettings), '暂停面板可打开音量设置');
  await tap(page, 270 + 92, 255 + 392);
  await sleep(200);
  await tap(page, 270, 420); // 继续
  await sleep(300);
  check(await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.fsm.name) === 'survive', '继续游戏');

  // 失败流程：第 1 关画一条没用的短线
  await G(page, () => window.__ANIME_DRAWLINE__.scenes.change('game', { level: 1, seed: 7 }));
  await waitScene(page, 'game');
  await dragPath(page, [{ x: 30, y: 200 }, { x: 90, y: 200 }]);
  await page.waitForFunction(() => window.__ANIME_DRAWLINE__.scenes.current.world.state === 'lost', null, { timeout: 12000 });
  const lost = await G(page, () => ({ expr: window.__ANIME_DRAWLINE__.scenes.current.world.heroine.expression, by: window.__ANIME_DRAWLINE__.scenes.current.world.result.by }));
  check(lost.expr === 'lose', `被${lost.by}碰到 -> 失败，哭泣表情`);
  await page.waitForFunction(() => window.__ANIME_DRAWLINE__.scenes.current.panel, null, { timeout: 5000 });
  await sleep(800);
  const loseShot = await shot(page, 'lose');
  const lv = await G(page, () => window.__ANIME_DRAWLINE__.voice.history.slice(-1)[0]);
  check(lv === 'lose', `失败语音「lose」，截图: ${loseShot}`);

  // 失败面板的「提示」：桩广告 -> 重开本关并显示虚线
  await tap(page, 200, 690);
  await waitScene(page, 'game');
  await sleep(300);
  const h = await G(page, () => ({ vis: window.__ANIME_DRAWLINE__.scenes.current.hints.visible, ads: window.__ANIME_DRAWLINE__.ads.shown, saved: JSON.parse(localStorage.getItem('animeDrawLine.save.v2')).hints }));
  check(h.vis && h.ads === 1 && h.saved[1], `提示：激励广告(桩) -> 解锁并显示参考线 (${JSON.stringify(h)})`);
  // HUD 提示按钮：已解锁的提示可直接开关
  await tap(page, 450, 44);
  await sleep(200);
  check(await G(page, () => !window.__ANIME_DRAWLINE__.scenes.current.hints.visible) && await G(page, () => window.__ANIME_DRAWLINE__.ads.shown) === 1, 'HUD 提示按钮可切换显示 (已解锁不再看广告)');

  // BGM 无缝循环：跳到结尾前 0.6 秒，确认绕回开头继续播放
  await G(page, () => { const el = window.__ANIME_DRAWLINE__.bgm.el; el.currentTime = el.duration - 0.6; });
  await sleep(1500);
  const bl = await G(page, () => window.__ANIME_DRAWLINE__.bgm.state());
  check(bl.playing && bl.time < 1.5, `BGM 播放到结尾后自动循环 (t=${bl.time.toFixed(2)}s)`);
  // 重试同一关：开场白不再每次都说 (random 固定为 0.99 > startChance)
  const vh = await G(page, async () => {
    const g = window.__ANIME_DRAWLINE__;
    g.voice.random = () => 0.99;
    const before = g.voice.history.filter((x) => x === 'start').length;
    g.scenes.change('game', { level: 2 });
    await new Promise((r) => setTimeout(r, 1500));
    const after = g.voice.history.filter((x) => x === 'start').length;
    g.voice.random = Math.random;
    return { before, after };
  });
  check(vh.after === vh.before, `重试已玩过的关卡时开场白按概率省略 (start 次数 ${vh.before} -> ${vh.after})`);

  await testChapters(page);
  await testRobust(page);
  check(errors.length === 0, `控制台无错误${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await page.close();
}

/** 1.2 审计：暂停 / 失焦 / 多指 / 缩放 / 指针出界 / 连点 / 内存泄漏 / 提示星级封顶 / 广告暂停音乐 */
async function testRobust(page) {
  console.log('\n[1b] 健壮性 (1.2 审计)');
  const enter = async (id, seed = 3) => { await G(page, ([l, s]) => window.__ANIME_DRAWLINE__.scenes.change('game', { level: l, seed: s }), [id, seed]); await waitScene(page, 'game'); await sleep(150); };
  const drawState = () => G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; const d = s.world.drawing; return { state: s.world.state, fsm: s.fsm.name, drawing: d.drawing, armed: d.armed, n: d.points.length, ink: d.inkUsed, line: !!s.world.line, pts: (s.world.line ? s.world.line.worldPoints() : d.points).map((p) => [p.x, p.y]) }; });
  const down = async (x, y) => { const p = await toPage(page, x, y); await page.mouse.move(p.x, p.y); await page.mouse.down(); };
  const moveTo = async (x, y, steps = 4) => { const p = await toPage(page, x, y); await page.mouse.move(p.x, p.y, { steps }); };

  // 画到一半按 Esc 暂停 -> 这一笔作废；继续后可以重新画
  await enter(2);
  await down(60, 300); await moveTo(160, 300); await moveTo(220, 320);
  await page.keyboard.press('Escape');
  await sleep(100);
  await moveTo(260, 330); await page.mouse.up();
  let st = await drawState();
  check(st.fsm === 'paused' && !st.line && st.n === 0 && st.ink === 0, `画到一半暂停：这一笔作废，不会提交成线 (${st.fsm}, 点 ${st.n})`);
  await page.keyboard.press('Escape');
  await sleep(150);
  await dragPath(page, [{ x: 60, y: 300 }, { x: 200, y: 300 }]);
  st = await drawState();
  check(st.fsm === 'survive' && st.line, `继续后可以正常画一笔 (${st.fsm})`);

  // 窗口失焦 (Alt+Tab) -> 这一笔作废，之后的点击仍然有效
  await enter(2);
  await down(60, 300); await moveTo(200, 300);
  await G(page, () => window.dispatchEvent(new Event('blur')));
  await sleep(50);
  st = await drawState();
  await page.mouse.up();
  check(!st.line && st.n === 0 && st.state === 'draw', `画线时窗口失焦：这一笔取消 (点 ${st.n})`);
  await dragPath(page, [{ x: 60, y: 300 }, { x: 200, y: 300 }]);
  st = await drawState();
  check(st.line, '失焦后指针不会卡住，可以继续画');

  // 在主角身上按下 -> 拖出来才开始画 (待落笔)
  await enter(2);
  const hz = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.world.heroine.zone(0));
  await down(hz.x + hz.w / 2, hz.y + hz.h / 2);
  st = await drawState();
  const armed = st.armed && st.n === 0;
  await moveTo(hz.x + hz.w + 60, hz.y + hz.h / 2, 8); await moveTo(hz.x + hz.w + 180, hz.y + hz.h / 2, 8);
  await page.mouse.up();
  st = await drawState();
  check(armed && st.line && Math.min(...st.pts.map((p) => p[0])) > hz.x + hz.w, `在主角身上按下：拖出主角范围后才开始画线 (线左端 x=${Math.round(Math.min(...st.pts.map((p) => p[0])))})`);

  // 多指：第二根手指被忽略
  await enter(2);
  const mt = await G(page, () => {
    const c = document.getElementById('game'); const r = c.getBoundingClientRect();
    const ev = (type, id, x, y, tgt = c) => tgt.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.left + (x / 540) * r.width, clientY: r.top + (y / 960) * r.height, bubbles: true, pointerType: 'touch', isPrimary: id === 11 }));
    ev('pointerdown', 11, 60, 300);
    for (let x = 66; x <= 240; x += 6) ev('pointermove', 11, x, 300);
    ev('pointerdown', 12, 300, 500);
    for (let y = 500; y <= 600; y += 6) ev('pointermove', 12, 300, y);
    ev('pointerup', 12, 300, 600, window);
    const mid = window.__ANIME_DRAWLINE__.scenes.current.world.state;
    for (let x = 246; x <= 300; x += 6) ev('pointermove', 11, x, 300);
    ev('pointerup', 11, 300, 300, window);
    const w = window.__ANIME_DRAWLINE__.scenes.current.world;
    return { mid, state: w.state, maxY: Math.max(...w.line.worldPoints().map((p) => p.y)), len: w.inkUsed };
  });
  check(mt.mid === 'draw' && mt.state === 'survive' && mt.maxY < 330, `多指：第二根手指抬起不会结束 / 污染第一笔 (线最低 y=${Math.round(mt.maxY)}, 长 ${Math.round(mt.len)})`);

  // 画线时手指滑出画布再回来；松手在画布外
  await enter(2);
  await down(100, 300); await moveTo(300, 300);
  const out = await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.right + 30, y: r.top + 300 }; });
  await page.mouse.move(out.x, out.y, { steps: 3 });
  await moveTo(400, 340);
  await page.mouse.move(out.x, out.y + 40, { steps: 3 });
  await page.mouse.up();
  st = await drawState();
  check(st.line && st.pts.every((p) => p[0] >= 0 && p[0] <= 540), `指针滑出画布再回来 / 在画布外松手：线正常提交且不越界 (${st.pts.length} 点)`);

  // 画线中途窗口缩放 (横竖屏 / DPR 改变)：坐标仍正确，线不跳
  await enter(2);
  await down(60, 300); await moveTo(200, 300);
  await page.setViewportSize({ width: 420, height: 800 });
  await sleep(200);
  await moveTo(320, 300, 6);
  await page.mouse.up();
  st = await drawState();
  st.pts = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.world.drawing.points.map((p) => [p.x, p.y])); // 原始采样点 (提交后的线经过简化)
  let maxSeg = 0; for (let i = 1; i < st.pts.length; i++) maxSeg = Math.max(maxSeg, Math.hypot(st.pts[i][0] - st.pts[i - 1][0], st.pts[i][1] - st.pts[i - 1][1]));
  const xs = st.pts.map((p) => p[0]);
  check(st.line && Math.abs(Math.max(...xs) - 320) < 12 && maxSeg < 120 && st.pts.flat().every(Number.isFinite), `画线中途窗口缩放：坐标按新尺寸换算，线连续 (缩放瞬间手指相对画布移动，最大段 ${Math.round(maxSeg)}px)，终点 x=${Math.round(Math.max(...xs))} ≈ 320`);
  await page.setViewportSize({ width: 540, height: 960 });
  await sleep(200);

  // 提示：看过提示后最多 2 星，并告知玩家
  await G(page, () => window.__ANIME_DRAWLINE__.save.unlockHint(1));
  await G(page, () => window.__ANIME_DRAWLINE__.scenes.change('game', { level: 1, seed: 1, showHint: true }));
  await waitScene(page, 'game');
  await G(page, () => { window.__ANIME_DRAWLINE__.timeScale = 4; const s = window.__ANIME_DRAWLINE__.scenes.current; s.debugDraw(s.level.solution); });
  await page.waitForFunction(() => window.__ANIME_DRAWLINE__.scenes.current.panel, null, { timeout: 20000 });
  await sleep(600);
  const hr = await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; window.__ANIME_DRAWLINE__.timeScale = 1; return s.result; });
  const hintShot = await shot(page, 'hint-capped');
  check(hr.win && hr.stars === 2 && hr.hintCapped && hr.hintUsed, `看过提示：参考解法也最多 2 星，结算面板说明原因 (${hr.stars} 星)，截图: ${hintShot}`);

  // 结算面板狂按 Enter / 下一关：只前进一关
  for (let i = 0; i < 8; i++) await page.keyboard.press('Enter');
  await waitScene(page, 'game');
  await sleep(300);
  check(await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.level.id) === 2, '结算面板连按「下一关」8 次：只进入第 2 关');
  for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyR'); await sleep(i % 3 ? 20 : 120); }
  await waitScene(page, 'game');
  await sleep(300);
  st = await scene(page);
  check(st.fsm === 'draw' && st.state === 'draw', `狂按重开 10 次：状态正常 (${st.fsm})`);

  // 广告期间 BGM 暂停、语音停止
  const ad = await G(page, async () => {
    const g = window.__ANIME_DRAWLINE__;
    g.events.emit('ad:show');
    await new Promise((r) => setTimeout(r, 200));
    const during = { bgm: g.bgm.state().playing, voice: g.voice.isPlaying() };
    g.events.emit('ad:close');
    await new Promise((r) => setTimeout(r, 400));
    return { during, after: g.bgm.state().playing };
  });
  check(!ad.during.bgm && !ad.during.voice && ad.after, `激励广告播放时 BGM 暂停、语音停止，关闭后恢复 (${JSON.stringify(ad)})`);

  // 内存 / 监听泄漏：反复切换 20 次关卡 (中途回菜单 / 选关)，事件监听数与刚体数不增长
  const snap = () => G(page, () => {
    const g = window.__ANIME_DRAWLINE__; const s = g.scenes.current;
    let n = 0; for (const set of g.events.listeners.values()) n += set.size;
    return { listeners: n, bodies: s.world ? s.world.physics.engine.world.bodies.length : -1, hazards: s.world ? s.world.hazards.list.length : -1 };
  });
  await enter(12, 5);
  const s0 = await snap();
  for (let i = 0; i < 20; i++) {
    const id = [3, 17, 25, 33, 40, 12][i % 6];
    if (i % 7 === 3) { await G(page, () => window.__ANIME_DRAWLINE__.scenes.change('menu')); await waitScene(page, 'menu'); }
    else if (i % 7 === 5) { await G(page, () => window.__ANIME_DRAWLINE__.scenes.change('levels')); await waitScene(page, 'levels'); }
    await enter(id, 5);
    if (i % 2) await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; s.debugDraw(s.level.solution); });
    await sleep(i % 2 ? 400 : 60);
  }
  await G(page, () => window.__ANIME_DRAWLINE__.scenes.change('menu'));
  await waitScene(page, 'menu');
  const vm = await G(page, () => ({ voice: window.__ANIME_DRAWLINE__.voice.isPlaying(), swarm: window.__ANIME_DRAWLINE__.audio.swarmLevel || 0 }));
  check(!vm.voice && vm.swarm === 0, `关卡中途回菜单：语音停止、蜂群声静音 (${JSON.stringify(vm)})`);
  await enter(12, 5);
  const s1 = await snap();
  check(s1.listeners === s0.listeners && s1.bodies === s0.bodies && s1.hazards === s0.hazards, `切换 20 次关卡后无泄漏 (监听 ${s0.listeners}→${s1.listeners}，刚体 ${s0.bodies}→${s1.bodies})`);
}

const chapterNow = (page) => G(page, () => window.__ANIME_DRAWLINE__.scenes.current.chapter);
/** 用参考解法玩一关：返回 { won, stars } ；midShot 给出时在倒计时中途截图 */
async function playSolution(page, midShot, midDelay = 3200) {
  await sleep(300);
  const d = await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; return s.debugDraw(s.level.solution).ok; });
  let shotPath = null;
  if (midShot) { await sleep(midDelay); shotPath = await shot(page, midShot); }
  await page.waitForFunction(() => window.__ANIME_DRAWLINE__.scenes.current.panel, null, { timeout: 20000 });
  const st = await scene(page);
  return { drew: d, won: st.fsm === 'won', stars: st.result && st.result.stars, shotPath };
}

async function testChapters(page) {
  // ---- 旧存档迁移：20 关版本 (v1) -> v2 ----
  await G(page, () => {
    localStorage.clear();
    const levels = {};
    for (let i = 1; i <= 22; i++) levels[i] = { stars: i % 3 + 1, bestInk: 400 + i, clears: 1 };
    levels[57] = { stars: 3 }; // 越界的脏数据应被丢弃
    localStorage.setItem('animeDrawLine.save.v1', JSON.stringify({ levels, hints: { 2: true }, plays: 30, muted: false, voiceOn: true, lastLevel: 22, sfxVolume: 0.5, voiceVolume: 0.9 }));
  });
  await page.reload();
  await waitScene(page, 'menu');
  const mig = await G(page, () => ({ v2: JSON.parse(localStorage.getItem('animeDrawLine.save.v2')), v1: !!localStorage.getItem('animeDrawLine.save.v1'), from: window.__ANIME_DRAWLINE__.save.migratedFrom }));
  check(mig.v2 && mig.v2.version === 4 && mig.v2.levels[2].stars === 3 && mig.v2.levels[3].stars === 1 && mig.v2.levels[22] && !mig.v2.levels[57] && mig.v2.hints[2] && mig.from === 'animeDrawLine.save.v1' && mig.v1,
    `旧版 v1 存档自动迁移到 v4 (保留 ${Object.keys(mig.v2 ? mig.v2.levels : {}).length} 关进度与提示，旧键保留)`);
  check([4, 9, 10, 15, 20, 22].every((i) => mig.v2.levels[i].stars === 0 && mig.v2.levels[i].bestInk === null && mig.v2.levels[i].clears >= 1 && mig.v2.levels[i].redesigned),
    '重新设计的第 4~40 关：旧星级清零、通关记录保留 (后续关卡不会重新上锁)');
  const sv = await G(page, () => ({ v2: JSON.parse(localStorage.getItem('animeDrawLine.save.v2')), sfx: window.__ANIME_DRAWLINE__.audio.volume, voice: window.__ANIME_DRAWLINE__.voice.volume }));
  check(sv.v2.settingsVersion === 3 && !('sfxVolume' in sv.v2) && !('voiceVolume' in sv.v2) && Math.abs(sv.sfx - 0.12) < 1e-9 && Math.abs(sv.voice - 0.3) < 1e-9,
    `旧存档里的大音量被丢弃，改用新默认值 (音效 ${sv.sfx}，语音 ${sv.voice}，settingsVersion ${sv.v2.settingsVersion})`);
  // 菜单：制作人员面板 + 音乐开关
  await tap(page, 270, 930);
  await sleep(400);
  check(await G(page, () => !!window.__ANIME_DRAWLINE__.scenes.current.credits), '菜单「制作人员」面板打开 (AivisSpeech: リダ 署名)');
  await shot(page, 'credits');
  await tap(page, 270, 742);
  await sleep(200);
  check(await G(page, () => !window.__ANIME_DRAWLINE__.scenes.current.credits), '关闭制作人员面板');
  await tap(page, 350, 46);
  await sleep(300);
  const m1 = await G(page, () => window.__ANIME_DRAWLINE__.bgm.state());
  await tap(page, 350, 46);
  await sleep(300);
  const m2 = await G(page, () => window.__ANIME_DRAWLINE__.bgm.state());
  check(!m1.enabled && !m1.playing && m2.enabled && m2.playing, '菜单音乐开关：关闭后暂停、再打开继续播放');
  // 音量设置：菜单左上角 -> 拖动「总音量」滑块到 50% -> 各声道实际音量减半并保存
  await tap(page, 40, 46);
  await sleep(300);
  check(await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.showSettings), '菜单「音量设置」面板打开');
  await shot(page, 'settings');
  const ms = await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current.settings.slider('master'); return { x: s.x, y: s.y, w: s.w }; });
  await dragPath(page, [{ x: ms.x + ms.w, y: ms.y }, { x: ms.x + ms.w * 0.5, y: ms.y }]);
  await sleep(200);
  const mv = await G(page, () => { const g = window.__ANIME_DRAWLINE__; return { master: g.mixer.get('master'), sfx: g.audio.volume, voice: g.voice.volume, bgm: g.bgm.volume, saved: JSON.parse(localStorage.getItem('animeDrawLine.save.v2')).volumes }; });
  check(Math.abs(mv.master - 0.5) < 0.051 && Math.abs(mv.bgm - 0.15 * mv.master) < 1e-6 && Math.abs(mv.voice - 0.3 * mv.master) < 1e-6 && mv.saved && mv.saved.master === mv.master,
    `总音量滑块 ${Math.round(mv.master * 100)}% -> 语音 ${mv.voice.toFixed(3)} / 音效 ${mv.sfx.toFixed(3)} / 音乐 ${mv.bgm.toFixed(3)}，已保存`);
  await G(page, () => window.__ANIME_DRAWLINE__.mixer.reset());
  await tap(page, 270 + 92, 250 + 392);   // 完成
  await sleep(200);
  check(await G(page, () => !window.__ANIME_DRAWLINE__.scenes.current.showSettings), '关闭音量设置面板');
  await tap(page, 270, 812);
  await waitScene(page, 'levels');
  check(await chapterNow(page) === 2, '选关默认打开上次所玩关卡所在的第 3 章');
  // ---- 章节页签 / 箭头 / 滑动 / 键盘 ----
  await tap(page, 270 - 1.5 * 126, 146);
  await sleep(250);
  check(await chapterNow(page) === 0, '点击页签切到第 1 章');
  await tap(page, 470, 676);
  await sleep(250);
  check(await chapterNow(page) === 1, '右箭头翻到第 2 章');
  await dragPath(page, [{ x: 430, y: 500 }, { x: 300, y: 505 }, { x: 140, y: 510 }]);
  await sleep(250);
  check(await chapterNow(page) === 2, '向左滑动翻到第 3 章');
  await page.keyboard.press('ArrowRight');
  await sleep(250);
  check(await chapterNow(page) === 3, '键盘 → 翻到第 4 章');
  await tap(page, 70, 452); // 第 31 关 (锁定)
  await sleep(400);
  check(await G(page, () => window.__ANIME_DRAWLINE__.scenes.currentName) === 'levels', '第 4 章未解锁时第 31 关无法进入');
  await tap(page, 470, 676);
  await sleep(250);
  check(await chapterNow(page) === 3, '最后一章右箭头不再翻页');
  await tap(page, 70, 676);
  await sleep(900);
  check(await chapterNow(page) === 2, '左箭头回到第 3 章');
  await tap(page, 70, 676);
  await sleep(900);
  const newShot = await shot(page, 'levelselect-new');
  check(await chapterNow(page) === 1 && await G(page, () => window.__ANIME_DRAWLINE__.save.isRedesigned(12) && window.__ANIME_DRAWLINE__.save.isRedesigned(5) && !window.__ANIME_DRAWLINE__.save.isRedesigned(2)), `第 2 章：重新设计的关卡显示「新」角标，截图: ${newShot}`);
  await tap(page, 470, 676);
  await sleep(900);
  const lsShot = await shot(page, 'levelselect');
  check(true, `选关截图: ${lsShot}`);

  // ---- 第 3 章：第 23 关 (跷跷板) ----
  await tap(page, 270, 452);
  await waitScene(page, 'game');
  let id = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.level.id);
  check(id === 23, `从第 3 章页面进入第 23 关 (${id})`);
  const r3 = await playSolution(page, 'ch3', 3600);
  check(r3.drew && r3.won, `第 23 关参考解法通关 (${r3.stars} 星)，截图: ${r3.shotPath}`);
  await sleep(1400);
  await tap(page, 340, 690); // 结算面板「选关」
  await waitScene(page, 'levels');
  check(await chapterNow(page) === 2, '结算面板「选关」回到本关所在的第 3 章');

  // ---- 第 4 章：解锁到 40 关，打开最终关 ----
  await G(page, () => {
    const s = window.__ANIME_DRAWLINE__.save;
    for (let i = 1; i <= 39; i++) if (!s.isCleared(i)) s.submit(i, 1, 500);
    s.set('lastLevel', 38);
    window.__ANIME_DRAWLINE__.scenes.change('levels');
  });
  await waitScene(page, 'levels');
  check(await chapterNow(page) === 3, '解锁后选关打开第 4 章');
  await tap(page, 470, 584); // 第 40 关
  await waitScene(page, 'game');
  id = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.level.id);
  const mech = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.world.mechanisms.list.length);
  check(id === 40 && mech >= 3, `从第 4 章页面进入第 40 关 (${id}，机关 ${mech} 个)`);
  await G(page, () => { window.__warps = 0; window.__ANIME_DRAWLINE__.events.on('portal:warp', () => window.__warps++); });
  const r4 = await playSolution(page, 'ch4', 4200);
  const warps = await G(page, () => window.__warps);
  check(r4.drew && r4.won, `第 40 关参考解法通关 (${r4.stars} 星，传送 ${warps} 次)，截图: ${r4.shotPath}`);
  const fin = await G(page, () => window.__ANIME_DRAWLINE__.scenes.current.panel && window.__ANIME_DRAWLINE__.scenes.current.level.id);
  check(fin === 40, '最终关结算面板显示');
}

async function testDev(browser) {
  console.log('\n[2] 开发版 index.html (ES Module 源码, 本地服务器)');
  const port = 8798;
  const server = spawn(process.execPath, [path.join(root, 'tools/serve.js'), String(port)], { stdio: 'ignore' });
  await sleep(600);
  try {
    const { page, errors } = await openPage(browser, `http://localhost:${port}/index.html`);
    await waitScene(page, 'menu');
    await tap(page, 270, 812);
    await waitScene(page, 'levels');
    await tap(page, 70, 452);
    await waitScene(page, 'game');
    const r = await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; const d = s.debugDraw(s.level.solution); return { ok: d.ok, v: window.__ANIME_DRAWLINE__.voice.loadedCount }; });
    await sleep(1500);
    const st = await scene(page);
    check(r.ok && st.state === 'survive' && r.v === 15, `源码版可进入第 1 关并画线 (状态 ${st.state}, 语音 ${r.v})`);
    const db = await G(page, () => ({ bgm: window.__ANIME_DRAWLINE__.bgm.state(), voice: window.__ANIME_DRAWLINE__.voice.lastPlay }));
    check(db.bgm.playing && !db.bgm.error && db.voice && db.voice.result === 'audio', `源码版 BGM 播放中 (${db.bgm.src})，开场语音 mp3 播放`);
    // 源码版：章节翻页 + 第 3 / 4 章关卡
    await G(page, () => window.__ANIME_DRAWLINE__.scenes.change('levels', { chapter: 0 }));
    await waitScene(page, 'levels');
    await page.keyboard.press('ArrowRight');
    await tap(page, 270 + 0.5 * 126, 146);
    await sleep(300);
    check(await chapterNow(page) === 2, '源码版章节页签切换');
    for (const lid of [28, 36]) {
      await G(page, (l) => window.__ANIME_DRAWLINE__.scenes.change('game', { level: l }), lid);
      await waitScene(page, 'game');
      const d = await G(page, () => { const s = window.__ANIME_DRAWLINE__.scenes.current; return s.debugDraw(s.level.solution).ok; });
      await sleep(2500);
      const s2 = await scene(page);
      check(d && s2.state === 'survive', `源码版第 ${lid} 关可画线并运行机关 (状态 ${s2.state})`);
    }
    check(errors.length === 0, `控制台无错误${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await page.close();
  } finally {
    server.kill();
  }
}

const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
try {
  await testDist(browser);
  await testDev(browser);
} catch (err) {
  failures++;
  console.error('测试异常:', err);
} finally {
  await browser.close();
}
console.log(failures ? `\n失败 ${failures} 项` : '\n全部通过 ✔');
process.exit(failures ? 1 : 0);
