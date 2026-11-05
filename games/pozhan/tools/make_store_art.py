"""抖音上架素材：python3 tools/make_store_art.py [截图目录]
输入：tools/shots.mjs 生成的 1080×1920 游戏截图 (默认 /workspace/_scratch/shots，可传参数) 与 assets/images。
输出：docs/上架资料/商店截图/
  图标_512x512.png            方形、不带圆角 (平台要求「请勿上传圆角图标」)
  加载图_640x1385.jpg          ≤120KB，不含进度条 / 虚假数字
  推荐卡片_494x670.jpg         ≤120KB，顶部 50px、底部 100px 不放关键信息
  搜索结果图_345x150.jpg       ≤80KB
  游戏截图_0N_xxx.jpg          1080×1920 竖屏真实游戏画面
"""
import os, sys, io
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/workspace/_scratch/shots'
OUT = os.path.join(ROOT, 'docs', '上架资料', '商店截图')
IMG = os.path.join(ROOT, 'assets', 'images')
os.makedirs(OUT, exist_ok=True)
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
if not os.path.exists(FONT): FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(size): return ImageFont.truetype(FONT, size, index=2)   # index 2 = SC

def cover(im, w, h, focus=(0.5, 0.5)):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = int((im.width - w) * focus[0]); y = int((im.height - h) * focus[1])
    return im.crop((x, y, x + w, y + h))

def text(d, xy, s, size, fill='#ffffff', stroke='#e0457b', sw=None, anchor='mm'):
    d.text(xy, s, font=font(size), fill=fill, stroke_width=sw if sw is not None else max(2, size // 9), stroke_fill=stroke, anchor=anchor)

def save_jpg(im, name, limit_kb):
    for q in range(92, 40, -3):
        b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True, progressive=True)
        if b.tell() <= limit_kb * 1024: break
    open(os.path.join(OUT, name), 'wb').write(b.getvalue())
    print(f'{name}: {im.width}x{im.height}, {b.tell() / 1024:.0f} KB (≤{limit_kb} KB), q={q}')

bg = Image.open(os.path.join(IMG, 'bg_sunset.jpg')).convert('RGB')
girl = Image.open(os.path.join(IMG, 'nuonuo_happy.png')).convert('RGBA')

def soft_bg(w, h):
    b = cover(bg, w, h).filter(ImageFilter.GaussianBlur(1.2))
    veil = Image.new('RGBA', (w, h), (255, 240, 247, 70))
    return Image.alpha_composite(b.convert('RGBA'), veil)

def paste_girl(canvas, height, cx, bottom):
    g = girl.resize((round(girl.width * height / girl.height), height), Image.LANCZOS)
    shadow = Image.new('RGBA', g.size, (120, 40, 90, 0)); shadow.putalpha(g.getchannel('A').point(lambda a: a * 0.35))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    canvas.alpha_composite(shadow, (int(cx - g.width / 2 + 6), int(bottom - g.height + 10)))
    canvas.alpha_composite(g, (int(cx - g.width / 2), int(bottom - g.height)))

# 1) 图标 512×512 (方形满版，无圆角、无角标)
ic = Image.new('RGBA', (512, 512))
grad = Image.linear_gradient('L').resize((512, 512))
ic = Image.composite(Image.new('RGBA', (512, 512), (255, 214, 232, 255)), Image.new('RGBA', (512, 512), (214, 196, 255, 255)), grad.point(lambda v: 255 - v))
g = girl.resize((620, round(girl.height * 620 / girl.width)), Image.LANCZOS)
ic.alpha_composite(g, ((512 - g.width) // 2 + 10, 40))
ic.convert('RGB').save(os.path.join(OUT, '图标_512x512.png'), optimize=True)
print('图标_512x512.png: 512x512')

# 2) 加载图 640×1385
L = soft_bg(640, 1385)
d = ImageDraw.Draw(L)
text(d, (320, 300), '次元破绽', 118, stroke='#e0457b', sw=10)
d.rounded_rectangle((150, 380, 490, 434), 27, fill='#7c6cf0')
text(d, (320, 407), '二次元梗图找茬', 32, stroke='#7c6cf0', sw=0)
paste_girl(L, 600, 320, 1130)
text(d, (320, 1250), '出品：狸猫', 30, fill='#8a5a7a', stroke='#ffffff', sw=4)
save_jpg(L, '加载图_640x1385.jpg', 120)

# 3) 推荐卡片 494×670 (顶部 50px / 底部 100px 留空，文字字号 ≥28)
C = soft_bg(494, 670)
d = ImageDraw.Draw(C)
text(d, (247, 110), '次元破绽', 76, sw=7)
text(d, (247, 172), '这张图，毫无破绽…吗？', 30, fill='#ffffff', stroke='#7c6cf0', sw=5)
paste_girl(C, 360, 247, 560)
save_jpg(C, '推荐卡片_494x670.jpg', 120)

# 4) 搜索结果图 345×150
S = soft_bg(345, 150)
paste_girl(S, 150, 70, 156)
d = ImageDraw.Draw(S)
text(d, (232, 62), '次元破绽', 44, sw=5)
text(d, (232, 110), '二次元梗图找茬', 22, fill='#ffffff', stroke='#7c6cf0', sw=3)
save_jpg(S, '搜索结果图_345x150.jpg', 80)

# 5) 竖屏游戏截图 (真实画面)
picks = [('menu', '主菜单'), ('play-L01', '找不合理'), ('play-L10-diff', '找不同'), ('play-L07-puzzle', '助她脱困'), ('play-L08-word', '文字拼字'), ('win', '通关结算')]
for i, (k, label) in enumerate(picks, 1):
    p = os.path.join(SHOTS, f'anime-spotdiff-{k}.png')
    if not os.path.exists(p): print('缺少截图', p); continue
    im = Image.open(p).convert('RGB')
    if im.size != (1080, 1920): im = im.resize((1080, 1920), Image.LANCZOS)
    save_jpg(im, f'游戏截图_{i:02d}_{label}_1080x1920.jpg', 600)
