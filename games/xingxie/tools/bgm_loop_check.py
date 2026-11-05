"""抖音版 BGM 循环接缝的波形检查。

模拟「不读 LAME 无缝头」的最坏情况 (ffmpeg -flags2 +skip_manual：保留编码器头尾静音，相当于底层播放器不裁)：
  · 旧做法 (原 mp3 + loop=true)：直接把解码结果首尾相接，测接缝处的静音长度，作为对照
  · 新做法 (tools/make_tt_bgm.py 的文件 + TTLoopAudio)：实例 A 从 0 开始，播到循环点 L(+计时误差 δ) 时实例 B 从头开始，
    xfade 秒等功率交叉淡化，按运行时完全相同的方式合成输出
以 ogg 母带的理想无缝循环为参照，逐 10ms 窗比较 RMS (与参照在 ±(|δ|+10ms) 内的最小值比，容忍计时误差造成的鼓点错位)：
  · 接缝前后 0.5s 内，参照有声 (> -40 dBFS) 的窗，输出不得低于参照 -6 dB，且不得出现 < -50 dBFS 的窗
δ 取 0 / +1 帧 (16.7ms) / -30ms / +60ms，覆盖每帧计时的量化误差与播放启动延迟。
结果写入 build/bgm_loop_report.json (test_douyin 会检查)。
用法：python3 tools/bgm_loop_check.py
"""
import os, sys, json, hashlib, subprocess, numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
WIN = int(0.01 * SR)
JITTERS = [0.0, 1 / 60, -0.03, 0.06]

def decode(path, naive):
    a = ['ffmpeg', '-v', 'error'] + (['-flags2', '+skip_manual'] if naive else []) + ['-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(a, capture_output=True, check=True).stdout, np.float32).astype(np.float64)

def rms_windows(x):
    n = len(x) // WIN
    return np.sqrt(np.mean(x[:n * WIN].reshape(n, WIN) ** 2, axis=1) + 1e-20)

db = lambda v: 20 * np.log10(max(v, 1e-10))

def find_delay(naive, gapless, search=4000):
    seg = gapless[SR:SR + 8192]
    best, bd = -1, 0
    for d in range(0, search):
        c = np.dot(naive[SR + d:SR + d + 8192], seg)
        if c > best: best, bd = c, d
    return bd

def judge(out, ref, shift_s=0.0):
    """计时误差 δ 会让淡化后的输出整体比理想参照错开 δ；为了只抓「空白 / 掉音量」，
    每个窗与参照在 ±(|δ|+10ms) 范围内的最小值比较 (即参照的「底」)，鼓点对不齐不算问题。"""
    ro, rr = rms_windows(out), rms_windows(ref)
    k = int(np.ceil(abs(shift_s) / 0.01)) + 1
    floor = np.array([rr[max(0, i - k):i + k + 1].min() for i in range(len(rr))])
    voiced = floor > 10 ** (-40 / 20)
    ratio = ro[voiced] / floor[voiced]
    silent_ms = int(np.sum(ro < 10 ** (-50 / 20)) * 10)
    worst = float(db(ratio.min())) if len(ratio) else 0.0
    return {'worst_vs_ref_db': round(worst, 2), 'max_vs_ref_db': round(float(db(ratio.max())), 2) if len(ratio) else 0.0,
            'silent_ms': silent_ms, 'min_window_dbfs': round(float(db(ro.min())), 1), 'ok': worst > -6 and silent_ms == 0}

def main():
    sys.path.insert(0, ROOT)
    man = open(os.path.join(ROOT, 'src/config/BgmLoopManifest.js'), encoding='utf8').read()
    loops = json.loads(man[man.index('{'):man.rindex('}') + 1])
    report = {'tracks': {}, 'ok': True}
    for name, info in loops.items():
        L = info['samples']; xf = info['xfade']
        master = decode(os.path.join(ROOT, f'assets/audio/bgm/bgm_{name}.ogg'), False)
        assert len(master) == L, (name, len(master), L)
        tt_path = os.path.join(ROOT, f'assets/douyin/bgm/bgm_{name}.mp3')
        f = decode(tt_path, True)                     # 最坏情况：保留编码器静音
        g = decode(tt_path, False)
        D = find_delay(f, g)                          # 编码器延迟 (两实例相同)
        ref = lambda n0, n1: master[(np.arange(n0, n1) - D) % L]     # 理想无缝循环 (同样延迟 D)
        a0, a1 = L + D - int(0.5 * SR), L + D + int((xf + 0.5) * SR)
        res = {'loop_s': info['loop'], 'encoder_delay_samples': D, 'cases': {}}
        # 新做法：双实例交叉淡化
        for dj in JITTERS:
            T = int(round((info['loop'] + dj) * SR))
            n = np.arange(a0, a1)
            A = f[np.clip(n, 0, len(f) - 1)] * (n < len(f))
            nb = n - T
            B = np.where(nb >= 0, f[np.clip(nb, 0, len(f) - 1)], 0.0)
            k = np.clip((n - T) / (xf * SR), 0, 1)
            gA = np.where(n < T, 1.0, np.cos(k * np.pi / 2)); gB = np.where(n < T, 0.0, np.sin(k * np.pi / 2))
            out = A * gA + B * gB
            r = judge(out, ref(a0, a1), dj)
            res['cases'][f'crossfade_jitter_{int(round(dj * 1000))}ms'] = r
            report['ok'] &= r['ok']
        # 对照：旧文件直接 loop=true (最坏情况的接缝)
        old = decode(os.path.join(ROOT, f'assets/audio/bgm/bgm_{name}.mp3'), True)
        Lo = len(old); n = np.arange(Lo - int(0.5 * SR), Lo + int(0.5 * SR))
        base = old[n % Lo]
        Do = find_delay(old, decode(os.path.join(ROOT, f'assets/audio/bgm/bgm_{name}.mp3'), False))
        rb = rms_windows(base)
        res['baseline_loop_true'] = {'naive_len_extra_ms': round((Lo - L) / SR * 1000, 1),
                                     'silent_ms_at_seam': int(np.sum(rb < 10 ** (-50 / 20)) * 10),
                                     'min_window_dbfs': round(float(db(rb.min())), 1)}
        res['tt_file_sha256'] = hashlib.sha256(open(tt_path, 'rb').read()).hexdigest()
        report['tracks'][name] = res
        worst = min(c['worst_vs_ref_db'] for c in res['cases'].values())
        print(f"{name:7s} delay {D} smp | 交叉淡化: 最差 {worst:+.1f} dB vs 理想, 静音 {max(c['silent_ms'] for c in res['cases'].values())} ms"
              f" | 对照 loop=true: 接缝静音 {res['baseline_loop_true']['silent_ms_at_seam']} ms (最低 {res['baseline_loop_true']['min_window_dbfs']} dBFS)")
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    json.dump(report, open(os.path.join(ROOT, 'build/bgm_loop_report.json'), 'w'), indent=1, ensure_ascii=False)
    print('结果', '✓ 无缝' if report['ok'] else '✗ 有问题')
    sys.exit(0 if report['ok'] else 1)

if __name__ == '__main__':
    main()
