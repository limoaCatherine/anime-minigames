#!/usr/bin/env python3
"""
compose_bgm.py — 程序化作曲并渲染《次元破绽！》背景音乐 (原创，无第三方素材，无版权问题)
沿用《美少女合成》tools/compose_bgm.py 的做法：numpy 合成各声部 → FFT 卷积混响 → 尾音叠回开头做无缝循环
→ 线性增益校准到 -22 LUFS → mp3 (v1.3 起不再输出 ogg：iOS 播不了)。
循环接缝：mp3 编码会在首尾加静音填充，直接 loop 会有空隙。所以 mp3 = 一整轮 (L 秒) + 再接上开头 XF_TAIL 秒，
播放端 (src/systems/BgmSystem.js) 用两个播放器：播到 L 秒时另一个从 0 开始，0.15 秒等功率交叉淡化。
交叉的那 0.15 秒里两边放的是同一段音乐，所以接缝听不出来。L 写在 src/config/AudioConfig.js 的 loopEnd。

两首曲子 (与姊妹作的曲子完全不同的旋律与音色)：
  bgm_menu 《吐槽役的早晨》 C 大调 100 BPM：马林巴琶音 + 钟琴主旋律 + 拨弦低音 + 轻沙锤，轻松日常
  bgm_game 《破绽在哪喵》   D 小调→F 大调 116 BPM：「蹑手蹑脚」的拨奏低音 + 单簧管风主旋律 + 钢片琴应答
                            + 木鱼/指响，侦探喜剧感，适合一边找茬一边听；32 小节 ≈ 66 秒
用法 (需要 numpy 与 ffmpeg)：python tools/compose_bgm.py [--preview-dir /tmp]
"""
import argparse, os, subprocess, tempfile, wave
import numpy as np

SR = 44100
TAIL = 5.0
TARGET_LUFS = -22.0
XF_TAIL = 0.5          # mp3 末尾多接的「开头」长度 (秒)，给播放端交叉淡化用

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------------- 音色 ----------------
def env_ad(n, attack, tau):
    t = np.arange(n) / SR
    return np.minimum(1.0, t / max(attack, 1e-4)) * np.exp(-t / tau)

def release(n, start, rel):
    t = np.arange(n) / SR
    return 1 - np.clip((t - start) / rel, 0, 1)

def marimba(f, dur, vel):
    n = int((dur + 0.8) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42)
    x += 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.06)
    x += 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.015)
    return x * np.minimum(1, t / 0.002) * vel

def glock(f, dur, vel):
    n = int((dur + 1.4) * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 0.8), (2.76, 0.3, 0.3), (5.4, 0.1, 0.12)):
        for det in (-0.001, 0.001):
            x += amp * np.sin(2 * np.pi * f * ratio * (1 + det) * t) * np.exp(-t / tau)
    return x * np.minimum(1, t / 0.0015) * vel * 0.45

def pizz(f, dur, vel):
    n = int((min(dur, 0.5) + 0.4) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05) + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.03)
    return np.tanh(1.3 * x) * env_ad(n, 0.003, 0.22) * vel

def clarinet(f, dur, vel):
    # 奇次谐波为主 + 轻微颤音，音头稍慢，像单簧管 / 木管
    n = int((dur + 0.25) * SR); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    x = np.sin(ph) + 0.42 * np.sin(3 * ph) + 0.2 * np.sin(5 * ph) + 0.08 * np.sin(7 * ph)
    e = np.minimum(1, t / 0.03) * (0.85 + 0.15 * np.exp(-t / 0.2)) * release(n, dur, 0.12)
    return x * e * vel * 0.5

def celesta(f, dur, vel):
    n = int((dur + 1.0) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55) + 0.25 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.12)
    return x * np.minimum(1, t / 0.002) * vel * 0.5

def pad(notes, dur, vel):
    n = int((dur + 1.0) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for det in (-0.003, 0.003):
            for k in range(1, 5):
                out += np.sin(2 * np.pi * f * k * (1 + det) * t + k) / k ** 2
    e = np.minimum(1.0, t / 0.6) * (1 - np.clip((t - dur) / 0.8, 0, 1))
    return out * e * vel / (len(notes) * 2)

rng = np.random.default_rng(20261011)

def noise_hit(dur, tau, color):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    if color == 'hi':
        x = np.diff(x, prepend=0); x = np.diff(x, prepend=0)
    elif color == 'mid':
        x = np.diff(x, prepend=0)
    x = x * np.minimum(1, t / 0.003) * np.exp(-t / tau)
    return x / (np.max(np.abs(x)) + 1e-9)

def kick():
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 52 + 60 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)

