#!/usr/bin/env python3
"""
pick_voice_takes.py — 从多个候选语音中挑一条 (类似配音录制时的 "选 take")

AivisSpeech 每次合成的结果都略有不同 (偶尔读错、偶尔很平)。本脚本：
  1. 用 faster-whisper 把每个候选转写成文字，与朗读文本 (转平假名后) 比较字符错误率 (CER)，过滤掉读错的候选
     (保留 CER ≤ 最好成绩 + 0.05 且 ≤ 0.3 的)
  2. 在剩下的候选里挑"最有表现力"的一条：音高起伏 (半音标准差，上限 6) + 响度起伏 (逐帧 dB 标准差)，
     时长超出 1.2~3.3 秒的扣分
结果写入 <dir>/picked.json，并复制到 assets/audio/voice/<id>.mp3

用法:
    node tools/generate_voices.mjs --takes 8 --out build/voice-takes
    pip install faster-whisper pykakasi numpy      # 另需 ffmpeg
    python tools/pick_voice_takes.py build/voice-takes [--model small] [--dry-run]
"""
import argparse, glob, json, os, re, shutil, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_lines():
    """用 node 读取 VoiceConfig.js 的台词 (id, 朗读文本)"""
    js = "import('./src/config/VoiceConfig.js').then(m=>console.log(JSON.stringify(m.VOICE_LINES.map(l=>[l.id,l.tts]))))"
    out = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [(f'assets/audio/voice/{i}.mp3', t) for i, t in json.loads(out)]

def pcm16k(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def pitch_std(x, sr=16000):
    win, hop, f0 = 640, 160, []
    for i in range(0, len(x) - win, hop):
        f = x[i:i + win].astype(float)
        if np.sqrt((f ** 2).mean()) < 0.015: continue
        f -= f.mean(); ac = np.correlate(f, f, 'full')[win - 1:]
        lo, hi = sr // 700, sr // 110; k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] / ac[0] > 0.45: f0.append(sr / k)
    if len(f0) < 5: return 0.0
    v = np.array(f0); return float((12 * np.log2(v / np.median(v))).std())

def dynamics(x, sr=16000):
    hop = sr // 50
    e = np.array([np.sqrt((x[i:i + hop] ** 2).mean()) for i in range(0, len(x) - hop, hop)])
    e = e[e > 0.01]
    return float((20 * np.log10(e)).std()) if len(e) > 5 else 0.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir'); ap.add_argument('--model', default='small'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    from faster_whisper import WhisperModel
    import pykakasi
    kks = pykakasi.kakasi()
    kana = lambda s: ''.join(t['hira'] for t in kks.convert(re.sub(r'[、。！？…!?♡♪\s「」,.ー〜]', '', s)))
    def cer(ref, hyp):
        d = list(range(len(hyp) + 1))
        for i, c in enumerate(ref, 1):
            p = d[:]; d[0] = i
            for j, h in enumerate(hyp, 1): d[j] = min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (c != h))
        return d[len(hyp)] / max(1, len(ref))
    model = WhisperModel(a.model, device='cpu', compute_type='int8')
    report = []
    for file, tts in load_lines():
        stem = os.path.basename(file).replace('.mp3', '')
        takes = sorted(glob.glob(os.path.join(a.dir, f'{stem}_take*.mp3')))
        if not takes: continue
        scored = []
        for t in takes:
            x = pcm16k(t)
            segs, _ = model.transcribe(x, language='ja', beam_size=5)
            txt = ''.join(s.text for s in segs)
            st, dyn, dur = pitch_std(x), dynamics(x), len(x) / 16000
            expr = min(st, 6.0) + 0.25 * min(dyn, 10.0) - (2.0 if not 1.2 <= dur <= 3.3 else 0)
            scored.append(dict(cer=round(cer(kana(tts), kana(txt)), 3), expr=round(expr, 2), st=round(st, 2), dyn=round(dyn, 2), dur=round(dur, 2), take=t, asr=txt))
        best_cer = min(s['cer'] for s in scored)
        ok = [s for s in scored if s['cer'] <= min(0.3, best_cer + 0.05)] or [min(scored, key=lambda s: s['cer'])]
        best = max(ok, key=lambda s: s['expr'])
        print(f"{stem}: 选 {os.path.basename(best['take'])} CER={best['cer']:.2f} 表现力={best['expr']:.2f} (音高 {best['st']}st, 响度 {best['dyn']}dB, {best['dur']}s) 「{best['asr']}」 "
              f"候选 CER {[s['cer'] for s in scored]}")
        report.append({'file': file, 'take': os.path.basename(best['take']), 'cer': best['cer'], 'expr': best['expr'], 'pitch_st': best['st'], 'dur': best['dur'], 'asr': best['asr'],
                       'candidates': len(scored), 'passed_asr': len(ok)})
        if not a.dry_run: shutil.copyfile(best['take'], os.path.join(ROOT, file))
    json.dump(report, open(os.path.join(a.dir, 'picked.json'), 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
