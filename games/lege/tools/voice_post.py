#!/usr/bin/env python3
"""voice_post.py <in.wav> <out.mp3> [reverb_wet] [breath_db|off]
语音后期 (generate_voices.mjs 调用)，让合成语音少一点"机器味"：
  裁首尾静音 → 低切 90Hz → 轻微气声 (2.5~9kHz 噪声，跟随语音包络，约 -26 dB) → 小房间混响 (约 0.3 秒)
  → ffmpeg：轻微削减 4kHz 刺耳频段、齿音抑制 → 测量后精确增益到 -20 LUFS (限幅 -3 dBFS) → mp3 96kbps 单声道
用 python tools/voice_post.py --fix a.mp3 b.mp3 ... 可把已有文件重新校正到 -20 LUFS。
需要 numpy 与 ffmpeg。
"""
import os, re, subprocess, sys, tempfile, wave
import numpy as np

TARGET_LUFS = -20
SR = 44100

def read_wav(p):
    with wave.open(p, 'rb') as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), '<i2').astype(np.float64) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    if sr != SR:
        t = np.arange(int(len(x) * SR / sr)) * sr / SR
        x = np.interp(t, np.arange(len(x)), x)
    return x

def trim(x, thr=10 ** (-50 / 20)):
    idx = np.where(np.abs(x) > thr)[0]
    return x[max(0, idx[0] - 200): idx[-1] + 2000] if len(idx) else x

def fft_band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.clip((f - lo) / (lo * 0.5), 0, 1) * np.clip((hi - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(X * g, len(x))

def highpass(x, fc=90):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * (1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4)), len(x))

def envelope(x, win=0.02):
    n = int(win * SR); k = np.ones(n) / n
    return np.sqrt(np.convolve(x ** 2, k, 'same'))

def room_ir(wet_len=0.32, seed=7):
    r = np.random.default_rng(seed)
    n = int(wet_len * SR); t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / (wet_len / 5))
    for d, g in ((0.011, 0.5), (0.019, 0.35), (0.027, 0.25)):   # 早期反射
        ir[int(d * SR)] += g * 3
    ir = np.convolve(ir, np.ones(8) / 8, 'same')                # 让混响偏暗
    return ir / np.sqrt(np.sum(ir ** 2))

def measure(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])

def exact_gain(src_audio, dst, extra_in=()):
    """短句用 loudnorm 单遍处理时会偏 1~3 dB：先测量，再用精确增益 + 限幅器一次编码"""
    I, _ = measure(src_audio)
    g = TARGET_LUFS - I
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *extra_in, '-i', src_audio, '-af',
                    f'volume={g:.2f}dB,alimiter=limit={10 ** (-3 / 20):.4f}:attack=2:release=40:level=disabled',
                    '-ar', '44100', '-ac', '1', '-b:a', '96k', dst], check=True)

def fix_existing(files):
    """把已生成的 mp3 重新校正到 -20 LUFS (原地覆盖)"""
    for f in files:
        with tempfile.TemporaryDirectory() as td:
            w = os.path.join(td, 'x.wav')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, w], check=True)
            exact_gain(w, f)
        print(f, '%.1f LUFS' % measure(f)[0])

def main():
    if sys.argv[1] == '--fix':
        return fix_existing(sys.argv[2:])
    src, dst = sys.argv[1], sys.argv[2]
    wet = float(sys.argv[3]) if len(sys.argv) > 3 else 0.1
    x = highpass(trim(read_wav(src)))
    pad = np.zeros(int(0.35 * SR))
    x = np.concatenate([x, pad])
    rng = np.random.default_rng(len(x))
    bdb = sys.argv[4] if len(sys.argv) > 4 else '-26'
    y = x
    if bdb != 'off':   # AivisSpeech 本身已有气声，传 off 跳过
        breath = fft_band(rng.standard_normal(len(x)), 2500, 9000)
        breath *= envelope(x) / (np.sqrt(np.mean(breath ** 2)) + 1e-9) * 10 ** (float(bdb) / 20)
        y = x + breath
    ir = room_ir()
    nfft = 1 << int(np.ceil(np.log2(len(y) + len(ir))))
    rev = np.fft.irfft(np.fft.rfft(y, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(y)]
    rev *= np.sqrt(np.mean(y ** 2)) / (np.sqrt(np.mean(rev ** 2)) + 1e-9)
    y = y + rev * wet
    y /= max(1e-9, np.max(np.abs(y))) / 0.8
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    chain = ','.join([
        'equalizer=f=4000:t=q:w=1.2:g=-2',
        'deesser=i=0.3:m=0.5:f=0.5',
        'afade=t=in:d=0.008',
        'areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse',
        'apad=pad_dur=0.12',
    ])
    with tempfile.TemporaryDirectory() as td:
        mid = os.path.join(td, 'mid.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', chain, '-c:a', 'pcm_f32le', mid], input=pcm, check=True)
        exact_gain(mid, dst)

if __name__ == '__main__':
    main()
