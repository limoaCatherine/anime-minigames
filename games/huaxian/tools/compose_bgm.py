#!/usr/bin/env python3
"""
compose_bgm.py — 程序化作曲并渲染《画线守护美少女》背景音乐 (原创，无第三方素材，无版权问题)

曲名: 《棉花糖散步》(Marshmallow Stroll)
风格: 轻快俏皮的拨弦小品 —— 弦乐拨奏 (pizzicato) + 尤克里里扫弦 + 八音盒 / 钢片琴，G 大调，108 BPM，直八分
编制: 拨奏主旋律 / 八音盒旋律 + 尤克里里和弦 + 拨弦低音 + 木鱼、沙锤、轻柔底鼓 + 极淡的弦乐铺底
结构: 8 小节 × 4 段 = 32 小节 ≈ 71 秒
      A  拨奏主旋律 (尤克里里扫弦)
      B  八音盒旋律 + 拨奏分解和弦
      A' 拨奏 + 钢片琴高八度叠奏 (最热闹)
      C  安静的过渡段 (八音盒 + 铺底，鼓几乎停下) → 回到 A
响度: 统一到 -22 LUFS (与《美少女合成》相同的标准)
无缝循环: 多渲染一段尾音，把越过循环点的尾音 (延音、混响) 叠回开头，首尾波形连续
与姊妹项目《美少女合成》的 BGM (F 大调 lo-fi / 电钢琴 / swing) 完全不同的曲子与音色

用法 (需要 numpy 与 ffmpeg):
    python tools/compose_bgm.py              # 输出 assets/audio/bgm/bgm_main.ogg 与 bgm_main.mp3
    python tools/compose_bgm.py --preview /path/preview.mp3   # 另存约 20 秒试听
"""
import argparse, os, subprocess, tempfile, wave
import numpy as np

SR = 44100
BPM = 108
BEAT = 60.0 / BPM
BAR = 4 * BEAT
TAIL = 5.0              # 秒，叠回开头的尾音长度
rng = np.random.default_rng(20261011 + 7)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------------- 和声 ----------------
CHORDS = {   # 尤克里里 / 中音区和弦音, 低音根音
    'G':   ([62, 67, 71, 74], 43),
    'Em':  ([64, 67, 71, 76], 40),
    'C':   ([60, 64, 67, 72], 48),
    'D':   ([62, 66, 69, 74], 38),
    'Bm7': ([62, 66, 69, 71], 47),
    'Bm':  ([62, 66, 71, 74], 47),
    'D7':  ([60, 62, 66, 69], 38),
    'Am7': ([60, 64, 67, 69], 45),
}
PROG_A = ['G', 'Em', 'C', 'D', 'G', 'Bm7', 'C', 'D7']
PROG_B = ['C', 'D', 'Bm', 'Em', 'Am7', 'D', 'G', 'D7']
PROG_C = ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am7', 'D7']

