// 桌面版 (Electron) 自动化测试：在 Linux 上运行同一份打包应用 (build/linux-x64)，验证与 Windows 版相同的主进程逻辑。
// 用法: npm run package:linux && xvfb-run -a node tools/test-desktop.mjs [截图路径]
import { _electron as electron } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = path.join(root, 'build/linux-x64/anime-drawline');
const shot = process.argv[2] || path.join(root, 'desktop-screenshot.png');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 独立的 appData，避免污染本机 (XDG_CONFIG_HOME 决定 Linux 上的 appData)
const cfgHome = fs.mkdtempSync(path.join(os.tmpdir(), 'adl-cfg-'));
const env = { ...process.env, XDG_CONFIG_HOME: cfgHome };
let failures = 0;
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failures++; };

async function waitScene(win, name) {
  await win.waitForFunction((n) => window.__ANIME_DRAWLINE__ && window.__ANIME_DRAWLINE__.scenes.currentName === n && !window.__ANIME_DRAWLINE__.scenes.transitioning, name, { timeout: 15000 });
}
async function launch() {
  const app = await electron.launch({ executablePath: exe, args: ['--no-sandbox'], env });
  const win = await app.firstWindow();
  const errors = [];
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  win.on('pageerror', (e) => errors.push(String(e)));
  await waitScene(win, 'menu');
  return { app, win, errors };
}
async function toPage(win, x, y) {
  return win.evaluate(([lx, ly]) => {
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.left + (lx / 540) * r.width, y: r.top + (ly / 960) * r.height };
  }, [x, y]);
}
async function tap(win, x, y) { const p = await toPage(win, x, y); await win.mouse.click(p.x, p.y); }
async function dragPath(win, pts) {
  const s = await toPage(win, pts[0].x, pts[0].y);
  await win.mouse.move(s.x, s.y);
  await win.mouse.down();
  for (let i = 1; i < pts.length; i++) { const p = await toPage(win, pts[i].x, pts[i].y); await win.mouse.move(p.x, p.y, { steps: 4 }); }
  await win.mouse.up();
}

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
check(info.title === '画线守护美少女', `窗口标题: ${info.title}`);
check(info.visible, 'ready-to-show 后窗口可见');
check(info.menu === null, '无菜单栏');
check(Math.abs(info.size[0] / info.size[1] - 9 / 16) < 0.02, `竖屏 9:16 内容区: ${info.size.join('x')}`);
check(info.devtools === false, '打包后无法打开开发者工具');
check(/AnimeDrawLine$/.test(info.userData), `存档目录: ${info.userData}`);
check(/app\.asar\/dist\/index\.html$/.test(info.url), `从包内加载: ${info.url.replace(/^.*resources/, '…/resources')}`);

const st = await win.evaluate(() => {
  const g = window.__ANIME_DRAWLINE__;
  return { imgs: [...g.assets.images.values()].filter((i) => i instanceof HTMLImageElement && i.naturalWidth > 0).length, voices: g.voice.loadedCount };
});
check(st.imgs === 10 && st.voices === 15, `包内图片 ${st.imgs}/10、语音 ${st.voices}/15 加载成功`);

// 桌面版允许自动播放：未交互时 BGM 已在菜单播放；循环点无缝回到开头继续
await sleep(600);
const bgm0 = await win.evaluate(() => window.__ANIME_DRAWLINE__.bgm.state());
check(bgm0.playing && bgm0.time > 0 && !bgm0.error, `启动即播放 BGM (包内 ${bgm0.src.split('/').pop()}, t=${bgm0.time.toFixed(2)}s, 音量 ${bgm0.volume.toFixed(3)})`);
await win.evaluate(() => { const el = window.__ANIME_DRAWLINE__.bgm.el; el.currentTime = el.duration - 0.4; });
await sleep(1000);
const bgm1 = await win.evaluate(() => window.__ANIME_DRAWLINE__.bgm.state());
check(bgm1.playing && bgm1.time > 0.2 && bgm1.time < 1.5, `BGM 到结尾后循环回开头继续 (t=${bgm1.time.toFixed(2)}s)`);

// 开始游戏 -> 选关 -> 第 1 关，用鼠标画出参考解法并通关
await tap(win, 270, 812);
await waitScene(win, 'levels');
await tap(win, 70, 452);
await waitScene(win, 'game');
await sleep(500);
const v0 = await win.evaluate(() => window.__ANIME_DRAWLINE__.voice.lastPlay);
check(v0 && v0.group === 'start' && v0.result === 'audio', `开局语音播放: ${JSON.stringify(v0)}`);
const sol = await win.evaluate(() => window.__ANIME_DRAWLINE__.scenes.current.level.solution);
await dragPath(win, sol);
await sleep(2500);
await win.screenshot({ path: shot });
check(true, `桌面窗口截图 (关卡中): ${shot}`);
await win.waitForFunction(() => window.__ANIME_DRAWLINE__.scenes.current.panel, null, { timeout: 20000 });
await sleep(1200);
const res = await win.evaluate(() => window.__ANIME_DRAWLINE__.scenes.current.result);
check(res && res.win && res.stars >= 1, `鼠标画线通关第 1 关 (${res && res.stars} 星)`);
// 音量设置写入存档
await win.evaluate(() => window.__ANIME_DRAWLINE__.mixer.set('master', 0.6));

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
const saved = await win.evaluate(() => { const g = window.__ANIME_DRAWLINE__; return { stars: g.save.stars(1), unlocked2: g.save.isUnlocked(2), master: g.mixer.get('master') }; });
check(saved.stars >= 1 && saved.unlocked2 && Math.abs(saved.master - 0.6) < 1e-6, `localStorage 跨重启保留: 第 1 关 ${saved.stars} 星、第 2 关已解锁、总音量 ${saved.master}`);
check(errors.length === 0, '控制台无错误');
// 刚写完存档就立刻点关闭窗口 (不等 Chromium 的延迟写盘)
await win.evaluate(() => { const g = window.__ANIME_DRAWLINE__; g.save.submit(2, 3, 123); g.save.set('lastLevel', 2); });
const exited = new Promise((r) => app.process().once('exit', r));
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
await Promise.race([exited, sleep(10000)]);

console.log('\n[desktop] 关窗瞬间写入的存档');
({ app, win, errors } = await launch());
const saved2 = await win.evaluate(() => { const g = window.__ANIME_DRAWLINE__; return { s2: g.save.stars(2), last: g.save.get('lastLevel'), bak: !!localStorage.getItem('animeDrawLine.save.v2.bak') }; });
check(saved2.s2 === 3 && saved2.last === 2 && saved2.bak, `过关后立刻关窗：存档没有丢 (第 2 关 ${saved2.s2} 星，备份 ${saved2.bak})`);
await app.close();
fs.rmSync(cfgHome, { recursive: true, force: true });

console.log(failures ? `\n失败 ${failures} 项` : '\n全部通过 ✔');
process.exit(failures ? 1 : 0);
