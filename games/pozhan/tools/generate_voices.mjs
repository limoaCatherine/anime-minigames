// 用 VOICEVOX 引擎合成角色语音 -> assets/audio/voice/<who>_<group>_<n>.mp3 (流程沿用《美少女合成》系列)
// 台词、风格与调校参数来源: src/config/VoiceConfig.js (单一数据源)
// 前提: VOICEVOX 引擎已启动 (默认 http://127.0.0.1:50021)，例如:
//   Windows: 启动 VOICEVOX 应用即可；Linux: ./run --host 127.0.0.1 --port 50021
//   ffmpeg 在 PATH 中 (裁剪静音、EQ、齿音抑制、轻混响、响度统一到 -20 LUFS、转 mp3)
// 「去 AI 感」(v1.1): 每句标注情绪 → 选 VOICEVOX 风格 + 语速 1.15~1.3 / 抑扬 1.3~1.5 / 音高偏移；
//   逐音拍调整音高曲线 (句尾上扬 / 下沉、短语起伏、细微抖动)、句首轻吸气、首尾静音 0.05 秒、
//   每句 ±1.2% 音高/共振峰随机微移、很轻的房间混响、响度 -20 LUFS
// 用法: node tools/generate_voices.mjs [--engine http://127.0.0.1:50021] [--only start_1,lose_2]
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

