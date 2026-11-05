// 响度检查 / 音效校准 (Playwright + ffmpeg)
//   node tools/measure_audio.mjs              # 测量：音效 (离线渲染) / 语音 / BGM 的 LUFS 与峰值 -> docs/audio-levels.md
//   node tools/measure_audio.mjs --calibrate  # 按 TARGETS 重新计算 src/config/SfxTrim.js (之后需重新 build)
//
// 响度标准 (与《美少女合成》一致)：
//   语音文件 -20 LUFS、BGM 文件 -22 LUFS；默认播放音量 语音 0.3 / 音效 0.12 / BGM 0.15
//   音效以"最大瞬时响度 (Momentary max，400ms 窗)"计，引擎输出 (未乘 0.12) 的目标见 TARGETS：
//   三消/结算 ≈ -13~-14、拿牌 ≈ -18、界面音 ≈ -22~-28；乘以 0.12 后游戏内约 -31 ~ -46 LUFS，
//   低于语音 (-30.5 LUFS) 、高于或接近 BGM (-38.5 LUFS，台词时再 -5 dB)。
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAL = process.argv.includes('--calibrate');
const GAIN = { voice: 0.3, sfx: 0.12, bgm: 0.15 };
const db = (g) => 20 * Math.log10(g);

export const TARGETS = {
  click: -22, hover: -28, toggle: -22, tick: -24, whoosh: -26,
  pick: -18, land: -19, deal: -24, deny: -20,
  clear: -14, combo: -16, warn: -16, heartbeat: -18, moveOut: -16, undo: -17, shuffle: -17,
  revive: -14, star: -16, unlock: -15, start: -16,
  victory: -13, bigVictory: -13, gameover: -14,
};
const OPTS = { pick: { type: 3 }, clear: { combo: 1 }, combo: { combo: 3 }, heartbeat: { fast: true }, toggle: { on: true }, star: { index: 1 } };

