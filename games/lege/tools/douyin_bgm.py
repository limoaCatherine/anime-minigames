"""抖音版 BGM：无缝循环 (InnerAudioContext 的 loop 在 mp3 上会因编码器延迟/补零出现几十毫秒空隙)。

做法 (配合 src/platform/LoopAudio.js)：
  1. 从无缝的 ogg 母带解码出整数个采样的循环体 L；
  2. 末尾再接上循环开头的 TAIL 秒 (= 音乐的自然延续)，编码成 mp3 (LAME，带 gapless 信息头)；
  3. 运行时两个 InnerAudioContext 交替：A 播到 L 时 B 从 0 开始，A 继续播"延续段"的同时交叉淡化 XFADE 秒。
     接缝处两路是同一段音乐，即使某些机型解码器不认 gapless 头 (开头多出 ~25 ms 静音)，也被 A 的延续段盖住。
校验 (写入 build/douyin-assets/bgm/report.json)：
  - 解码后首/尾相对母带多出的静音 (gapless 解码) < 5 ms
  - 不认 gapless 头时的原始延迟 (仅供参考)
  - 模拟接缝：按 LoopAudio 的交叉淡化拼接两遍，与"理想循环"(母带重复) 对比，接缝附近不得出现 ≥5 ms 的静音/掉电平
用法：python3 tools/douyin_bgm.py <out_dir>
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'assets', 'audio', 'bgm')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'douyin-assets', 'bgm')
SR = 44100
TAIL = 0.5      # 与 LoopAudio.TAIL 一致
XFADE = 0.25    # 与 LoopAudio.XFADE 一致
os.makedirs(OUT, exist_ok=True)

def decode(path, raw=False):
    args = ['ffmpeg', '-v', 'error']
    if raw:
        args += ['-flags2', '+skip_manual']   # 不跳过编码器延迟 (模拟不认 gapless 头的解码器)
    args += ['-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']
    b = subprocess.run(args, capture_output=True, check=True).stdout
    return np.frombuffer(b, dtype=np.float32).reshape(-1, 2).copy()

def lead_silence(x, thr=10 ** (-60 / 20)):
    m = np.abs(x).max(axis=1)
    idx = np.nonzero(m > thr)[0]
    return int(idx[0]) if len(idx) else len(x)

def trail_silence(x, thr=10 ** (-60 / 20)):
    m = np.abs(x).max(axis=1)
    idx = np.nonzero(m > thr)[0]
    return int(len(x) - 1 - idx[-1]) if len(idx) else len(x)

def rms_win(x, n):
    m = (x ** 2).mean(axis=1)
    k = len(m) // n
    return np.sqrt(m[:k * n].reshape(k, n).mean(axis=1))

report = {}
for name in sorted(os.listdir(SRC)):
    if not name.endswith('.ogg'):
        continue
    key = name[:-4]
    master = decode(os.path.join(SRC, name))
    L = len(master)
    tail = int(TAIL * SR)
    body = np.concatenate([master, master[:tail]])
    wav = os.path.join(OUT, key + '.wav')
    import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(body, -1, 1) * 32767).astype('<i2').tobytes())
    mp3 = os.path.join(OUT, key + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '112k', '-write_xing', '1', mp3], check=True)
    os.remove(wav)

    dec = decode(mp3)          # 认 gapless 头
    raw = decode(mp3, raw=True)
    ms = lambda n: round(n * 1000 / SR, 2)
    extra_lead = lead_silence(dec) - lead_silence(body)
    extra_trail = trail_silence(dec) - trail_silence(body)
    raw_delay = len(raw) - len(dec)

    # 接缝模拟：A 播 [0, L+XFADE)，B 在 L 处从 0 开始；等功率交叉淡化 XFADE 秒
    def seam(B_offset):
        n = int(XFADE * SR)
        A = dec
        Bsig = np.concatenate([np.zeros((B_offset, 2), np.float32), dec]) if B_offset > 0 else dec
        t = np.linspace(0, 1, n, dtype=np.float32)[:, None]
        mix = A[L:L + n] * np.cos(t * np.pi / 2) + Bsig[:n] * np.sin(t * np.pi / 2)
        out = np.concatenate([A[L - SR // 2:L], mix, Bsig[n:n + SR // 2]])
        ideal = np.concatenate([master[L - SR // 2:], master[:n + SR // 2]])
        w = int(0.005 * SR)
        r_out = rms_win(out, w); r_ideal = rms_win(ideal[:len(out)], w)
        # 掉电平：输出 5 ms 窗 RMS 比理想值低 12 dB 以上 (且理想值本身不安静)
        loud = r_ideal > 10 ** (-50 / 20)
        drop = np.sum((r_out < r_ideal * 10 ** (-12 / 20)) & loud)
        silent = np.sum((r_out < 10 ** (-60 / 20)) & loud)
        return {'droppedWindows5ms': int(drop), 'silentWindows5ms': int(silent)}

    report[key] = {
        'loopSamples': L, 'loopSeconds': round(L / SR, 6), 'tailSeconds': TAIL, 'fileBytes': os.path.getsize(mp3),
        'extraLeadSilenceMs': ms(extra_lead), 'extraTrailSilenceMs': ms(extra_trail),
        'rawDecoderDelayMs_noGapless': ms(raw_delay),
        'seamGapless': seam(0), 'seamNoGaplessDecoder': seam(max(0, raw_delay)),
    }
    r = report[key]
    ok = abs(r['extraLeadSilenceMs']) < 5 and abs(r['extraTrailSilenceMs']) < 5 and r['seamGapless']['silentWindows5ms'] == 0 and r['seamNoGaplessDecoder']['silentWindows5ms'] == 0 and r['seamGapless']['droppedWindows5ms'] == 0
    r['ok'] = bool(ok)
    print(f"  {key}: 循环 {L / SR:.3f}s + 尾 {TAIL}s · 首/尾多出静音 {r['extraLeadSilenceMs']}/{r['extraTrailSilenceMs']} ms · "
          f"不认 gapless 头时多出 {r["rawDecoderDelayMs_noGapless"]} ms (延迟+补零，由交叉淡化盖住) · 接缝静音窗 {r['seamGapless']['silentWindows5ms']}/{r['seamNoGaplessDecoder']['silentWindows5ms']} · "
          f"掉电平窗 {r['seamGapless']['droppedWindows5ms']}/{r['seamNoGaplessDecoder']['droppedWindows5ms']} → {'OK' if ok else '不合格'}")
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=2, ensure_ascii=False)
if not all(r['ok'] for r in report.values()):
    sys.exit(3)
