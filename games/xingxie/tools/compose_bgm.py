#!/usr/bin/env python3
"""
compose_bgm.py — 程序化作曲并渲染《星屑轮舞》的三首背景音乐 (原创，无第三方素材)。
沿用《画线守护美少女》compose_bgm.py 的做法：numpy 加法合成 → 混响 → 尾音叠回开头做无缝循环 → 响度统一 -22 LUFS → ogg + mp3。

  menu   《午夜的星屑》  E♭ 大调 92 BPM  八音盒 + 柔和铺底 + 拨弦低音，安静的夜
  battle 《星屑轮舞》    A 小调 / C 大调 140 BPM  明亮的方波主旋律 + 十六分琶音 + 四拍底鼓，跑起来的感觉
  boss   《梦魇进行曲》  D 小调 152 BPM  低音八度跳进 + 紧张的弦乐顿音 + 军鼓滚奏

用法：python tools/compose_bgm.py [--only battle] [--preview /tmp/x.mp3]
输出：assets/audio/bgm/bgm_<name>.ogg / .mp3
"""
import argparse, os, subprocess, tempfile, wave
import numpy as np

SR = 44100
TAIL = 4.0
TARGET_LUFS = -22.0

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------------- 音色 ----------------
def env_adsr(n, a, d, s, r_start, r, t):
    e = np.minimum(1, t / max(a, 1e-4))
    e = np.where(t > a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)), e)
    rel = 1 - np.clip((t - r_start) / max(r, 1e-4), 0, 1)
    return e * rel

def tone(f, dur, vel, harm, decay=0.4, attack=0.004, sustain=0.0, rel=0.08, vib=0.0, rng=None):
    n = int((dur + rel + 0.05) * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    if vib: ph = 2 * np.pi * np.cumsum(f * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.3))) / SR
    out = np.zeros(n)
    for k, amp in harm:
        if f * k > SR * 0.45: break
        out += amp * np.sin(ph * k + (rng.random() * 0.4 if rng is not None else 0))
    return out * env_adsr(n, attack, decay, sustain, dur, rel, t) * vel

SQUARE = [(1, 1), (3, 0.28), (5, 0.12), (7, 0.06), (2, 0.08)]
BELL = [(1, 1), (2.0, 0.25), (3.01, 0.12), (4.2, 0.05)]
SAW = [(k, 1 / k) for k in range(1, 9)]

def lead(f, d, v, rng):  return tone(f, d, v, SQUARE, decay=0.5, sustain=0.45, rel=0.07, vib=0.004, rng=rng)
def arp(f, d, v, rng):   return tone(f, d, v, BELL, decay=0.12, sustain=0.0, rel=0.05, rng=rng)
def bass(f, d, v, rng):  return tone(f, d, v, [(1, 1), (2, 0.35), (3, 0.12)], decay=0.25, sustain=0.5, rel=0.04, rng=rng) * 1.2
def pluckb(f, d, v, rng): return tone(f, d, v, [(1, 1), (2, 0.3), (3, 0.08)], decay=0.35, sustain=0.0, rel=0.1, rng=rng) * 1.2

def box(f, d, v, rng):
    n = int((d + 1.2) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for r, a, tau in ((1, 1, 1.0), (2.76, 0.16, 0.25), (5.4, 0.04, 0.1)):
        out += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / tau)
    return out * np.minimum(1, t / 0.002) * v * 0.5

def pad(notes, d, v, rng, bright=1.0):
    n = int((d + 0.8) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for det in (-0.005, 0.0, 0.005):
            for k in range(1, 7):
                out += np.sin(2 * np.pi * f * k * (1 + det) * t + rng.random() * 6) / (k ** (2.2 - 0.6 * bright))
    e = np.minimum(1, t / 0.5) * (1 - np.clip((t - d) / 0.8, 0, 1))
    return out * e * v / (len(notes) * 3)

def stab(notes, d, v, rng):   # 弦乐顿音 (boss)
    n = int((d + 0.15) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for det in (-0.006, 0.006):
            for k in range(1, 8):
                out += np.sin(2 * np.pi * f * k * (1 + det) * t) / k ** 1.3
    return out * np.minimum(1, t / 0.01) * np.exp(-t / 0.12) * v / (len(notes) * 2)

def kick(rng):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 48 + 80 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14) + 0.15 * rng.standard_normal(n) * np.exp(-t / 0.004)

def hp(x, fc):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * (fr / np.sqrt(fr ** 2 + fc ** 2)), len(x))

