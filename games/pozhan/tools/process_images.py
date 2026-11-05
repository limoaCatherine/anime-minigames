"""把 assets/images/source/ 下的原图处理成游戏用图片 (assets/images/*.png|jpg)。
- 角色立绘 (girl_XX.png，来自姊妹作《美少女了个美》的透明底立绘；1~11 号与《美少女合成》同一批角色)
  -> 裁掉透明边，等比缩小到高 460px
- 糯糯 4 种表情 (nuonuo_*.png，来自公司角色库的同一位粉色双马尾角色) -> 统一缩放比例，保证表情切换时大小一致
- 背景 (bg_*.jpg) -> 压缩为质量 86 的 jpg
依赖: pip install pillow   用法: python tools/process_images.py
"""
import os, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'images', 'source')
DST = os.path.join(ROOT, 'assets', 'images')

for f in sorted(glob.glob(os.path.join(SRC, 'girl_*.png'))):
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    k = 460 / im.height
    im = im.resize((round(im.width * k), 460), Image.LANCZOS)
    im.save(os.path.join(DST, os.path.basename(f)), optimize=True)
    print('girl', os.path.basename(f), im.size)

for f in sorted(glob.glob(os.path.join(SRC, 'nuonuo_*.png'))):
    im = Image.open(f).convert('RGBA')
    k = 0.92  # 同一比例 (原图已是同一尺度)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(os.path.join(DST, os.path.basename(f)), optimize=True)
    print('nuonuo', os.path.basename(f), im.size)

for f in sorted(glob.glob(os.path.join(SRC, 'bg_*.jpg'))):
    im = Image.open(f).convert('RGB')
    im.save(os.path.join(DST, os.path.basename(f)), quality=86, optimize=True)
    print('bg', os.path.basename(f), im.size)