def woodblock(f=900):
    n = int(0.12 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.7 * t)) * np.exp(-t / 0.025)

def snap():
    x = noise_hit(0.1, 0.018, 'hi')
    n = len(x); t = np.arange(n) / SR
    return x * 0.8 + 0.3 * np.sin(2 * np.pi * 1700 * t) * np.exp(-t / 0.01)

# ---------------- 曲子定义 ----------------
C4 = 60
def chord(root, kind):
    iv = {'M': [0, 4, 7], 'm': [0, 3, 7], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], '7': [0, 4, 7, 10], 'sus': [0, 5, 7]}[kind]
    return [root + i for i in iv]

def song_menu():
    bpm = 100; beat = 60 / bpm
    prog = [(48, 'M7'), (45, 'm7'), (41, 'M7'), (43, '7'), (40, 'm7'), (45, 'm7'), (38, 'm7'), (43, 'sus')]
    # 旋律 (C 大调五声为主)，每小节 [(拍, midi, 时值)]
    A = [[(0, 76, 1), (1, 79, .5), (1.5, 76, .5), (2, 74, 1), (3, 72, 1)],
         [(0, 72, 1.5), (1.5, 69, .5), (2, 72, 2)],
         [(0, 69, .5), (.5, 72, .5), (1, 74, 1), (2, 76, 1), (3, 79, 1)],
         [(0, 77, 1.5), (1.5, 76, .5), (2, 74, 2)],
         [(0, 76, 1), (1, 79, .5), (1.5, 81, .5), (2, 79, 1), (3, 76, 1)],
         [(0, 72, 1), (1, 76, 1), (2, 74, .5), (2.5, 72, .5), (3, 69, 1)],
         [(0, 72, 1), (1, 74, 1), (2, 77, 1), (3, 76, .5), (3.5, 74, .5)],
         [(0, 74, 3)]]
    B = [[(0, 81, 2), (2, 79, 1), (3, 76, 1)],
         [(0, 79, 1.5), (1.5, 76, .5), (2, 72, 2)],
         [(0, 77, 1), (1, 76, 1), (2, 74, 1), (3, 72, 1)],
         [(0, 74, 1), (1, 76, .5), (1.5, 79, .5), (2, 79, 2)],
         [(0, 79, 1), (1, 76, 1), (2, 79, 1), (3, 84, 1)],
         [(0, 81, 2), (2, 79, .5), (2.5, 76, .5), (3, 72, 1)],
         [(0, 74, 1), (1, 72, 1), (2, 74, 1), (3, 77, 1)],
         [(0, 79, 2), (2, 74, 1), (3.5, 74, .5)]]
    return dict(name='bgm_menu', beat=beat, prog=prog, sections=[A, B, A], style='menu')

