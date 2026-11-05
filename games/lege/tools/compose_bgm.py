#!/usr/bin/env python3
"""
compose_bgm.py — 程序化作曲并渲染《美少女了个美》的 3 首背景音乐 (原创，无第三方素材)
沿用《美少女合成》compose_bgm.py 的做法：numpy 合成乐器 → 分轨混音 → 卷积混响 → 尾音叠回开头实现无缝循环
→ 响度统一 (ffmpeg ebur128 测量后校正到 -22 LUFS，峰值 ≤ -3 dBFS) → ogg (主用，无缝) + mp3 (兜底)

  menu  《樱花便当》   F 大调 84 BPM swing   八音盒 + 电钢琴 + 柔和贝斯 + lo-fi 鼓        菜单 / 选关 / 结算
  game  《午休三连》   C 大调 112 BPM        马林巴主旋律 + 拨弦和弦 + 跳跃贝斯 + 拍手鼓组 + 钟琴   普通关
  hell  《满槽警报》   D 小调 138 BPM        16 分琶音 + 方波主旋律 + 弦乐铺底 + 四踩底鼓       BOSS·地狱关

用法 (需要 numpy 与 ffmpeg)：
    python tools/compose_bgm.py                    # 全部
    python tools/compose_bgm.py game --preview /tmp/game.mp3
"""
import argparse, os, re, subprocess, tempfile, wave
import numpy as np

SR = 44100
TARGET_LUFS = -22.0
TAIL = 5.0
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

# ================= 乐器 =================
def env_ad(n, attack, tau, rel_start=None, rel=0.1):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(attack, 1e-4)) * np.exp(-t / tau)
    if rel_start is not None:
        e *= 1 - np.clip((t - rel_start) / rel, 0, 1)
    return e

def music_box(f, dur, vel):
    n = int((dur + 1.6) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 0.9), (3.0, 0.22, 0.25), (5.2, 0.07, 0.10)):
        for det in (-0.0012, 0.0012):
            out += amp * np.sin(2 * np.pi * f * ratio * (1 + det) * t) * np.exp(-t / tau)
    return out * np.minimum(1.0, t / 0.0015) * vel * 0.5

def epiano(f, dur, vel):
    n = int((dur + 1.2) * SR); t = np.arange(n) / SR
    idx = 1.1 * np.exp(-t / 0.35) + 0.15
    out = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    out += 0.12 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.3)
    return out * env_ad(n, 0.004, 1.3, dur, 0.25) * vel

def marimba(f, dur, vel):
    n = int(1.2 * SR); t = np.arange(n) / SR
    out = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42)
    out += 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.07)
    out += 0.08 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.02)
    return out * np.minimum(1, t / 0.0012) * vel

def glock(f, dur, vel):
    n = int(1.8 * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for r, a, tau in ((1, 1, 1.1), (2.76, .35, .4), (5.40, .15, .15), (8.93, .06, .06)):
        out += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / tau)
    return out * np.minimum(1, t / 0.001) * vel * 0.6

def saw(f, t, nh=12, decay=None, det=(0.0,)):
    out = np.zeros(len(t))
    for d in det:
        for k in range(1, nh + 1):
            if f * k > 14000: break
            a = 1 / k
            if decay is not None: a = a * np.exp(-t * decay * k)
            out += a * np.sin(2 * np.pi * f * (1 + d) * k * t + k * 0.7)
    return out / len(det)

def pluck(f, dur, vel):
    n = int((dur + 0.4) * SR); t = np.arange(n) / SR
    x = saw(f, t, 12, decay=2.2)
    return x * env_ad(n, 0.002, 0.28, dur, 0.06) * vel * 0.6

def arp(f, dur, vel):
    n = int((dur + 0.15) * SR); t = np.arange(n) / SR
    x = saw(f, t, 8, decay=3.5, det=(-0.004, 0.004))
    return x * env_ad(n, 0.002, 0.11, dur, 0.04) * vel * 0.55

def lead(f, dur, vel):
    n = int((dur + 0.25) * SR); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    x = np.sin(ph) + 0.28 * np.sin(3 * ph) + 0.12 * np.sin(5 * ph) + 0.05 * np.sin(7 * ph)
    return x * env_ad(n, 0.012, 2.5, dur, 0.12) * vel * 0.55

