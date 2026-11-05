// 桌面版 (Electron) 自动化测试：在 Linux 上运行同一份打包应用 (build/linux-x64)，验证与 Windows 版相同的主进程逻辑。
// 用法: node tools/package.mjs linux && xvfb-run -a node tools/test-desktop.mjs [截图路径]
import { _electron as electron } from 'playwright';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = path.join(root, 'build/linux-x64/anime-spotdiff');
const shot = process.argv[2] || '/workspace/anime-spotdiff-desktop.png';
const cfgHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-cfg-'));
const env = { ...process.env, XDG_CONFIG_HOME: cfgHome };
let failures = 0;
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failures++; };

const app = await electron.launch({ executablePath: exe, args: ['--no-sandbox'], env });
const win = await app.firstWindow();
const errors = [];
win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
win.on('pageerror', (e) => errors.push(String(e)));
await win.waitForFunction(() => window.__SPOTDIFF__ && window.__SPOTDIFF__.scenes.current && window.__SPOTDIFF__.scenes.current.name === 'menu', null, { timeout: 20000 });
const info = await app.evaluate(({ app: a, BrowserWindow, Menu }) => {
  const w = BrowserWindow.getAllWindows()[0];
  const [cw, ch] = w.getContentSize();
  return { packaged: a.isPackaged, title: w.getTitle(), visible: w.isVisible(), menu: Menu.getApplicationMenu(), size: [cw, ch], userData: a.getPath('userData'), url: w.webContents.getURL() };
});
check(info.packaged, '以打包模式运行');
check(info.title === '次元破绽！', `窗口标题: ${info.title}`);
check(info.visible, '窗口可见');
check(info.menu === null, '无菜单栏');
check(Math.abs(info.size[0] / info.size[1] - 9 / 16) < 0.02, `竖屏 9:16 内容区: ${info.size.join('x')}`);
check(/AnimeSpotDiff$/.test(info.userData), `存档目录: ${info.userData}`);
check(/app\.asar\/dist\/index\.html$/.test(info.url), '从包内加载 dist/index.html');
await win.waitForTimeout(1500);
// 进第 1 关点开场按钮
await win.evaluate(() => window.__SPOTDIFF__.scenes.change('game', { levelId: 'L01' }));
await win.waitForTimeout(800);
await win.evaluate(() => { const s = window.__SPOTDIFF__.scenes.current; s.dialog.btn.onClick(); });
await win.waitForTimeout(1200);
await win.screenshot({ path: shot });
const gameErrors = await win.evaluate(() => window.__SPOTDIFF__.errors || []);
check(!errors.length && !gameErrors.length, `无控制台错误 ${errors.concat(gameErrors.map(String)).join(' ; ')}`);
await app.close();
console.log(failures ? `✘ ${failures} 项失败` : '✔ 桌面版检查全部通过', '截图:', shot);
process.exit(failures ? 1 : 0);
