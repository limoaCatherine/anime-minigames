"""语音客观指标：时长 (去首尾静音)、发声时长 (首末有声帧之间)、有声段平均 F0、F0 标准差 (半音)、F0 变化速率、积分响度 (LUFS)。
用法: python3 tools/voice_metrics.py <目录> [输出.json]
F0 用简单的自相关法 (40ms 窗 / 10ms 步，80~700Hz)，只用于前后版本对比，不追求绝对精度。"""
import sys, os, json, subprocess, re
import numpy as np

SR = 22050

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def trim(x, thr_db=-40):
    if not len(x): return x
    peak = np.max(np.abs(x)) + 1e-9
    win = int(0.01 * SR)
    env = np.sqrt(np.convolve(x * x, np.ones(win) / win, mode='same'))
    idx = np.where(env > peak * 10 ** (thr_db / 20))[0]
    return x[idx[0]:idx[-1] + 1] if len(idx) else x[:0]

def f0_track(x):
    w = int(0.04 * SR); hop = int(0.01 * SR)
    lo, hi = int(SR / 700), int(SR / 80)
    out = []
    peak = np.max(np.abs(x)) + 1e-9
    for i in range(0, len(x) - w, hop):
        fr = x[i:i + w] * np.hanning(w)
        if np.sqrt(np.mean(fr ** 2)) < peak * 0.05: out.append(0); continue
        ac = np.correlate(fr, fr, 'full')[w - 1:]
        ac /= ac[0] + 1e-9
        seg = ac[lo:hi]
        k = int(np.argmax(seg)); v = seg[k]
        out.append(SR / (lo + k) if v > 0.45 else 0)
    return np.array(out)

def lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r)
    return float(m[-1]) if m else None

def metrics(path):
    x = trim(load(path))
    f = f0_track(x); v = f[f > 0]
    st = 12 * np.log2(v / np.median(v)) if len(v) > 3 else np.array([0])
    d = np.abs(np.diff(st)) if len(st) > 1 else np.array([0])
    vi = np.where(f > 0)[0]
    span = (vi[-1] - vi[0] + 4) * 0.01 if len(vi) else 0   # 第一个到最后一个有声帧 (不含换气 / 叹气 / 尾音静音)
    return {'dur': round(len(x) / SR, 3), 'speech': round(float(span), 3), 'f0': round(float(np.median(v)) if len(v) else 0, 1), 'f0_std_st': round(float(np.std(st)), 2),
            'f0_range_st': round(float(np.percentile(st, 95) - np.percentile(st, 5)), 2), 'f0_motion': round(float(np.mean(d)), 3), 'lufs': lufs(path)}

if __name__ == '__main__':
    d = sys.argv[1]
    res = {f[:-4]: metrics(os.path.join(d, f)) for f in sorted(os.listdir(d)) if f.endswith('.mp3')}
    if len(sys.argv) > 2: json.dump(res, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    keys = ['dur', 'speech', 'f0_std_st', 'f0_range_st', 'f0_motion', 'lufs']
    print(f'{len(res)} files')
    for k in keys:
        vals = [r[k] for r in res.values() if r[k] is not None]
        print(f'  {k:12s} mean={np.mean(vals):.3f}  median={np.median(vals):.3f}')
