// 用 VOICEVOX 引擎合成角色语音 (v1.1 真人化版) -> assets/audio/voice/<角色>_<分组>_<n>.mp3
// 台词 / 情绪 / 风格声线 / 语调参数来源: src/config/VoiceConfig.js (单一数据源)
// 前提: VOICEVOX 引擎已启动 (默认 http://127.0.0.1:50021)；ffmpeg 在 PATH 中
//
// 处理流程 (v1.3.2 去沙哑版，参数见 VoiceConfig.js)：
//  1. 情绪 → 同一声优的「干净」风格声线 (ノーマル / あまあま / ツンツン …)，不用 ささやき 等气声类声线；speedScale 1.13~1.22
//  2. prePhonemeLength / postPhonemeLength 压到几乎为 0，句中停顿缩短并封顶，不拖沓
//  3. 音高只做轻微整形：短语内起伏 ×≤1.05、整句轻微下倾、情绪对应的句尾形状 (up / question / down / punch / smug / trail / flat)。
//     v1.1 的逐音拍随机抖动、元音时长随机化会让声码器出伪影 (谐噪比明显变低、听感发沙)，已去掉
//  4. 多句台词按「。！？」分句合成；只有 ≥2 句且较长的台词在句间留一口很轻的换气，不再有句首吸气 / 句尾叹气
//  5. 后期：裁静音 → 低切 80Hz → 11.5kHz 以上滤掉 (引擎 24kHz 原生，上面只有重采样残留) → 3.5kHz 轻削 → 轻度齿音抑制
//     → 线性增益对齐 -20 LUFS → 限幅 (留 headroom) → 160kbps / 44.1kHz mp3，编码后复测：true peak ≤ -1 dBTP、无削波、响度 -20±0.5
//     (v1.1 的「气声层」高频噪声、高频提升、房间混响全部去掉)
// 用法: node tools/generate_voices.mjs [--engine http://127.0.0.1:50021] [--only hikari_start_1,nox_defeat_2] [--missing] [--report out.json]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const ENGINE = opt('--engine', 'http://127.0.0.1:50021');
const ONLY = opt('--only', '') ? opt('--only').split(',') : null;
const REPORT = opt('--report', '');
const MISSING = args.includes('--missing');   // 只补生成缺的文件 (中断后续跑)
const SR = 44100;
const TARGET_LUFS = -20;

