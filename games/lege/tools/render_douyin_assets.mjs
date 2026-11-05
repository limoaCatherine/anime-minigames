// 抖音小游戏用的预渲染资源 (Playwright + ffmpeg)，结果缓存在 build/douyin-assets/，由 build-douyin.mjs 复制进包：
//   sfx/*.mp3        SfxEngine 的每个音效 (含音高变体) 离线渲染 → 去掉尾部静音 → 单声道 mp3
//                    (抖音不保证 WebAudio，运行时用 InnerAudioContext 播放这些文件)
//   dark/card_XX.png 被压住的卡的"变暗"贴图 (抖音画布不保证支持 'saturation' 混合模式，提前画好)
//   share.png        分享卡片图 500×400 (5:4)，截自菜单页
// 用法：npm run build 之后  node tools/render_douyin_assets.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sfxRenderList, SFX_FILE_GAIN } from '../src/config/SfxFiles.js';
import { CARDS } from '../src/config/CardConfig.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build/douyin-assets');
const SR = 44100;

function wav16(mono) {
  const buf = Buffer.alloc(44 + mono.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + mono.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(mono.length * 2, 40);
  for (let i = 0; i < mono.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mono[i])) * 32767), 44 + i * 2);
  return buf;
}

export async function renderDouyinAssets({ log = console.log } = {}) {
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error('先运行 npm run build');
  fs.rmSync(out, { recursive: true, force: true });
  for (const d of ['sfx', 'dark']) fs.mkdirSync(path.join(out, d), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dysfx-'));
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] }); // file:// 下读回画布像素需要
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
  await page.waitForFunction(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.debug && window.__ANIME_STACK__.scenes.currentName === 'menu', null, { timeout: 30000 });

  // —— 音效 ——
  const names = await page.evaluate(() => window.__ANIME_STACK__.debug.sfxNames());
  const list = sfxRenderList(names);
  let maxPeak = 0; let total = 0;
  for (const [file, name, opts, sec] of list) {
    const b64 = await page.evaluate(([n, o, s]) => window.__ANIME_STACK__.debug.renderSfx(n, o, s), [name, opts, sec]);
    const f32 = new Float32Array(new Uint8Array(Buffer.from(b64, 'base64')).buffer);
    const n = f32.length / 2;
    const mono = new Float32Array(n);
    let peak = 0;
    for (let i = 0; i < n; i++) { const v = (f32[2 * i] + f32[2 * i + 1]) * 0.5 * SFX_FILE_GAIN; mono[i] = v; peak = Math.max(peak, Math.abs(v)); }
    maxPeak = Math.max(maxPeak, peak);
    // 去掉尾部静音 (< -60 dBFS)，保留 40 ms 并淡出
    let end = n - 1;
    while (end > 0 && Math.abs(mono[end]) < 1e-3) end--;
    end = Math.min(n, end + Math.round(SR * 0.04));
    const fade = Math.round(SR * 0.03);
    for (let i = 0; i < fade && end - 1 - i >= 0; i++) mono[end - 1 - i] *= i / fade;
    const wav = path.join(tmp, `${file}.wav`);
    fs.writeFileSync(wav, wav16(mono.subarray(0, Math.max(end, Math.round(SR * 0.1)))));
    const mp3 = path.join(out, 'sfx', `${file}.mp3`);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3]);
    if (r.status !== 0) throw new Error(`ffmpeg 失败: ${file}\n${r.stderr}`);
    total += fs.statSync(mp3).size;
  }
  log(`  音效 ${list.length} 个 → ${(total / 1024).toFixed(0)} KB，渲染峰值 ${(20 * Math.log10(maxPeak || 1e-9)).toFixed(1)} dBFS (增益 ${SFX_FILE_GAIN})`);
  if (maxPeak > 1) throw new Error('音效渲染削波，请调小 SFX_FILE_GAIN');

  // —— 暗色卡牌贴图 ——
  const darks = await page.evaluate(() => window.__ANIME_STACK__.cardSprites.map((s) => {
    const d = s.dark;
    if (d.toDataURL) return d.toDataURL('image/png');
    const c = document.createElement('canvas'); c.width = d.width; c.height = d.height;
    c.getContext('2d').drawImage(d, 0, 0); return c.toDataURL('image/png');
  }));
  if (darks.length !== CARDS.length) throw new Error(`暗色贴图数量 ${darks.length} ≠ ${CARDS.length}`);
  CARDS.forEach((c, i) => fs.writeFileSync(path.join(out, 'dark', path.basename(c.image)), Buffer.from(darks[i].split(',')[1], 'base64')));
  log(`  暗色卡牌 ${darks.length} 张`);

  // —— 分享图 500×400：菜单页上半部分 (Logo + 美少女) ——
  await page.waitForTimeout(1500);
  const shot = await page.locator('#game').screenshot();
  fs.writeFileSync(path.join(tmp, 'menu.png'), shot);
  const py = spawnSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(path.join(tmp, 'menu.png'))}).convert('RGB')
w, h = im.size
s = w / 540
box = (0, int(40 * s), w, int(40 * s + 432 * s))
im.crop(box).resize((500, 400), Image.LANCZOS).save(${JSON.stringify(path.join(out, 'share.png'))}, optimize=True)
`], { encoding: 'utf8' });
  if (py.status !== 0) throw new Error(py.stderr);
  log('  分享图 share.png 500×400');
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  renderDouyinAssets().then(() => console.log('预渲染完成 → build/douyin-assets/'), (e) => { console.error(e); process.exit(1); });
}
