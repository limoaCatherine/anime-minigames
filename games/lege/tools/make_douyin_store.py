"""抖音小游戏商店素材 (出品：狸猫) → docs/douyin/store/
  icon_1024.png / icon_512.png / icon_144.png   方形、无圆角、无透明、无二维码 (抖音要求图标不带圆角)
  promo_494x670.jpg   推荐卡片图   ≤120 KB
  search_345x150.jpg  搜索结果图   ≤80 KB
  loading_640x1385.jpg 竖版加载图  ≤120 KB
截图 screenshot_1..5 (1080×1920) 由 node tools/test-douyin.mjs --store 生成在 docs/douyin/。
"""
import io, os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
D = os.path.join(ROOT, 'docs', 'douyin')
OUT = os.path.join(D, 'store')
os.makedirs(OUT, exist_ok=True)

def grad(w, h, top, bot):
    g = Image.new('RGB', (1, h))
    for y in range(h):
        k = y / max(1, h - 1)
        g.putpixel((0, y), tuple(int(top[i] * (1 - k) + bot[i] * k) for i in range(3)))
    return g.resize((w, h))

# —— 图标：渐变底 + 星海女神半身 (满版方形) ——
cut_p = os.path.join(ROOT, 'assets', 'images', 'cutout', 'girl_11.png')
S = 1024
icon = grad(S, S, (255, 214, 236), (196, 160, 255))
if os.path.exists(cut_p):
    cut = Image.open(cut_p).convert('RGBA')
    W, H = cut.size
    side = int(H * 0.74)
    x0, y0 = (W - side) // 2, int(H * 0.39 - side / 2)
    face = cut.crop((x0, max(0, y0), x0 + side, max(0, y0) + side)).resize((S, S), Image.LANCZOS)
else:
    card = Image.open(os.path.join(ROOT, 'assets', 'images', 'card_11.png')).convert('RGBA')
    m = int(card.width * 0.0625) + 2
    face = card.crop((m, m, card.width - m, card.width - m)).resize((S, S), Image.LANCZOS)
icon.paste(face, (0, 0), face)
for s in (1024, 512, 144):
    icon.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, f'icon_{s}.png'), optimize=True)

def save_jpg(im, name, limit_kb):
    for q in range(90, 40, -5):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True, progressive=True)
        if b.tell() <= limit_kb * 1024:
            break
    open(os.path.join(OUT, name), 'wb').write(b.getvalue())
    return b.tell() // 1024, q

menu = Image.open(os.path.join(D, 'screenshot_1_menu.png')).convert('RGB')   # 1080×1920
game = Image.open(os.path.join(D, 'screenshot_2_game.png')).convert('RGB')
res = []
# 推荐卡片 494×670：菜单页 Logo + 角色 + 按钮区
h = int(1080 * 670 / 494)
res.append(('promo_494x670.jpg',) + save_jpg(menu.crop((0, 140, 1080, 140 + h)).resize((494, 670), Image.LANCZOS), 'promo_494x670.jpg', 120))
# 搜索结果图 345×150：Logo 横条
h2 = int(1080 * 150 / 345)
res.append(('search_345x150.jpg',) + save_jpg(menu.crop((0, 300, 1080, 300 + h2)).resize((345, 150), Image.LANCZOS), 'search_345x150.jpg', 80))
# 竖版加载图 640×1385
w3 = int(1920 * 640 / 1385)
x3 = (1080 - w3) // 2
res.append(('loading_640x1385.jpg',) + save_jpg(menu.crop((x3, 0, x3 + w3, 1920)).resize((640, 1385), Image.LANCZOS), 'loading_640x1385.jpg', 120))
for n, kb, q in res:
    print(f'{n}: {kb} KB (q{q})')
print('icons: 1024/512/144')
