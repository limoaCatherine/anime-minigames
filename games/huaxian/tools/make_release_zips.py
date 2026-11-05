#!/usr/bin/env python3
"""生成 GitHub Release 用的两个 zip（文件名 UTF-8 标志，Windows 解压中文不乱码）。
用法: npm run build && npm run package:win && python3 tools/make_release_zips.py [输出目录]
  -> huaxian-shouhu-windows.zip  (画线守护美少女/  完整 Electron 程序 + 怎么玩.txt)
  -> huaxian-shouhu-web.zip      (画线守护美少女-网页版/  dist + 怎么玩.txt)
"""
import os, sys, time, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out'))

WIN_TXT = """画线守护美少女 —— 怎么玩（Windows 版）
出品：狸猫

1. 把整个 zip 解压出来（不要在压缩包里直接双击运行）。
2. 打开「画线守护美少女」文件夹，双击「画线守护美少女.exe」就能玩，不用安装。
   这个文件夹里的其他文件都是程序需要的，请整个文件夹一起保留 / 拷贝。

如果 Windows 弹出蓝色的「Windows 已保护你的电脑」(SmartScreen) 提示：
   点「更多信息」→「仍要运行」即可。（游戏没有数字签名，所以会这样提示。）

存档：进度、星级和音量设置自动保存在本机（%APPDATA%\\AnimeDrawLine），
      删掉或更新游戏文件夹也不会丢。

玩法：每关只能画一笔线，松手后线会掉下来，坚持到倒计时结束别让她被碰到就赢了。
      卡关了点右上角 💡 看提示。共 40 关、4 章。

主角语音：リダ / Lida（AivisSpeech）https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join
"""

WEB_TXT = """画线守护美少女 —— 怎么玩（网页版）
出品：狸猫

1. 把整个 zip 解压出来。
2. 打开「画线守护美少女-网页版」文件夹，双击「index.html」，
   会用浏览器（Edge / Chrome 等）打开，离线就能玩，不用联网、不用安装。
   请保留文件夹里的其他文件（assets、vendor 等），它们是游戏需要的图片和声音；licenses 里是第三方许可。

如果双击后没有用浏览器打开：右键 index.html →「打开方式」→ 选 Edge 或 Chrome。

存档：进度、星级和音量设置保存在这个浏览器本机的存储里（localStorage）。
      换浏览器或清除浏览器数据会丢失进度。

想要不开浏览器的版本？请下载 huaxian-shouhu-windows.zip，双击 exe 就能玩
（Windows 若弹出 SmartScreen 提示：点「更多信息」→「仍要运行」）。

玩法：每关只能画一笔线，松手后线会掉下来，坚持到倒计时结束别让她被碰到就赢了。
      卡关了点右上角 💡 看提示。共 40 关、4 章。

主角语音：リダ / Lida（AivisSpeech）https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join
"""


def crlf(s):
    return s.replace('\r\n', '\n').replace('\n', '\r\n')


def make(zip_path, src_dir, top, txt, extra=()):
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        now = time.localtime()[:6]
        z.writestr(zipfile.ZipInfo(top + '/', now), b'')
        # 怎么玩.txt: UTF-8 带 BOM + CRLF，Windows 记事本直接正确显示
        info = zipfile.ZipInfo(f'{top}/怎么玩.txt', now)
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, '\ufeff'.encode('utf-8') + crlf(txt).encode('utf-8'))
        for d, dirs, files in os.walk(src_dir):
            dirs.sort()
            rel = os.path.relpath(d, src_dir)
            arc_dir = top if rel == '.' else f'{top}/{rel.replace(os.sep, "/")}'
            if rel != '.':
                z.write(d, arc_dir + '/')
            for f in sorted(files):
                z.write(os.path.join(d, f), f'{arc_dir}/{f}')
        for src, arc in extra:  # 额外文件夹 (如第三方许可)
            for f in sorted(os.listdir(src)):
                z.write(os.path.join(src, f), f'{top}/{arc}/{f}')
    print(zip_path, os.path.getsize(zip_path))


os.makedirs(OUT, exist_ok=True)
win_src = os.path.join(ROOT, 'release', '画线守护美少女')
web_src = os.path.join(ROOT, 'dist')
assert os.path.isfile(os.path.join(win_src, '画线守护美少女.exe')), 'run npm run package:win first'
assert os.path.isfile(os.path.join(web_src, 'index.html')), 'run npm run build first'
make(os.path.join(OUT, 'huaxian-shouhu-windows.zip'), win_src, '画线守护美少女', WIN_TXT)
make(os.path.join(OUT, 'huaxian-shouhu-web.zip'), web_src, '画线守护美少女-网页版', WEB_TXT,
     extra=[(os.path.join(ROOT, 'docs', 'licenses'), 'licenses')])
