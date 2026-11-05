// 合成角色语音 -> assets/audio/voice/<id>.mp3 (AivisSpeech Engine HTTP API，与 VOICEVOX 相同的接口)
// 台词、情绪、声线、调校参数的唯一数据源：src/config/VoiceConfig.js (lineVoice() 给出每句的模型/风格/参数)
//
// 流程：
//   1) audio_query (按情绪选的风格 styleId)
//   2) 设置 speedScale 1.15~1.25、intonationScale = 情绪强度、tempoDynamicsScale = 语速缓急、
//      pitchScale 只做 ±0.03 的微调；句首/句尾留白与句中停顿都缩短
//   3) synthesis -> wav (AivisSpeech 每次结果都略有不同，所以每句生成多个候选)
//   4) tools/voice_post.py：裁静音 → 低切 → 很轻的房间混响 → 齿音抑制 → 精确增益到 -20 LUFS → mp3 96kbps
//   5) python tools/pick_voice_takes.py <out>：语音识别过滤读错的候选，再挑最有表现力的一条
//
// 用法 (需 AivisSpeech Engine、ffmpeg、python3 + numpy)：
//   Linux:   AivisSpeech-Engine-Linux-x64/run --port 10101      Windows: 启动 AivisSpeech 即可
//   node tools/generate_voices.mjs --engine http://127.0.0.1:10101 --takes 8 --out build/voice-takes [--only c01_1,win_1]
//   python tools/pick_voice_takes.py build/voice-takes
// 缺少的模型会自动从 AivisHub 安装 (VOICES[*].modelUuid)。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const ENGINE = opt('--engine', 'http://127.0.0.1:10101');
const RESUME = args.includes('--resume');
const ONLY = opt('--only', '') ? opt('--only').split(',') : null;
const TAKES = Math.max(1, Number(opt('--takes', 1)));
const OUT = opt('--out', null);
const PY = opt('--python', process.platform === 'win32' ? 'python' : 'python3');

// 候选之间的小差异 (再加上引擎本身的随机性)：情绪强度 / 语速缓急 / 语速
const VARIANTS = [
  { k: 1.0, t: 1.0, s: 1.0 },
  { k: 1.12, t: 1.08, s: 1.0 },
  { k: 0.92, t: 1.0, s: 1.02 },
  { k: 1.06, t: 1.15, s: 0.98 },
  { k: 1.2, t: 1.05, s: 1.02 },
  { k: 1.0, t: 1.2, s: 1.0 },
  { k: 0.96, t: 1.1, s: 1.03 },
  { k: 1.15, t: 1.0, s: 0.99 },
];

async function loadConfig() {
  const src = await fs.readFile(path.join(root, 'src/config/VoiceConfig.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `voiceconfig-${process.pid}.mjs`);
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

async function ensureModel(v, installed) {
  if (installed.has(v.modelUuid)) return;
  console.log(`  安装 AivisHub 模型 ${v.model} (${v.modelUuid}) ...`);
  const form = new FormData();
  form.append('url', `https://api.aivis-project.com/v1/aivm-models/${v.modelUuid}/download?model_type=AIVMX`);
  await post(`${ENGINE}/aivm_models/install`, null, form);
  installed.add(v.modelUuid);
}

async function synth(line, v, variant) {
  const q = await (await post(`${ENGINE}/audio_query?${new URLSearchParams({ text: line.tts, speaker: v.styleId })}`)).json();
  q.speedScale = +(v.speed * variant.s).toFixed(3);
  q.intonationScale = +(v.intensity * variant.k).toFixed(3);   // AivisSpeech：风格(情绪)强度
  q.tempoDynamicsScale = +(v.tempo * variant.t).toFixed(3);    // 语速缓急，越大越"生"
  q.pitchScale = v.pitch;                                       // 只做 ±0.03 的微调 (过大会劣化音质)
  q.volumeScale = 1;
  q.prePhonemeLength = 0.04;
  q.postPhonemeLength = 0.06;
  if ('pauseLengthScale' in q) q.pauseLengthScale = 0.6;       // 句中停顿短一点
  q.outputSamplingRate = 44100;
  q.outputStereo = false;
  return Buffer.from(await (await post(`${ENGINE}/synthesis?speaker=${v.styleId}`, q)).arrayBuffer());
}

async function main() {
  const { VOICE_LINES, lineVoice, voiceFile } = await loadConfig();
  const ver = await (await fetch(`${ENGINE}/version`)).text().catch(() => null);
  if (!ver) throw new Error(`无法连接 AivisSpeech 引擎: ${ENGINE}`);
  console.log(`AivisSpeech engine ${ver} @ ${ENGINE}`);
  const installed = new Set(Object.keys(await (await fetch(`${ENGINE}/aivm_models`)).json()));
  const outDir = OUT ? path.resolve(root, OUT) : path.join(root, 'assets/audio/voice');
  await fs.mkdir(outDir, { recursive: true });
  for (const line of VOICE_LINES) {
    if (ONLY && !ONLY.includes(line.id)) continue;
    const v = lineVoice(line);
    await ensureModel(v, installed);
    for (let k = 1; k <= TAKES; k++) {
      const dest0 = OUT ? path.join(outDir, `${line.id}_take${k}.mp3`) : path.join(root, voiceFile(line));
      if (RESUME && (await fs.stat(dest0).then((st) => st.size > 1000, () => false))) continue;   // --resume：已有的 take 跳过
      const wav = await synth(line, v, VARIANTS[(k - 1) % VARIANTS.length]);
      const wavPath = path.join(os.tmpdir(), `as_voice_${line.id}_${k}.wav`);
      await fs.writeFile(wavPath, wav);
      const dest = OUT ? path.join(outDir, `${line.id}_take${k}.mp3`) : path.join(root, voiceFile(line));
      execFileSync(PY, [path.join(root, 'tools/voice_post.py'), wavPath, dest, String(v.reverb), 'off'], { stdio: 'inherit' });
      await fs.rm(wavPath, { force: true });
      console.log(`ok ${line.id}${TAKES > 1 ? ` take${k}` : ''} ${v.model}(${v.style}) [${line.emotion}] ${line.text}`);
    }
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
