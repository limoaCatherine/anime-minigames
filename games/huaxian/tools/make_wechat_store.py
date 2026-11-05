# 微信小游戏商店 / 提审素材：由 tools/test-wechat.mjs --store 生成的 1080×1920 截图 + 主视觉，制作
#   wechat/store/screenshot_0..5.jpg   游戏截图 1080×1920 (同一尺寸；0 = 启动页 健康游戏忠告 + 游戏名，1 主界面，2 选关，3~4 玩法，5 胜利结算)
#                                      提审「游戏内容介绍」与小游戏备案按顺序上传 (健康忠告 / 名称页 → 玩法 → 过程 → 胜负)
#   wechat/store/icon_1024.png / icon_512.png / icon_144.png   小游戏头像 (方形、不透明的有色背景，平台显示为圆形 / 圆角)
#   wechat/store/promo_1920x1080.jpg  宣传图 (版本审核 step3「上传宣传图」为选填，尺寸以提交页面提示为准；16:9 横图)
#   wechat/store/share_500x400.jpg    转发卡片图 (5:4，与游戏内 assets/share.jpg 相同)
#   assets/wechat/share_timeline.jpg  分享到朋友圈的正方形图 300×300 (构建时打进主包)
# 用法：node tools/test-wechat.mjs --store && python3 tools/make_wechat_store.py
import io, os, shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = os.path.join(ROOT, 'wechat', 'store')
os.makedirs(STORE, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'assets', 'wechat'), exist_ok=True)
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


def text_c(img, text, y, size, color, x=None):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    d.text(((img.width - w) / 2 if x is None else x, y), text, font=f, fill=color, stroke_width=max(2, size // 8), stroke_fill=(255, 255, 255))


out = []
# 1) 截图 (同一机型、同一尺寸)
for i, n in enumerate(['shot0_boot', 'shot1_menu', 'shot2_levels', 'shot3_play', 'shot4_boss', 'shot5_win']):
    src = os.path.join(STORE, n + '.png')
    if not os.path.exists(src):
        continue
    kb, q = save_jpg(Image.open(src), os.path.join(STORE, f'screenshot_{i}.jpg'), q=90)
    os.remove(src)
    out.append(f'screenshot_{i}.jpg 1080x1920 {kb}KB')

# 2) 头像：圆角 app.png 铺到同色方形底上 (不透明、有色背景)
ic = Image.open(P('assets/icons/app.png')).convert('RGBA')
bgc = ic.getpixel((ic.width // 2, 6)) if ic.getpixel((ic.width // 2, 6))[3] == 255 else (255, 241, 232, 255)
sq = Image.new('RGBA', ic.size, bgc)
sq.alpha_composite(ic)
sq = sq.convert('RGB')
for s in (1024, 512, 144):
    sq.resize((s, s), Image.LANCZOS).save(os.path.join(STORE, f'icon_{s}.png'), optimize=True)
    out.append(f'icon_{s}.png {s}x{s}')

bg = Image.open(P('assets/images/bg_menu.jpg')).convert('RGB')
key = Image.open(P('assets/images/source/key_art.jpg')).convert('RGB')

# 3) 宣传图 1920×1080：主视觉 + 标题
pr = cover(key, 1920, 1080, 0.35)
text_c(pr, '画线守护美少女', 70, 128, (255, 92, 160))
text_c(pr, '画一条线，护住她！', 250, 56, (110, 80, 130))
text_c(pr, '出品：狸猫', 960, 40, (110, 80, 130))
kb, q = save_jpg(pr, os.path.join(STORE, 'promo_1920x1080.jpg'), 600)
out.append(f'promo_1920x1080.jpg {kb}KB q{q}')

# 4) 转发卡片 (5:4) —— 与抖音版共用 assets/douyin/share.jpg
share = P('assets', 'douyin', 'share.jpg')
if os.path.exists(share):
    shutil.copyfile(share, os.path.join(STORE, 'share_500x400.jpg'))
    out.append('share_500x400.jpg (= assets/douyin/share.jpg)')

# 5) 朋友圈正方形图 300×300
tl = cover(key, 300, 300, 0.3)
text_c(tl, '画线守护美少女', 8, 34, (255, 92, 160))
kb, q = save_jpg(tl, P('assets', 'wechat', 'share_timeline.jpg'), 60, 88)
out.append(f'assets/wechat/share_timeline.jpg 300x300 {kb}KB')
print('\n'.join(out))
