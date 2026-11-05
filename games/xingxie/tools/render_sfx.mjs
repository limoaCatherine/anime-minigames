// 抖音小游戏音效预渲染：在无头 Chromium 里用网页版同一套 WebAudio 合成代码 (AudioSystem.synth) 离线渲染，
// 输出 22.05kHz 单声道 wav 到 assets/sfx/，并生成 src/config/SfxManifest.js。
// 用法：node tools/render_sfx.mjs        (需要 playwright 的 chromium 与 ffmpeg；生成物已入库，平时不用重跑)
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets/sfx');
const tmp = path.join(root, 'build/sfx_tmp');
const SR = 44100;

// 名称 → 变体数 / 参数。音高随机的音效渲染多个变体，播放时随机挑
const SIMPLE = ['click', 'eliteDie', 'bossDie', 'fire_slash', 'fire_orbit', 'fire_chain', 'fire_boomerang', 'fire_zone', 'fire_homing', 'fire_meteor',
  'bigBoom', 'slam', 'warn', 'charge', 'levelup', 'refresh', 'pick', 'evolve', 'chest', 'chestBig', 'chestDrop', 'bossWarn', 'eliteWarn', 'horn',
  'hurt', 'block', 'shield', 'heal', 'magnet', 'revive', 'tick', 'buy', 'deny', 'victory', 'lose'];
const JOBS = [];
for (const n of SIMPLE) JOBS.push({ key: n, name: n, n: 1 });
for (const n of ['hit', 'crit', 'pop', 'coin', 'fire_projectile', 'fire_frost']) JOBS.push({ key: n, name: n, n: 3 });
JOBS.push({ key: 'boom', name: 'boom', n: 2 });
JOBS.push({ key: 'hit_big', name: 'hit', opts: { elite: true }, n: 2 });
for (let st = 0; st <= 11; st++) {
  JOBS.push({ key: `gem_s${st}`, name: 'gem', opts: { gemStep: st, type: 'blue' }, n: 1 });
  JOBS.push({ key: `gem_b${st}`, name: 'gem', opts: { gemStep: st, type: 'red' }, n: 1 });
}

function wav(samples, sr) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}

function trim(s) {
  let end = s.length - 1;
  while (end > 0 && Math.abs(s[end]) < 0.0004) end--;
  end = Math.min(s.length, end + Math.round(SR * 0.03));
  const t = s.slice(0, end);
  const f = Math.min(t.length, Math.round(SR * 0.02));
  for (let i = 0; i < f; i++) t[t.length - 1 - i] *= i / f;
  return t;
}

async function main() {
  await fs.mkdir(tmp, { recursive: true });
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });
  await build({ entryPoints: [path.join(root, 'tools/sfx_render_entry.js')], bundle: true, format: 'iife', outfile: path.join(tmp, 'entry.js'), logLevel: 'error' });
  await fs.writeFile(path.join(tmp, 'index.html'), '<!doctype html><script src="entry.js"></script>');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(tmp, 'index.html'));
  await page.waitForFunction(() => !!window.renderSfx);

  const rendered = [];
  for (const j of JOBS) {
    for (let v = 0; v < j.n; v++) {
      const raw = await page.evaluate(([n, o, sec, sr]) => window.renderSfx(n, o, sec, sr), [j.name, j.opts || {}, 3.6, SR]);
      rendered.push({ key: j.key, file: `${j.key}${j.n > 1 ? `_${v}` : ''}.wav`, s: trim(raw) });
    }
  }
  // 怪群环境声：渲染 8.5 秒，取稳定后的 5 秒 (LFO 0.6Hz 的整 3 周期)，尾部与开头前一段交叉淡化做成无缝循环
  const sw = await page.evaluate(([sec, sr]) => window.renderSwarm(sec, sr), [8.5, SR]);
  await browser.close();
  const L = SR * 5; const F = Math.round(SR * 0.25); const T0 = SR * 3;
  const loop = new Array(L);
  for (let i = 0; i < L; i++) {
    if (i < L - F) loop[i] = sw[T0 + i];
    else { const w = (i - (L - F)) / F; loop[i] = sw[T0 + i] * (1 - w) + sw[T0 + i - L] * w; }
  }
  // 群体环境声按强度 1 渲染：除以 maxGain 后与其他音效同样按 K 放大 (播放时 × 当前强度)
  rendered.push({ key: '__swarm', file: 'swarm_loop.wav', s: loop });

  const peak = Math.max(...rendered.map((r) => r.s.reduce((m, x) => Math.max(m, Math.abs(x)), 0)));
  const K = Math.min(36, 0.89 / peak);
  const files = {}; const dur = {};
  let bytes = 0;
  for (const r of rendered) {
    const tmpWav = path.join(tmp, r.file);
    await fs.writeFile(tmpWav, wav(r.s.map((x) => x * K), SR));
    const dst = path.join(out, r.file);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmpWav, '-ar', '22050', '-ac', '1', '-c:a', 'pcm_s16le', dst]);
    bytes += (await fs.stat(dst)).size;
    const src = `assets/sfx/${r.file}`;
    if (r.key === '__swarm') continue;
    (files[r.key] = files[r.key] || []).push(src);
    dur[src] = +(r.s.length / SR).toFixed(3);
  }
  const manifest = { gain: +K.toFixed(4), files, dur, swarm: 'assets/sfx/swarm_loop.wav' };
  await fs.writeFile(path.join(root, 'src/config/SfxManifest.js'),
    `// 由 tools/render_sfx.mjs 生成，请勿手改。抖音版预渲染音效清单 (网页版不用)。\n// gain = 文件相对网页版合成输出放大的倍数 (播放时除回来)\nexport const SFX_MANIFEST = ${JSON.stringify(manifest, null, 1)};\n`);
  await fs.rm(tmp, { recursive: true, force: true });
  console.log(`音效 ${rendered.length} 个文件，${(bytes / 1024).toFixed(0)} KB，放大 K=${K.toFixed(2)} (峰值 ${peak.toFixed(4)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
