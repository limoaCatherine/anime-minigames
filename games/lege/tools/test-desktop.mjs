// 桌面版 (Electron) 自动化测试：在 Linux 上运行同一份打包应用 (build/linux-x64)，验证与 Windows 版相同的主进程逻辑。
// 用法: npm run package:linux && xvfb-run -a node tools/test-desktop.mjs [截图路径]
import { _electron as electron } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = path.join(root, 'build/linux-x64/anime-stack');
const shot = process.argv[2] || path.join(os.tmpdir(), 'anime-stack-desktop.png');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 独立的 appData，避免污染本机 (XDG_CONFIG_HOME 决定 Linux 上的 appData)
const cfgHome = fs.mkdtempSync(path.join(os.tmpdir(), 'as-cfg-'));
const env = { ...process.env, XDG_CONFIG_HOME: cfgHome };
let failures = 0;
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failures++; };
const ready = (n) => `window.__ANIME_STACK__ && window.__ANIME_STACK__.scenes.currentName === '${n}' && !window.__ANIME_STACK__.scenes.transitioning`;

async function launch() {
  const app = await electron.launch({ executablePath: exe, args: ['--no-sandbox'], env });
  const win = await app.firstWindow();
  const errors = [];
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  win.on('pageerror', (e) => errors.push(String(e)));
  await win.waitForFunction(ready('menu'), null, { timeout: 15000 });
  return { app, win, errors };
}

async function tap(win, x, y) {
  const p = await win.evaluate(([lx, ly]) => {
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.left + (lx / 540) * r.width, y: r.top + (ly / 960) * r.height };
  }, [x, y]);
  await win.mouse.click(p.x, p.y);
}
const dbg = (win, n, a) => win.evaluate(([n2, a2]) => window.__ANIME_STACK__.debug[n2](a2), [n, a]);

console.log('\n[desktop] 第一次启动');
let { app, win, errors } = await launch();
const info = await app.evaluate(({ app: a, BrowserWindow, Menu }) => {
  const w = BrowserWindow.getAllWindows()[0];
  const [cw, ch] = w.getContentSize();
  return {
    packaged: a.isPackaged, title: w.getTitle(), visible: w.isVisible(), menu: Menu.getApplicationMenu(),
    size: [cw, ch], userData: a.getPath('userData'), url: w.webContents.getURL(),
    devtools: (() => { w.webContents.openDevTools(); return w.webContents.isDevToolsOpened(); })(),
  };
});
check(info.packaged, '以打包模式运行 (app.isPackaged)');
check(info.title === '美少女了个美', `窗口标题: ${info.title}`);
check(info.visible, 'ready-to-show 后窗口可见');
check(info.menu === null, '无菜单栏');
check(Math.abs(info.size[0] / info.size[1] - 9 / 16) < 0.02, `竖屏 9:16 内容区: ${info.size.join('x')}`);
check(info.devtools === false, '打包后无法打开开发者工具');
check(/AnimeStack$/.test(info.userData), `存档目录: ${info.userData}`);
check(/app\.asar\/dist\/index\.html$/.test(info.url), `从包内加载: ${info.url.replace(/^.*resources/, '…/resources')}`);

const st = await win.evaluate(() => {
  const g = window.__ANIME_STACK__;
  return { imgs: [...g.assets.images.values()].filter((i) => i instanceof HTMLImageElement && i.naturalWidth > 0).length, voices: g.voice.loadedCount, total: g.voice.clips.size };
});
check(st.imgs >= 15 && st.voices === 25 && st.total === 25, `包内图片 ${st.imgs} 张、语音 ${st.voices}/${st.total} 加载成功`);

// 桌面版允许自动播放：未交互时 BGM 已在菜单播放；循环点无缝回到开头继续
await sleep(1200);
const bgm0 = (await dbg(win, 'audioState')).bgm;
check(bgm0.playing && bgm0.time > 0 && !bgm0.error, `启动即播放 BGM (包内 ${bgm0.src}, t=${bgm0.time.toFixed(2)}s, 音量 ${bgm0.volume.toFixed(3)})`);
await win.evaluate(() => { const el = window.__ANIME_STACK__.music.els.menu.el; el.currentTime = el.duration - 0.4; });
await sleep(1000);
const bgm1 = (await dbg(win, 'audioState')).bgm;
check(bgm1.playing && bgm1.time > 0.2 && bgm1.time < 1.5, `BGM 到结尾后循环回开头继续 (t=${bgm1.time.toFixed(2)}s)`);

// 开始第 1 关：开局语音自动播放，用鼠标点几张牌
await tap(win, 270, 600);
await win.waitForFunction(ready('game'), null, { timeout: 8000 });
await sleep(1500);
const a1 = await dbg(win, 'audioState');
check(a1.music === 'game' && a1.voice.history.some((id) => /^start/.test(id)), `游戏 BGM + 开局语音: ${a1.voice.history.join(', ')} (${a1.voice.last && a1.voice.last.result})`);
let picks = 0;
for (let i = 0; i < 6; i++) {
  const h = await dbg(win, 'hint');
  if (!h) { await sleep(200); continue; }
  await tap(win, h.x, h.y); picks++;
  await sleep(350);
}
const s2 = await dbg(win, 'state');
check(picks === 6 && s2.remaining === s2.total - 6, `鼠标点牌 ${picks} 次 (剩 ${s2.remaining}/${s2.total})`);
await sleep(300);
await win.screenshot({ path: shot });
check(true, `桌面窗口截图: ${shot}`);

// 写入存档
await win.evaluate(() => {
  const g = window.__ANIME_STACK__;
  g.save.submit(1, { win: true, progress: 1, stars: 2 });
  g.mixer.set('bgm', 0.5);
  g.save.flush();
});

// 单实例：再次启动应立即退出并激活已有窗口
const second = spawn(exe, ['--no-sandbox'], { env, stdio: 'ignore' });
const code = await new Promise((resolve) => {
  const t = setTimeout(() => { second.kill(); resolve('timeout'); }, 10000);
  second.on('exit', (c) => { clearTimeout(t); resolve(c); });
});
const count = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
check(code === 0 && count === 1, `单实例锁: 第二个进程退出 (code ${code})，窗口数 ${count}`);
check(errors.length === 0, `控制台无错误${errors.length ? ': ' + errors.join(' | ') : ''}`);
await app.close();

console.log('\n[desktop] 重启后检查存档');
({ app, win, errors } = await launch());
const saved = await win.evaluate(() => ({ stars: window.__ANIME_STACK__.save.starsOf(1), unlocked: window.__ANIME_STACK__.save.get('unlocked'), bgm: window.__ANIME_STACK__.mixer.get('bgm') }));
check(saved.stars === 2 && saved.unlocked >= 2 && Math.abs(saved.bgm - 0.5) < 1e-6, `localStorage 跨重启保留: 第 1 关 ${saved.stars} 星, 已解锁 ${saved.unlocked}, BGM 音量 ${saved.bgm}`);
check(errors.length === 0, '控制台无错误');
await app.close();
fs.rmSync(cfgHome, { recursive: true, force: true });

console.log(failures ? `\n失败 ${failures} 项` : '\n全部通过 ✔');
process.exit(failures ? 1 : 0);
