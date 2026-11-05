"""抖音版 BGM：做成「可无缝循环」的 mp3。

问题：mp3 编码器会在文件头尾补一段静音 (encoder delay + padding，约 25~40ms)。
      浏览器 / ffmpeg 会读 LAME 头把它裁掉，但抖音 InnerAudioContext 的底层播放器不保证这样做，
      直接 loop=true 时循环接缝处会出现一小段空白。
做法 (两层保险)：
  1. 以无缝的 ogg 成品为母带，解码出精确的一个循环 (L 个采样)，在末尾再接上循环开头的 OVERRUN 秒，
     编码为 mp3 (libmp3lame，写 LAME/Xing 无缝头)。
  2. 运行时 (src/core/platform/tt.js 的 TTLoopAudio) 不用 loop=true，而是两个 InnerAudio 轮流播：
     当前这条播到循环点 L 时，另一条从头开始，在当前这条的「多出来的 OVERRUN」区间里做 XFADE 秒等功率交叉淡化。
     两条在淡化区间播的是同一段音乐，所以接缝处既没有编码器静音，也没有跳变。
输出：assets/douyin/bgm/bgm_<name>.mp3 + src/config/BgmLoopManifest.js (循环长度，供运行时用)
用法：python3 tools/make_tt_bgm.py   (之后 node tools/build.mjs --target douyin 会优先拷这里的文件)
"""
import os, subprocess, json, numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
OVERRUN = 1.0     # 循环点之后多带的秒数 (给运行时计时误差留余量)
XFADE = 0.15      # 运行时交叉淡化长度 (秒)
TRACKS = ['menu', 'battle', 'boss']

def decode(path, naive=False):
    a = ['ffmpeg', '-v', 'error'] + (['-flags2', '+skip_manual'] if naive else []) + ['-i', path, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(a, capture_output=True, check=True).stdout, np.int16).reshape(-1, 2)

def main():
    out_dir = os.path.join(ROOT, 'assets/douyin/bgm')
    os.makedirs(out_dir, exist_ok=True)
    manifest = {}
    for n in TRACKS:
        loop = decode(os.path.join(ROOT, f'assets/audio/bgm/bgm_{n}.ogg'))
        L = len(loop)
        ext = np.concatenate([loop, loop[:int(OVERRUN * SR)]])
        dst = os.path.join(out_dir, f'bgm_{n}.mp3')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-i', '-',
                        '-c:a', 'libmp3lame', '-b:a', '128k', '-write_xing', '1', dst], input=ext.tobytes(), check=True)
        manifest[n] = {'src': f'assets/audio/bgm/bgm_{n}.mp3', 'loop': round(L / SR, 6), 'samples': L, 'overrun': OVERRUN, 'xfade': XFADE}
        print(f'{n:7s} loop {L / SR:.3f}s + overrun {OVERRUN}s -> {os.path.relpath(dst, ROOT)} ({os.path.getsize(dst) / 1024:.0f} KB)')
    js = ('// 由 tools/make_tt_bgm.py 生成，请勿手改。抖音版 BGM 的循环信息 (TTLoopAudio 用)：\n'
          '// loop = 一个循环的长度 (秒)，文件实际长度 = loop + overrun；xfade = 循环点交叉淡化长度\n'
          f'export const BGM_LOOPS = {json.dumps(manifest, indent=2, ensure_ascii=False)};\n')
    open(os.path.join(ROOT, 'src/config/BgmLoopManifest.js'), 'w', encoding='utf8').write(js)

if __name__ == '__main__':
    main()