async function loadConfig() {
  const src = await fs.readFile(path.join(root, 'src/config/VoiceConfig.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `survivor-voiceconfig-${process.pid}.mjs`);
  await fs.writeFile(tmp, src);
  const mod = await import(pathToFileURL(tmp).href);
  await fs.rm(tmp, { force: true });
  return mod;
}

async function post(url, body, tries = 4) {
  for (let k = 1; ; k++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text()}`);
      return res;
    } catch (err) {   // 引擎忙 / 偶发断连：退避重试
      if (k >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * k));
    }
  }
}

// ---------- 音高曲线 ----------
const voiced = (ap) => ap.moras.filter((m) => m.pitch > 0);

function shapeContour(q, v, isLast, seed) {
  const aps = q.accent_phrases;
  const amp = Math.min(v.amp ?? 1.0, 1.05); const rise = Math.min(v.rise ?? 0.04, 0.06);
  const contour = isLast ? (v.contour || 'up') : (v.contour === 'question' ? 'flat' : v.contour);
  aps.forEach((ap, i) => {
    const vm = voiced(ap);
    if (!vm.length) return;
    const mean = vm.reduce((s, m) => s + m.pitch, 0) / vm.length;
    vm.forEach((m, j) => {
      m.pitch = mean + (m.pitch - mean) * amp;                       // 起伏轻微放大
      m.pitch += -0.006 * i;                                           // 整句轻微下倾
    });
  });
  const last = aps[aps.length - 1];
  const vm = voiced(last);
  if (!vm.length) return;
  const end = vm[vm.length - 1]; const prev = vm[vm.length - 2];
  switch (contour) {
    case 'up': end.pitch += rise; if (prev) prev.pitch += rise * 0.35; end.vowel_length *= 1.06; break;
    case 'question': last.is_interrogative = true; end.pitch += rise * 1.1; break;
    case 'down': end.pitch -= rise * 0.8; if (prev) prev.pitch -= rise * 0.3; end.vowel_length *= 1.1; break;
    case 'punch': // 喝声：第一拍顶上去，整句收紧，尾音短而有力
      if (vm[0]) vm[0].pitch += rise * 0.6;
      for (const m of vm) m.vowel_length *= 0.95;
      end.pitch += rise * 0.25;
      break;
    case 'smug': // 得意：倒数第二拍上扬，尾音落下来、稍长
      if (prev) prev.pitch += rise * 0.7;
      end.pitch -= rise * 0.3; end.vowel_length *= 1.08;
      break;
    case 'trail': // 害羞 / 悄悄话：尾音轻轻下沉并拖长
      end.pitch -= rise * 0.5; end.vowel_length *= 1.12;
      break;
    default: // flat
      end.pitch -= rise * 0.2;
  }
}

async function synthSegment(text, v, isLast, seed) {
  const q = await (await post(`${ENGINE}/audio_query?${new URLSearchParams({ text, speaker: v.styleId })}`)).json();
  shapeContour(q, v, isLast, seed);
  q.speedScale = Math.min(1.22, Math.max(1.13, v.speed ?? 1.18));
  q.pitchScale = v.pitch ?? 0;
  q.intonationScale = Math.min(v.intonation ?? 1.15, 1.25);
  q.volumeScale = 1;
  q.pauseLengthScale = 0.35;
  for (const ap of q.accent_phrases) if (ap.pause_mora) ap.pause_mora.vowel_length = Math.min(ap.pause_mora.vowel_length, 0.09);
  q.prePhonemeLength = 0.0;
  q.postPhonemeLength = 0.02;
  q.outputSamplingRate = SR;
  q.outputStereo = false;
  const wav = Buffer.from(await (await post(`${ENGINE}/synthesis?speaker=${v.styleId}`, q)).arrayBuffer());
  const moras = q.accent_phrases.reduce((s, ap) => s + ap.moras.length, 0);
  return { wav, moras, kana: q.kana };
}

// ---------- 音频工具 ----------
const runFfmpeg = (a, input) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { input, maxBuffer: 64 << 20 });
const toPcm = (wav, filters) => { const raw = runFfmpeg(['-i', '-', ...(filters ? ['-af', filters] : []), '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], wav); return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length)); };
const peakOf = (x) => { let p = 0; for (const s of x) p = Math.max(p, Math.abs(s)); return p; };

function rng(seed) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 * 2 - 1; }; }

/** 换气声：带通噪声 + 平滑包络。inhale = 吸气 (渐强后快收)，exhale = 叹气 (快起慢收、更暗) */
function breath(seconds, level, seed, kind = 'inhale') {
  const n = Math.round(seconds * SR); const out = new Float32Array(n); const r = rng(seed);
  let lp = 0; let lp2 = 0;
  const a1 = kind === 'inhale' ? 0.35 : 0.2; const a2 = kind === 'inhale' ? 0.05 : 0.03;
  for (let i = 0; i < n; i++) {
    const x = r(); lp += a1 * (x - lp); lp2 += a2 * (lp - lp2);
    const t = i / n;
    const env = kind === 'inhale' ? Math.sin(Math.PI * Math.pow(t, 0.65)) ** 2 : Math.pow(1 - t, 1.6) * Math.min(1, t * 12);
    out[i] = (lp - lp2) * env * level * 3;
  }
  return out;
}

function concat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0); const out = new Float32Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const silence = (sec) => new Float32Array(Math.round(sec * SR));

const TP_MAX = -1.0;   // true peak 上限 (dBTP)
const MP3_KBPS = '160k';

/** 平铺 4 遍测响度 / true peak (短句 <0.4s 的 integrated loudness 测不出来，平铺后响度不变) */
function measure(args, input) {
  const m = spawnSync('ffmpeg', ['-hide_banner', ...args, '-af', 'aloop=loop=3:size=2000000000,ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { input, maxBuffer: 64 << 20 });
  const txt = m.stderr.toString();
  const I = [...txt.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop(); const tp = [...txt.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop();
  return { I: I ? Number(I[1]) : null, tp: tp ? Number(tp[1]) : null };
}
const pcmArgs = ['-f', 'f32le', '-ac', '1', '-ar', String(SR), '-i', '-'];

/** 线性增益对齐 -20 LUFS → 限幅 (只削偶发峰值) → mp3。编码后复测 (mp3 解码会产生样本间峰值)，不达标就修正增益 / 收紧限幅再编一次 */
function encodeFinal(pcm, mp3Path) {
  const buf = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const m0 = measure(pcmArgs, buf);
  let gain = Math.max(-12, Math.min(20, TARGET_LUFS - (m0.I ?? -24)));
  let limit = -2.5;   // 限幅门限 dBFS：给 mp3 编码留 headroom
  let res = null;
  for (let k = 0; k < 5; k++) {
    runFfmpeg([...pcmArgs, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${(10 ** (limit / 20)).toFixed(4)}:attack=3:release=60:level=false,adelay=20,afade=t=in:d=0.006,apad=pad_dur=0.1`,
      '-ar', String(SR), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', MP3_KBPS, mp3Path], buf);
    res = measure(['-i', mp3Path]);
    const dI = TARGET_LUFS - res.I; const overTp = res.tp - TP_MAX;
    if (Math.abs(dI) <= 0.4 && overTp <= -0.1) break;
    if (overTp > -0.1) limit -= overTp + 0.3;
    gain += dI;
  }
  return { gain: +gain.toFixed(2), limit: +limit.toFixed(2), lufs: res.I, tp: res.tp };
}

// 裁首尾静音 → 低切 → 引擎原生 24kHz，11.5k 以上只剩重采样残留 → 3.5k 附近轻削 1.5dB → 轻度齿音抑制
const CLEAN = ['silenceremove=start_periods=1:start_threshold=-50dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB', 'areverse',
  'highpass=f=80', 'lowpass=f=11500', 'equalizer=f=3500:t=q:w=1.4:g=-1.5', 'deesser=i=0.2:m=0.5:f=0.5:s=o'].join(',');

async function render(line, seed) {
  const v = line.voice;
  // 分句：保留句末标点 (影响语调)；「、」不分句
  const segs = line.tts.match(/[^。！？!?]+[。！？!?]*/g).map((s) => s.trim()).filter((s) => s.replace(/[。！？!?、ー]/g, '').length);
  const longLine = segs.length >= 2 && line.tts.replace(/[。！？!?、ーっ\s]/g, '').length >= 14;
  const parts = []; let moras = 0; const kana = [];
  for (let i = 0; i < segs.length; i++) {
    const r = await synthSegment(segs[i], v, i === segs.length - 1, seed + i * 13);
    moras += r.moras; kana.push(r.kana);
    const pcm = toPcm(r.wav, CLEAN);
    if (i > 0) {
      const endsHard = /[。]$/.test(segs[i - 1]);
      // 换气只留在长台词的句间，而且很轻 (峰值的 2.5%)
      if (endsHard && longLine) parts.push(silence(0.05), breath(0.11, peakOf(pcm) * 0.025, seed + i, 'inhale'), silence(0.03));
      else parts.push(silence(endsHard ? 0.1 : 0.07));
    }
    parts.push(pcm);
  }
  const enc = encodeFinal(concat(parts), path.join(root, line.file));
  return { moras, kana: kana.join(' / '), segs: segs.length, ...enc };
}

async function main() {
  const ver = await (await fetch(`${ENGINE}/version`)).text().catch(() => null);
  if (!ver) throw new Error(`无法连接 VOICEVOX 引擎: ${ENGINE}`);
  console.log(`VOICEVOX engine ${ver}`);
  const { ALL_VOICE_LINES } = await loadConfig();
  const dir = path.join(root, 'assets/audio/voice');
  await fs.mkdir(dir, { recursive: true });
  if (!ONLY && !MISSING) for (const f of await fs.readdir(dir)) if (f.endsWith('.mp3')) await fs.rm(path.join(dir, f));   // 清掉旧版文件
  const report = {};
  for (const line of ALL_VOICE_LINES) {
    const id = `${line.who}_${line.group}_${line.index + 1}`;
    if (ONLY && !ONLY.includes(id)) continue;
    if (MISSING && await fs.stat(path.join(root, line.file)).then(() => true, () => false)) continue;
    const seed = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
    const r = await render(line, seed);
    report[id] = { emo: line.emo, style: line.voice.style, speed: line.voice.speed, moras: r.moras, segs: r.segs, gain: r.gain, limit: r.limit, lufs: r.lufs, tp: r.tp };
    console.log(`ok ${id.padEnd(22)} ${line.emo.padEnd(7)} ${line.voice.speaker}(${line.voice.style}) x${line.voice.speed} ${r.lufs}LUFS ${r.tp}dBTP ${r.kana}`);
  }
  if (REPORT) await fs.writeFile(REPORT, JSON.stringify(report, null, 1));
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
