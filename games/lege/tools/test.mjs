// 自动化测试 (Playwright + Chromium 无头浏览器)
// 用法: npm run build && node tools/test.mjs
// 覆盖:
//  [1] dist/index.html 以 file:// 打开：无控制台报错、图片/语音全部加载
//  [2] 音频：首次点击后解锁、主菜单 BGM、按钮悬停音效
//  [3] 设置面板：BGM/音效/语音 开关与音量滑条即时生效，并在刷新后保留
//  [4] 选关地图：未解锁关卡点不进去；第 1 关 → 关卡信息 → 开始挑战 (游戏 BGM)
//  [5] 第 1 关：真实鼠标点击一路玩到通关 → ★★★ → 解锁第 2 关 → 选关地图播放解锁动画/音效
//  [6] 多个关卡的图案：张数为 3 的倍数、参考解可清空、卡牌都在牌桌区域内、BOSS 关切换地狱 BGM
//  [7] 被压住的卡点击无效
//  [8] 道具：撤回 / 移出 / 洗牌 (各有独立音效，次数用完)
//  [9] 卡槽 5/6 张 → 心跳音效 (紧张度 1/2)；字幕条位于 HUD 与牌桌之间，不遮挡卡牌
// [10] 卡槽填满 → 失败 → 看占位广告复活 → 再次填满 → 结算 (失败)
// [11] 每日挑战同一天布局一致；地狱关按参考解通关 → 大庆祝
// [12] 开发版 index.html (ES Module 源码，经本地服务器) 可运行
import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { LEVELS } from '../src/config/LevelConfig.js';
import { GameConfig } from '../src/config/GameConfig.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
let passes = 0;
function check(cond, msg) {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (cond) passes++; else failures++;
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
const dbg = (page, name, arg) => page.evaluate(([n, a]) => window.__ANIME_STACK__.debug[n](a), [name, arg]);
async function waitScene(page, name, timeout = 12000) {
  await page.waitForFunction((n) => {
    const g = window.__ANIME_STACK__;
    return g && g.scenes.currentName === n && !g.scenes.transitioning;
  }, name, { timeout });
}
async function toCss(page, x, y) {
  return page.evaluate(([lx, ly]) => {
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.left + (lx / 540) * r.width, y: r.top + (ly / 960) * r.height };
  }, [x, y]);
}
async function tap(page, x, y) {
  const p = await toCss(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
}
async function hover(page, x, y) {
  const p = await toCss(page, x, y);
  await page.mouse.move(p.x, p.y, { steps: 3 });
}
async function findButton(page, labelPart) {
  const btns = await dbg(page, 'buttons');
  const b = btns.find((x) => String(x.label).includes(labelPart) || x.key === labelPart);
  if (!b) throw new Error(`找不到按钮「${labelPart}」，当前: ${btns.map((x) => x.label).join(' / ')}`);
  return b;
}
async function tapButton(page, labelPart) {
  const b = await findButton(page, labelPart);
  await tap(page, b.x, b.y);
  return b;
}
const state = (page) => dbg(page, 'state');
const audio = (page) => dbg(page, 'audioState');
async function waitIdle(page, ms = 4000) {
  await page.waitForFunction(() => !window.__ANIME_STACK__.debug.state().busy, null, { timeout: ms }).catch(() => {});
}
async function startLevel(page, level, seed = 12345) {
  await G(page, ([l, s]) => window.__ANIME_STACK__.scenes.change('game', { level: l, seed: s }), [level, seed]);
  await waitScene(page, 'game');
  await sleep(300);
}
async function fillSlot(page, n) {
  for (let i = 0; i < 20; i++) {
    const st = await state(page);
    if (st.slotCount >= n || st.fsm !== 'playing') break;
    const c = await dbg(page, 'nonMatchingFree');
    if (!c) break;
    await dbg(page, 'tryPick', c.id);
    await sleep(60);
    await waitIdle(page, 1500);
  }
  return state(page);
}

async function testDist(browser) {
  const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
  let { page, errors } = await openPage(browser, url);

  console.log('\n[1] dist/index.html (file://, 双击方式)');
  await waitScene(page, 'menu');
  await sleep(300);
  const load = await G(page, () => {
    const g = window.__ANIME_STACK__;
    return {
      imgs: [...g.assets.images.values()].filter((i) => i instanceof HTMLImageElement && i.naturalWidth > 0).length,
      sprites: g.cardSprites.length,
      voices: g.voice.loadedCount,
      voiceTotal: g.voice.clips.size,
    };
  });
  check(load.imgs >= 15, `图片加载 ${load.imgs} 张 (14 卡牌 + 背景)`);
  check(load.sprites === 14, `生成 14 种卡牌贴图 (含暗色版)`);
  check(load.voices === load.voiceTotal && load.voiceTotal === 25, `AivisSpeech 语音加载 ${load.voices}/${load.voiceTotal}`);

  console.log('\n[2] 音频解锁 / BGM / 悬停音效 / 默认音量');
  let a = await audio(page);
  check(a.ctx === null, '首次交互前不创建 AudioContext (遵守自动播放策略；BGM 若被浏览器拦截会在首次点击时重试)');
  check(Math.abs(a.voiceGain - 0.3) < 1e-6 && Math.abs(a.sfxTarget - 0.12) < 1e-6 && Math.abs(a.bgmGain - 0.15) < 1e-6,
    `默认音量 语音 ${a.voiceGain} / 音效 ${a.sfxTarget} / BGM ${a.bgmGain}`);
  await tap(page, 270, 960 - 40); // 点空白处
  await sleep(1500);
  a = await audio(page);
  check(a.ctx === 'running', `点击后音频解锁 (state=${a.ctx})`);
  check(a.music === 'menu' && a.bgm.src === 'bgm_menu.ogg' && a.bgm.time > 0 && !a.bgm.error,
    `主菜单播放作曲 BGM 文件：${a.bgm.src} t=${a.bgm.time.toFixed(2)}s 音量 ${a.bgm.volume.toFixed(3)}`);
  await G(page, () => { const el = window.__ANIME_STACK__.music.els.menu.el; el.currentTime = el.duration - 0.3; });
  await sleep(900);
  a = await audio(page);
  check(a.bgm.playing && a.bgm.time > 0.1 && a.bgm.time < 1.5, `BGM 结尾无缝循环回开头 (t=${a.bgm.time.toFixed(2)}s)`);
  const helpBtn = await findButton(page, '玩法说明');
  await hover(page, helpBtn.x, helpBtn.y);
  await sleep(200);
  a = await audio(page);
  check(a.log.includes('hover'), '按钮悬停播放 hover 音效');
  // 语音播放时 BGM 平滑压低到 ×0.55，结束后恢复
  await G(page, () => window.__ANIME_STACK__.voice.request('win'));
  await sleep(120);
  const dk1 = (await audio(page)).bgm.duck;
  await sleep(700);
  a = await audio(page);
  const dk2 = a.bgm.duck;
  check(a.voice.last && a.voice.last.result === 'audio' && dk1 > dk2 && Math.abs(dk2 - 0.55) < 0.08,
    `台词 ${a.voice.last && a.voice.last.id} 播放中 BGM 平滑压低 (${dk1.toFixed(2)} → ${dk2.toFixed(2)})`);
  await page.waitForFunction(() => !window.__ANIME_STACK__.voice.isPlaying(), null, { timeout: 8000 });
  await sleep(2000);
  a = await audio(page);
  check(a.bgm.duck > 0.9, `台词结束后 BGM 恢复 (duck=${a.bgm.duck.toFixed(2)})`);

  console.log('\n[3] 设置面板 / 制作人员');
  await tapButton(page, '设置');
  await sleep(400);
  await tapButton(page, '开关:背景音乐');
  await sleep(1200);
  a = await audio(page);
  check(a.bgmOn === false && a.bgmGain === 0 && !a.bgm.playing, `关闭背景音乐 → BGM 暂停 (增益 ${a.bgmGain})`);
  check(a.log.includes('toggle'), '开关有拨动音效');
  await tapButton(page, '开关:背景音乐');
  await sleep(600);
  a = await audio(page);
  check(a.bgmOn === true && a.bgm.playing, `重新打开背景音乐 → 继续播放`);
  const sl = await findButton(page, '音量:音效');
  await tap(page, sl.x + sl.w * 0.25, sl.y);
  await sleep(300);
  a = await audio(page);
  check(Math.abs(a.sfxVol - 0.5) < 0.06 && Math.abs(a.sfxGain - 0.12 * a.sfxVol) < 0.01, `拖动音效滑条 → ${Math.round(a.sfxVol * 100)}% (实际增益 ${a.sfxGain.toFixed(3)})`);
  const ms = await findButton(page, '音量:总音量');
  await tap(page, ms.x + ms.w * 0.5, ms.y);
  await sleep(300);
  a = await audio(page);
  check(Math.abs(a.master - 0.5) < 0.06 && Math.abs(a.voiceGain - 0.15) < 0.02, `总音量 50% → 语音实际 ${a.voiceGain.toFixed(3)}`);
  await tapButton(page, '开关:角色语音');
  await sleep(200);
  a = await audio(page);
  check(a.voiceOn === false && a.voiceGain === 0, '关闭角色语音');
  await tapButton(page, '开关:音效');
  await sleep(200);
  a = await audio(page);
  check(a.sfxOn === false && a.sfxGain < 0.01, '关闭音效 → 音效总线静音');
  await tapButton(page, '制作人员');
  await sleep(400);
  const cr = await G(page, () => { const p = window.__ANIME_STACK__.scenes.current.settings; return !!(p && p.credits); });
  check(cr, '「制作人员」面板打开 (AivisSpeech 声线署名)');
  await page.screenshot({ path: path.join(os.tmpdir(), 'anime-stack-credits-test.png') });
  await tapButton(page, '关闭');
  await sleep(200);
  await tapButton(page, '完成');
  await sleep(300);
  // 刷新后设置仍在
  await page.reload();
  await waitScene(page, 'menu');
  a = await audio(page);
  check(a.sfxOn === false && a.voiceOn === false && Math.abs(a.sfxVol - 0.5) < 0.06 && Math.abs(a.master - 0.5) < 0.06, '刷新页面后设置保留 (localStorage)');
  // 恢复
  await G(page, () => { const m = window.__ANIME_STACK__.mixer; m.setOn('sfx', true); m.setOn('voice', true); m.reset(); });
  await tap(page, 270, 920);
  await sleep(300);

  console.log('\n[4] 选关地图');
  await tapButton(page, '选择关卡');
  await waitScene(page, 'levels');
  let nodes = await dbg(page, 'levelNodes');
  check(nodes.length === LEVELS.length && nodes.length >= 12, `地图共 ${nodes.length} 个关卡节点`);
  check(nodes.filter((n) => n.unlocked).length === 1, '初始只解锁第 1 关');
  const n2 = nodes.find((n) => n.id === 2);
  await tap(page, n2.x, n2.y);
  await sleep(300);
  const info2 = await G(page, () => !!window.__ANIME_STACK__.scenes.current.info);
  check(!info2, '点击未解锁的第 2 关不会打开');
  const n1 = nodes.find((n) => n.id === 1);
  await tap(page, n1.x, n1.y);
  await sleep(400);
  await tapButton(page, '开打');
  await waitScene(page, 'game');
  await sleep(300);
  a = await audio(page);
  check(a.music === 'game', `进入关卡后切换为游戏 BGM：${a.music}`);

  console.log('\n[5] 第 1 关：真实鼠标点击直到通关');
  let st = await state(page);
  check(st.level === 1 && st.total === 27, `第 1 关共 ${st.total} 张`);
  await sleep(1300); // 等发牌动画
  a = await audio(page);
  check(a.log.includes('deal'), '开局发牌音效 (按层落下)');
  let clicks = 0;
  for (let i = 0; i < 80; i++) {
    st = await state(page);
    if (st.scene !== 'game' || st.fsm !== 'playing' || st.remaining === 0) break;
    const h = await dbg(page, 'hint');
    if (!h) { await sleep(100); continue; }
    await tap(page, h.x, h.y);
    clicks++;
    await sleep(90);
  }
  a = await audio(page);
  check(a.log.includes('pick') && a.log.includes('land') && a.log.includes('clear'), '拿牌 / 落槽 / 三消 音效');
  const vh = await G(page, () => window.__ANIME_STACK__.voice.history.filter((id) => /^c\d/.test(id)));
  check(vh.length >= 1 && vh.length <= 5, `9 次消除只说了 ${vh.length} 句消除台词 (频率限制)：${vh.join(', ')}`);
  await waitScene(page, 'result', 15000);
  let res = await G(page, () => window.__ANIME_STACK__.scenes.current.data);
  check(res.win === true, `用 ${clicks} 次真实点击通关第 1 关`);
  check(res.stars === 3, `不用道具 → ★★★ (stars=${res.stars})`);
  await sleep(2200);
  a = await audio(page);
  check(a.log.includes('victory') && a.log.includes('star'), '胜利号角 + 星星音效');
  check(a.log.includes('unlock'), '解锁新关卡音效');
  let save = await dbg(page, 'save');
  check(save.unlocked === 2 && save.stars[1] === 3, '存档：解锁第 2 关、第 1 关 3 星');
  await tapButton(page, '选择关卡');
  await waitScene(page, 'levels');
  await sleep(1300); // 解锁动画 (小锁抖动 → 碎裂)
  nodes = await dbg(page, 'levelNodes');
  check(nodes.find((n) => n.id === 2).unlocked, '选关地图：第 2 关已解锁 (播放解锁动画)');

  console.log('\n[6] 各关卡图案');
  const sample = [2, 4, 5, 7, 10, 11, 14, 15];
  const b = GameConfig.board;
  for (const id of sample) {
    await startLevel(page, id, 777 + id);
    const stats = await dbg(page, 'generatedStats');
    const ref = await dbg(page, 'verifyReference');
    const def = LEVELS.find((l) => l.id === id);
    const geo = await G(page, () => {
      const s = window.__ANIME_STACK__.scenes.current;
      const bc = s.board.cards.filter((c) => c.zone === 'board');
      return { minY: Math.min(...bc.map((c) => c.y)), maxY: Math.max(...bc.map((c) => c.y)), minX: Math.min(...bc.map((c) => c.x)), maxX: Math.max(...bc.map((c) => c.x)) };
    });
    const inside = geo.minY >= b.top - 0.5 && geo.maxY + 62 <= b.top + b.rows * b.unit + 0.5 && geo.minX >= b.left - 0.5 && geo.maxX + 62 <= b.left + b.cols * b.unit + 0.5;
    const mult3 = stats.counts.every((c) => c % 3 === 0);
    a = await audio(page);
    const musicOk = a.music === (def.boss ? 'hell' : 'game');
    check(stats.pattern === def.pattern && mult3 && ref.ok && inside && musicOk,
      `第 ${id} 关「${def.title}」图案 ${stats.pattern}，${stats.total} 张 / ${stats.layers} 层 / ${stats.types} 种，3 的倍数 ${mult3}，参考解 ${ref.ok}，在牌桌内 ${inside}，BGM ${a.music}`);
  }

  console.log('\n[7] 被压住的卡不可点击 (第 5 关)');
  await startLevel(page, 5, 4242);
  await sleep(1500);
  const cov = await dbg(page, 'coveredCard');
  st = await state(page);
  if (cov) {
    await tap(page, cov.x, cov.y);
    await sleep(200);
    const after = await state(page);
    const c2 = await dbg(page, 'cardById', cov.id);
    a = await audio(page);
    check(after.slotCount === st.slotCount && c2.state === 'board', `点击被 ${cov.coveredBy} 张卡压住的卡：无反应`);
    check(a.log.includes('deny'), '被压住时播放 deny 音效');
  } else {
    check(false, '找不到被压住的卡');
  }

  console.log('\n[8] 道具');
  await fillSlot(page, 2);
  st = await state(page);
  const before = st.slotCount;
  await tapButton(page, 'undo');
  await sleep(500);
  st = await state(page);
  check(st.slotCount === before - 1 && st.props.undo === 0, `撤回：卡槽 ${before} → ${st.slotCount}`);
  await fillSlot(page, 3);
  await tapButton(page, 'moveOut');
  await sleep(600);
  st = await state(page);
  check(st.temp > 0 && st.props.moveOut === 0, `移出：暂存区 ${st.temp} 张`);
  const typesBefore = (await dbg(page, 'boardTypes')).sort().join(',');
  await tapButton(page, 'shuffle');
  await sleep(600);
  const typesAfter = (await dbg(page, 'boardTypes')).sort().join(',');
  st = await state(page);
  check(typesBefore === typesAfter && st.props.shuffle === 0, '洗牌：场上花色总量不变');
  a = await audio(page);
  check(['undo', 'moveOut', 'shuffle'].every((k) => a.log.includes(k)), '三个道具各有独立音效');
  await tapButton(page, 'undo');
  await sleep(300);
  st = await state(page);
  check(st.props.undo === 0, '道具用完后不能再用');

  console.log('\n[9] 心跳 / 字幕位置');
  st = await fillSlot(page, 5);
  await sleep(200);
  a = await audio(page);
  check(st.slotCount === 5 && a.tension === 1, `卡槽 5 张 → 紧张度 ${a.tension}`);
  st = await fillSlot(page, 6);
  await sleep(900);
  a = await audio(page);
  check(st.slotCount === 6 && a.tension === 2 && a.log.includes('heartbeat'), `卡槽 6 张 → 紧张度 ${a.tension}，心跳音效`);
  const sub = await G(page, () => window.__ANIME_STACK__.scenes.current.subtitles.y);
  check(sub + 26 < b.top && sub - 26 > 60, `字幕条中心 y=${sub}，位于 HUD 下方、牌桌 (y≥${b.top}) 之上，不遮挡卡牌`);

  console.log('\n[10] 卡槽填满 → 复活 → 再失败');
  st = await fillSlot(page, 7);
  await sleep(800);
  const reviveBtn = await findButton(page, '看广告复活').catch(() => null);
  check(!!reviveBtn, '卡槽满 → 弹出复活对话框');
  if (reviveBtn) {
    await tap(page, reviveBtn.x, reviveBtn.y);
    await sleep(300);
    const showing = await G(page, () => window.__ANIME_STACK__.ads.isShowingFake);
    check(showing, '显示占位广告');
    await page.waitForFunction(() => window.__ANIME_STACK__.ads.fakeFinished, null, { timeout: 9000 });
    await sleep(200);
    await tapButton(page, '领取奖励');
    await page.waitForFunction(() => window.__ANIME_STACK__.debug.state().fsm === 'playing', null, { timeout: 4000 });
    await sleep(500);
    st = await state(page);
    check(st.slotCount <= 4 && st.props.revive === 0, `复活成功：卡槽剩 ${st.slotCount} 张`);
    a = await audio(page);
    check(a.log.includes('revive'), '复活音效');
    await fillSlot(page, 7);
    await waitScene(page, 'result', 8000);
    res = await G(page, () => window.__ANIME_STACK__.scenes.current.data);
    check(res.win === false, '第二次填满 → 失败结算');
    a = await audio(page);
    check(a.log.includes('gameover'), '失败音效');
    await findButton(page, '再来一把');
    check(true, '失败结算有「重新挑战」');
  }

  console.log('\n[11] 每日挑战 / 地狱关通关');
  await startLevel(page, 'daily', null);
  const d1 = await dbg(page, 'boardTypes');
  await startLevel(page, 'daily', null);
  const d2 = await dbg(page, 'boardTypes');
  check(d1.join(',') === d2.join(',') && d1.length > 0, '每日挑战：同一天布局一致');
  await startLevel(page, 10, 99);
  const order = await dbg(page, 'referenceOrder');
  for (const id of order) { await dbg(page, 'tryPick', id); await sleep(15); }
  await waitScene(page, 'result', 20000);
  res = await G(page, () => window.__ANIME_STACK__.scenes.current.data);
  check(res.win && res.hell, `地狱关 (第 10 关) 按参考解通关 → 大庆祝 (${res.total} 张)`);
  save = await dbg(page, 'save');
  check(save.unlocked === 11, '通关第 10 关 → 解锁第 11 关');

  check(errors.length === 0, `控制台无报错${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  await page.close();
}

async function testEdge(browser) {
  console.log('\n[13] 逻辑漏洞 / 边界情况 (v3.1 审查修复)');
  const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
  const { page, errors } = await openPage(browser, url);
  await waitScene(page, 'menu');
  await tap(page, 270, 920);   // 解锁音频
  await sleep(300);
  const S = (fn, arg) => page.evaluate(([f, a]) => new Function('s', 'g', 'a', f)(window.__ANIME_STACK__.scenes.current, window.__ANIME_STACK__, a), [fn, arg]);
  const startNoWait = async (level, seed) => {
    await G(page, ([l, s]) => window.__ANIME_STACK__.scenes.change('game', { level: l, seed: s }, { transition: false }), [level, seed]);
  };

  // —— 发牌动画期间不能点牌 ——
  await startNoWait(3, 31);
  await sleep(150);
  let h = await dbg(page, 'hint');
  await tap(page, h.x, h.y);
  await sleep(100);
  let st = await state(page);
  check(st.slotCount === 0, `发牌动画还没落完时点牌：无反应 (卡槽 ${st.slotCount})`);
  await sleep(1600);
  h = await dbg(page, 'hint');
  await tap(page, h.x, h.y);
  await sleep(100);
  st = await state(page);
  check(st.slotCount === 1, '发牌结束后点牌：正常进槽');

  // —— 双击同一张卡 ——
  h = await dbg(page, 'hint');
  const p = await toCss(page, h.x, h.y);
  await page.mouse.dblclick(p.x, p.y);
  await sleep(150);
  const slotIds = await S('return s.slot.cards.map((c) => c.id)');
  check(new Set(slotIds).size === slotIds.length && slotIds.filter((id) => id === h.id).length === 1, `双击同一张卡：这张卡只进槽一次 (槽内 ${slotIds.length} 张，无重复)`);

  // —— 暂停时 / 广告时点牌无效；暂停时计时停止 ——
  await sleep(500);
  const t0 = await S('s.pause(); return s.playTime');
  // 选一张不在暂停对话框范围内的可点卡 (点到对话框按钮属于正常操作)
  h = await S(`const d = s.dialog; const c = s.board.freeCards.find((x) => x.zone === 'board' && (x.cx < d.x - 10 || x.cx > d.x + d.w + 10 || x.cy < d.y - 10 || x.cy > d.y + d.h + 10)) || s.board.freeCards.find((x) => x.cy > d.y + d.h + 10 || x.cy < d.y - 10); return c ? { x: c.cx, y: c.cy } : { x: 30, y: 300 }`);
  const before = (await state(page)).slotCount;
  await tap(page, h.x, h.y);
  await sleep(1000);
  const t1 = await S('return s.playTime');
  st = await state(page);
  check(st.slotCount === before && st.fsm === 'paused', '暂停对话框打开时点牌：无反应');
  check(Math.abs(t1 - t0) < 0.05, `暂停期间计时停止 (+${(t1 - t0).toFixed(3)} 秒)`);
  await S("s.fsm.change('playing')");

  // —— 第 7 张刚好凑满三张：不判负 ——
  await startLevel(page, 4, 404);
  await sleep(1700);
  const seven = await S(`
    const free = s.board.freeCards.filter((c) => c.zone === 'board');
    if (free.length < 7) return null;
    const pick = free.slice(0, 7);
    [0, 0, 1, 1, 2, 2, 0].forEach((t, i) => { pick[i].type = t; });
    return pick.map((c) => c.id);`);
  if (!seven) check(false, '第 4 关开局可点的卡不足 7 张');
  else {
    for (const id of seven.slice(0, 6)) { await dbg(page, 'tryPick', id); await sleep(80); }
    await sleep(500);
    st = await state(page);
    const six = st.slotCount;
    await dbg(page, 'tryPick', seven[6]);
    await sleep(1500);
    st = await state(page);
    check(six === 6 && st.slotCount === 4 && st.fsm === 'playing', `卡槽 6 张时第 7 张凑成三张：消除后剩 ${st.slotCount} 张，不判负 (fsm=${st.fsm})`);
    // 撤回不能撤销已经消掉的三张
    const ok = await S("return s.useProp('undo')");
    st = await state(page);
    check(!ok && st.props.undo === 1 && st.slotCount === 4, '刚凑成三张后撤回：被拒绝，次数不扣');
  }

  // —— 侧边牌堆的卡：拿起后撤回，回到牌堆原位 ——
  await startLevel(page, 7, 707);
  await sleep(1700);
  const pile = await S("const c = s.board.freeCards.find((x) => x.zone === 'pile'); return c ? { id: c.id, x: c.x, y: c.y, layer: c.layer } : null");
  await dbg(page, 'tryPick', pile.id);
  await sleep(400);
  await S("s.useProp('undo')");
  await sleep(500);
  let c = await S('const c = s.board.cards.find((x) => x.id === a); return { state: c.state, zone: c.zone, x: c.x, y: c.y, layer: c.layer, free: c.free, flying: c.flying }', pile.id);
  check(c.state === 'board' && c.zone === 'pile' && Math.abs(c.x - pile.x) < 0.5 && Math.abs(c.y - pile.y) < 0.5 && c.layer === pile.layer && c.free && !c.flying,
    '牌堆的卡撤回后回到牌堆原位，仍可点击');

  // —— 移出 (槽里不足 3 张) → 撤回被拒；暂存区的卡拿起再撤回 → 回到暂存区 ——
  await startLevel(page, 7, 708);
  await sleep(1700);
  h = await dbg(page, 'hint');
  await dbg(page, 'tryPick', h.id);
  await sleep(450);
  await S("s.useProp('moveOut')");
  await sleep(500);
  st = await state(page);
  check(st.temp === 1 && st.slotCount === 0 && st.props.moveOut === 0, `槽里只有 1 张时移出：移出 ${st.temp} 张`);
  let ok = await S("return s.useProp('undo')");
  st = await state(page);
  check(!ok && st.props.undo === 1, '移出之后撤回：被拒绝 (不会把移出的卡又塞回去)，次数不扣');
  const tmp = await S("const c = s.board.cards.find((x) => x.zone === 'temp' && x.state === 'board'); return { id: c.id, x: c.home.x, y: c.home.y, layer: c.home.layer }");
  await dbg(page, 'tryPick', tmp.id);
  await sleep(450);
  await S("s.useProp('undo')");
  await sleep(500);
  c = await S('const c = s.board.cards.find((x) => x.id === a); return { state: c.state, zone: c.zone, x: c.x, y: c.y, layer: c.layer, free: c.free }', tmp.id);
  check(c.state === 'board' && c.zone === 'temp' && Math.abs(c.x - tmp.x) < 0.5 && Math.abs(c.y - tmp.y) < 0.5 && c.layer === tmp.layer && c.free, '暂存区的卡拿起后撤回：回到暂存区原位');

  // —— 移出 + 复活：暂存区叠成两层，上层压住下层；广告期间点牌无效；重开后道具次数恢复 ——
  await startLevel(page, 8, 808);
  await sleep(1800);
  await fillSlot(page, 3);
  await S("s.useProp('moveOut')");
  await sleep(500);
  await fillSlot(page, 7);
  await sleep(900);
  const rb = await findButton(page, '看广告复活').catch(() => null);
  if (!rb) check(false, '卡槽满后没有出现复活对话框');
  else {
    await tap(page, rb.x, rb.y);
    await sleep(300);
    const cnt = (await state(page)).slotCount;
    h = await S("const c = s.board.freeCards.find((x) => x.zone === 'board'); return { x: c.cx, y: c.cy }");
    await tap(page, h.x, h.y);
    await sleep(200);
    st = await state(page);
    check(st.slotCount === cnt && st.fsm === 'ad', '看广告期间点牌：无反应');
    await page.waitForFunction(() => window.__ANIME_STACK__.ads.fakeFinished, null, { timeout: 9000 });
    await sleep(200);
    await tapButton(page, '领取奖励');
    await page.waitForFunction(() => window.__ANIME_STACK__.debug.state().fsm === 'playing', null, { timeout: 4000 });
    await sleep(600);
    const temp = await S(`return s.board.cards.filter((c) => c.state === 'board' && c.zone === 'temp').map((c) => ({ x: c.x, y: c.y, level: c.layer - 100, free: c.free }))`);
    const lv0 = temp.filter((t) => t.level === 0), lv1 = temp.filter((t) => t.level === 1);
    const stacked = lv1.every((t) => lv0.some((u) => Math.abs(u.x - t.x) < 0.5 && u.y > t.y));
    const sameLayerOverlap = [lv0, lv1].some((L) => L.some((a2, i) => L.some((b2, j) => i !== j && Math.abs(a2.x - b2.x) < 62)));
    check(lv0.length === 3 && lv1.length === 3 && stacked && !sameLayerOverlap && lv1.every((t) => t.free) && lv0.every((t) => !t.free),
      `移出后再复活：暂存区两层各 3 张，新的一层叠在上面并压住下层，同层互不重叠` + (lv0.length === 3 && lv1.length === 3 && stacked && !sameLayerOverlap && lv1.every((t) => t.free) && lv0.every((t) => !t.free) ? '' : ' ' + JSON.stringify(temp)));
    await G(page, () => window.__ANIME_STACK__.scenes.change('game', { level: 8, seed: 808 }, { transition: false }));
    await sleep(200);
    st = await state(page);
    check(Object.values(st.props).every((v) => v === 1) && st.temp === 0, '重新开始：移出 / 撤回 / 洗牌 / 复活次数全部恢复为 1');
  }

  // —— 最后几张在暂存区也能正常通关；用过道具 → 2 星 ——
  await startLevel(page, 1, 111);
  await sleep(1700);
  for (let i = 0; i < 2; i++) { h = await dbg(page, 'hint'); await dbg(page, 'tryPick', h.id); await sleep(400); }
  await S("s.useProp('moveOut')");
  await sleep(500);
  for (let i = 0; i < 80; i++) {
    st = await state(page);
    if (st.scene !== 'game' || st.fsm !== 'playing') break;
    h = await dbg(page, 'hint');
    if (!h) { await sleep(100); continue; }
    await dbg(page, 'tryPick', h.id);
    await sleep(60);
  }
  await waitScene(page, 'result', 10000);
  let res = await G(page, () => window.__ANIME_STACK__.scenes.current.data);
  check(res.win && res.stars === 2, `暂存区的卡最后取完也能通关 (win=${res.win})；用过道具 → ${res.stars} 星`);

  // —— 撤回的卡还在飞回去时立刻洗牌：卡不能卡在"飞行中"(v3 的死局) ——
  await startLevel(page, 6, 606);
  await sleep(1800);
  h = await dbg(page, 'hint');
  await dbg(page, 'tryPick', h.id);
  await sleep(500);
  await S("s.useProp('undo'); s.useProp('shuffle')");
  await sleep(1200);
  const info = await S(`const c = s.board.cards.find((x) => x.id === ${h.id}); return { n: s.board.cards.filter((x) => x.flying).length, st: c.state, dx: Math.abs(c.x - c.home.x) + Math.abs(c.y - c.home.y) }`);
  const nStuck = info.n;
  check(nStuck === 0 && info.st === 'board' && info.dx < 0.5, `撤回途中洗牌：没有卡卡在飞行中 (${nStuck})，撤回的卡回到原位`);

  // —— 洗牌后仍然有解：按洗牌时求出的路线一直点到通关 ——
  await startLevel(page, 12, 1212);
  await sleep(2000);
  let order = await dbg(page, 'referenceOrder');
  for (const id of order.slice(0, 20)) { await dbg(page, 'tryPick', id); await sleep(20); }
  await sleep(600);
  const slotNow = (await state(page)).slotCount;
  await S("s.useProp('shuffle')");
  await sleep(500);
  const sh = await dbg(page, 'lastShuffle');
  const solv = await dbg(page, 'stillSolvable');
  check(sh && sh.ok && solv, `洗牌 (槽里有 ${slotNow} 张)：花色重新分配后仍有解 (第 ${sh && sh.tries} 次尝试找到)`);
  order = await dbg(page, 'referenceOrder');
  for (const id of order) { await dbg(page, 'tryPick', id); await sleep(15); }
  await waitScene(page, 'result', 20000);
  res = await G(page, () => window.__ANIME_STACK__.scenes.current.data);
  check(res.win, `洗牌后按新路线点完 ${order.length} 张 → 通关`);

  // —— 每日挑战：跨午夜才结算，仍记在开局那天 ——
  await startLevel(page, 'daily', null);
  await sleep(300);
  const key = await S('return s.dailyKey');
  await page.evaluate(() => {
    const Real = Date;
    window.__RealDate = Real;
    window.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + 86400000); } static now() { return Real.now() + 86400000; } };
  });
  await S('s.finish(true)');
  await waitScene(page, 'result');
  const saved = (await dbg(page, 'save')).dailyCleared;
  await page.evaluate(() => { window.Date = window.__RealDate; });
  check(saved === key, `每日挑战在午夜后才结算：记为开局当天 ${saved}`);

  // —— 心跳：暂停 / 离开时停止；离开关卡时台词停止 ——
  await startLevel(page, 4, 4040);
  await sleep(1700);
  await fillSlot(page, 5);
  await sleep(300);
  let a = await audio(page);
  const t1a = a.tension;
  await S('s.pause()');
  await sleep(200);
  a = await audio(page);
  const t2a = a.tension;
  await S("s.fsm.change('playing')");
  await sleep(200);
  const t3a = (await audio(page)).tension;
  await G(page, () => window.__ANIME_STACK__.voice.request('winBoss'));
  await sleep(150);
  const vp = await G(page, () => window.__ANIME_STACK__.voice.isPlaying());
  await G(page, () => window.__ANIME_STACK__.scenes.change('levels'));
  await waitScene(page, 'levels');
  await sleep(300);
  a = await audio(page);
  const vp2 = await G(page, () => window.__ANIME_STACK__.voice.isPlaying());
  check(t1a === 1 && t2a === 0 && t3a === 1 && a.tension === 0, `心跳：卡槽 5 张 ${t1a} → 暂停 ${t2a} → 继续 ${t3a} → 离开关卡 ${a.tension}`);
  check(vp && !vp2 && a.music === 'menu', '中途离开关卡：正在说的台词停止，BGM 换回菜单曲');

  // —— 窗口缩放 (卡牌飞行途中) 后点击坐标仍然准确 ——
  await startLevel(page, 4, 4141);
  await sleep(1700);
  h = await dbg(page, 'hint');
  await tap(page, h.x, h.y);
  await page.setViewportSize({ width: 420, height: 760 });
  await sleep(500);
  h = await dbg(page, 'hint');
  await tap(page, h.x, h.y);
  await sleep(400);
  st = await state(page);
  const picked = await S('return s.slot.cards.some((c) => c.id === a)', h.id);
  check(st.slotCount === 2 && picked, '飞行途中缩放窗口：之后的点击仍然点中目标卡');
  await page.setViewportSize({ width: 540, height: 960 });

  check(errors.length === 0, `控制台无报错${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  await page.close();

  // —— 触屏：一次点击只触发一次 (Pointer Events，不会鼠标/触摸双发) ——
  const tctx = await browser.newContext({ viewport: { width: 540, height: 960 }, hasTouch: true, isMobile: true });
  const tp = await tctx.newPage();
  await tp.goto(url);
  await waitScene(tp, 'menu');
  await G(tp, () => window.__ANIME_STACK__.scenes.change('game', { level: 4, seed: 4242 }, { transition: false }));
  await sleep(2000);
  const th = await dbg(tp, 'hint');
  const tpos = await toCss(tp, th.x, th.y);
  await tp.touchscreen.tap(tpos.x, tpos.y);
  await sleep(300);
  const tst = await state(tp);
  const hov = await G(tp, () => !!window.__ANIME_STACK__.scenes.current.board.hovered);
  check(tst.slotCount === 1 && !hov, `触屏点一下：只拿 1 张 (卡槽 ${tst.slotCount})，没有残留悬停高亮`);
  await tctx.close();

  // —— localStorage 不可用 (部分浏览器的 file:// / 隐私模式) ——
  const lctx = await browser.newContext({ viewport: { width: 540, height: 960 } });
  await lctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
  });
  const lp = await lctx.newPage();
  const lerr = [];
  lp.on('pageerror', (e) => lerr.push(String(e)));
  await lp.goto(url);
  await waitScene(lp, 'menu');
  await G(lp, () => window.__ANIME_STACK__.scenes.change('game', { level: 1, seed: 1 }, { transition: false }));
  await sleep(1800);
  const lh = await dbg(lp, 'hint');
  await dbg(lp, 'tryPick', lh.id);
  await G(lp, () => window.__ANIME_STACK__.mixer.set('bgm', 0.5));
  const lst = await state(lp);
  const avail = await G(lp, () => window.__ANIME_STACK__.save.available);
  check(lst.slotCount === 1 && avail === false && lerr.length === 0, 'localStorage 读写抛异常：游戏照常运行 (存档只在本次有效)，无页面错误');
  await lctx.close();
}

async function testDev(browser) {
  console.log('\n[14] 开发版 index.html (ES Module 源码，经本地服务器)');
  const port = 8799;
  const srv = spawn(process.execPath, [path.join(root, 'tools/serve.js'), String(port)], { stdio: 'ignore' });
  try {
    await sleep(600);
    const { page, errors } = await openPage(browser, `http://localhost:${port}/index.html`);
    await waitScene(page, 'menu');
    await G(page, () => window.__ANIME_STACK__.scenes.change('levels'));
    await waitScene(page, 'levels');
    await G(page, () => window.__ANIME_STACK__.scenes.change('game', { level: 1 }));
    await waitScene(page, 'game');
    await sleep(500);
    const st = await state(page);
    check(st.level === 1 && st.total > 0, '开发版可进入选关与第 1 关');
    check(errors.length === 0, `开发版控制台无报错${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await page.close();
  } finally {
    srv.kill();
  }
}

const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
try {
  if (process.env.ONLY !== "edge") await testDist(browser);
  await testEdge(browser);
  if (process.env.ONLY !== "edge") await testDev(browser);
} catch (err) {
  console.error(err);
  failures++;
} finally {
  await browser.close();
}
console.log(`\n结果：${passes} 项通过，${failures} 项失败`);
process.exit(failures ? 1 : 0);
