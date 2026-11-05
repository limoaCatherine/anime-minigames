// 开发用：node tools/preview.mjs L01 [L02 ...] [--flags=a,b] [--found=x] [--variant=B] [--no-overlay]
// 输出 /workspace/_scratch/spotdiff/preview_<id>.png
import { build } from 'esbuild';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({ entryPoints: [path.join(root, 'tools/preview/entry.js')], bundle: true, outfile: path.join(root, 'tools/preview/bundle.js'), format: 'iife', logLevel: 'error' });
const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 540, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const id of ids) {
  const q = new URLSearchParams({ level: id, flags: opt.flags || '', found: opt.found || '', variant: opt.variant || 'A', overlay: opt['no-overlay'] ? '0' : '1' });
  await page.goto('file://' + path.join(root, 'tools/preview/index.html') + '?' + q);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 15000 });
  const out = `/workspace/_scratch/spotdiff/preview_${id}${opt.suffix ? '_' + opt.suffix : ''}.png`;
  await page.locator('#c').screenshot({ path: out });
  console.log(out);
}
await browser.close();
