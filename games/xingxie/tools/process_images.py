#!/usr/bin/env python3
"""把复用的角色立绘 (anime-stack 的抠图版 cutout/girl_XX.png，1280x720 RGBA) 处理成本作用的图：
  char_<id>_avatar.png  256px 圆形头像 + 主题色描边 (战斗中的角色、HUD、选角缩略图)
  char_<id>_card.png    上半身立绘：用源图全部高度 (头顶到胸口，源图本身就只画到这里)，
                        左右收窄到身体，切掉有瑕疵的手 (光的魔杖手)，四周柔和渐隐 (选角 / 结算大图)
  boss_nox.png          最终 Boss「诺克丝」的头像 (girl_12 裁头部，调暗偏紫)
用法: python tools/process_images.py
"""
import os
from PIL import Image, ImageDraw, ImageEnhance, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/images/source')
OUT = os.path.join(ROOT, 'assets/images')

# id: (源文件, 头像中心 x, 中心 y, 半径, 立绘左右裁切 (x0, x1), 描边色)
CHARS = {
    'hikari': ('girl_06.png', 600, 320, 320, (330, 850), (190, 120, 255)),    # 850 往右是拿魔杖的手 (手指有瑕疵)，连魔杖一起切掉
    'kanon':  ('girl_08.png', 590, 330, 330, (210, 970), (90, 200, 240)),
    'rinne':  ('girl_07.png', 645, 330, 330, (265, 1025), (235, 95, 110)),
    'momo':   ('girl_05.png', 640, 330, 330, (250, 1030), (255, 130, 190)),
    'tsukimi':('girl_09.png', 630, 330, 330, (250, 1010), (170, 160, 255)),
    'regina': ('girl_10.png', 650, 335, 335, (240, 1060), (255, 205, 70)),
}

def circle_avatar(im, cx, cy, r, ring, size=256, ring_w=12):
    box = (cx - r, cy - r, cx + r, cy + r)
    crop = im.crop(box).resize((size, size), Image.LANCZOS)
    bg = Image.new('RGBA', (size, size), (255, 244, 250, 255))
    bg.alpha_composite(crop)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((ring_w * 2, ring_w * 2, size * 4 - ring_w * 2, size * 4 - ring_w * 2), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    ring_img = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring_img)
    d.ellipse((4, 4, size * 4 - 4, size * 4 - 4), outline=(255, 255, 255, 255), width=ring_w * 4 + 8)
    d.ellipse((14, 14, size * 4 - 14, size * 4 - 14), outline=ring + (255,), width=ring_w * 4 - 12)
    ring_img = ring_img.resize((size, size), Image.LANCZOS)
    out.alpha_composite(ring_img)
    return out

def card(im, xr, height=560, side=48, bottom=100):
    import numpy as np
    x0, x1 = xr
    crop = im.crop((x0, 0, x1, im.height))
    w, h = crop.size
    # 左右各 side px、底部 bottom px 平滑渐隐 (smoothstep)，避免硬切
    sm = lambda t: t * t * (3 - 2 * t)
    gx = np.ones(w); t = np.linspace(0, 1, side); gx[:side] = sm(t); gx[-side:] = sm(t[::-1])
    gy = np.ones(h); t = np.linspace(0, 1, bottom); gy[-bottom:] = sm(t[::-1])
    a = np.asarray(crop.split()[3], dtype=np.float32) * gy[:, None] * gx[None, :]
    crop.putalpha(Image.fromarray(a.clip(0, 255).astype(np.uint8)))
    return crop.resize((round(w * height / h), height), Image.LANCZOS)

def main():
    for cid, (fn, cx, cy, r, xr, ring) in CHARS.items():
        im = Image.open(os.path.join(SRC, fn)).convert('RGBA')
        circle_avatar(im, cx, cy, r, ring).save(os.path.join(OUT, f'char_{cid}_avatar.png'), optimize=True)
        c = card(im, xr)
        c.save(os.path.join(OUT, f'char_{cid}_card.png'), optimize=True)
        print('ok', cid, c.size)
    # Boss 诺克丝：girl_12 的头部，压暗、偏紫
    im = Image.open(os.path.join(SRC, 'girl_12.png')).convert('RGBA')
    head = circle_avatar(im, 650, 330, 300, (150, 60, 200))
    rgb = ImageEnhance.Brightness(head.convert('RGB')).enhance(0.85)
    tint = Image.new('RGB', head.size, (120, 40, 170))
    rgb = Image.blend(rgb, tint, 0.18)
    nox = rgb.convert('RGBA'); nox.putalpha(head.split()[3])
    nox.save(os.path.join(OUT, 'boss_nox.png'), optimize=True)
    print('ok boss_nox')

if __name__ == '__main__':
    main()
