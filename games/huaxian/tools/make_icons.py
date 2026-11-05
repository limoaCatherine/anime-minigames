"""生成应用图标：assets/icons/app.ico (16~256 多尺寸)、app.png (512)、favicon.png (64)。
来源：assets/images/heroine_idle.png 的头部，放在粉色渐变圆形底上。用法: python tools/make_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'images', 'heroine_idle.png')
OUT = os.path.join(ROOT, 'assets', 'icons')
os.makedirs(OUT, exist_ok=True)

S = 512
src = Image.open(SRC).convert('RGBA')
w, h = src.size
head = src.crop((0, 0, w, int(w * 0.95)))          # 头部 (含双马尾)
# 圆形底
bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(bg)
for r in range(S // 2, 0, -2):                      # 径向渐变
    t = r / (S / 2)
    c = (int(255 - 20 * t), int(214 - 40 * (1 - t)), int(236 - 10 * t), 255)
    d.ellipse((S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r), fill=c)
ring = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(ring).ellipse((6, 6, S - 6, S - 6), outline=(255, 111, 168, 255), width=18)
bg = Image.alpha_composite(bg, ring)
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).ellipse((24, 24, S - 24, S - 24), fill=255)
face = head.resize((int(S * 0.9), int(S * 0.9 * head.height / head.width)), Image.LANCZOS)
layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
layer.alpha_composite(face, ((S - face.width) // 2, int(S * 0.1)))
la = layer.split()[3]
from PIL import ImageChops
layer.putalpha(ImageChops.multiply(la, mask))
base = Image.alpha_composite(bg, layer)
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
print('ok', sizes)