def lp(x, fc):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (fr / fc) ** 2), len(x))

def snare(rng):
    n = int(0.25 * SR); t = np.arange(n) / SR
    nz = hp(rng.standard_normal(n), 1500) * np.exp(-t / 0.07)
    return (0.7 * nz + 0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)) / 1.2

def hat(rng, open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7000) * np.exp(-t / (0.08 if open_ else 0.015))
    return x / (np.max(np.abs(x)) + 1e-9)

# ---------------- 旋律：由和弦音 + 节奏动机生成 ----------------
def melody(prog, chords, motifs, rng, octave=0, steps=None):
    """motifs: 每 2 小节一个节奏动机 [(拍, 时值, 音级偏移)]；音级偏移在和弦音 + 经过音里走"""
    out = []
    for bar, ch in enumerate(prog):
        notes = sorted(set([m % 12 for m in chords[ch][0]]))
        motif = motifs[(bar // 2) % len(motifs)]
        half = bar % 2
        for (beat, dur, deg) in motif:
            if (beat >= 4) != bool(half): continue
            b = beat - 4 * half
            root = chords[ch][0][0]
            scale = steps or [0, 2, 3, 5, 7, 8, 10]
            pool = sorted(set(chords[ch][0] + [chords[ch][0][0] + 12, chords[ch][0][1] + 12]))
            m = pool[deg % len(pool)] + 12 * (deg // len(pool)) + octave
            out.append((bar, b, dur, m))
    return out

# ---------------- 曲目 ----------------
def render_track(spec, seed):
    rng = np.random.default_rng(seed)
    BEAT = 60.0 / spec['bpm']; BAR = 4 * BEAT
    bars = spec['bars']
    L = len(bars) * BAR
    N = int((L + TAIL) * SR)
    buses = {k: np.zeros((N, 2)) for k in ('lead', 'arp', 'bass', 'pad', 'drums', 'box', 'stab')}

    def put(bus, sig, t0, pan=0.0, gain=1.0):
        i = int(round(t0 * SR)); j = min(N, i + len(sig))
        if j <= i or i < 0: return
        s = sig[:j - i] * gain
        buses[bus][i:j, 0] += s * np.cos((pan + 1) * np.pi / 4)
        buses[bus][i:j, 1] += s * np.sin((pan + 1) * np.pi / 4)

    K, S, H, HO = kick(rng), snare(rng), hat(rng), hat(rng, True)
    hum = lambda: 0.88 + 0.24 * rng.random()
    chords = spec['chords']
    for bi, (sec, ch) in enumerate(bars):
        t0 = bi * BAR
        notes, root = chords[ch]
        st = spec['sections'][sec]
        # pad
        if st.get('pad'): put('pad', pad(notes, BAR, st['pad'], rng, st.get('bright', 1.0)), t0)
        # arp
        if st.get('arp'):
            pat = st.get('arpPat', [0, 1, 2, 3, 2, 1, 2, 3])
            div = st.get('arpDiv', 4)                      # 每拍几个
            for e in range(4 * div):
                m = notes[pat[e % len(pat)] % len(notes)] + 12 * st.get('arpOct', 1)
                put('arp', arp(mtof(m), BEAT / div * 0.9, st['arp'] * hum() * (1.15 if e % div == 0 else 0.85), rng), t0 + e * BEAT / div, pan=0.25 * np.sin(e * 0.7))
        # bass
        bp = st.get('bassPat')
        if bp:
            for (beat, dur, iv, v) in bp:
                m = root + iv
                fn = pluckb if st.get('softBass') else bass
                put('bass', fn(mtof(m), dur * BEAT, v * hum(), rng), t0 + beat * BEAT)
        # stabs
        if st.get('stab'):
            for (beat, v) in st['stabPat']:
                put('stab', stab(notes, 0.3 * BEAT, st['stab'] * v, rng), t0 + beat * BEAT, pan=-0.2)
        # drums
        dp = st.get('drums')
        if dp:
            for beat in dp.get('k', []): put('drums', K, t0 + beat * BEAT, gain=0.9)
            for beat in dp.get('s', []): put('drums', S, t0 + beat * BEAT, pan=0.05, gain=0.55 * hum())
            for beat in dp.get('h', []): put('drums', H, t0 + beat * BEAT, pan=0.35, gain=0.22 * hum())
            for beat in dp.get('o', []): put('drums', HO, t0 + beat * BEAT, pan=0.35, gain=0.18)
            if bi % 8 == 7 and dp.get('fill'):
                for e in range(8): put('drums', S, t0 + (2 + e * 0.25) * BEAT, gain=0.25 + 0.05 * e)
    # melody
    for sec, (lead_fn, motifs, octave, vel, bus) in spec['melodies'].items():
        idx = [i for i, (s, _) in enumerate(bars) if s == sec]
        if not idx: continue
        groups = []
        for i in idx:
            if groups and groups[-1][-1] == i - 1: groups[-1].append(i)
            else: groups.append([i])
        for g in groups:
            prog = [bars[i][1] for i in g]
            for (bar, b, dur, m) in melody(prog, chords, motifs, rng, octave):
                t = (g[0] + bar) * BAR + b * BEAT
                fn = {'lead': lead, 'box': box, 'arp': arp}[lead_fn]
                put(bus, fn(mtof(m), dur * BEAT * 0.92, vel * hum(), rng), t, pan=0.1)
    mx = spec['mix']
    mix = sum(buses[k] * mx.get(k, 0) for k in buses)
    # 混响
    ir_len = int(1.8 * SR); t = np.arange(ir_len) / SR
    ir = rng.standard_normal((ir_len, 2)) * np.exp(-t / spec.get('verb', 0.4))[:, None]
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    send = buses['lead'] * 0.2 + buses['arp'] * 0.3 + buses['box'] * 0.4 + buses['pad'] * 0.1 + buses['stab'] * 0.2
    nfft = 1 << int(np.ceil(np.log2(N + ir_len)))
    for c in range(2):
        wet = np.fft.irfft(np.fft.rfft(send[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N]
        mix[:, c] += wet * 0.28
        mix[:, c] = 0.7 * mix[:, c] + 0.3 * lp(mix[:, c], spec.get('lp', 7000))
    Ls = int(round(L * SR))
    out = mix[:Ls].copy()
    out[:N - Ls] += mix[Ls:]
    out *= 10 ** (-18 / 20) / np.sqrt(np.mean(out ** 2))
    out = np.tanh(out * 1.05) / 1.05
    return out, L

# 和弦表 (中音区和弦音, 低音根音)
CH_MENU = {'Eb': ([63, 67, 70, 74], 39), 'Cm': ([60, 63, 67, 70], 36), 'Ab': ([60, 63, 68, 72], 44), 'Bb': ([62, 65, 70, 74], 46),
           'Gm': ([62, 67, 70, 74], 43), 'Fm': ([60, 65, 68, 72], 41)}
CH_BATTLE = {'Am': ([64, 69, 72, 76], 45), 'F': ([65, 69, 72, 77], 41), 'C': ([64, 67, 72, 76], 48), 'G': ([62, 67, 71, 74], 43),
             'Dm': ([62, 65, 69, 74], 38), 'E': ([64, 68, 71, 76], 40), 'Em': ([64, 67, 71, 76], 40)}
CH_BOSS = {'Dm': ([62, 65, 69, 74], 38), 'Bb': ([62, 65, 70, 74], 46), 'Gm': ([62, 67, 70, 74], 43), 'A': ([61, 64, 69, 73], 45),
           'C': ([64, 67, 72, 76], 48), 'F': ([65, 69, 72, 77], 41), 'Eb': ([63, 67, 70, 75], 39)}

FOUR = {'k': [0, 1, 2, 3], 's': [1, 3], 'h': [0.5, 1.5, 2.5, 3.5], 'o': [], 'fill': True}
HALF = {'k': [0, 2.5], 's': [], 'h': [0.5, 1.5, 2.5, 3.5]}

TRACKS = {
    'menu': {
        'bpm': 92, 'verb': 0.6, 'lp': 5200,
        'chords': CH_MENU,
        'bars': [('a', c) for c in ['Eb', 'Cm', 'Ab', 'Bb'] * 2] + [('b', c) for c in ['Ab', 'Bb', 'Gm', 'Cm', 'Fm', 'Bb', 'Eb', 'Bb']],
        'sections': {
            'a': {'pad': 0.8, 'bassPat': [(0, 2.5, 0, 0.6), (3, 1, 7, 0.35)], 'softBass': True, 'arp': 0.18, 'arpDiv': 2, 'arpPat': [0, 2, 1, 3], 'arpOct': 1},
            'b': {'pad': 1.0, 'bright': 1.2, 'bassPat': [(0, 1.5, 0, 0.6), (1.5, 1, 7, 0.35), (2.5, 1.5, 12, 0.35)], 'softBass': True,
                  'arp': 0.2, 'arpDiv': 2, 'arpPat': [0, 1, 2, 3, 2, 1, 0, 1], 'drums': {'k': [0], 'h': [1, 3]}},
        },
        'melodies': {
            'a': ('box', [[(0, 1.5, 4), (1.5, 0.5, 3), (2, 2, 2), (4, 1, 1), (5, 1, 2), (6, 2, 4)],
                          [(0, 1, 5), (1, 1, 4), (2, 1.5, 3), (3.5, 0.5, 2), (4, 3, 1)]], 12, 0.55, 'box'),
            'b': ('box', [[(0, 0.5, 2), (0.5, 0.5, 3), (1, 1, 4), (2, 1, 5), (3, 1, 4), (4, 2, 3), (6, 1, 2), (7, 1, 1)],
                          [(0, 1.5, 5), (1.5, 0.5, 4), (2, 1, 3), (3, 1, 4), (4, 4, 2)]], 12, 0.5, 'box'),
        },
        'mix': {'box': 0.42, 'arp': 0.18, 'pad': 0.07, 'bass': 0.3, 'drums': 0.1},
    },
    'battle': {
        'bpm': 140, 'verb': 0.35, 'lp': 8000,
        'chords': CH_BATTLE,
        'bars': [('i', c) for c in ['Am', 'F', 'C', 'G']] + [('a', c) for c in ['Am', 'F', 'C', 'G'] * 2]
                + [('b', c) for c in ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E']] + [('a', c) for c in ['Am', 'F', 'C', 'G'] * 2]
                + [('c', c) for c in ['F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E']],
        'sections': {
            'i': {'pad': 0.7, 'arp': 0.22, 'arpDiv': 4, 'drums': HALF, 'bassPat': [(0, 3.5, 0, 0.6)]},
            'a': {'pad': 0.5, 'arp': 0.2, 'arpDiv': 4, 'drums': FOUR,
                  'bassPat': [(0, .45, 0, .8), (.5, .45, 12, .5), (1, .45, 0, .7), (1.5, .45, 12, .5), (2, .45, 0, .7), (2.5, .45, 12, .5), (3, .45, 7, .7), (3.5, .45, 12, .5)]},
            'b': {'pad': 0.8, 'bright': 1.3, 'arp': 0.18, 'arpDiv': 4, 'arpPat': [0, 2, 1, 3], 'drums': {**FOUR, 'o': [0.5, 1.5, 2.5, 3.5], 'h': []},
                  'bassPat': [(0, .9, 0, .8), (1, .45, 0, .6), (1.5, .45, 7, .5), (2, .9, 0, .7), (3, .45, 12, .5), (3.5, .45, 7, .6)]},
            'c': {'pad': 0.9, 'arp': 0.14, 'arpDiv': 2, 'drums': HALF, 'bassPat': [(0, 1.5, 0, 0.6), (2, 1.5, 7, 0.5)]},
        },
        'melodies': {
            'a': ('lead', [[(0, .5, 4), (.5, .5, 5), (1, 1, 4), (2, .5, 3), (2.5, .5, 2), (3, 1, 3), (4, 1.5, 2), (5.5, .5, 1), (6, 2, 2)],
                           [(0, .5, 2), (.5, .5, 3), (1, .5, 4), (1.5, .5, 5), (2, 1, 6), (3, 1, 5), (4, .5, 4), (4.5, .5, 3), (5, 1, 4), (6, 1.5, 5), (7.5, .5, 4)]], 0, 0.42, 'lead'),
            'b': ('lead', [[(0, 1.5, 5), (1.5, .5, 4), (2, 1, 3), (3, 1, 5), (4, 3, 4), (7, .5, 3), (7.5, .5, 2)],
                           [(0, 1, 3), (1, 1, 4), (2, 1, 5), (3, 1, 6), (4, 2, 5), (6, 2, 3)]], 0, 0.4, 'lead'),
            'c': ('arp', [[(0, 2, 5), (2, 2, 4), (4, 4, 3)]], 12, 0.3, 'lead'),
        },
        'mix': {'lead': 0.26, 'arp': 0.16, 'pad': 0.06, 'bass': 0.3, 'drums': 0.22},
    },
    'boss': {
        'bpm': 152, 'verb': 0.3, 'lp': 7000,
        'chords': CH_BOSS,
        'bars': [('i', c) for c in ['Dm', 'Dm', 'Bb', 'A']] + [('a', c) for c in ['Dm', 'Bb', 'Gm', 'A'] * 2]
                + [('b', c) for c in ['Bb', 'C', 'F', 'A', 'Gm', 'Eb', 'A', 'A']] + [('a', c) for c in ['Dm', 'Bb', 'Gm', 'A'] * 2],
        'sections': {
            'i': {'pad': 0.8, 'stab': 0.9, 'stabPat': [(0, 1), (0.75, .7), (1.5, .8)], 'drums': {'k': [0, 1.5], 's': [], 'h': [], 'fill': True},
                  'bassPat': [(0, .4, 0, .9), (.75, .4, 0, .7), (1.5, .4, 0, .8)]},
            'a': {'pad': 0.5, 'stab': 0.7, 'stabPat': [(0, 1), (1.5, .7), (2.5, .8)], 'arp': 0.13, 'arpDiv': 4, 'arpPat': [0, 1, 2, 1], 'arpOct': 0,
                  'drums': {'k': [0, 1, 2, 3], 's': [1, 3], 'h': [0.5, 1.5, 2.5, 3.5, 3.75], 'fill': True},
                  'bassPat': [(e * .5, .4, 12 if e % 2 else 0, .8 if e % 2 == 0 else .6) for e in range(8)]},
            'b': {'pad': 0.8, 'bright': 1.4, 'stab': 0.6, 'stabPat': [(0, 1), (2, .8)], 'arp': 0.12, 'arpDiv': 4, 'arpOct': 1,
                  'drums': {'k': [0, 0.75, 2, 2.75], 's': [1, 3], 'h': [e * .5 for e in range(8)], 'fill': True},
                  'bassPat': [(0, 1.4, 0, .8), (1.5, .45, 7, .6), (2, 1.4, 0, .7), (3.5, .45, 12, .6)]},
        },
        'melodies': {
            'a': ('lead', [[(0, 1, 4), (1, .5, 3), (1.5, .5, 4), (2, 1, 5), (3, 1, 3), (4, 1.5, 2), (5.5, .5, 3), (6, 2, 1)],
                           [(0, .5, 4), (.5, .5, 5), (1, .5, 6), (1.5, .5, 5), (2, 1, 4), (3, 1, 3), (4, 3, 4), (7, 1, 2)]], 0, 0.36, 'lead'),
            'b': ('lead', [[(0, 2, 5), (2, 1, 6), (3, 1, 5), (4, 2, 4), (6, 2, 3)]], 12, 0.32, 'lead'),
        },
        'mix': {'lead': 0.24, 'arp': 0.12, 'pad': 0.06, 'bass': 0.32, 'drums': 0.24, 'stab': 0.2},
    },
}

def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def measure_lufs(wav):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    lines = [l for l in r.stderr.splitlines() if l.strip().startswith('I:')]
    return float(lines[-1].split()[1])

def main():
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument('--out', default=os.path.join(root, 'assets/audio/bgm'))
    ap.add_argument('--only', default=None)
    ap.add_argument('--preview', default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for i, (name, spec) in enumerate(TRACKS.items()):
        if a.only and name != a.only: continue
        x, L = render_track(spec, 20261011 + i * 101)
        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, 'bgm.wav')
            write_wav(wav, x)
            lufs = measure_lufs(wav)
            x = x * 10 ** ((TARGET_LUFS - lufs) / 20)
            write_wav(wav, x)
            print(f'[bgm] {name}: {L:.1f}s, loudness {lufs:.1f} -> {measure_lufs(wav):.1f} LUFS, peak {np.max(np.abs(x)):.2f}')
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', os.path.join(a.out, f'bgm_{name}.ogg')], check=True)
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', os.path.join(a.out, f'bgm_{name}.mp3')], check=True)
            if a.preview:
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-t', '25', '-c:a', 'libmp3lame', '-b:a', '128k', a.preview.replace('.mp3', f'_{name}.mp3')], check=True)

if __name__ == '__main__':
    main()
