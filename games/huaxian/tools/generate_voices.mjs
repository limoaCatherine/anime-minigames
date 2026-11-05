// 合成主角语音 -> assets/audio/voice/<group>_<n>.mp3
// 台词、情绪、模型 / 风格与调校参数来源: src/config/VoiceConfig.js (单一数据源)
// 引擎: AivisSpeech Engine (Style-Bert-VITS2 系，VOICEVOX 兼容 API，默认 http://127.0.0.1:10101)
//   Windows: 安装并启动 AivisSpeech 即可；Linux: AivisSpeech-Engine-Linux-x64/run --host 127.0.0.1 --port 10101
//   缺少的模型 (voice.modelUuid) 会自动从 AivisHub 安装；ffmpeg 需在 PATH 中
// 后期: 裁静音、压缩句中停顿、EQ、齿音抑制、句首轻吸气、很轻的房间混响、响度统一到 -20 LUFS、转 mp3
//
// AivisSpeech 每次合成结果都略有不同 (语气、偶尔读错)，所以按「录音选 take」的方式做：
//   node tools/generate_voices.mjs --takes 8 --out build/voice-takes      # 每句 8 个候选 + lines.json
//   python tools/pick_voice_takes.py build/voice-takes                    # Whisper 筛读音，挑感情最丰富的一条复制到 assets
// 只生成一遍 (不挑): node tools/generate_voices.mjs [--only start_1,lose_2]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const ENGINE = opt('--aivis', opt('--engine', 'http://127.0.0.1:10101'));
const ONLY = opt('--only', '') ? opt('--only').split(',') : null;
const TAKES = Math.max(1, Number(opt('--takes', 1)));
const OUT = opt('--out', null);

async function loadConfig() {
  // VoiceConfig.js 是浏览器用的 ES 模块；复制成 .mjs 再导入
  const src = await fs.readFile(path.join(root, 'src/config/VoiceConfig.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `drawline-voiceconfig-${process.pid}.mjs`);
  await fs.writeFile(tmp, src);
  const mod = await import(pathToFileURL(tmp).href);
  await fs.rm(tmp, { force: true });
  return mod;
}

async function post(url, body, form) {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text()}`);
  return res;
}

/** 确保模型已安装 (缺少时从 AivisHub 安装) */
async function ensureModel(v, installed) {
  if (!v.modelUuid || installed.has(v.modelUuid)) return;
  console.log(`  安装 AivisHub 模型 ${v.model} (${v.modelUuid}) ...`);
  const form = new FormData();
  form.append('url', `https://api.aivis-project.com/v1/aivm-models/${v.modelUuid}/download?model_type=AIVMX`);
  await post(`${ENGINE}/aivm_models/install`, null, form);
  installed.add(v.modelUuid);
}

async function synth(line, installed) {
  const v = line.voice;
  await ensureModel(v, installed);
  const q = await (await post(`${ENGINE}/audio_query?${new URLSearchParams({ text: line.tts, speaker: v.styleId })}`)).json();
  q.speedScale = v.speed ?? 1.15;
  q.intonationScale = v.intonation ?? 1.3;   // AivisSpeech: 风格 (感情) 强度
  q.tempoDynamicsScale = v.tempo ?? 1.2;     // 语速缓急，越大越像真人说话 (有快有慢)
  q.pitchScale = v.pitch ?? 0;               // 只做 ±0.03 以内微调 (过大会劣化音质)
  q.volumeScale = 1;
  q.prePhonemeLength = v.pre ?? 0.03;
  q.postPhonemeLength = v.post ?? 0.06;
  q.outputSamplingRate = SR;
  q.outputStereo = false;
  const wav = Buffer.from(await (await post(`${ENGINE}/synthesis?speaker=${v.styleId}`, q)).arrayBuffer());
  return { wav, kana: q.kana };
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
    // 句中停顿 (「、」处) 过长显得机械：超过 0.12 秒的静音压缩到 0.08 秒
    'silenceremove=stop_periods=-1:stop_duration=0.12:stop_threshold=-40dB:stop_silence=0.08',
    'highpass=f=100',
    'equalizer=f=4000:t=q:w=1.2:g=-2',
    'deesser=i=0.3:m=0.5:f=0.5',
  ].join(',');
  const raw = runFfmpeg(['-i', wavPath, '-af', pre, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-']);
  let pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  if (v.breath !== false) {
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
    'apad=pad_dur=0.12',
  ].join(',');
  runFfmpeg(['-f', 'f32le', '-ac', '1', '-ar', String(SR), '-i', '-', '-af', post, '-ar', String(SR), '-ac', '1', '-b:a', '96k', mp3Path], Buffer.from(pcm.buffer));
}

async function main() {
  const ver = await (await fetch(`${ENGINE}/version`)).text().catch(() => null);
  if (!ver) throw new Error(`无法连接 AivisSpeech 引擎: ${ENGINE}`);
  console.log(`AivisSpeech engine ${ver} @ ${ENGINE}`);
  const installed = new Set(Object.keys(await (await fetch(`${ENGINE}/aivm_models`)).json()));
  const { ALL_VOICE_LINES, VOICE_SPEAKER } = await loadConfig();
  const outDir = OUT ? path.resolve(root, OUT) : path.join(root, 'assets/audio/voice');
  await fs.mkdir(outDir, { recursive: true });
  if (OUT) await fs.writeFile(path.join(outDir, 'lines.json'), JSON.stringify(ALL_VOICE_LINES.map((l) => ({ file: l.file, tts: l.tts, emo: l.emo, text: l.text })), null, 1));
  for (const line of ALL_VOICE_LINES) {
    const id = `${line.group}_${line.index + 1}`;
    if (ONLY && !ONLY.includes(id)) continue;
    for (let k = 1; k <= TAKES; k++) {
      const { wav, kana } = await synth(line, installed);
      const wavPath = path.join(os.tmpdir(), `drawline_${id}.wav`);
      await fs.writeFile(wavPath, wav);
      const dest = OUT ? path.join(outDir, `${path.basename(line.file, '.mp3')}_take${k}.mp3`) : path.join(root, line.file);
      encode(wavPath, dest, line.voice, line.index + 1 + line.group.length * 7 + k * 13);
      await fs.rm(wavPath, { force: true });
      console.log(`ok ${id.padEnd(9)}${TAKES > 1 ? ` take${k}` : ''} ${VOICE_SPEAKER.name}(${line.voice.style}) ${line.emo} x${line.voice.speed} ${kana}`);
    }
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
