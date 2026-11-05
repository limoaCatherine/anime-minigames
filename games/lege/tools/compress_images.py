"""抖音包体压缩：PNG → 256 色调色板 PNG (保留透明)，JPG → 质量 82 渐进式。
只在变小时才替换。用法：python3 tools/compress_images.py <src_dir> <dst_dir>  (只处理当前层文件)"""
import os, sys, io
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
before = after = 0
for name in sorted(os.listdir(src)):
    p = os.path.join(src, name)
    if not os.path.isfile(p):
        continue
    ext = name.lower().rsplit('.', 1)[-1]
    if ext not in ('png', 'jpg', 'jpeg'):
        continue
    raw = open(p, 'rb').read()
    im = Image.open(p)
    buf = io.BytesIO()
    if ext == 'png':
        q = im.convert('RGBA').quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(buf, 'PNG', optimize=True)
    else:
        im.convert('RGB').save(buf, 'JPEG', quality=82, optimize=True, progressive=True)
    data = buf.getvalue() if len(buf.getvalue()) < len(raw) else raw
    open(os.path.join(dst, name), 'wb').write(data)
    before += len(raw); after += len(data)
print(f'{before // 1024} KB -> {after // 1024} KB')
