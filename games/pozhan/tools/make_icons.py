"""生成应用图标：assets/icons/app.ico (16~256 多尺寸)、app.png (512)、favicon.png (64)，并复制到 desktop/icon.png。
来源：assets/images/nuonuo_happy.png (看板娘糯糯) 的脸部，放进圆角方块里，和游戏里的卡牌同一种风格。
用法: python tools/make_icons.py
"""
import os, shutil
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'images', 'nuonuo_happy.png')
OUT = os.path.join(ROOT, 'assets', 'icons')
os.makedirs(OUT, exist_ok=True)

S = 512
cut = Image.open(SRC).convert('RGBA')
W, H = cut.size
side = int(W * 0.56)
x0, y0 = int(W * 0.47 - side / 2), max(0, int(H * 0.27 - side / 2))
face = cut.crop((x0, y0, x0 + side, y0 + side))

def grad(size, top, bot):
    g = Image.new('RGBA', (1, size))
    for y in range(size):
        k = y / (size - 1)
        g.putpixel((0, y), tuple(int(top[i] * (1 - k) + bot[i] * k) for i in range(3)) + (255,))
    return g.resize((size, size))

pad = 20
inner = S - pad * 2
R = 104
# 卡牌底 (厚度) + 外框
base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([pad, pad + 14, S - pad, S - pad + 10], radius=R, fill=(60, 30, 90, 120))
base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(9)))
d = ImageDraw.Draw(base)
d.rounded_rectangle([pad, pad + 12, S - pad, S - pad + 4], radius=R, fill=(150, 70, 140, 255))
d.rounded_rectangle([pad, pad, S - pad, S - pad - 8], radius=R, fill=(255, 122, 182, 255))
# 内部渐变 + 角色
ip = pad + 22
iw = S - ip * 2
card = grad(iw, (255, 236, 246), (214, 196, 255))
card.alpha_composite(face.resize((iw, iw), Image.LANCZOS))
mask = Image.new('L', (iw, iw), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, iw - 1, iw - 9], radius=R - 22, fill=255)
base.paste(card, (ip, ip), mask)
d = ImageDraw.Draw(base)
d.rounded_rectangle([pad, pad, S - pad, S - pad - 8], radius=R, outline=(255, 214, 234, 255), width=8)
base.save(os.path.join(OUT, 'app.png'))

sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
imgs = []
for s in sizes:
    im = base.resize((s, s), Image.LANCZOS)
    if s <= 32:
        im = im.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    imgs.append(im)
imgs[-1].save(os.path.join(OUT, 'app.ico'), format='ICO', sizes=[(s, s) for s in sizes], append_images=imgs[:-1])
base.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'favicon.png'))
base.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, 'desktop', 'icon.png'))
print('ok', sizes)
