// 抖音版音效预渲染：用 AudioSystem.synth() 同一份 WebAudio 合成代码，在 Chromium 的 OfflineAudioContext 里离线渲染
// 每个命名音效 (及其变体)，归一化后用 ffmpeg 编码成小 mp3，写到 assets/sfx/；蜂群嗡嗡声在 Node 里按同样参数
// 合成一段 8/3 秒、首尾相位完全闭合的无缝循环 wav。同时生成清单 src/config/SfxSamples.js (文件 / 原始增益 / 时长)。
// 用法：node tools/render-sfx.mjs
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets/sfx');
const SR = 44100;          // 渲染采样率
const ENC_SR = 22050;      // 编码采样率 (音效链路上本来就有 7 kHz 低通)
fs.mkdirSync(OUT, { recursive: true });

// 变体：key -> [音效名, 参数, 随机数序列 (控制 Math.random，前几个值固定，之后用固定种子)]
const VARIANTS = {
  click: ['click'], start: ['start'], drawStart: ['drawStart'],
  scribble_0: ['scribble', { ratio: 0.85 }, [0.5, 0.9]],
  scribble_1: ['scribble', { ratio: 0.5 }, [0.5, 0.9]],
  scribble_2: ['scribble', { ratio: 0.15 }, [0.5, 0.9]],
  blocked: ['blocked'], inkEmpty: ['inkEmpty'], pop: ['pop'],
  boing_0: ['boing', {}, [0.12]], boing_1: ['boing', {}, [0.38]], boing_2: ['boing', {}, [0.62]], boing_3: ['boing', {}, [0.88]],
  whoosh: ['whoosh'], thud: ['thud'], land: ['land'], rumble: ['rumble'], rockHit: ['rockHit'], gasp: ['gasp'],
  tick: ['tick', { last: false }], tick_last: ['tick', { last: true }],
  victory: ['victory'],
  star_0: ['star', { index: 0 }], star_1: ['star', { index: 1 }], star_2: ['star', { index: 2 }],
  hit: ['hit'], lose: ['lose'], hint: ['hint'], warp: ['warp'], spring: ['spring'],
  glass_0: ['glass', {}, [], 7], glass_1: ['glass', {}, [], 23],
};

async function renderSynth() {
  const bundle = await esbuild.build({
    stdin: { contents: "import { AudioSystem } from './src/systems/AudioSystem.js'; import { AudioConfig } from './src/config/AudioConfig.js'; window.AudioSystem = AudioSystem; window.AudioConfig = AudioConfig;", resolveDir: root, loader: 'js' },
    bundle: true, write: false, format: 'iife', target: 'es2018',
  });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const out = {};
  SWARM = await page.evaluate(() => window.AudioConfig.swarm);
  for (const [key, [name, opts = {}, seq = [], seed = 1]] of Object.entries(VARIANTS)) {
    out[key] = await page.evaluate(async ({ name, opts, seq, seed, SR }) => {
      const ctx = new OfflineAudioContext(1, Math.round(SR * 2.6), SR);
      let s = seed >>> 0;
      const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const q = seq.slice();
      const orig = Math.random;
      Math.random = () => (q.length ? q.shift() : rnd());
      const ev = { on() {}, emit() {} };
      const save = { get: (k, d) => d, set() {} };
      const sys = new window.AudioSystem(ev, save, null, null);
      sys.ctx = ctx;
      sys.master = ctx.createGain();
      sys.master.gain.value = 1;
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass'; soft.frequency.value = 7000; soft.Q.value = 0.5;
      sys.master.connect(soft); soft.connect(ctx.destination);
      sys.synth(name, opts);
      Math.random = orig;
      const buf = await ctx.startRendering();
      return Array.from(buf.getChannelData(0));
    }, { name, opts, seq, seed, SR });
  }
  await browser.close();
  return out;
}

function wav(samples, sr) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}

/** 蜂群嗡嗡声：与 AudioSystem.setSwarm 相同的结构 (两个微失谐三角波 + 二倍频，0.375 Hz 音高起伏，5.25 Hz 音量起伏，低通)。
 *  所有频率都取 1/L 的整数倍 (L = 8/3 秒)，首尾相位完全闭合 -> 无缝循环 */
