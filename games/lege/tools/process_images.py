"""原始立绘 -> 卡牌贴图 v2 (Pillow + rembg)
每种卡牌拥有强烈的独立识别度 (即使缩小到 62px、被压暗也能分辨)：
  1) 专属背景色渐变 + 专属白色花纹 (圆点/条纹/格子/波浪/爱心/星星…)
  2) 专属颜色的粗边框 + 同色系底部厚度
  3) 抠图后的头像 (紧贴脸部，发色清晰)
  4) 右上角大号宝石符号 + 左下角小号同款符号 (卡牌被压住一半时也至少能看到一个)
步骤：
  a) 抠图：assets/images/source/girl_XX_raw.jpg -> assets/images/cutout/girl_XX.png
     (rembg + isnet-anime 模型；已生成的抠图会被复用，删除后重新生成)
  b) 合成：-> assets/images/card_XX.png (160x176)
  c) 背景：assets/images/source/bg_raw.jpg -> assets/images/bg.jpg (竖屏 cover 裁切)
用法: pip install pillow "rembg[cpu]" ; python tools/process_images.py
"""
import os, math
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'images', 'source')
CUT = os.path.join(ROOT, 'assets', 'images', 'cutout')
OUT = os.path.join(ROOT, 'assets', 'images')

COUNT = 14
SS = 4
CARD_W, FACE_H, THICK = 160, 160, 16

# 头像裁切：(正方形边长占原图高度比例, 中心 y 占原图高度比例)。13/14 头更大，取大一些保证头完整
CROP = {i: (0.74, 0.38) for i in range(1, COUNT + 1)}
CROP[2] = (0.76, 0.38)
CROP[11] = (0.78, 0.39)
CROP[13] = (0.80, 0.41)
CROP[14] = (0.50, 0.33)   # v3: 收紧到脸部，去掉端杯子的手 (手指有 AI 瑕疵)

# 每种卡: (背景主色, 花纹, 宝石形状, 宝石颜色)  —— 与 src/config/CardConfig.js 保持一致
# 外观相近的角色 (两位橙/金发、两位深色发、三位银白发) 特意分配色相差距最大的背景与不同符号
STYLE = [
    ('#4dabf7', 'dots',     'heart',    '#ff4f86'),  # 1 见习学妹 (棕发)   天蓝 + 圆点 + 爱心
    ('#20c997', 'stripes',  'star',     '#ff9f1c'),  # 2 元气同学 (橙发)   薄荷 + 斜条纹 + 星星
    ('#fcc419', 'grid',     'diamond',  '#2f6fff'),  # 3 图书委员 (深蓝发) 明黄 + 方格线 + 菱形
    ('#e64980', 'waves',    'clover',   '#2ec27e'),  # 4 社团部长 (绿发)   玫红 + 波浪 + 四叶草
    ('#94d82d', 'hearts',   'circle',   '#ff4fb8'),  # 5 偶像练习生 (粉发) 青柠 + 小爱心 + 圆珠
    ('#ff922b', 'stars',    'moon',     '#8b45e8'),  # 6 魔法少女 (紫发)   橙 + 小星星 + 月牙
    ('#2f9e44', 'diamonds', 'triangle', '#ff3b4e'),  # 7 精灵巫女 (银发)   森林绿 + 菱格 + 三角
    ('#7048e8', 'sparkle',  'drop',     '#00c2f0'),  # 8 星辉歌姬 (浅蓝发) 紫罗兰 + 闪光 + 水滴
    ('#0b7285', 'rings',    'hexagon',  '#c0a4ff'),  # 9 月之公主 (淡紫发) 深青 + 圆环 + 六边形
    ('#364fc7', 'rays',     'crown',    '#ffc300'),  # 10 天空女王 (金发)  宝蓝 + 放射光 + 皇冠
    ('#2b1d4f', 'galaxy',   'star4',    '#ff9cf0'),  # 11 星海女神 (彩虹发) 夜空紫 + 星河 + 四芒星
    ('#adb5bd', 'gingham',  'square',   '#7a4a2e'),  # 12 女仆店长 (黑发)  银灰 + 格纹 + 方块
    ('#e03131', 'zigzag',   'ribbon',   '#ffffff'),  # 13 神社巫女 (银发)  朱红 + 锯齿 + 蝴蝶结
    ('#9c6644', 'beans',    'leaf',     '#3ddc97'),  # 14 咖啡前辈 (青发)  咖啡 + 豆子 + 叶子
]

