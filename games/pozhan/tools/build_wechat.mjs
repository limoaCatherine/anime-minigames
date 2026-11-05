// 微信小游戏构建：npm run build:wechat → build-wechat/ (用微信开发者工具「导入项目」，或 cli upload 上传)
// 官方限制 (https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html)：
//   主包 ≤ 4M，主包 + 全部分包 ≤ 30M，普通分包单个不限。
//
//  build-wechat/
//    game.js               入口 (读取 platform-config.js，启动游戏)
//    platform-config.js    ★ 唯一需要填写的配置：激励视频广告位 id、分享标题 / 图片
//    project.config.json   ★ AppID 写在这里的 "appid" (默认 touristappid = 游客模式，只能本地调试)
//    game.json             竖屏、隐藏状态栏、分包声明 (subpackages)
//    js/main.js            游戏代码 (src/ 用 esbuild 打包，与网页 / 抖音版共用核心，平台差异在 src/platform/wechat.js)
//    images/               图片 (PNG 量化到 256 色，体积约原来的 1/5)
//    sfx/                  预渲染音效 (tools/render_sfx.mjs)
//    audio/                分包「audio」：配音 + BGM (进游戏后后台加载，加载完前只显示字幕)
//
// 重复构建时保留你已经改过的 platform-config.js 与 project.config.json 里的 appid。
import { build } from 'esbuild';
import { promises as fs, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build-wechat');
const MB = 1024 * 1024;
const LIMIT = { main: 4 * MB, sub: 30 * MB, total: 30 * MB };   // 官方：主包 4M、总包 30M、普通分包不限 (受总包约束)

async function keep(file) { try { return await fs.readFile(path.join(out, file), 'utf8'); } catch (_) { return null; } }
async function dirSize(dir, skip = () => false) {
  let n = 0;
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name.endsWith('.map')) continue;   // 官方体积计算同样排除
    const p = path.join(dir, e.name);
    if (skip(p)) continue;
    n += e.isDirectory() ? await dirSize(p, skip) : (await fs.stat(p)).size;
  }
  return n;
}
const fmt = (b) => `${(b / MB).toFixed(2)} MB`;

