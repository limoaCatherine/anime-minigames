# 生成微信转发卡片图 assets/wechat/share_5x4.jpg (500×400，官方转发图显示比例 5:4)
# 来源：上架截图 01_主菜单 (标题 + 主角)，中间正方形区域放大居中，左右用同图模糊铺底。
from PIL import Image, ImageFilter
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(root, 'docs/douyin/截图/01_主菜单.jpg')).convert('RGB')
W, H = 500, 400
bg = src.crop((0, 200, 1080, 1064)).resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))
fg = src.crop((0, 150, 1080, 1230)).resize((H, H), Image.LANCZOS)
bg.paste(fg, ((W - H) // 2, 0))
out = os.path.join(root, 'assets/wechat/share_5x4.jpg')
bg.save(out, quality=88, optimize=True)
print(out, os.path.getsize(out))
