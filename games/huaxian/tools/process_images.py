"""把 assets/images/source/ 下的原图处理成游戏用图片。
- 角色/敌人 (白底立绘) -> 去白底、裁掉透明边的 PNG (assets/images/<name>.png)
  · 优先使用 rembg (isnet-anime 模型) 生成主体蒙版，再与「从边缘泛洪的白底」结合：
    与外部连通的白色 = 背景；被线条包围的白色区域按 rembg 蒙版的平均值整体判定
    (白色裙子保留、手臂与身体之间的空隙去掉)，避免白裙出现破洞。
  · 未安装 rembg 时退回纯泛洪算法 (容差 + 边缘羽化)，内部白色全部保留。
  · 半透明边缘做「去白边」(反预乘白色)，并去掉与主体不相连的小装饰 (闪光/爱心)，
    保证同一角色不同表情的尺寸一致。
- 背景 (横版 1280x720) -> 竖版 720x1280：模糊放大铺满 + 清晰原图居中，上下羽化过渡。
依赖: pip install pillow numpy scipy  (可选: pip install "rembg[cpu]")
用法: python tools/process_images.py [--check]   (--check 额外输出深色底预览图到 assets/images/source/_preview.png)
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'images', 'source')
DST = os.path.join(ROOT, 'assets', 'images')

# 名称: 相对原图的缩放比例。同一角色的四种表情使用同一比例，保证游戏内大小一致。
SPRITES = {
    'heroine_idle': 0.62, 'heroine_scared': 0.62, 'heroine_happy': 0.62, 'heroine_lose': 0.62,
    'enemy_bee': 0.22, 'enemy_hive': 0.5, 'enemy_boss': 0.6, 'enemy_auntie': 0.6,
}
BACKGROUNDS = {'bg_park': 'bg_level', 'key_art': 'bg_menu'}

try:
    from rembg import remove, new_session
    _SESSION = new_session('isnet-anime')
except Exception:  # noqa
    _SESSION = None


def white_flood(rgb, tol=26):
    """与图像边缘连通的近白像素 -> True (背景)"""
    a = rgb.astype(np.int16)
    mn = a.min(axis=2); mx = a.max(axis=2)
    near_white = (mn >= 255 - tol) & ((mx - mn) <= 22)
    lab, _ = ndimage.label(near_white)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    return np.isin(lab, border), near_white


def cutout(name):
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB')
    rgb = np.asarray(im)
    bg, near_white = white_flood(rgb)
    fg = ~bg
    if _SESSION is not None:
        r = np.asarray(remove(im, session=_SESSION, only_mask=True)).astype(np.float32) / 255
        # 被包围的白色区域：整体按 rembg 平均值判定
        enclosed = near_white & ~bg
        lab, n = ndimage.label(enclosed)
        if n:
            means = ndimage.mean(r, lab, index=np.arange(1, n + 1))
            sizes = ndimage.sum(np.ones_like(r), lab, index=np.arange(1, n + 1))
            drop = [i + 1 for i in range(n) if means[i] < 0.35 and sizes[i] > 60]
            fg &= ~np.isin(lab, drop)
        # 非白色但 rembg 认为是背景的 = 白底上的小装饰；交给下方的连通分量过滤
    # 去掉与主体不相连的小块 (闪光、爱心等)
    lab, n = ndimage.label(ndimage.binary_closing(fg, iterations=2))
    if n > 1:
        sizes = ndimage.sum(np.ones(fg.shape), lab, index=np.arange(1, n + 1))
        keep = [i + 1 for i in range(n) if sizes[i] >= sizes.max() * 0.06]
        fg &= np.isin(lab, keep)
    # 边缘：收缩 1px 后高斯羽化
    core = ndimage.binary_erosion(fg, iterations=1)
    alpha = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255
    alpha = np.clip((alpha - 0.08) / 0.84, 0, 1)
    alpha[ndimage.binary_erosion(fg, iterations=3)] = 1.0
    # 去白边：c = (c - (1-a)*255) / a
    a3 = alpha[..., None]
    col = rgb.astype(np.float32)
    dec = np.where(a3 > 0.02, (col - (1 - a3) * 255) / np.maximum(a3, 0.02), col)
    dec = np.clip(dec, 0, 255)
    rgba = np.dstack([dec, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    bbox = out.getbbox()
    out = out.crop((max(0, bbox[0] - 4), max(0, bbox[1] - 4), min(out.width, bbox[2] + 4), min(out.height, bbox[3] + 4)))
    s = SPRITES[name]
    out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
    out.save(os.path.join(DST, name + '.png'), optimize=True)
    return out


def portrait_bg(name, out_name, W=720, H=1280, band=0.62):
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB')
    # 模糊铺底 (cover)
    s = max(W / im.width, H / im.height)
    big = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (big.width - W) // 2
    base = big.crop((x, 0, x + W, H)).filter(ImageFilter.GaussianBlur(18))
    # 清晰中景：高度 = H*band，居中裁剪
    bh = round(H * band)
    s2 = bh / im.height
    mid = im.resize((round(im.width * s2), bh), Image.LANCZOS)
    x2 = (mid.width - W) // 2
    mid = mid.crop((x2, 0, x2 + W, bh))
    y0 = round((H - bh) * 0.55)
    mask = np.ones((bh, W), np.float32)
    f = round(bh * 0.16)
    ramp = np.linspace(0, 1, f) ** 1.5
    mask[:f] *= ramp[:, None]
    mask[-f:] *= ramp[::-1][:, None]
    base.paste(mid, (0, y0), Image.fromarray((mask * 255).astype(np.uint8)))
    base.save(os.path.join(DST, out_name + '.jpg'), quality=88, optimize=True)


def preview(cuts):
    pad = 20
    w = sum(c.width for c in cuts) * 0.5 + pad * (len(cuts) + 1)
    h = max(c.height for c in cuts) * 0.5 + pad * 2
    for color, nm in [((40, 30, 60), '_preview.png'), ((255, 120, 170), '_preview_pink.png')]:
        sheet = Image.new('RGBA', (int(w), int(h)), color + (255,))
        x = pad
        for c in cuts:
            cc = c.resize((c.width // 2, c.height // 2), Image.LANCZOS)
            sheet.alpha_composite(cc, (x, pad))
            x += cc.width + pad
        sheet.save(os.path.join(SRC, nm))


if __name__ == '__main__':
    print('rembg:', 'isnet-anime' if _SESSION else '未安装，使用泛洪去底')
    cuts = []
    for n in SPRITES:
        cuts.append(cutout(n))
        print('ok', n, cuts[-1].size)
    for n, o in BACKGROUNDS.items():
        portrait_bg(n, o)
        print('ok', o)
    if '--check' in sys.argv:
        preview(cuts)
        print('预览:', os.path.join(SRC, '_preview.png'))
