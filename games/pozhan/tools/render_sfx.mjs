// 把 WebAudio 实时合成的音效预渲染成小 mp3 (抖音小游戏版用；网页 / 桌面版仍然实时合成)。
// 做法：esbuild 把 src/systems/AudioSystem.js 打包进一个空白页面，在 Playwright Chromium 里
// 用 OfflineAudioContext 逐个渲染 sfxVariants() 列出的所有变体 (含五声音阶逐级升高的 correct_0~12 / final_0~7)，
// 每个变体 SFX_TAKES 个版本 (不同随机种子 → 不同的轻微音高抖动)，再用 ffmpeg 编码为 44.1kHz 单声道 mp3。
// 响度：渲染时主音量 = 混音标准里的 sfx 0.12，写文件时 ×(1/0.12) 还原到满幅，播放时再乘回 0.12 → 与网页版实时合成一致。
// 用法：node tools/render_sfx.mjs   → assets/audio/sfx/{key}_{take}.mp3
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets/audio/sfx');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sfx-'));
const SFX_GAIN = 0.12;

const entry = path.join(tmp, 'entry.js');
await fs.writeFile(entry, `
import { AudioSystem, sfxVariants, SFX_TAKES } from ${JSON.stringify(path.join(root, 'src/systems/AudioSystem.js'))};
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
window.variants = () => sfxVariants().map((v) => ({ key: v.key, name: v.name, opts: v.opts }));
window.TAKES = SFX_TAKES;
window.renderOne = async (v, take) => {
  const sr = 44100; const secs = 3.2;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
  let seed = 0; for (const ch of v.key + '#' + take) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const orig = Math.random; Math.random = mulberry(seed);
  try {
    const events = { on() {}, emit() {} };
    const mixer = { gain: () => ${SFX_GAIN}, muted: false };
    const a = new AudioSystem(events, mixer);
    a.initContext(ctx);
    a.play(v.name, v.opts);
  } finally { Math.random = orig; }
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0); const R = buf.getChannelData(1);
  const mono = new Float32Array(L.length);
  let peak = 0;
  for (let i = 0; i < L.length; i++) { const s = (L[i] + R[i]) / 2 / ${SFX_GAIN}; mono[i] = s; peak = Math.max(peak, Math.abs(s)); }
  // 去掉尾部静音 (< -60 dBFS)，留 40ms 余量
  let end = mono.length - 1; while (end > 0 && Math.abs(mono[end]) < 0.001) end--;
  end = Math.min(mono.length, end + Math.round(sr * 0.04));
  const scale = peak > 0.98 ? 0.98 / peak : 1;
  const pcm = new Int16Array(end);
  for (let i = 0; i < end; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(mono[i] * scale * 32767)));
  const bytes = new Uint8Array(pcm.buffer); let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return { b64: btoa(bin), samples: end, peak, scale };
};
`);
await build({ entryPoints: [entry], bundle: true, format: 'iife', outfile: path.join(tmp, 'bundle.js'), logLevel: 'error' });
await fs.writeFile(path.join(tmp, 'index.html'), '<!doctype html><meta charset="utf-8"><script src="bundle.js"></script>');

function wav(pcm, sr = 44100) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.goto('file://' + path.join(tmp, 'index.html'));
  const variants = await page.evaluate(() => window.variants());
  const takes = await page.evaluate(() => window.TAKES);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  let total = 0; let clipped = 0; let maxPeak = 0;
  for (const v of variants) {
    for (let t = 0; t < takes; t++) {
      const r = await page.evaluate(([v, t]) => window.renderOne(v, t), [v, t]);
      maxPeak = Math.max(maxPeak, r.peak); if (r.scale < 1) clipped++;
      const w = path.join(tmp, `${v.key}_${t}.wav`); const o = path.join(outDir, `${v.key}_${t}.mp3`);
      await fs.writeFile(w, wav(Buffer.from(r.b64, 'base64')));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', w, '-ac', '1', '-ar', '44100', '-b:a', '64k', o]);
      total += (await fs.stat(o)).size;
    }
  }
  console.log(`音效预渲染完成：${variants.length} 个变体 × ${takes} = ${variants.length * takes} 个文件，共 ${(total / 1024).toFixed(0)} KB；` +
    `最大峰值 ${maxPeak.toFixed(2)}${clipped ? `，${clipped} 个超满幅已整体压到 0.98` : ''} -> assets/audio/sfx/`);
} finally {
  await browser.close();
  await fs.rm(tmp, { recursive: true, force: true });
}