async function main() {
  const t0 = Date.now();
  if (!existsSync(path.join(root, 'assets/audio/sfx/click_0.mp3'))) {
    console.log('未找到预渲染音效，先运行 tools/render_sfx.mjs …');
    execFileSync('node', [path.join(root, 'tools/render_sfx.mjs')], { stdio: 'inherit' });
  }
  const oldCfg = await keep('platform-config.js');
  const oldProj = await keep('project.config.json');
  let appid = 'touristappid';
  try { const a = JSON.parse(oldProj).appid; if (a) appid = a; } catch (_) { /* 首次构建 */ }

  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(path.join(out, 'js'), { recursive: true });

  await build({
    entryPoints: [path.join(root, 'src/main.wechat.js')], bundle: true, format: 'cjs', platform: 'neutral',
    target: ['es2017'], minify: !process.env.NOMINIFY, legalComments: 'none', charset: 'utf8', outfile: path.join(out, 'js/main.js'),
  });

  await fs.writeFile(path.join(out, 'game.js'),
    `// 《次元破绽！》微信小游戏入口。广告位 / 分享配置请改 platform-config.js；AppID 在 project.config.json\n` +
    `const cfg = require('./platform-config.js');\nrequire('./js/main.js').boot(cfg);\n`, 'utf8');
  await fs.writeFile(path.join(out, 'platform-config.js'), oldCfg ?? await fs.readFile(path.join(root, 'platforms/wechat/platform-config.js'), 'utf8'), 'utf8');
  await fs.writeFile(path.join(out, 'game.json'), JSON.stringify({
    deviceOrientation: 'portrait', showStatusBar: false, subpackages: [{ name: 'audio', root: 'audio/' }],
  }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(out, 'project.config.json'), JSON.stringify({
    description: '《次元破绽！》微信小游戏 (npm run build:wechat 生成)',
    compileType: 'game', appid, projectname: '次元破绽', libVersion: 'latest',
    setting: { es6: true, enhance: true, minified: true, urlCheck: true, uploadWithSourceMap: false },
    packOptions: { ignore: [{ type: 'suffix', value: '.md' }, { type: 'file', value: 'README.txt' }, { type: 'file', value: 'upload.bat' }], include: [] },
    condition: {}, editorSetting: { tabIndent: 'insertSpaces', tabSize: 2 },
  }, null, 2) + '\n', 'utf8');

  // 图片：PNG 量化 (256 色 + 抖动)，JPG 原样
  await fs.mkdir(path.join(out, 'images'), { recursive: true });
  execFileSync('python3', ['-c', `
import sys, os, shutil
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for n in sorted(os.listdir(src)):
    p = os.path.join(src, n)
    if os.path.isdir(p): continue
    if n.lower().endswith('.png'):
        im = Image.open(p).convert('RGBA')
        q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(os.path.join(dst, n), optimize=True)
    elif n.lower().endswith(('.jpg', '.jpeg')):
        shutil.copyfile(p, os.path.join(dst, n))
`, path.join(root, 'assets/images'), path.join(out, 'images')]);

  // 分享卡片 (5:4，500×400)：从商店推荐卡片 (标题 + 糯糯，不剧透任何破绽) 上半部分裁出
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size; ch = int(w * 4 / 5); top = int(h * 0.08)
im.crop((0, top, w, top + ch)).resize((500, 400), Image.LANCZOS).save(sys.argv[2], quality=86, optimize=True)
`, path.join(root, 'docs/上架资料/商店截图/推荐卡片_494x670.jpg'), path.join(out, 'images/share_card.jpg')]);

  // 主包音效
  await fs.mkdir(path.join(out, 'sfx'), { recursive: true });
  for (const n of await fs.readdir(path.join(root, 'assets/audio/sfx'))) if (n.endsWith('.mp3')) await fs.copyFile(path.join(root, 'assets/audio/sfx', n), path.join(out, 'sfx', n));

  // 分包 audio：语音 (44.1k 单声道 96k mp3) + BGM mp3
  const sub = path.join(out, 'audio');
  await fs.mkdir(path.join(sub, 'voice'), { recursive: true }); await fs.mkdir(path.join(sub, 'bgm'), { recursive: true });
  await fs.writeFile(path.join(sub, 'game.js'), '// 分包「audio」入口：只放配音与背景音乐资源，没有代码。\n', 'utf8');
  for (const n of await fs.readdir(path.join(root, 'assets/audio/voice'))) if (n.endsWith('.mp3')) await fs.copyFile(path.join(root, 'assets/audio/voice', n), path.join(sub, 'voice', n));
  for (const n of await fs.readdir(path.join(root, 'assets/audio/bgm'))) if (n.endsWith('.mp3')) await fs.copyFile(path.join(root, 'assets/audio/bgm', n), path.join(sub, 'bgm', n));

  await fs.writeFile(path.join(out, 'README.txt'), [
    '《次元破绽！》微信小游戏工程 (由 npm run build:wechat 生成)',
    '',
    '1. 打开 project.config.json，把 "appid" 的 touristappid 改成你的小游戏 AppID (公众平台 → 开发管理 → 开发设置，wx 开头)。',
    '2. 打开「微信开发者工具」→ 导入 → 选择本文件夹 (项目类型：小游戏)。',
    '3. (流量主开通后) 打开 platform-config.js 填 rewardedAdUnitId；首发留空即可，游戏里不会出现看广告按钮。',
    '4. 预览 / 真机调试没问题后，点「上传」，或在 Windows 命令行运行 upload.bat (见里面的说明)。',
    '详细步骤、资质清单、CLI 命令见 docs/上架资料/微信上架说明.md。',
  ].join('\r\n') + '\r\n', 'utf8');

  // 体积报告
  const subSize = await dirSize(sub);
  const mainSize = await dirSize(out, (p) => p === sub || p.endsWith('README.txt') || p.endsWith('upload.bat'));
  const detail = {};
  for (const d of ['js', 'images', 'sfx']) detail[d] = await dirSize(path.join(out, d));
  const report = {
    main: mainSize, audio: subSize, total: mainSize + subSize, detail,
    ok: mainSize <= LIMIT.main && subSize <= LIMIT.sub && mainSize + subSize <= LIMIT.total,
  };
  // Windows 一键上传脚本 (微信开发者工具 CLI)
  const ver = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
  await fs.writeFile(path.join(out, 'upload.bat'), [
    '@echo off',
    'rem 《次元破绽！》微信小游戏一键上传 (微信开发者工具 CLI)',
    'rem 前提：1) 已安装微信开发者工具并登录；2) 工具 设置 → 安全设置 → 打开「服务端口」；3) project.config.json 已填正确的 appid',
    'rem 如果开发者工具不是装在默认位置，改下面 CLI 这一行。',
    'set CLI="C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat"',
    `call %CLI% upload --project "%~dp0." -v ${ver} -d "次元破绽 v${ver}"`,
    'pause',
  ].join('\r\n') + '\r\n', 'utf8');
  // 中文 Windows 的 cmd 默认按 GBK 读 .bat (路径里有「微信web开发者工具」)，转成 GBK 最稳
  execFileSync('python3', ['-c', 'import sys; p=sys.argv[1]; t=open(p,encoding="utf-8").read(); open(p,"w",encoding="gbk",newline="").write(t)', path.join(out, 'upload.bat')]);


  await fs.writeFile(path.join(root, 'build-wechat-size.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`微信小游戏构建完成 -> build-wechat/  (${Date.now() - t0} ms)`);
  console.log(`  主包     ${fmt(mainSize)} / 4 MB   (代码 ${fmt(detail.js)}，图片 ${fmt(detail.images)}，音效 ${fmt(detail.sfx)})`);
  console.log(`  分包audio ${fmt(subSize)}  (配音 + BGM，普通分包不限大小)`);
  console.log(`  合计     ${fmt(mainSize + subSize)} / 30 MB  ${report.ok ? '✓ 符合限制' : '✗ 超出限制！'}`);
  if (!report.ok) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