async function loadConfig() {
  // VoiceConfig.js 是浏览器用的 ES 模块；复制成 .mjs 再导入
  const src = await fs.readFile(path.join(root, 'src/config/VoiceConfig.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `spotdiff-voiceconfig-${process.pid}.mjs`);
  await fs.writeFile(tmp, src);
  const mod = await import(pathToFileURL(tmp).href);
  await fs.rm(tmp, { force: true });
  return mod;
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text()}`);
  return res;
}

// ---------- 「去 AI 感」：逐个音拍 (mora) 手工调整音高曲线 ----------
// VOICEVOX 的 pitch 是 log(F0)；+0.06 ≈ +1 个半音。
const hash = (i, j, k = 0) => { const x = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
const voiced = (ap) => ap.moras.filter((m) => m.pitch > 0);

/**
 * 语调形状 (voice.contour)：
 *   up       开心/活泼：句尾上扬并稍微拖长 (「〜ね！」「〜よ！」)
 *   question 疑问：句尾明显上扬
 *   down     失落/害怕：句尾自然下沉并拖长一点，像叹气
 * 通用处理：整句轻微下倾 (declination)；每个短语开头的音拍稍低、第二拍抬起 (日语自然的「くの字」起伏)；
 *          音高与时长加入极小的确定性抖动，避免机械的完全平均；句中带「！」的短语也会小幅上扬。
 */
function shapeContour(q, v, line) {
  const aps = q.accent_phrases;
  const contour = v.contour || 'up';
  const drift = v.drift ?? 0.01;
  const rise = v.rise ?? 0.1;
  const exclaim = (line.tts.match(/[！!]/g) || []).length;
  aps.forEach((ap, i) => {
    const vm = voiced(ap);
    vm.forEach((m, j) => {
      m.pitch += -drift * i + hash(i, j) * 0.006;
      if (j === 0 && vm.length > 2 && ap.accent !== 1) m.pitch -= 0.025;     // 短语开头低起
      m.vowel_length *= 1 + hash(i, j, 1) * 0.05;
    });
    // 句中的「！」(短语后面有停顿)：小幅上扬
    if (exclaim && ap.pause_mora && i < aps.length - 1 && contour !== 'down' && vm.length) {
      vm[vm.length - 1].pitch += rise * 0.6;
    }
  });
  const last = aps[aps.length - 1];
  const vm = voiced(last);
  if (!vm.length) return;
  const end = vm[vm.length - 1]; const prev = vm[vm.length - 2];
  if (contour === 'up') {
    end.pitch += rise; if (prev) prev.pitch += rise * 0.4;
    end.vowel_length *= 1.18;
  } else if (contour === 'question') {
    last.is_interrogative = true;
    end.pitch += rise * 1.2; end.vowel_length *= 1.1;
  } else if (contour === 'down') {
    end.pitch -= rise * 0.7; if (prev) prev.pitch -= rise * 0.25;
    end.vowel_length *= 1.25;
  }
}

async function synth(line) {
  const v = line.voice;
  const q = await (await post(`${ENGINE}/audio_query?${new URLSearchParams({ text: line.tts, speaker: v.styleId })}`)).json();
  // 可选：用 AquesTalk 风格假名直接指定重音 (修正个别词的读法/重音)，例: "テ'ンサイダネ"
  if (v.kana) {
    q.accent_phrases = await (await post(`${ENGINE}/accent_phrases?${new URLSearchParams({ text: v.kana, speaker: v.styleId, is_kana: 'true' })}`)).json();
  }
  shapeContour(q, v, line);
  q.speedScale = v.speed ?? 1;
  q.pitchScale = v.pitch ?? 0;
  q.intonationScale = v.intonation ?? 1.3;
  q.volumeScale = 1;
  // 句中停顿：整体缩短 (pauseLengthScale) 并钳制上限 = 0.12 秒 × pause 系数，让语气轻快不拖沓
  q.pauseLengthScale = v.pauseScale ?? 0.5;
  for (const ap of q.accent_phrases) {
    if (ap.pause_mora) ap.pause_mora.vowel_length = Math.min(ap.pause_mora.vowel_length, 0.12 * (v.pause ?? 1));
  }
  q.prePhonemeLength = v.pre ?? 0.05;     // 句首 / 句尾静音很短 (之后 ffmpeg 还会再裁一次)
  q.postPhonemeLength = v.post ?? 0.05;
  q.outputSamplingRate = SR;
  q.outputStereo = false;
  const wav = Buffer.from(await (await post(`${ENGINE}/synthesis?speaker=${v.styleId}`, q)).arrayBuffer());
  return { wav, kana: v.kana || q.kana };
}

// ---------- 后期 ----------
const SR = 44100;
const TARGET_LUFS = -20;     // 与《美少女合成》统一的语音响度标准

/** 一口很轻的吸气声 (带通噪声 + 平滑包络)，放在句首，让台词更像真人开口 */
function breath(seconds = 0.17, level = 0.02, seed = 1) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 * 2 - 1; };
  let lp = 0; let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const x = rnd();
    lp += 0.35 * (x - lp);            // 低通 ~ 3 kHz
    lp2 += 0.04 * (lp - lp2);         // 再减去更低的部分 => 带通
    const t = i / n;
    const env = Math.sin(Math.PI * Math.pow(t, 0.7)) ** 2;
    out[i] = (lp - lp2) * env * level * 3;
  }
  return out;
}

const runFfmpeg = (args, input) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { input, maxBuffer: 64 << 20 });

/**
 * 后期: 裁静音 → 低切 100Hz → 轻微削减 4kHz 刺耳频段 → 齿音抑制 → (可选) 句首吸气声
 *       → 一点点「空气感」(10kHz 高架 +1.5dB) → 很轻的小房间混响 → 响度 -20 LUFS → 淡入/尾部留白
 */
function encode(wavPath, mp3Path, v, seed) {
  const pre = [
    'silenceremove=start_periods=1:start_threshold=-50dB',
    'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB', 'areverse',
    'highpass=f=100',
    'equalizer=f=4000:t=q:w=1.2:g=-2',
    'deesser=i=0.3:m=0.5:f=0.5',
  ].join(',');
  // 每句音高 / 共振峰随机微移 ±1.2% (同一角色每句略有不同，避免「复读机」感)
  const jitter = 1 + hash(seed, 3, 7) * 0.012;
  const raw = runFfmpeg(['-i', wavPath, '-af', `${pre},rubberband=pitch=${jitter.toFixed(4)}:formant=shifted`, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-']);
  let pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  if (v.breath) {
    let peak = 0; for (const x of pcm) peak = Math.max(peak, Math.abs(x));
    const b = breath(v.breathLen ?? 0.17, peak * (v.breath ?? 0.05), seed);
    const gap = Math.round(0.035 * SR);
    const joined = new Float32Array(b.length + gap + pcm.length);
    joined.set(b, 0); joined.set(pcm, b.length + gap);
    pcm = joined;
  }
  const post = [
    'treble=g=1.5:f=10000:w=0.7',
    `aecho=0.85:0.5:${v.room ?? '23|41'}:0.07|0.04`,       // 很轻的小房间早期反射
    `loudnorm=I=${TARGET_LUFS}:TP=-3:LRA=11`,
    'adelay=30',
    'afade=t=in:d=0.01',
    'apad=pad_dur=0.06',
  ].join(',');
  // loudnorm 对 1~2 秒的短句不够准：先出 PCM，再实测积分响度做第二遍增益校正 (目标 -20 LUFS ±0.5)
  const out = runFfmpeg(['-f', 'f32le', '-ac', '1', '-ar', String(SR), '-i', '-', '-af', post, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], Buffer.from(pcm.buffer));
  const I = measureLufs(out);
  // +0.45 dB: 补偿 mp3 编码与限幅的损失
  const gain = Number.isFinite(I) ? Math.max(-6, Math.min(8, TARGET_LUFS - I + 0.45)) : 0;
  runFfmpeg(['-f', 'f32le', '-ac', '1', '-ar', String(SR), '-i', '-', '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false`, '-ar', String(SR), '-ac', '1', '-b:a', '96k', mp3Path], out);
}

