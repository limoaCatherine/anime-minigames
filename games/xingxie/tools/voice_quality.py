"""语音音质客观指标 (排查沙哑用)，前后版本对比。
用法: python3 tools/voice_quality.py <目录> [输出.json]
每条语音输出：
  lufs        积分响度 (短句平铺 4 遍再测，响度不变)            目标 -20
  tp_dbtp     true peak (ffmpeg ebur128 peak=true，4 倍过采样)   要求 ≤ -1.0
  clip        削波样本数 (|x| ≥ 0.995)                           要求 0
  hnr_db      谐噪比 (40ms 帧自相关，Boersma 法，取有声帧中位数) 越高越干净；气声 / 沙哑会明显变低
  hf_ratio_db 4-10 kHz 能量占整帧能量 (有声帧中位数，dB)        气声噪声层、齿音会抬高
  hf_flat     4-10 kHz 频谱平坦度 (0=纯谐波, 1=白噪声)           越接近 1 越像噪声
  hf_floor_db 句内 4-10 kHz 噪声底 (句内所有帧该频段电平的 20% 分位, dBFS)
  sr / kbps   采样率 / 码率
hoarse 为排序用综合分 (−HNR、hf_ratio、hf_flat 的 z 分数之和)，越大越「沙」。"""
import sys, os, json, subprocess, re
import numpy as np

SR = 44100

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=sample_rate,bit_rate', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip().split(',')
    return int(r[0]), round(int(r[1]) / 1000) if len(r) > 1 and r[1].isdigit() else None

def loudness(x):
    rep = np.tile(x, 4).astype(np.float32).tobytes()
    r = subprocess.run(['ffmpeg', '-hide_banner', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], input=rep, capture_output=True).stderr.decode()
    i = re.findall(r'I:\s+(-?[\d.]+) LUFS', r)
    tp = re.findall(r'Peak:\s+(-?[\d.inf]+) dBFS', r)
    return (float(i[-1]) if i else None), (float(tp[-1]) if tp else None)

def trim(x, thr_db=-45):
    peak = np.max(np.abs(x)) + 1e-9
    win = int(0.01 * SR)
    env = np.sqrt(np.convolve(x * x, np.ones(win) / win, mode='same'))
    idx = np.where(env > peak * 10 ** (thr_db / 20))[0]
    return x[idx[0]:idx[-1] + 1] if len(idx) else x[:0]

def frames(x, w, hop):
    n = 1 + max(0, (len(x) - w) // hop)
    return np.stack([x[i * hop:i * hop + w] for i in range(n)]) if len(x) >= w else np.zeros((0, w))

def analyse(path):
    x = load(path)
    lufs, tp = loudness(x)
    clip = int(np.sum(np.abs(x) >= 0.995))
    y = trim(x)
    w = int(0.04 * SR); hop = int(0.01 * SR)
    F = frames(y, w, hop)
    rms = np.sqrt(np.mean(F ** 2, axis=1)) + 1e-12
    active = rms > np.max(rms) * 10 ** (-30 / 20)
    win = np.hanning(w)
    spec = np.abs(np.fft.rfft(F * win, axis=1)) ** 2
    freqs = np.fft.rfftfreq(w, 1 / SR)
    band = (freqs >= 4000) & (freqs <= 10000)
    lo, hi = int(SR / 800), int(SR / 70)
    hnr, hfr, flat = [], [], []
    # 汉宁窗自相关 (Boersma 1993：除以窗自身的自相关做校正)
    wac = np.correlate(win, win, 'full')[w - 1:]; wac /= wac[0]
    for k in np.where(active)[0]:
        fr = (F[k] - F[k].mean()) * win
        ac = np.correlate(fr, fr, 'full')[w - 1:]
        if ac[0] <= 0: continue
        ac = ac / ac[0] / np.maximum(wac, 1e-3)
        r = float(np.max(ac[lo:hi]))
        p = spec[k]
        hb = p[band].sum(); tot = p.sum() + 1e-20
        if r > 0.5:                      # 有声帧
            r = min(r, 0.9999)
            hnr.append(10 * np.log10(r / (1 - r)))
            hfr.append(10 * np.log10(hb / tot + 1e-12))
            pb = p[band] + 1e-20
            flat.append(float(np.exp(np.mean(np.log(pb))) / np.mean(pb)))
    bandlev = 10 * np.log10(spec[:, band].sum(axis=1) / (np.sum(win ** 2) * w / 2) + 1e-20)
    sr, kbps = probe(path)
    md = lambda a: round(float(np.median(a)), 2) if len(a) else None
    return {'lufs': lufs, 'tp_dbtp': tp, 'clip': clip, 'hnr_db': md(hnr), 'hf_ratio_db': md(hfr), 'hf_flat': md(flat) if flat else None,
            'hf_floor_db': round(float(np.percentile(bandlev, 20)), 1) if len(bandlev) else None, 'voiced_frames': len(hnr), 'sr': sr, 'kbps': kbps}

def summarize(res):
    keys = ['lufs', 'tp_dbtp', 'clip', 'hnr_db', 'hf_ratio_db', 'hf_flat', 'hf_floor_db', 'kbps']
    out = {}
    for k in keys:
        v = np.array([r[k] for r in res.values() if r[k] is not None], dtype=float)
        out[k] = {'mean': round(float(v.mean()), 2), 'median': round(float(np.median(v)), 2), 'min': round(float(v.min()), 2), 'max': round(float(v.max()), 2)}
    out['files'] = len(res)
    out['clip_files'] = sum(1 for r in res.values() if r['clip'] > 0)
    out['tp_over_-1'] = sum(1 for r in res.values() if r['tp_dbtp'] is not None and r['tp_dbtp'] > -1.0)
    return out

def hoarse_scores(res):
    ids = [k for k, r in res.items() if r['hnr_db'] is not None]
    def z(key, sign=1):
        v = np.array([res[k][key] for k in ids], dtype=float)
        return dict(zip(ids, sign * (v - v.mean()) / (v.std() + 1e-9)))
    a, b, c = z('hnr_db', -1), z('hf_ratio_db'), z('hf_flat')
    return {k: round(float(a[k] + b[k] + c[k]), 2) for k in ids}

if __name__ == '__main__':
    d = sys.argv[1]
    res = {f[:-4]: analyse(os.path.join(d, f)) for f in sorted(os.listdir(d)) if f.endswith('.mp3')}
    hs = hoarse_scores(res)
    for k in res: res[k]['hoarse'] = hs.get(k)
    s = summarize(res)
    if len(sys.argv) > 2: json.dump({'summary': s, 'files': res}, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(s, ensure_ascii=False, indent=1))