def hex2rgb(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)

def mix(c1, c2, k):
    return tuple(int(c1[i] * (1 - k) + c2[i] * k) for i in range(3)) + (255,)

def shade(rgb, k):
    return tuple(max(0, min(255, int(c * k))) for c in rgb[:3]) + (rgb[3] if len(rgb) > 3 else 255,)

WHITE = (255, 255, 255, 255)

def poly_star(cx, cy, ro, ri, n, rot=-math.pi / 2):
    pts = []
    for i in range(n * 2):
        r = ro if i % 2 == 0 else ri
        a = rot + i * math.pi / n
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts

def heart_pts(cx, cy, s):
    pts = []
    for t in range(0, 360, 6):
        a = math.radians(t)
        x = 16 * math.sin(a) ** 3
        y = -(13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))
        pts.append((cx + x * s / 17, cy + y * s / 17 + s * 0.05))
    return pts

def draw_symbol(d, cx, cy, s, shape, c, outline=None):
    dark = outline or shade(c, 0.62)
    w = max(1, int(s * 0.12))
    if shape == 'heart':
        d.polygon(heart_pts(cx, cy, s), fill=c, outline=dark)
    elif shape == 'star':
        d.polygon(poly_star(cx, cy + s * 0.05, s * 1.05, s * 0.45, 5), fill=c, outline=dark)
    elif shape == 'star4':
        d.polygon(poly_star(cx, cy, s * 1.08, s * 0.34, 4), fill=c, outline=dark)
    elif shape == 'diamond':
        d.polygon([(cx, cy - s), (cx + s * 0.75, cy), (cx, cy + s), (cx - s * 0.75, cy)], fill=c, outline=dark)
    elif shape == 'circle':
        d.ellipse([cx - s * 0.85, cy - s * 0.85, cx + s * 0.85, cy + s * 0.85], fill=c, outline=dark, width=w)
    elif shape == 'moon':
        d.ellipse([cx - s * 0.92, cy - s * 0.92, cx + s * 0.92, cy + s * 0.92], fill=c)
        d.ellipse([cx - s * 0.42, cy - s * 1.08, cx + s * 1.1, cy + s * 0.44], fill=WHITE)
    elif shape == 'triangle':
        d.polygon([(cx, cy - s * 0.98), (cx + s * 0.98, cy + s * 0.78), (cx - s * 0.98, cy + s * 0.78)], fill=c, outline=dark)
    elif shape == 'drop':
        d.ellipse([cx - s * 0.72, cy - s * 0.25, cx + s * 0.72, cy + s * 0.98], fill=c)
        d.polygon([(cx, cy - s * 1.05), (cx + s * 0.64, cy + s * 0.2), (cx - s * 0.64, cy + s * 0.2)], fill=c)
    elif shape == 'hexagon':
        pts = [(cx + math.cos(math.pi / 3 * i) * s * 0.95, cy + math.sin(math.pi / 3 * i) * s * 0.95) for i in range(6)]
        d.polygon(pts, fill=c, outline=dark)
    elif shape == 'crown':
        d.polygon([(cx - s, cy + s * 0.72), (cx - s, cy - s * 0.55), (cx - s * 0.5, cy + s * 0.02), (cx, cy - s * 0.9),
                   (cx + s * 0.5, cy + s * 0.02), (cx + s, cy - s * 0.55), (cx + s, cy + s * 0.72)], fill=c, outline=dark)
    elif shape == 'square':
        d.rounded_rectangle([cx - s * 0.74, cy - s * 0.74, cx + s * 0.74, cy + s * 0.74], radius=s * 0.22, fill=c, outline=dark)
    elif shape == 'ribbon':
        d.polygon([(cx, cy), (cx - s, cy - s * 0.72), (cx - s, cy + s * 0.72)], fill=c, outline=dark)
        d.polygon([(cx, cy), (cx + s, cy - s * 0.72), (cx + s, cy + s * 0.72)], fill=c, outline=dark)
        d.ellipse([cx - s * 0.32, cy - s * 0.32, cx + s * 0.32, cy + s * 0.32], fill=dark)
    elif shape == 'clover':
        for a in range(4):
            ang = a * math.pi / 2 + math.pi / 4
            x, y = cx + math.cos(ang) * s * 0.46, cy + math.sin(ang) * s * 0.46
            d.ellipse([x - s * 0.47, y - s * 0.47, x + s * 0.47, y + s * 0.47], fill=c)
    elif shape == 'leaf':
        pts = []
        for t in range(0, 361, 10):
            a = math.radians(t)
            pts.append((math.cos(a) * s * 1.02, -math.sin(a) * s * 0.55))
        ca, sa = math.cos(-math.pi / 4), math.sin(-math.pi / 4)
        d.polygon([(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts], fill=c, outline=dark)
        d.line([(cx - s * 0.62, cy + s * 0.62), (cx + s * 0.62, cy - s * 0.62)], fill=(255, 255, 255, 200), width=max(1, int(s * 0.13)))

def badge(d, cx, cy, r, shape, color, ring):
    """白色圆形底座 + 彩色描边 + 符号"""
    d.ellipse([cx - r * 1.3, cy - r * 1.3, cx + r * 1.3, cy + r * 1.3], fill=WHITE, outline=ring, width=max(2, int(r * 0.2)))
    gem = hex2rgb(color)
    if color.lower() == '#ffffff':
        gem = hex2rgb('#e03131')  # 神社巫女: 红色蝴蝶结 (白底上)
    draw_symbol(d, cx, cy, r * 0.92, shape, gem)

def pattern(layer, kind, w, h, base):
    d = ImageDraw.Draw(layer)
    a = 70
    col = (255, 255, 255, a)
    step = 26 * SS // 2
    if kind == 'dots':
        for y in range(0, h, step):
            for x in range((y // step % 2) * step // 2, w, step):
                d.ellipse([x - 5 * SS, y - 5 * SS, x + 5 * SS, y + 5 * SS], fill=col)
    elif kind == 'stripes':
        for k in range(-h, w, 18 * SS):
            d.polygon([(k, 0), (k + 8 * SS, 0), (k + 8 * SS + h, h), (k + h, h)], fill=col)
    elif kind == 'grid':
        for x in range(0, w, 16 * SS):
            d.line([(x, 0), (x, h)], fill=col, width=2 * SS)
        for y in range(0, h, 16 * SS):
            d.line([(0, y), (w, y)], fill=col, width=2 * SS)
    elif kind == 'waves':
        for y0 in range(0, h + 20 * SS, 18 * SS):
            pts = [(x, y0 + math.sin(x / (10 * SS)) * 4 * SS) for x in range(0, w + SS, SS * 2)]
            d.line(pts, fill=col, width=3 * SS)
    elif kind == 'hearts':
        for y in range(10 * SS, h, 30 * SS):
            for x in range(((y // (30 * SS)) % 2) * 15 * SS, w, 30 * SS):
                d.polygon(heart_pts(x, y, 7 * SS), fill=col)
    elif kind == 'stars':
        for y in range(10 * SS, h, 28 * SS):
            for x in range(((y // (28 * SS)) % 2) * 14 * SS, w, 28 * SS):
                d.polygon(poly_star(x, y, 7 * SS, 3 * SS, 5), fill=col)
    elif kind == 'diamonds':
        for y in range(0, h + 20 * SS, 22 * SS):
            for x in range(((y // (22 * SS)) % 2) * 11 * SS, w + 20 * SS, 22 * SS):
                d.polygon([(x, y - 7 * SS), (x + 5 * SS, y), (x, y + 7 * SS), (x - 5 * SS, y)], fill=col)
    elif kind == 'sparkle':
        import random
        rnd = random.Random(8)
        for _ in range(26):
            x, y, s = rnd.randrange(w), rnd.randrange(h), rnd.randrange(3, 8) * SS
            d.polygon(poly_star(x, y, s, s * 0.28, 4), fill=(255, 255, 255, 110))
    elif kind == 'rings':
        for y in range(12 * SS, h, 32 * SS):
            for x in range(((y // (32 * SS)) % 2) * 16 * SS, w, 32 * SS):
                d.ellipse([x - 9 * SS, y - 9 * SS, x + 9 * SS, y + 9 * SS], outline=col, width=3 * SS)
    elif kind == 'rays':
        cx, cy = w / 2, h * 0.45
        for i in range(16):
            a0 = i * math.pi / 8
            a1 = a0 + math.pi / 16
            R = w * 1.2
            d.polygon([(cx, cy), (cx + math.cos(a0) * R, cy + math.sin(a0) * R), (cx + math.cos(a1) * R, cy + math.sin(a1) * R)], fill=(255, 255, 255, 46))
    elif kind == 'galaxy':
        import random
        rnd = random.Random(11)
        for _ in range(70):
            x, y = rnd.randrange(w), rnd.randrange(h)
            r = rnd.choice([1, 1, 2, 3]) * SS
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 240, 255, rnd.randrange(120, 230)))
        for _ in range(8):
            x, y, s = rnd.randrange(w), rnd.randrange(h), rnd.randrange(5, 9) * SS
            d.polygon(poly_star(x, y, s, s * 0.25, 4), fill=(255, 220, 250, 200))
    elif kind == 'gingham':
        for x in range(0, w, 20 * SS):
            d.rectangle([x, 0, x + 10 * SS, h], fill=(255, 255, 255, 55))
        for y in range(0, h, 20 * SS):
            d.rectangle([0, y, w, y + 10 * SS], fill=(255, 255, 255, 55))
    elif kind == 'zigzag':
        for y0 in range(0, h + 20 * SS, 18 * SS):
            pts = [(x, y0 + (6 * SS if (x // (10 * SS)) % 2 else 0)) for x in range(0, w + 10 * SS, 10 * SS)]
            d.line(pts, fill=col, width=3 * SS)
    elif kind == 'beans':
        for y in range(10 * SS, h, 26 * SS):
            for x in range(((y // (26 * SS)) % 2) * 13 * SS, w, 26 * SS):
                d.ellipse([x - 7 * SS, y - 5 * SS, x + 7 * SS, y + 5 * SS], fill=col)
                d.arc([x - 7 * SS, y - 5 * SS, x + 7 * SS, y + 5 * SS], 200, 340, fill=shade(base, 0.7), width=SS * 2)

def get_cutout(i):
    os.makedirs(CUT, exist_ok=True)
    p = os.path.join(CUT, f'girl_{i:02d}.png')
    if not os.path.exists(p):
        from rembg import remove, new_session
        global _SESSION
        if '_SESSION' not in globals():
            _SESSION = new_session('isnet-anime')
        raw = Image.open(os.path.join(SRC, f'girl_{i:02d}_raw.jpg')).convert('RGB')
        remove(raw, session=_SESSION, post_process_mask=True).save(p)
    return Image.open(p).convert('RGBA')

def make_card(i):
    bg_hex, pat, shape, gem = STYLE[i - 1]
    base = hex2rgb(bg_hex)
    cut = get_cutout(i)
    W, H = cut.size
    k, cyk = CROP[i]
    S = int(H * k)
    x0 = (W - S) // 2
    y0 = int(H * cyk - S / 2)
    face = cut.crop((x0, y0, x0 + S, y0 + S))
    face = ImageEnhance.Color(face).enhance(1.1)

    w, fh, th = CARD_W * SS, FACE_H * SS, THICK * SS
    R = 26 * SS
    img = Image.new('RGBA', (w, fh + th), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 厚度 (底边，同色系加深)
    d.rounded_rectangle([0, th, w - 1, fh + th - 1], radius=R, fill=shade(base, 0.55))
    d.rounded_rectangle([0, th * 0.5, w - 1, fh + th * 0.5 - 1], radius=R, fill=shade(base, 0.72))
    # 边框 (主色)
    d.rounded_rectangle([0, 0, w - 1, fh - 1], radius=R, fill=base)
    d.rounded_rectangle([0, 0, w - 1, fh - 1], radius=R, outline=mix(base, WHITE, 0.45), width=3 * SS)
    # 内部：渐变 + 花纹
    pad = 10 * SS
    iw = w - pad * 2
    inner = Image.new('RGBA', (iw, iw), (0, 0, 0, 0))
    top_c, bot_c = mix(base, WHITE, 0.55), mix(base, WHITE, 0.08)
    grad = Image.new('RGBA', (1, iw))
    for y in range(iw):
        grad.putpixel((0, y), mix(top_c, bot_c, y / iw))
    inner = grad.resize((iw, iw))
    if pat == 'galaxy':
        inner = Image.new('RGBA', (iw, iw))
        g2 = Image.new('RGBA', (1, iw))
        for y in range(iw):
            g2.putpixel((0, y), mix(hex2rgb('#5b3d9e'), hex2rgb('#1b1236'), y / iw))
        inner = g2.resize((iw, iw))
    pl = Image.new('RGBA', (iw, iw), (0, 0, 0, 0))
    pattern(pl, pat, iw, iw, base)
    inner = Image.alpha_composite(inner, pl)
    # 头像 (带柔和白色描边，让发色与背景分离)
    f = face.resize((iw, iw), Image.LANCZOS)
    alpha = f.split()[3]
    glow = Image.new('RGBA', (iw, iw), (255, 255, 255, 0))
    glow.putalpha(alpha.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3 * SS)).point(lambda v: min(255, int(v * 0.9))))
    inner = Image.alpha_composite(inner, glow)
    inner = Image.alpha_composite(inner, f)
    mask = Image.new('L', (iw, iw), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, iw - 1, iw - 1], radius=R - pad // 2, fill=255)
    img.paste(inner, (pad, pad), mask)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([pad, pad, pad + iw - 1, pad + iw - 1], radius=R - pad // 2, outline=WHITE, width=3 * SS)
    # 光泽
    gloss = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(gloss).rounded_rectangle([pad + 8 * SS, pad + 4 * SS, w - pad - 30 * SS, pad + 16 * SS], radius=6 * SS, fill=(255, 255, 255, 60))
    img = Image.alpha_composite(img, gloss)
    d = ImageDraw.Draw(img)
    ring = shade(base, 0.8)
    # 右上大符号 + 左下小符号
    gr = 20 * SS
    badge(d, w - gr * 1.18, gr * 1.18, gr, shape, gem, ring)
    sr = 12 * SS
    badge(d, sr * 1.45, fh - sr * 1.45, sr, shape, gem, ring)
    img = img.resize((CARD_W, FACE_H + THICK), Image.LANCZOS)
    img.save(os.path.join(OUT, f'card_{i:02d}.png'), optimize=True)

def make_bg():
    raw = Image.open(os.path.join(SRC, 'bg_raw.jpg')).convert('RGB')
    W, H = raw.size
    TW, TH = 720, 1280
    cw = int(H * TW / TH)
    crop = raw.crop(((W - cw) // 2, 0, (W - cw) // 2 + cw, H)).resize((TW, TH), Image.LANCZOS)
    crop = crop.filter(ImageFilter.GaussianBlur(1.2))
    crop.save(os.path.join(OUT, 'bg.jpg'), quality=86)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for i in range(1, COUNT + 1):
        make_card(i)
        print('ok card', i)
    make_bg()
    print('ok bg')