let SWARM = null;
function renderSwarm() {
  const SW = SWARM;
  const L = 8 / 3;
  const sr = ENC_SR;
  const n = Math.round(L * sr);
  const f1 = Math.round(SW.base * L) / L;               // 165 Hz
  const f2 = Math.round(SW.base * 1.012 * L) / L;       // ≈166.9 Hz (原 1.012 倍失谐)
  const f3 = Math.round(SW.base * 2.005 * L) / L;       // ≈330.8 Hz
  const wobF = 1 / L; const wobA = SW.base * 0.035;     // 0.375 Hz (原 0.37)
  const tremF = 14 / L;                                  // 5.25 Hz (原 5.3)
  const tri = (ph) => { const x = ph - Math.floor(ph); return 4 * Math.abs(x - 0.5) - 1; };
  // RBJ 低通 (与 BiquadFilter lowpass 相同的公式)
  const fc = SW.lowpass; const Q = 0.6;
  const w0 = 2 * Math.PI * fc / sr; const al = Math.sin(w0) / (2 * Q); const cs = Math.cos(w0);
  const a0 = 1 + al;
  const b0 = (1 - cs) / 2 / a0; const b1 = (1 - cs) / a0; const b2 = b0; const a1 = -2 * cs / a0; const a2 = (1 - al) / a0;
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  let p1 = 0; let p2 = 0; let p3 = 0;
  const out = new Float32Array(n);
  for (let pass = 0; pass < 3; pass++) {               // 前两遍让滤波器进入稳态，取第三遍
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const wob = wobA * Math.sin(2 * Math.PI * wobF * t);
      p1 += (f1 + wob) / sr; p2 += (f2 + wob) / sr; p3 += f3 / sr;
      const x = tri(p1) + tri(p2) + 0.25 * tri(p3);
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const trem = 0.8 + 0.18 * Math.sin(2 * Math.PI * tremF * t);
      if (pass === 2) out[i] = y * trem;
    }
  }
  return { data: out, sr, dur: L };
}

const manifest = {};
const rendered = await renderSynth();
let total = 0;
for (const [key, data] of Object.entries(rendered)) {
  let peak = 0; let last = 0;
  for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; if (a > 2e-4) last = i; }
  if (peak <= 0) throw new Error(`音效 ${key} 渲染为空`);
  const end = Math.min(data.length, last + Math.round(SR * 0.03));
  const norm = 0.89 / peak;
  const samples = data.slice(0, end).map((v) => v * norm);
  const tmp = path.join(OUT, `${key}.tmp.wav`);
  fs.writeFileSync(tmp, wav(samples, SR));
  const file = `${key}.mp3`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', String(ENC_SR), '-codec:a', 'libmp3lame', '-b:a', '48k', path.join(OUT, file)]);
  fs.unlinkSync(tmp);
  const size = fs.statSync(path.join(OUT, file)).size;
  total += size;
  manifest[key] = { file, gain: +(peak / 0.89).toPrecision(4), dur: +(end / SR).toFixed(3) };
}
{
  const sw = renderSwarm();
  let peak = 0;
  for (const v of sw.data) peak = Math.max(peak, Math.abs(v));
  const norm = 0.89 / peak;
  const file = 'swarm_loop.wav';
  fs.writeFileSync(path.join(OUT, file), wav(Array.from(sw.data, (v) => v * norm), sw.sr));
  total += fs.statSync(path.join(OUT, file)).size;
  manifest.swarm = { file, gain: +(peak / 0.89).toPrecision(4), dur: +sw.dur.toFixed(4), loop: true };
}
const js = `// 由 tools/render-sfx.mjs 生成，请勿手改。抖音版 (无 WebAudio) 使用的预渲染音效清单。
// gain = 文件归一化前的峰值 (播放音量 = 声道音量 × gain，响度与实时合成一致)。
export const SFX_DIR = 'assets/sfx';
export const SFX_SAMPLES = ${JSON.stringify(manifest, null, 2)};
`;
fs.writeFileSync(path.join(root, 'src/config/SfxSamples.js'), js);
console.log(`预渲染 ${Object.keys(manifest).length} 个音效 -> assets/sfx/  共 ${(total / 1024).toFixed(1)} KB`);
