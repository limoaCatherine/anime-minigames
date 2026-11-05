# 抖音商店素材：由 tools/test-douyin.mjs --store 生成的 1080×1920 截图 + 主视觉，制作
#   douyin/store/screenshot_1..5.jpg   游戏截图 1080×1920 (登录/主界面含游戏名、选关、玩法 ×2、结算)
#   douyin/store/icon_512.png / icon_144.png   方形图标 (不透明、无圆角，平台会自动加圆角)
#   douyin/store/promo_card_494x670.jpg       推广卡片 (≤120 KB)
#   douyin/store/loading_640x1385.jpg         加载图 (≤120 KB)
#   douyin/store/search_345x150.jpg           搜索结果图 (≤80 KB)
#   assets/douyin/share.jpg                   分享卡片 500×400 (5:4)
# 用法：python3 tools/make_douyin_store.py
import io, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = os.path.join(ROOT, 'douyin', 'store')
os.makedirs(STORE, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'assets', 'douyin'), exist_ok=True)
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
P = lambda *a: os.path.join(ROOT, *a)


def save_jpg(im, path, limit_kb=None, q=90):
    im = im.convert('RGB')
    while True:
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        if limit_kb is None or buf.tell() <= limit_kb * 1024 or q <= 40:
            break
        q -= 4
    open(path, 'wb').write(buf.getvalue())
    return buf.tell() // 1024, q


def cover(im, w, h, cy=0.5):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = (im.width - w) // 2
    y = int((im.height - h) * cy)
    return im.crop((x, y, x + w, y + h))


def title(img, y, size, sub=None):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    for text, color, yy, fs in [('画线守护美少女', (255, 92, 160), y, f)] + ([(sub, (110, 80, 130), y + int(size * 1.35), ImageFont.truetype(FONT, int(size * 0.45)))] if sub else []):
        w = d.textlength(text, font=fs)
        x = (img.width - w) / 2
        d.text((x, yy), text, font=fs, fill=color, stroke_width=max(2, fs.size // 9), stroke_fill=(255, 255, 255))


out = []
# 1) 截图
for i, n in enumerate(['shot1_menu', 'shot2_levels', 'shot3_play', 'shot4_boss', 'shot5_win'], 1):
    src = os.path.join(STORE, n + '.png')
    if not os.path.exists(src):
        continue
    kb, q = save_jpg(Image.open(src), os.path.join(STORE, f'screenshot_{i}.jpg'), q=90)
    os.remove(src)
    out.append(f'screenshot_{i}.jpg 1080x1920 {kb}KB')

# 2) 图标：圆角 app.png 铺到同色方形底上
ic = Image.open(P('assets/icons/app.png')).convert('RGBA')
bgc = ic.getpixel((ic.width // 2, 6)) if ic.getpixel((ic.width // 2, 6))[3] == 255 else (255, 241, 232, 255)
sq = Image.new('RGBA', ic.size, bgc)
sq.alpha_composite(ic)
# 用主视觉补满四角 (避免纯色角)
sq = sq.convert('RGB')
for s in (512, 144):
    sq.resize((s, s), Image.LANCZOS).save(os.path.join(STORE, f'icon_{s}.png'), optimize=True)
    out.append(f'icon_{s}.png {s}x{s}')

bg = Image.open(P('assets/images/bg_menu.jpg')).convert('RGB')
key = Image.open(P('assets/images/source/key_art.jpg')).convert('RGB')

# 3) 推广卡片 494×670：菜单主视觉 + 标题 (平台要求顶部 50px、底部 100px 不放主要内容，字号 ≥ 28)
card = cover(bg, 494, 670, 0.35)
d = ImageDraw.Draw(card)
for text, size, y, color in [('画线守护', 64, 62, (255, 92, 160)), ('美少女', 68, 140, (255, 138, 61)), ('出品：狸猫', 28, 228, (110, 80, 130))]:
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    d.text(((card.width - w) / 2, y), text, font=f, fill=color, stroke_width=max(3, size // 8), stroke_fill=(255, 255, 255))
kb, q = save_jpg(card, os.path.join(STORE, 'promo_card_494x670.jpg'), 120)
out.append(f'promo_card_494x670.jpg {kb}KB q{q}')

# 4) 加载图 640×1385：菜单背景 + 标题 + 出品
ld = cover(bg, 640, 1385, 0.5)
title(ld, 150, 66, '出品：狸猫')
kb, q = save_jpg(ld, os.path.join(STORE, 'loading_640x1385.jpg'), 120)
out.append(f'loading_640x1385.jpg {kb}KB q{q}')

# 5) 搜索结果图 345×150：主视觉横图
sr = cover(key, 345, 150, 0.35)
kb, q = save_jpg(sr, os.path.join(STORE, 'search_345x150.jpg'), 80)
out.append(f'search_345x150.jpg {kb}KB q{q}')

# 6) 分享卡片 500×400 (5:4)
sh = cover(key, 500, 400, 0.4)
title(sh, 8, 44)
kb, q = save_jpg(sh, P('assets', 'douyin', 'share.jpg'), 100, 86)
out.append(f'assets/douyin/share.jpg 500x400 {kb}KB')
print('\n'.join(out))
