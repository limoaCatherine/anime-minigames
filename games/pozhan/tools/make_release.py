#!/usr/bin/env python3
"""生成 GitHub Release 用的两个「下载即玩」压缩包。
  python3 tools/make_release.py [输出目录]   (默认 /workspace/_release)
前置：npm run build 与 npm run package:win 已完成。
  ciyuan-pozhan-windows.zip → 解压得到 次元破绽/次元破绽.exe (+ 运行库、licenses/、开始游戏.bat、怎么玩.txt)
  ciyuan-pozhan-web.zip     → 解压得到 次元破绽-网页版/index.html (双击即可离线玩)
"""
import json, os, shutil, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/_release'
_v = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']
VER = _v[:-2] if _v.endswith('.0') else _v  # 1.3.0 → 1.3
STAGE = os.path.join(OUT, 'stage')

WIN_NOTE = """次元破绽！ v{ver}（Windows 版） · 出品：狸猫

怎么玩：
1. 把压缩包整个解压，得到「次元破绽」文件夹。
2. 打开文件夹，双击「次元破绽.exe」（或双击「开始游戏.bat」）。
   遇到「Windows 已保护你的电脑」：点「更多信息」→「仍要运行」（程序没有数字签名，属于正常提示）。
3. 开玩！不用安装，不用联网。

小提示：
· 整个文件夹要放在一起，不要只把 exe 拷出去；想放桌面就右键 exe →「发送到」→「桌面快捷方式」。
· 存档在 %APPDATA%\\AnimeSpotDiff。需要 Windows 10 / 11（64 位）。
· 配音：VOICEVOX:満別花丸 / VOICEVOX:冥鳴ひまり / VOICEVOX:四国めたん / VOICEVOX:九州そら / VOICEVOX:あんこもん，许可条款见 licenses 文件夹。
"""

WEB_NOTE = """次元破绽！ v{ver}（网页版） · 出品：狸猫

怎么玩：
1. 把压缩包整个解压，得到「次元破绽-网页版」文件夹。
2. 打开文件夹，双击「index.html」，用浏览器（Chrome / Edge / Firefox）打开。
3. 开玩！不用安装，不用联网，也不用开本地服务器。

小提示：
· index.html 旁边的 assets、game.js 等文件都要保留。
· 存档在浏览器里，换浏览器或清除网站数据会重置进度。
· 没声音的话先在画面上点一下（浏览器要求先操作才能放声音）。
· 配音：VOICEVOX:満別花丸 / VOICEVOX:冥鳴ひまり / VOICEVOX:四国めたん / VOICEVOX:九州そら / VOICEVOX:あんこもん，许可条款见 licenses 文件夹。
"""

# 只用 ASCII，避免不同系统代码页下 bat 里的中文乱码
START_BAT = '@echo off\r\ncd /d "%~dp0"\r\nfor %%f in ("%~dp0*.exe") do start "" "%%~ff"\r\n'


def write_text(p, s):
    with open(p, 'w', encoding='utf-8-sig', newline='\r\n') as f:
        f.write(s)


def make_zip(zp, top):
    if os.path.exists(zp): os.remove(zp)
    cwd = os.getcwd(); os.chdir(STAGE)
    try:
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:  # 非 ASCII 文件名自动带 UTF-8 标志
            for base, dirs, files in os.walk(top):
                dirs.sort()
                for f in sorted(files):
                    p = os.path.join(base, f)
                    info = zipfile.ZipInfo.from_file(p, p)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    with open(p, 'rb') as fh: z.writestr(info, fh.read(), compresslevel=9)
    finally:
        os.chdir(cwd)
    with zipfile.ZipFile(zp) as z: assert z.testzip() is None
    print(zp, os.path.getsize(zp), 'bytes')


def main():
    win_src = os.path.join(ROOT, 'release', '次元破绽')
    assert os.path.isfile(os.path.join(win_src, '次元破绽.exe')), '先运行 npm run package:win'
    assert os.path.isfile(os.path.join(ROOT, 'dist', 'index.html')), '先运行 npm run build'
    shutil.rmtree(STAGE, ignore_errors=True); os.makedirs(STAGE)
    # Windows
    w = os.path.join(STAGE, '次元破绽')
    shutil.copytree(win_src, w)
    write_text(os.path.join(w, '怎么玩.txt'), WIN_NOTE.format(ver=VER))
    with open(os.path.join(w, '开始游戏.bat'), 'w', encoding='ascii', newline='') as f: f.write(START_BAT)
    # 网页版
    b = os.path.join(STAGE, '次元破绽-网页版')
    shutil.copytree(os.path.join(ROOT, 'dist'), b)
    shutil.copytree(os.path.join(ROOT, 'docs', 'licenses'), os.path.join(b, 'licenses'))
    write_text(os.path.join(b, '怎么玩.txt'), WEB_NOTE.format(ver=VER))
    for d in (w, b):
        for base, _, files in os.walk(d):
            assert not any(f.lower().endswith('.ogg') for f in files), '发布包里不能有 ogg'
    make_zip(os.path.join(OUT, 'ciyuan-pozhan-windows.zip'), '次元破绽')
    make_zip(os.path.join(OUT, 'ciyuan-pozhan-web.zip'), '次元破绽-网页版')


if __name__ == '__main__':
    main()