G4, A4, B4, C5, D5, E5, Fs5, G5, A5, B5, C6 = 67, 69, 71, 72, 74, 76, 78, 79, 81, 83, 84
Fs4, E4 = 66, 64
MEL_A = [   # (拍, 音高, 时值) —— 拨奏，俏皮的八分音符
    [(0, B4, .5), (.5, D5, .5), (1, G5, .5), (1.5, D5, .5), (2, B4, 1), (3, A4, .5), (3.5, B4, .5)],
    [(0, G4, .5), (.5, B4, .5), (1, E5, 1), (2, D5, .5), (2.5, B4, .5), (3, G4, 1)],
    [(0, E5, .5), (.5, G5, .5), (1, E5, .5), (1.5, C5, .5), (2, D5, .5), (2.5, E5, .5), (3, C5, 1)],
    [(0, A4, .5), (.5, B4, .5), (1, C5, .5), (1.5, D5, .5), (2, Fs5, 1.5), (3.5, D5, .5)],
    [(0, G5, .5), (.5, Fs5, .5), (1, G5, .5), (1.5, D5, .5), (2, B4, .5), (2.5, D5, .5), (3, G5, 1)],
    [(0, Fs5, .5), (.5, D5, .5), (1, B4, 1), (2, A4, .5), (2.5, B4, .5), (3, D5, 1)],
    [(0, E5, 1), (1, C5, .5), (1.5, E5, .5), (2, D5, .5), (2.5, C5, .5), (3, B4, .5), (3.5, A4, .5)],
    [(0, A4, 1), (1, Fs4, .5), (1.5, A4, .5), (2, D5, 1.5)],
]
MEL_B = [   # 八音盒，舒展
    [(0, E5, 1.5), (1.5, G5, .5), (2, C6, 2)],
    [(0, A5, 1.5), (1.5, Fs5, .5), (2, D5, 2)],
    [(0, D5, 1), (1, Fs5, 1), (2, B5, 1.5), (3.5, A5, .5)],
    [(0, G5, 3), (3, E5, 1)],
    [(0, C6, 1), (1, B5, .5), (1.5, A5, .5), (2, G5, 1), (3, E5, 1)],
    [(0, Fs5, 1.5), (1.5, E5, .5), (2, D5, 1), (3, A4, 1)],
    [(0, B4, 1), (1, D5, 1), (2, G5, 1.5), (3.5, Fs5, .5)],
    [(0, E5, 1), (1, D5, 1), (2, C5, 1), (3, A4, 1)],
]
MEL_C = [   # 过渡段，稀疏
    [(0, B4, 2), (2, E5, 2)],
    [(0, G5, 2), (2, E5, 1), (3, C5, 1)],
    [(0, D5, 2), (2, B4, 1), (3, G4, 1)],
    [(0, A4, 3), (3, D5, 1)],
    [(0, E5, 1.5), (1.5, G5, .5), (2, B5, 2)],
    [(0, A5, 1), (1, G5, 1), (2, E5, 2)],
    [(0, C5, 1), (1, E5, 1), (2, G5, 1), (3, A5, 1)],
    [(0, Fs5, 2), (2, D5, .5), (2.5, E5, .5), (3, Fs5, .5), (3.5, A5, .5)],
]

# ---------------- 音色 (加法合成，全部向量化) ----------------
def pluck(f, dur, vel, tau=0.35, bright=1.6, pos=0.18, nh=10, body=0.0):
    """拨弦: 各次谐波按拨弦位置加权、高次谐波衰减更快"""
    n = int((dur + tau * 3) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, nh + 1):
        fk = f * k * (1 + 0.0004 * k * k)          # 轻微非谐性
        if fk > SR * 0.45: break
        amp = abs(np.sin(np.pi * k * pos)) / k ** bright
        out += amp * np.sin(2 * np.pi * fk * t + rng.random() * 0.3) * np.exp(-t * k ** 0.7 / tau)
    att = np.minimum(1.0, t / 0.002)
    rel = 1 - np.clip((t - dur - tau) / (tau * 2), 0, 1)
    if body:   # 琴身共鸣 (低频短促)
        out += body * np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.05)
    return out * att * rel * vel

def pizz(f, dur, vel):      # 弦乐拨奏: 圆润、短
    return pluck(f, min(dur, 0.25), vel, tau=0.22, bright=1.9, pos=0.22, nh=8, body=0.15)

def uke(f, dur, vel):       # 尤克里里: 明亮一些
    return pluck(f, dur, vel, tau=0.45, bright=1.3, pos=0.12, nh=12, body=0.1)

def ubass(f, dur, vel):     # 拨弦低音
    return pluck(f, dur, vel, tau=0.5, bright=2.2, pos=0.25, nh=6) * 1.3

def music_box(f, dur, vel):
    n = int((dur + 1.4) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 1.1), (2.76, 0.18, 0.3), (5.4, 0.05, 0.12)):   # 钢片琴般的非谐泛音
        out += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    return out * np.minimum(1.0, t / 0.002) * vel * 0.5