/** 实测积分响度 (EBU R128) */
function measureLufs(pcmBuf) {
  const res = spawnSync('ffmpeg', ['-nostats', '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-i', '-', '-af', 'ebur128', '-f', 'null', '-'], { input: pcmBuf, maxBuffer: 64 << 20 });
  const m = [...String(res.stderr).matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
  return m.length ? Number(m[m.length - 1][1]) : NaN;
}

async function main() {
  const ver = await (await fetch(`${ENGINE}/version`)).text().catch(() => null);
  if (!ver) throw new Error(`无法连接 VOICEVOX 引擎: ${ENGINE}`);
  console.log(`VOICEVOX engine ${ver}`);
  const { VOICE_LINES, VOICE_CAST, EMOTIONS } = await loadConfig();
  await fs.mkdir(path.join(root, 'assets/audio/voice'), { recursive: true });
  let n = 0;
  for (const line of VOICE_LINES) {
    if (ONLY && !ONLY.includes(line.id)) continue;
    const cast = VOICE_CAST[line.who];
    const emo = EMOTIONS[line.emo] || EMOTIONS.happy;
    // 风格按情绪选；参数 = 情绪模板 + 角色音高偏移 + 单句微调
    const styleId = (cast.styles && cast.styles[line.emo]) ?? cast.styleId;
    const voice = { ...cast, styleId, speed: emo.speed, intonation: emo.into, pitch: (cast.pitch || 0) + emo.pitch,
      contour: emo.contour, rise: emo.rise, breath: emo.breath, pauseScale: 0.4, ...line.tune };
    const { wav, kana } = await synth({ ...line, voice });
    const wavPath = path.join(os.tmpdir(), `spotdiff_${line.id}.wav`);
    await fs.writeFile(wavPath, wav);
    encode(wavPath, path.join(root, line.file), voice, ++n * 7 + line.group.length);
    await fs.rm(wavPath, { force: true });
    console.log(`ok ${line.id.padEnd(20)} ${cast.speaker}#${styleId} ${line.emo.padEnd(11)} x${voice.speed} ${kana}`);
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