def song_game():
    bpm = 116; beat = 60 / bpm
    prog = [(38, 'm'), (38, 'm'), (34, 'M'), (33, '7'), (38, 'm'), (31, 'm7'), (33, 'sus'), (33, '7'),
            (41, 'M'), (36, '7'), (34, 'M7'), (33, '7'), (38, 'm'), (31, 'm7'), (33, '7'), (38, 'm')]
    # 蹑手蹑脚的主题 (D 小调)，休止很多，像"偷偷观察"
    A = [[(0, 62, .5), (1, 65, .5), (2, 69, .5), (2.5, 68, .5), (3, 69, 1)],
         [(1, 72, .5), (1.5, 70, .5), (2, 69, .5), (3, 65, .5), (3.5, 67, .5)],
         [(0, 70, 1), (1, 69, .5), (2, 67, .5), (2.5, 65, .5), (3, 67, 1)],
         [(0, 69, 1.5), (2, 64, .5), (2.5, 65, .5), (3, 67, .5), (3.5, 69, .5)],
         [(0, 74, .5), (1, 72, .5), (1.5, 70, .5), (2, 69, 1), (3.5, 65, .5)],
         [(0, 67, 1), (1, 70, .5), (2, 74, .5), (2.5, 72, .5), (3, 70, 1)],
         [(0, 69, .5), (.5, 67, .5), (1, 65, .5), (1.5, 64, .5), (2, 62, 1), (3, 64, .5), (3.5, 65, .5)],
         [(0, 64, 1), (1, 61, 1), (2, 64, 1), (3, 69, 1)]]
    # 转到 F 大调的明亮段 ("找到了！")
    B = [[(0, 72, 1), (1, 77, .5), (1.5, 76, .5), (2, 74, .5), (2.5, 72, .5), (3, 69, 1)],
         [(0, 70, 1), (1, 72, .5), (2, 76, .5), (2.5, 74, .5), (3, 72, 1)],
         [(0, 74, 1.5), (1.5, 72, .5), (2, 70, .5), (2.5, 69, .5), (3, 70, 1)],
         [(0, 73, 1), (1, 76, 1), (2, 79, .5), (2.5, 77, .5), (3, 76, 1)],
         [(0, 74, .5), (.5, 77, .5), (1, 81, 1), (2, 79, .5), (2.5, 77, .5), (3, 74, 1)],
         [(0, 70, 1), (1, 74, .5), (1.5, 72, .5), (2, 70, 1), (3, 67, 1)],
         [(0, 69, .5), (.5, 73, .5), (1, 76, .5), (1.5, 79, .5), (2, 77, 1), (3, 73, 1)],
         [(0, 74, 2), (2.5, 69, .5), (3, 62, .5)]]
    return dict(name='bgm_game', beat=beat, prog=prog, sections=[A + B, A + B], style='game')

