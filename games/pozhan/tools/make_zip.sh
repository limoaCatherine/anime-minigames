#!/bin/bash
# 组装发布包：/workspace/次元破绽.zip → 次元破绽/{dist/, release/次元破绽/次元破绽.exe(+运行库, licenses/), 抖音小游戏/, 微信小游戏/, docs/, start.bat, tools/serve.js, README.md}
# 然后按 8 MB 切片到 /workspace/_spd13/CYPZ.part000…
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE=/workspace/_stage/spotdiff
TOP=次元破绽
ZIP=/workspace/次元破绽.zip
rm -rf "$STAGE" && mkdir -p "$STAGE/$TOP/tools" "$STAGE/$TOP/release"
cp -r "$ROOT/dist" "$STAGE/$TOP/dist"
cp -r "$ROOT/release/次元破绽" "$STAGE/$TOP/release/次元破绽"
cp "$ROOT/tools/start.bat" "$STAGE/$TOP/"
cp "$ROOT/tools/serve.js" "$STAGE/$TOP/tools/"
cp "$ROOT/docs/开发说明.md" "$STAGE/$TOP/README.md"
# 抖音小游戏工程 (npm run build:douyin 的产物)
test -f "$ROOT/build-douyin/game.js" || { echo "缺少 build-douyin/，先运行 npm run build:douyin"; exit 1; }
cp -r "$ROOT/build-douyin" "$STAGE/$TOP/抖音小游戏"
# 微信小游戏工程 (npm run build:wechat 的产物)
test -f "$ROOT/build-wechat/game.js" || { echo "缺少 build-wechat/，先运行 npm run build:wechat"; exit 1; }
cp -r "$ROOT/build-wechat" "$STAGE/$TOP/微信小游戏"
# 文档：上架说明、隐私协议草稿、商店文案、商店截图、许可证 (README 已放在顶层)
mkdir -p "$STAGE/$TOP/docs"
for f in 抖音上架说明.md 微信上架说明.md 隐私协议草稿.md 商店文案.md; do cp "$ROOT/docs/上架资料/$f" "$STAGE/$TOP/docs/"; done
cp -r "$ROOT/docs/上架资料/商店截图" "$ROOT/docs/licenses" "$STAGE/$TOP/docs/"
test -d "$STAGE/$TOP/release/次元破绽/licenses" || { echo "exe 旁缺少 licenses/，先运行 node tools/package.mjs win"; exit 1; }
# 不允许任何 ogg 进包 (iOS 不能播)
if find "$STAGE" -iname "*.ogg" | grep -q .; then echo "发布包里有 ogg 文件"; exit 1; fi
rm -f "$ZIP"
cd "$STAGE" && python3 - "$ZIP" "$TOP" <<'PY'
import os, sys, zipfile
zp, top = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, dirs, files in os.walk(top):
        dirs.sort()
        for f in sorted(files):
            p = os.path.join(base, f)
            info = zipfile.ZipInfo.from_file(p, p)
            info.compress_type = zipfile.ZIP_DEFLATED
            if os.access(p, os.X_OK): info.external_attr = (0o755 << 16)
            with open(p, 'rb') as fh: z.writestr(info, fh.read(), compresslevel=9)
PY
python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print('zip ok', len(z.namelist()), 'entries')" "$ZIP"
mkdir -p /workspace/_spd13 && rm -f /workspace/_spd13/CYPZ.part*
split -b 8M -d -a 3 "$ZIP" /workspace/_spd13/CYPZ.part
ls -la "$ZIP" /workspace/_spd13
sha256sum "$ZIP"
cat /workspace/_spd13/CYPZ.part* | sha256sum
