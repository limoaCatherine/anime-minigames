// 开发用快速截图：node tools/smoke.mjs "<query>" out.png [clicks json]
import { chromium } from 'playwright';
import path from 'node:path';
const [q = '', out = '/workspace/_scratch/spotdiff/smoke.png', actions = '[]'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('file://' + path.resolve('dist/index.html') + q);
await page.waitForTimeout(1800);
for (const a of JSON.parse(actions)) {
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.click) { const [x, y] = a.click; await page.mouse.click(x, y); }
  if (a.eval) console.log(await page.evaluate(a.eval));
}
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(await page.evaluate(() => JSON.stringify(window.__SPOTDIFF__.errors)));
await browser.close();