def string_pad(notes, dur, vel):
    n = int((dur + 1.0) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    vib = 1 + 0.002 * np.sin(2 * np.pi * 5.2 * t)
    for m in notes:
        f = mtof(m)
        for det in (-0.004, 0.004):
            for k in range(1, 5):
                out += np.sin(2 * np.pi * np.cumsum(np.full(n, f * k * (1 + det)) * vib) / SR) / k ** 2
    env = np.minimum(1.0, t / 0.9) * (1 - np.clip((t - dur) / 0.9, 0, 1))
    return out * env * vel / (len(notes) * 2)

def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    # 用 FFT 频域近似一阶低通 (避免逐样本循环)
    n = len(x); X = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (fr / fc) ** 2), n)

def woodblock():
    n = int(0.12 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 1050 * t) * np.exp(-t / 0.025) + 0.4 * np.sin(2 * np.pi * 1680 * t) * np.exp(-t / 0.012)
    return x / np.max(np.abs(x))

def shaker():
    n = int(0.08 * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - onepole_lp(x, 5000)                      # 高通
    x *= np.minimum(1, t / 0.008) * np.exp(-t / 0.022)
    return x / np.max(np.abs(x))

def soft_kick():
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 52 + 50 * np.exp(-t / 0.025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)

# ---------------- 编曲与渲染 ----------------
def render():
    sections = [('A', PROG_A, MEL_A), ('B', PROG_B, MEL_B), ('A2', PROG_A, MEL_A), ('C', PROG_C, MEL_C)]
    nbars = 8 * len(sections)
    L = nbars * BAR
    N = int((L + TAIL) * SR)
    buses = {k: np.zeros((N, 2)) for k in ('mel', 'box', 'uke', 'bass', 'pad', 'drums')}

    def put(bus, sig, t0, pan=0.0, gain=1.0):
        i = int(round(t0 * SR)); j = min(N, i + len(sig))
        if j <= i: return
        s = sig[:j - i] * gain
        buses[bus][i:j, 0] += s * np.cos((pan + 1) * np.pi / 4)
        buses[bus][i:j, 1] += s * np.sin((pan + 1) * np.pi / 4)

    WB, SH, KK = woodblock(), shaker(), soft_kick()
    STRUM = [(0, 1, .55), (1, 1, .4), (1.5, -1, .3), (2.5, -1, .32), (3, 1, .42), (3.5, -1, .3)]  # 下-下上-上下上
    b = 0
    for name, prog, mel in sections:
        quiet = name == 'C'
        for inbar in range(8):
            t_bar = b * BAR
            notes, root = CHORDS[prog[inbar]]
            hum = lambda: 0.9 + 0.2 * rng.random()
            # 尤克里里扫弦
            for off, direction, v in STRUM:
                order = notes if direction > 0 else notes[::-1]
                vv = v * (0.55 if quiet else 1.0) * (0.7 if name == 'B' else 1.0)
                for k, m in enumerate(order):
                    put('uke', uke(mtof(m), 0.5 * BEAT, vv * hum()), t_bar + off * BEAT + k * 0.011 + rng.random() * 0.004, pan=-0.3 + 0.1 * k / 3)
            # 低音
            if quiet:
                put('bass', ubass(mtof(root), 3.5 * BEAT, 0.6), t_bar)
            else:
                for off, m, v in ((0, root, .9), (1.5, root + 12, .45), (2, root + 7, .7), (3.5, root + 7, .4)):
                    put('bass', ubass(mtof(m), 0.45 * BEAT, v * hum()), t_bar + off * BEAT)
            # 铺底 (只在 B / C 段)
            if name in ('B', 'C'):
                put('pad', string_pad(notes, BAR, 1.0), t_bar)
            # 旋律
            for off, m, d in mel[inbar]:
                v = 0.8 + 0.2 * rng.random()
                if name in ('A', 'A2'):
                    put('mel', pizz(mtof(m), d * BEAT, v), t_bar + off * BEAT, pan=0.15)
                    if name == 'A2':
                        put('box', music_box(mtof(m + 12), d * BEAT, v * 0.35), t_bar + off * BEAT + 0.004, pan=0.4)
                else:
                    put('box', music_box(mtof(m + 12), d * BEAT, v * (0.9 if name == 'B' else 0.75)), t_bar + off * BEAT, pan=0.25)
            if name == 'B':   # 拨奏分解和弦作对位
                for e in range(8):
                    m = notes[(0, 2, 1, 3, 2, 1, 3, 2)[e]] + 12
                    put('mel', pizz(mtof(m), 0.25 * BEAT, 0.35 * hum()), t_bar + e * 0.5 * BEAT, pan=-0.1)
            # 打击乐
            for e in range(8):
                g = (0.5 if e % 2 == 0 else 0.32) * (0.35 if quiet else 1.0)
                put('drums', SH, t_bar + e * 0.5 * BEAT, pan=0.4, gain=g * hum())
            if not quiet:
                put('drums', KK, t_bar, gain=0.75)
                put('drums', KK, t_bar + 2 * BEAT, gain=0.55)
                for off in (1, 3):
                    put('drums', WB, t_bar + off * BEAT, pan=-0.35, gain=0.32 * hum())
                if inbar == 7:   # 每段最后一小节加一个小过门
                    for off in (3.5, 3.75):
                        put('drums', WB, t_bar + off * BEAT, pan=0.3, gain=0.22)
            b += 1

    mix = (buses['mel'] * 0.34 + buses['box'] * 0.30 + buses['uke'] * 0.16 + buses['bass'] * 0.30
           + buses['pad'] * 0.05 + buses['drums'] * 0.16)
    # 混响: 小房间 (指数衰减噪声脉冲响应，FFT 卷积)
    ir_len = int(1.6 * SR); t = np.arange(ir_len) / SR
    ir = rng.standard_normal((ir_len, 2)) * np.exp(-t / 0.35)[:, None]
    for c in range(2):
        ir[:, c] = np.convolve(ir[:, c], np.ones(8) / 8, mode='same')
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    send = buses['mel'] * 0.25 + buses['box'] * 0.35 + buses['uke'] * 0.12 + buses['pad'] * 0.05
    nfft = 1 << int(np.ceil(np.log2(N + ir_len)))
    for c in range(2):
        wet = np.fft.irfft(np.fft.rfft(send[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N]
        mix[:, c] += wet * 0.3
    # 整体柔化: 轻微压暗高频
    for c in range(2):
        mix[:, c] = 0.75 * mix[:, c] + 0.25 * onepole_lp(mix[:, c], 6000)
    # 无缝循环: 尾音叠回开头
    Ls = int(round(L * SR))
    out = mix[:Ls].copy()
    out[:N - Ls] += mix[Ls:]
    rms = np.sqrt(np.mean(out ** 2))
    out *= 10 ** (-19 / 20) / rms
    out = np.tanh(out * 1.1) / 1.1
    return out, L, nbars

def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

TARGET_LUFS = -22.0     # 与《美少女合成》统一的 BGM 响度标准

def measure_lufs(wav):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'],
                       capture_output=True, text=True)
    lines = [l for l in r.stderr.splitlines() if l.strip().startswith('I:')]
    return float(lines[-1].split()[1])

def main():
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument('--out', default=os.path.join(root, 'assets/audio/bgm'))
    ap.add_argument('--preview', default=None, help='另存约 20 秒的试听 mp3 (含淡出)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    x, L, nbars = render()
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, 'bgm.wav')
        write_wav(wav, x)
        lufs = measure_lufs(wav)                       # 响度统一到 -22 LUFS (线性增益，不再压缩)
        x = x * 10 ** ((TARGET_LUFS - lufs) / 20)
        write_wav(wav, x)
        print(f'[bgm] loudness {lufs:.1f} -> {measure_lufs(wav):.1f} LUFS, peak {np.max(np.abs(x)):.2f}')
        ogg = os.path.join(a.out, 'bgm_main.ogg'); mp3 = os.path.join(a.out, 'bgm_main.mp3')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', ogg], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
        if a.preview:
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-t', '20', '-af', 'afade=t=out:st=17.5:d=2.5',
                            '-c:a', 'libmp3lame', '-b:a', '160k', a.preview], check=True)
    print(f'[bgm] {len(x) / SR:.2f}s ({nbars} 小节 @ {BPM} BPM) -> {ogg}, {mp3}')

if __name__ == '__main__':
    main()
