#!/usr/bin/env python3
"""主菜单背景 bg_menu.png (540×960)：夜空 + 月亮 + 三位魔法少女 (取自 stack 项目的透明立绘)。
手部有瑕疵的地方被底部渐变盖住 (立绘只露出胸口以上)。"""
import os, random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, 'assets/images/source')
W, H = 540, 960
random.seed(7)
bg = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(bg)
top, bot = (22, 14, 58), (88, 52, 130)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)) + (255,))
# 星星
for _ in range(160):
    x, y = random.randrange(W), random.randrange(int(H * 0.7)); r = random.choice([0.6, 0.8, 1, 1.4])
    a = random.randint(90, 230)
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, a))
# 月亮 + 光晕
glow = Image.new('RGBA', (W, H)); gd = ImageDraw.Draw(glow)
gd.ellipse([330, 40, 530, 240], fill=(255, 230, 170, 90))
glow = glow.filter(ImageFilter.GaussianBlur(40)); bg.alpha_composite(glow)
moon = Image.new('RGBA', (W, H)); md = ImageDraw.Draw(moon)
md.ellipse([390, 100, 470, 180], fill=(255, 244, 210, 255))
mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).ellipse([410, 90, 490, 170], fill=255)
moon.putalpha(Image.composite(Image.new('L', (W, H), 0), moon.getchannel('A'), mask))
bg.alpha_composite(moon)
# 云
clouds = Image.new('RGBA', (W, H)); cd = ImageDraw.Draw(clouds)
for cx, cy, s in [(80, 300, 1.0), (300, 250, 0.8), (480, 330, 1.1), (180, 420, 0.9)]:
    for k in range(5):
        r = 40 * s * random.uniform(0.7, 1.2)
        ox = (k - 2) * 38 * s
        cd.ellipse([cx + ox - r, cy - r * 0.6, cx + ox + r, cy + r * 0.6], fill=(150, 120, 210, 60))
clouds = clouds.filter(ImageFilter.GaussianBlur(10)); bg.alpha_composite(clouds)

def girl(name, scale, cx, top_y, dark=1.0):
    im = Image.open(os.path.join(src, name)).convert('RGBA')
    im = im.crop(im.getbbox())
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    if dark < 1:
        rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(dark).convert('RGBA'); rgb.putalpha(im.getchannel('A')); im = rgb
    bg.alpha_composite(im, (int(cx - im.width / 2), int(top_y)))

girl('girl_08.png', 0.42, 92, 440, 0.72)    # 歌音 (左后)
girl('girl_10.png', 0.42, 462, 418, 0.72)    # 蕾吉娜 (右后)
girl('girl_06.png', 0.52, 250, 392)           # 光 (中间)
# 底部渐变 (盖住胸口以下与手)
fade = Image.new('RGBA', (W, H)); fd = ImageDraw.Draw(fade)
for y in range(565, H):
    t = min(1, (y - 565) / 135)
    fd.line([(0, y), (W, y)], fill=(30, 18, 66, int(255 * t ** 1.2)))
bg.alpha_composite(fade)
bg.convert('RGB').save(os.path.join(root, 'assets/images/bg_menu.jpg'), quality=88)
print('ok')