# ---------------- 渲染 ----------------
def render(song):
    beat = song['beat']; bar = 4 * beat
    mel_bars = [b for sec in song['sections'] for b in sec]
    nb = len(mel_bars)
    prog = song['prog']
    L = nb * bar
    N = int((L + TAIL) * SR)
    bus = {k: np.zeros((N, 2)) for k in ('lead', 'harm', 'bass', 'pad', 'drums')}

    def put(b, sig, t0, pan=0.0, gain=1.0):
        i = max(0, int(round(t0 * SR))); j = min(N, i + len(sig))
        if j <= i: return
        s = sig[:j - i] * gain
        bus[b][i:j, 0] += s * np.cos((pan + 1) * np.pi / 4)
        bus[b][i:j, 1] += s * np.sin((pan + 1) * np.pi / 4)

    K, W, S = kick(), woodblock(), snap()
    shk = noise_hit(0.06, 0.016, 'hi')
    for b in range(nb):
        t = b * bar
        root, kind = prog[b % len(prog)]
        notes = chord(root + 12, kind)
        sec = b // (len(mel_bars) // len(song['sections']))
        hum = lambda: (rng.random() - 0.5) * 0.008
        if song['style'] == 'menu':
            # 马林巴分解和弦 (八分音符)
            arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12, notes[-1] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12]
            for e, m in enumerate(arp):
                put('harm', marimba(mtof(m), 0.5 * beat, 0.32 + 0.1 * (e % 2 == 0)), t + e * 0.5 * beat + hum(), pan=-0.3)
            put('pad', pad(notes, 4 * beat, 0.8), t)
            for off, m in ((0, root), (1.5, root + 7), (2, root + 12), (3, root + 7)):
                put('bass', pizz(mtof(m), 0.5 * beat, 0.8), t + off * beat + hum())
            for e in range(8):
                put('drums', shk, t + e * 0.5 * beat + hum(), pan=0.4, gain=0.18 if e % 2 else 0.28)
            if b % 2 == 1: put('drums', W, t + 3.5 * beat, pan=-0.2, gain=0.22)
            for off, m, d in mel_bars[b]:
                put('lead', glock(mtof(m + 12), d * beat, 0.6 + 0.15 * rng.random()), t + off * beat + hum(), pan=0.2)
                if sec == 2: put('lead', marimba(mtof(m), d * beat, 0.25), t + off * beat + 0.01, pan=-0.1)
        else:
            # 蹑手蹑脚的拨奏低音：根-五-八-五 (四分音符，短促)
            for off, iv in ((0, 0), (1, 7), (2, 12), (3, 7)):
                put('bass', pizz(mtof(root + iv), 0.35 * beat, 0.9 if off == 0 else 0.7), t + off * beat + hum())
            # 反拍和弦 (钢片琴，短)
            for off in (0.5, 1.5, 2.5, 3.5):
                for k, m in enumerate(notes):
                    put('harm', celesta(mtof(m + 12), 0.2 * beat, 0.16), t + off * beat + k * 0.006, pan=-0.35)
            put('pad', pad(notes, 4 * beat, 0.5), t)
            # 旋律：单簧管风 (A 段) / 单簧管 + 钢片琴叠奏 (B 段第二遍)
            for off, m, d in mel_bars[b]:
                put('lead', clarinet(mtof(m), d * beat * 0.92, 0.75 + 0.15 * rng.random()), t + off * beat + hum(), pan=0.15)
                if sec == 1 and b % 16 >= 8:
                    put('lead', celesta(mtof(m + 12), d * beat, 0.35), t + off * beat + 0.008, pan=0.4)
            # 鼓：轻底鼓 + 木鱼 + 指响
            intro = b < 2
            if not intro:
                put('drums', K, t, gain=0.7); put('drums', K, t + 2.5 * beat, gain=0.45)
                put('drums', S, t + 1 * beat, pan=0.2, gain=0.5); put('drums', S, t + 3 * beat, pan=0.2, gain=0.5)
            for off in (0.5, 1.75, 2.5, 3.5):
                put('drums', W, t + off * beat + hum(), pan=-0.3, gain=0.18)
            if b % 8 == 7:
                for off in (3.25, 3.5, 3.75): put('drums', woodblock(1200), t + off * beat, pan=0.3, gain=0.25)

    mix = bus['lead'] * 0.34 + bus['harm'] * 0.22 + bus['bass'] * 0.32 + bus['pad'] * 0.06 + bus['drums'] * 0.24
    ir_len = int(1.8 * SR); tt = np.arange(ir_len) / SR
    ir = rng.standard_normal((ir_len, 2)) * np.exp(-tt / 0.42)[:, None]
    for c in range(2): ir[:, c] = np.convolve(ir[:, c], np.ones(6) / 6, mode='same')
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    send = bus['lead'] * 0.3 + bus['harm'] * 0.22 + bus['pad'] * 0.08 + bus['drums'] * 0.04
    nfft = 1 << int(np.ceil(np.log2(N + ir_len)))
    for c in range(2):
        wet = np.fft.irfft(np.fft.rfft(send[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N]
        mix[:, c] += wet * 0.32
    Ls = int(round(L * SR))
    out = mix[:Ls].copy()
    out[:N - Ls] += mix[Ls:]
    rms = np.sqrt(np.mean(out ** 2)); out *= 10 ** (-19 / 20) / rms
    out = np.tanh(out * 1.1) / 1.1
    return out, L

def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def measure_lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(r.split('Summary:')[1].split('I:')[1].split('LUFS')[0])

def main():
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument('--out', default=os.path.join(root, 'assets/audio/bgm'))
    ap.add_argument('--preview-dir', default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for song in (song_menu(), song_game()):
        x, L = render(song)
        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, 'bgm.wav')
            write_wav(wav, x)
            lufs = measure_lufs(wav)
            x = x * 10 ** ((TARGET_LUFS - lufs) / 20)
            write_wav(wav, x)
            print(f"[bgm] {song['name']}: {lufs:.1f} -> {measure_lufs(wav):.1f} LUFS, peak {20 * np.log10(np.max(np.abs(x))):.1f} dBFS, {L:.1f}s")
            base = os.path.join(a.out, song['name'])
            ext = os.path.join(td, 'bgm_ext.wav')
            write_wav(ext, np.concatenate([x, x[:int(round(XF_TAIL * SR))]]))
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', ext, '-c:a', 'libmp3lame', '-b:a', '128k', base + '.mp3'], check=True)
            print(f"[bgm] {song['name']}.mp3: loopEnd = {len(x) / SR:.6f} s (+{XF_TAIL}s 交叉淡化尾巴)")
            if a.preview_dir:
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-t', '25', '-af', 'afade=t=out:st=22:d=3', '-b:a', '160k',
                                os.path.join(a.preview_dir, song['name'] + '_preview.mp3')], check=True)

if __name__ == '__main__':
    main()