function loud(file, fmtArgs = []) {
  const r = spawnSync('ffmpeg', ['-nostats', ...fmtArgs, '-i', file, '-af', 'apad=pad_dur=0.5,ebur128=peak=true:framelog=info', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const err = r.stderr;
  const M = [...err.matchAll(/M:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])).filter((v) => v > -120);
  const I = Number((err.match(/I:\s+(-?[\d.]+) LUFS/g) || ['I: -70']).pop().match(/-?[\d.]+/)[0]);
  const P = Number((err.match(/Peak:\s+(-?[\d.]+) dBFS/g) || ['Peak: -70']).pop().match(/-?[\d.]+/)[0]);
  return { I, Mmax: M.length ? Math.max(...M) : -70, peak: P };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loud-'));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
await page.waitForFunction(() => window.__ANIME_STACK__ && window.__ANIME_STACK__.debug && window.__ANIME_STACK__.scenes.currentName === 'menu', null, { timeout: 20000 });
const names = await page.evaluate(() => window.__ANIME_STACK__.debug.sfxNames());
const sfx = {};
for (const n of names) {
  const b64 = await page.evaluate(([n, o]) => window.__ANIME_STACK__.debug.renderSfx(n, o, n === 'bigVictory' || n === 'revive' ? 3.5 : 2.5), [n, OPTS[n] || {}]);
  const f = path.join(tmp, `${n}.f32`);
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  sfx[n] = loud(f, ['-f', 'f32le', '-ar', '44100', '-ac', '2']);
}
await browser.close();

if (CAL) {
  const cur = (await import(pathToFileURL(path.join(root, 'src/config/SfxTrim.js')).href + `?t=${Date.now()}`)).SFX_TRIM;
  const out = {};
  for (const n of names) {
    const t = TARGETS[n] ?? -18;
    const g = (cur[n] ?? 1) * Math.pow(10, (t - sfx[n].Mmax) / 20);
    out[n] = Math.round(g * 1000) / 1000;
  }
  const body = Object.entries(out).map(([k, v]) => `  ${k}: ${v},`).join('\n');
  fs.writeFileSync(path.join(root, 'src/config/SfxTrim.js'),
    `// 各音效的响度校准增益 (由 node tools/measure_audio.mjs --calibrate 自动生成；目标见该脚本 TARGETS)。\nexport const SFX_TRIM = {\n${body}\n};\n`);
  console.log('SfxTrim.js 已更新：', out);
}

const rows = [];
for (const n of names) rows.push({ cat: '音效', name: n, ...sfx[n], game: sfx[n].Mmax + db(GAIN.sfx), target: TARGETS[n] });
const vdir = path.join(root, 'assets/audio/voice');
for (const f of fs.readdirSync(vdir).filter((x) => x.endsWith('.mp3')).sort()) {
  const m = loud(path.join(vdir, f));
  rows.push({ cat: '语音', name: f.replace('.mp3', ''), ...m, game: m.I + db(GAIN.voice) });
}
const bdir = path.join(root, 'assets/audio/bgm');
for (const f of fs.readdirSync(bdir).filter((x) => x.endsWith('.ogg')).sort()) {
  const m = loud(path.join(bdir, f));
  rows.push({ cat: 'BGM', name: f.replace('.ogg', ''), ...m, game: m.I + db(GAIN.bgm) });
}
fs.rmSync(tmp, { recursive: true, force: true });

const fx = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const summary = (cat, key) => {
  const r = rows.filter((x) => x.cat === cat);
  const v = r.map((x) => x[key]);
  return { n: r.length, min: Math.min(...v), max: Math.max(...v), avg: v.reduce((a, b) => a + b, 0) / v.length, peak: Math.max(...r.map((x) => x.peak)), game: r.map((x) => x.game) };
};
const S = { sfx: summary('音效', 'Mmax'), voice: summary('语音', 'I'), bgm: summary('BGM', 'I') };
let md = '# 响度测量 (node tools/measure_audio.mjs)\n\n';
md += '| 类别 | 数量 | 文件/引擎响度 | 最高峰值 | 默认音量 | 游戏内响度 |\n| --- | --- | --- | --- | --- | --- |\n';
md += `| 语音 (积分 LUFS) | ${S.voice.n} | ${fx(S.voice.min)} ~ ${fx(S.voice.max)} (平均 ${fx(S.voice.avg)}) | ${fx(S.voice.peak)} dBFS | 0.30 | ≈ ${fx(S.voice.avg + db(0.3))} LUFS |\n`;
md += `| BGM (积分 LUFS) | ${S.bgm.n} | ${fx(S.bgm.min)} ~ ${fx(S.bgm.max)} | ${fx(S.bgm.peak)} dBFS | 0.15 | ≈ ${fx(S.bgm.avg + db(0.15))} LUFS (台词时 ×0.55 → ${fx(S.bgm.avg + db(0.15 * 0.55))}) |\n`;
md += `| 音效 (瞬时最大 LUFS) | ${S.sfx.n} | ${fx(S.sfx.min)} ~ ${fx(S.sfx.max)} | ${fx(S.sfx.peak)} dBFS | 0.12 | ${fx(S.sfx.min + db(0.12))} ~ ${fx(S.sfx.max + db(0.12))} LUFS |\n\n`;
md += '| 类别 | 名称 | 积分 LUFS | 瞬时最大 LUFS | 峰值 dBFS | 目标 | 游戏内 (×默认音量) |\n| --- | --- | --- | --- | --- | --- | --- |\n';
for (const r of rows) md += `| ${r.cat} | ${r.name} | ${fx(r.I)} | ${fx(r.Mmax)} | ${fx(r.peak)} | ${r.target ?? ''} | ${fx(r.game)} |\n`;
fs.writeFileSync(path.join(root, 'docs/audio-levels.md'), md);
console.log(md.split('\n').slice(0, 7).join('\n'));
const bad = rows.filter((r) => r.cat === '音效' && Math.abs(r.Mmax - r.target) > 1.5);
console.log(bad.length ? `偏离目标 >1.5 dB 的音效: ${bad.map((b) => `${b.name} ${fx(b.Mmax)}/${b.target}`).join(', ')}` : '✔ 全部音效在目标 ±1.5 dB 内');