def strings(notes, dur, vel):
    n = int((dur + 0.8) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for m in notes:
        out += saw(mtof(m), t, 7, det=(-0.006, 0.0, 0.006))
    e = np.minimum(1, t / 0.35) * (1 - np.clip((t - dur) / 0.6, 0, 1))
    return out * e * vel / len(notes)

def pad(notes, dur, vel):
    n = int((dur + 1.0) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for m in notes:
        f = mtof(m + 12)
        for det in (-0.003, 0.0, 0.003):
            for k in range(1, 6):
                out += np.sin(2 * np.pi * f * k * (1 + det) * t + k) / k ** 1.8
    e = np.minimum(1.0, t / 0.7) * (1 - np.clip((t - dur) / 0.9, 0, 1))
    return out * e * vel / (len(notes) * 3)

def bass_soft(f, dur, vel):
    n = int((dur + 0.3) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    x = np.tanh(1.4 * x) / np.tanh(1.4)
    return x * env_ad(n, 0.008, 0.9, dur, 0.08) * vel

def bass_pluck(f, dur, vel):
    n = int((dur + 0.15) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + saw(f, t, 6, decay=6) * 0.5
    return np.tanh(1.3 * x) * env_ad(n, 0.004, 0.35, dur, 0.05) * vel

# --- 打击乐 (预先生成) ---
_rng = np.random.default_rng(20261011)
def _filt(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = (f >= lo) & (f <= hi)
    return np.fft.irfft(X * g, len(x))
def _norm(x): return x / (np.max(np.abs(x)) + 1e-9)

def kick(punch=1.0):
    n = int(0.4 * SR); t = np.arange(n) / SR
    f = 46 + 90 * punch * np.exp(-t / 0.028)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    x[:200] += _rng.standard_normal(200) * np.linspace(0.3, 0, 200) * punch
    return _norm(x)
def snare():
    n = int(0.25 * SR); t = np.arange(n) / SR
    x = _filt(_rng.standard_normal(n), 900, 9000) * np.exp(-t / 0.07) * 0.8
    x += np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    return _norm(x)
def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR; x = np.zeros(n)
    nz = _filt(_rng.standard_normal(n), 900, 5000)
    for d in (0, 0.011, 0.022):
        i = int(d * SR); x[i:] += nz[:n - i] * np.exp(-np.arange(n - i) / SR / (0.012 if d < 0.02 else 0.09))
    return _norm(x)
def rim():
    n = int(0.18 * SR); t = np.arange(n) / SR
    x = _filt(_rng.standard_normal(n), 1400, 2600) * np.exp(-t / 0.045)
    x += 0.4 * np.sin(2 * np.pi * 330 * t) * np.exp(-t / 0.02)
    return _norm(x)
def hat(open_=False):
    n = int((0.25 if open_ else 0.07) * SR); t = np.arange(n) / SR
    x = _filt(_rng.standard_normal(n), 6500, 16000)
    return _norm(x * np.minimum(1, t / 0.002) * np.exp(-t / (0.08 if open_ else 0.018)))
def shaker():
    n = int(0.07 * SR); t = np.arange(n) / SR
    x = _filt(_rng.standard_normal(n), 5500, 14000)
    return _norm(x * np.minimum(1, t / 0.006) * np.exp(-t / 0.02))

# ================= 曲目 =================
F4, G4, A4, Bb4, C5, D5, E5, F5, G5, A5 = 65, 67, 69, 70, 72, 74, 76, 77, 79, 81
B4, C6, D6, B5, E4, D4 = 71, 84, 86, 83, 64, 62
Cs5, Bb5 = 73, 82

MENU = dict(
    key='menu', title='樱花便当', bpm=84, swing=0.08,
    chords={'Fmaj7': ([53, 57, 60, 64], 41), 'Dm7': ([53, 57, 60, 62], 38), 'Gm7': ([53, 55, 58, 62], 43),
            'C7sus': ([53, 55, 58, 60], 48), 'C7': ([52, 55, 58, 60], 48), 'Am7': ([55, 57, 60, 64], 45),
            'Bbmaj7': ([53, 57, 58, 62], 46)},
    prog=[[('Fmaj7', 4)], [('Dm7', 4)], [('Gm7', 4)], [('C7sus', 2), ('C7', 2)],
          [('Am7', 4)], [('Dm7', 4)], [('Bbmaj7', 4)], [('C7', 4)]],
    mel={'A': [[(0, A4, 1.5), (1.5, C5, .5), (2, F5, 1), (3, E5, 1)],
               [(0, D5, 1), (1, C5, .5), (1.5, A4, .5), (2, F4, 2)],
               [(0, G4, .5), (.5, A4, .5), (1, Bb4, 1), (2, D5, 1.5), (3.5, C5, .5)],
               [(0, C5, 1), (1, Bb4, 1), (2, G4, 2)],
               [(0, E5, 1.5), (1.5, D5, .5), (2, C5, 1), (3, A4, 1)],
               [(0, F5, 1), (1, E5, .5), (1.5, D5, .5), (2, A4, 2)],
               [(0, D5, 1), (1, C5, 1), (2, Bb4, 1), (3, A4, 1)],
               [(0, G4, 3), (3.5, C5, .5)]],
         'B': [[(0, C5, .5), (.5, F5, 1), (1.5, G5, .5), (2, A5, 2)],
               [(0, G5, 1), (1, F5, 1), (2, D5, 1.5), (3.5, C5, .5)],
               [(0, D5, 1), (1, Bb4, 1), (2, G5, 1), (3, F5, 1)],
               [(0, E5, 3), (3.5, G4, .5)],
               [(0, A4, .5), (.5, C5, .5), (1, E5, 1), (2, A5, 1), (3, G5, 1)],
               [(0, F5, 1.5), (1.5, E5, .5), (2, D5, 2)],
               [(0, Bb4, 1), (1, D5, 1), (2, F5, 1), (3, E5, 1)],
               [(0, F5, 3)]]},
    form=['A', 'B', 'A+'],
)

GAME = dict(
    key='game', title='午休三连', bpm=112, swing=0.0,
    chords={'C': ([60, 64, 67], 36), 'G': ([59, 62, 67], 43), 'Am': ([60, 64, 69], 45), 'F': ([60, 65, 69], 41),
            'Em': ([59, 64, 67], 40)},
    progs={'A': [[('C', 4)], [('G', 4)], [('Am', 4)], [('F', 4)], [('C', 4)], [('G', 4)], [('F', 4)], [('G', 4)]],
           'B': [[('F', 4)], [('G', 4)], [('Em', 4)], [('Am', 4)], [('F', 4)], [('G', 4)], [('C', 4)], [('C', 4)]]},
    mel={'A': [[(0, E5, .5), (.5, G5, .5), (1, C6, 1), (2.5, G5, .5), (3, E5, 1)],
               [(0, D5, .5), (.5, E5, .5), (1, D5, .5), (1.5, B4, .5), (2, G4, 1.5), (3.5, B4, .5)],
               [(0, C5, .5), (.5, E5, .5), (1, A5, 1), (2, G5, .5), (2.5, E5, .5), (3, C5, 1)],
               [(0, D5, 1), (1, C5, .5), (1.5, A4, .5), (2, C5, 2)],
               [(0, E5, .5), (.5, G5, .5), (1, C6, 1), (2, D6, .5), (2.5, C6, .5), (3, G5, 1)],
               [(0, B5, 1), (1, A5, .5), (1.5, G5, .5), (2, D5, 2)],
               [(0, A5, .5), (.5, G5, .5), (1, F5, .5), (1.5, E5, .5), (2, D5, 1), (3, C5, 1)],
               [(0, D5, 2), (2.5, G4, .5), (3, B4, .5), (3.5, D5, .5)]],
         'B': [[(0, A5, 1.5), (1.5, G5, .5), (2, F5, 1), (3, A5, 1)],
               [(0, G5, 1.5), (1.5, F5, .5), (2, D5, 2)],
               [(0, E5, .5), (.5, G5, .5), (1, B5, 1), (2, A5, .5), (2.5, G5, .5), (3, E5, 1)],
               [(0, A5, 2), (2, C6, 1), (3, B5, 1)],
               [(0, A5, 1), (1, F5, .5), (1.5, A5, .5), (2, C6, 1), (3, A5, 1)],
               [(0, B5, 1), (1, D6, 1), (2, B5, .5), (2.5, G5, .5), (3, D5, 1)],
               [(0, E5, .5), (.5, G5, .5), (1, C6, 2), (3, G5, 1)],
               [(0, C6, 2), (3, G4, .5), (3.5, B4, .5)]]},
    form=['A', 'A+', 'B', 'A'],
)

HELL = dict(
    key='hell', title='满槽警报', bpm=138, swing=0.0,
    chords={'Dm': ([62, 65, 69], 38), 'Bb': ([62, 65, 70], 34), 'C': ([60, 64, 67], 36), 'A': ([61, 64, 69], 33),
            'Gm': ([62, 67, 70], 31)},
    progs={'A': [[('Dm', 4)], [('Bb', 4)], [('C', 4)], [('A', 4)], [('Dm', 4)], [('Bb', 4)], [('Gm', 4)], [('A', 4)]]},
    mel={'A': [[(0, D5, .75), (.75, F5, .75), (1.5, A5, 1), (2.5, G5, .5), (3, F5, .5), (3.5, E5, .5)],
               [(0, F5, 1.5), (1.5, D5, .5), (2, Bb4, 2)],
               [(0, C5, .5), (.5, E5, .5), (1, G5, 1), (2, F5, .5), (2.5, E5, .5), (3, C5, 1)],
               [(0, Cs5, 1.5), (1.5, E5, .5), (2, A5, 2)],
               [(0, A5, .75), (.75, G5, .75), (1.5, F5, 1), (2.5, E5, .5), (3, D5, 1)],
               [(0, D5, .5), (.5, F5, .5), (1, A5, 1), (2, G5, 1), (3, F5, 1)],
               [(0, G5, 1), (1, Bb5, 1), (2, A5, 1), (3, G5, 1)],
               [(0, E5, 1), (1, Cs5, 1), (2, A4, 1), (3, E5, 1)]]},
    form=['intro', 'A', 'A+'],
)

# ================= 渲染 =================
def render(song):
    bpm = song['bpm']; BEAT = 60.0 / bpm; BAR = 4 * BEAT
    swing = song.get('swing', 0)
    sw = lambda b: b + swing if abs(b % 1 - 0.5) < 1e-6 else b
    form = song['form']
    nbars = 8 * len(form)
    L = nbars * BAR
    N = int((L + TAIL) * SR)
    buses = {k: np.zeros((N, 2)) for k in ('lead', 'harm', 'bass', 'pad', 'drums', 'sparkle')}
    rng = np.random.default_rng(hash(song['key']) % 2**32)

    def put(bus, sig, t0, pan=0.0, gain=1.0):
        i = int(round(t0 * SR)); j = min(N, i + len(sig))
        if j <= i or i < 0: return
        s = sig[:j - i] * gain
        buses[bus][i:j, 0] += s * np.cos((pan + 1) * np.pi / 4)
        buses[bus][i:j, 1] += s * np.sin((pan + 1) * np.pi / 4)

    K, K2, S, CL, R, H, HO, SH = kick(1.0), kick(0.6), snare(), clap(), rim(), hat(), hat(True), shaker()
    key = song['key']
    for sec, part in enumerate(form):
        base = part.rstrip('+')
        plus = part.endswith('+')
        prog = song['progs'][base if base in song.get('progs', {}) else 'A'] if 'progs' in song else song['prog']
        mel = song['mel'].get(base)
        for inbar in range(8):
            b = sec * 8 + inbar
            t_bar = b * BAR
            last_bar = (b == nbars - 1)
            beat = 0
            for name, length in prog[inbar]:
                notes, root = song['chords'][name]
                t0 = t_bar + beat * BEAT
                if key == 'menu':
                    hits = [(0, 1.8, 0.55), (2.5, 1.3, 0.38)] if length == 4 else [(0, 1.7, 0.5)]
                    for off, d, v in hits:
                        for k, m in enumerate(notes):
                            put('harm', epiano(mtof(m), d * BEAT, v * (0.9 + 0.2 * rng.random())), t0 + sw(off) * BEAT + k * 0.012, pan=-0.25)
                    put('pad', pad(notes, length * BEAT, 1.0), t0)
                    bl = [(0, root, 1.7, 0.9), (2, root, 0.9, 0.7), (3, root + 7, 0.9, 0.6)] if length == 4 else [(0, root, 1.7, 0.85)]
                    for off, m, d, v in bl:
                        put('bass', bass_soft(mtof(m), d * BEAT, v), t0 + off * BEAT)
                elif key == 'game':
                    for off in (0.5, 1.5, 2.5, 3.5):         # 反拍拨弦和弦
                        for k, m in enumerate(notes):
                            put('harm', pluck(mtof(m), 0.35 * BEAT, 0.42 * (0.9 + 0.2 * rng.random())), t0 + off * BEAT + k * 0.006, pan=(-0.35, 0.0, 0.35)[k])
                    put('pad', pad(notes, length * BEAT, 0.6), t0)
                    for off, m in ((0, root), (1, root + 12), (1.5, root + 7), (2, root), (3, root + 12), (3.5, root + 7)):
                        put('bass', bass_pluck(mtof(m), 0.4 * BEAT, 0.8 if off in (0, 2) else 0.55), t0 + off * BEAT)
                else:  # hell
                    seq = notes + [notes[0] + 12, notes[2], notes[1]] + notes[::-1] + [notes[0] + 12, notes[1] + 12]
                    if sec > 0 or inbar >= 2:
                        for s16 in range(16):
                            m = seq[s16 % len(seq)] + 12
                            v = 0.55 if s16 % 4 == 0 else 0.36
                            put('harm', arp(mtof(m), 0.2 * BEAT, v), t0 + s16 * BEAT / 4, pan=0.3 * np.sin(s16 * 0.7))
                    if sec > 0:
                        put('pad', strings(notes, length * BEAT, 0.9 if plus else 0.55), t0)
                    for e8 in range(8):
                        m = root + (12 if e8 % 2 else 0)
                        put('bass', bass_pluck(mtof(m), 0.45 * BEAT, 0.85 if e8 % 2 == 0 else 0.6), t0 + e8 * BEAT / 2)
                beat += length
            # 旋律
            if mel:
                for off, m, d in mel[inbar]:
                    v = 0.75 + 0.2 * rng.random()
                    st = t_bar + sw(off) * BEAT + rng.normal(0, 0.004)   # 一点点"人手"误差
                    if key == 'menu':
                        put('lead', music_box(mtof(m + 12), d * BEAT, v), st, pan=0.2)
                        if plus: put('sparkle', music_box(mtof(m + 24), d * BEAT, v * 0.22), st + 0.006, pan=0.45)
                    elif key == 'game':
                        put('lead', marimba(mtof(m), d * BEAT, v), st, pan=0.1)
                        if plus or base == 'B': put('sparkle', glock(mtof(m + 12), d * BEAT, v * 0.32), st + 0.004, pan=-0.3)
                    else:
                        put('lead', lead(mtof(m), d * BEAT * 0.92, v), st, pan=0.0)
                        if plus: put('lead', lead(mtof(m + 12), d * BEAT * 0.92, v * 0.35), st + 0.008, pan=0.25)
                        if plus: put('sparkle', music_box(mtof(m + 12), d * BEAT, v * 0.3), st, pan=-0.35)
            # 鼓
            if key == 'menu':
                light = (sec == 0 and inbar < 2)
                for e in range(8):
                    g = 0.6 if e % 2 == 0 else 0.4
                    put('drums', SH, t_bar + sw(e / 2) * BEAT, pan=0.35, gain=g * (0.6 if light else 1.0) * (0.85 + 0.3 * rng.random()))
                if not light:
                    for off, gk in ((0, 1.0), (2.5, 0.7)):
                        if not (last_bar and off > 2): put('drums', K2, t_bar + sw(off) * BEAT, gain=gk)
                    for off in (1, 3): put('drums', R, t_bar + off * BEAT, pan=-0.1, gain=0.8)
                    if last_bar:
                        for off in (3.5, 3.75): put('drums', R, t_bar + off * BEAT, pan=0.1, gain=0.45)
            elif key == 'game':
                for off in (0, 2): put('drums', K, t_bar + off * BEAT, gain=0.95)
                if inbar % 2 == 1: put('drums', K, t_bar + 2.75 * BEAT, gain=0.5)
                for off in (1, 3): put('drums', CL, t_bar + off * BEAT, pan=0.05, gain=0.7)
                for e in range(8):
                    put('drums', HO if e == 7 and inbar == 7 else H, t_bar + e * BEAT / 2, pan=0.3, gain=(0.5 if e % 2 else 0.32) * (0.85 + 0.3 * rng.random()))
                if inbar == 7:
                    for off in (3.25, 3.5, 3.75): put('drums', S, t_bar + off * BEAT, gain=0.35 + 0.1 * off)
            else:
                for off in range(4): put('drums', K, t_bar + off * BEAT, gain=1.0)
                if sec > 0 or inbar >= 4:
                    for off in (1, 3): put('drums', S, t_bar + off * BEAT, gain=0.75)
                for s16 in range(16):
                    put('drums', H, t_bar + s16 * BEAT / 4, pan=-0.3, gain=(0.30 if s16 % 4 == 2 else 0.15) * (0.85 + 0.3 * rng.random()))
                if inbar == 7:
                    for k in range(8): put('drums', S, t_bar + (2 + k * 0.25) * BEAT, gain=0.25 + 0.06 * k)

    W = {'menu': dict(lead=.30, harm=.20, bass=.34, pad=.05, drums=.22, sparkle=.30),
         'game': dict(lead=.34, harm=.16, bass=.30, pad=.05, drums=.30, sparkle=.25),
         'hell': dict(lead=.26, harm=.16, bass=.30, pad=.10, drums=.34, sparkle=.20)}[key]
    mix = sum(buses[k] * W[k] for k in buses)
    # 混响
    ir_len = int(2.0 * SR); t = np.arange(ir_len) / SR
    ir = rng.standard_normal((ir_len, 2)) * np.exp(-t / (0.5 if key == 'menu' else 0.35))[:, None]
    for c in range(2): ir[:, c] = np.convolve(ir[:, c], np.ones(6) / 6, mode='same')
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    send = buses['lead'] * W['lead'] * 0.30 + buses['harm'] * W['harm'] * 0.2 + buses['pad'] * W['pad'] * 0.3 + buses['sparkle'] * W['sparkle'] * 0.4 + buses['drums'] * W['drums'] * 0.04
    nfft = 1 << int(np.ceil(np.log2(N + ir_len)))
    for c in range(2):
        wet = np.fft.irfft(np.fft.rfft(send[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N]
        mix[:, c] += wet * 0.35
    if key == 'menu':   # 极轻黑胶噪声
        crack = np.zeros(N); pos = rng.integers(0, N, int(5 * N / SR))
        crack[pos] = rng.standard_normal(len(pos)) * rng.random(len(pos)) ** 3
        mix += (np.diff(crack, prepend=0) * 0.04 + rng.standard_normal(N) * 0.0012)[:, None]
    # 无缝循环：尾音叠回开头
    Ls = int(round(L * SR))
    out = mix[:Ls].copy()
    out[:N - Ls] += mix[Ls:]
    return out, L, nbars

def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def measure(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); P = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])
    return I, P

def master(x, td):
    """把整体响度校正到 TARGET_LUFS，柔和限幅保证峰值 ≤ -3 dBFS"""
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.5
    for _ in range(3):
        p = os.path.join(td, 'm.wav'); write_wav(p, x)
        I, P = measure(p)
        x = x * 10 ** ((TARGET_LUFS - I) / 20)
        ceil = 10 ** (-3.2 / 20)
        x = np.where(np.abs(x) > ceil * 0.8, np.sign(x) * (ceil * 0.8 + (ceil * 0.2) * np.tanh((np.abs(x) - ceil * 0.8) / (ceil * 0.2))), x)
        if abs(I - TARGET_LUFS) < 0.2: break
    return x

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('tracks', nargs='*', default=['menu', 'game', 'hell'])
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets/audio/bgm'))
    ap.add_argument('--preview', default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    songs = {'menu': MENU, 'game': GAME, 'hell': HELL}
    for k in a.tracks:
        song = songs[k]
        x, L, nb = render(song)
        with tempfile.TemporaryDirectory() as td:
            x = master(x, td)
            wav = os.path.join(td, 'bgm.wav'); write_wav(wav, x)
            ogg = os.path.join(a.out, f'bgm_{k}.ogg'); mp3 = os.path.join(a.out, f'bgm_{k}.mp3')
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '3', ogg], check=True)
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '112k', mp3], check=True)
            if a.preview:
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-t', '20', '-af', 'afade=t=out:st=17.5:d=2.5', a.preview], check=True)
            I, P = measure(ogg)
        print(f'[bgm] {k} 《{song["title"]}》 {L:.2f}s ({nb} 小节 @ {song["bpm"]} BPM)  {I:.1f} LUFS  peak {P:.1f} dBFS -> {os.path.relpath(ogg, ROOT)}')

if __name__ == '__main__':
    main()
