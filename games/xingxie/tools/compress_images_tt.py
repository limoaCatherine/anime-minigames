# 抖音小游戏图片压缩：assets/images/*.png|jpg → assets/douyin/images/
# PNG 用 pngquant 量化为 256 色调色板 (保留透明；没有 pngquant 时退回 PIL)，JPG 重新编码 quality 82。只在原图更新后重跑；生成物入库，构建时直接复制。
import sys, os, glob
from PIL import Image, features

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(root, 'assets', 'images')
dst_dir = os.path.join(root, 'assets', 'douyin', 'images')
os.makedirs(dst_dir, exist_ok=True)
liq = features.check_feature('libimagequant')
method = Image.Quantize.LIBIMAGEQUANT if liq else Image.Quantize.FASTOCTREE
tot0 = tot1 = 0
for f in sorted(glob.glob(os.path.join(src_dir, '*.*'))):
    name = os.path.basename(f); out = os.path.join(dst_dir, name)
    im = Image.open(f)
    if name.lower().endswith('.png'):
        import shutil, subprocess
        if shutil.which('pngquant'):
            # pngquant 对半透明渐变处理得比 PIL 好得多 (立绘底部的淡出不会出色块)
            subprocess.run(['pngquant', '--force', '--quality=50-90', '--speed', '1', '--strip', '--output', out, f], check=False)
            if not os.path.exists(out): shutil.copyfile(f, out)
        else:
            q = im.convert('RGBA').quantize(colors=256, method=method, dither=Image.Dither.FLOYDSTEINBERG)
            q.save(out, optimize=True)
    elif name.lower().endswith(('.jpg', '.jpeg')):
        im.convert('RGB').save(out, quality=82, optimize=True, progressive=False)
    else:
        continue
    a, b = os.path.getsize(f), os.path.getsize(out)
    if b >= a:  # 压不动就用原图
        import shutil; shutil.copyfile(f, out); b = a
    tot0 += a; tot1 += b
    print(f'{name:28s} {a/1024:7.1f} KB -> {b/1024:7.1f} KB')
print(f'合计 {tot0/1024:.0f} KB -> {tot1/1024:.0f} KB  (libimagequant={liq})')
