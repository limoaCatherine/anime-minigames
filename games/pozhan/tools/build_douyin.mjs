// 抖音小游戏构建：npm run build:douyin → build-douyin/ (用抖音开发者工具直接「导入项目」)
//
//  build-douyin/
//    game.js               入口 (读取 platform-config.js，启动游戏)
//    platform-config.js    ★ 唯一需要填写的配置：AppID、激励视频广告位 id、分享模板 id
//    game.json             竖屏、隐藏状态栏、分包声明
//    project.config.json   开发者工具项目配置 (appid 占位 YOUR_DOUYIN_APPID)
//    js/main.js            游戏代码 (src/ 用 esbuild 打包，与网页版共用核心，平台差异在 src/platform/douyin.js)
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
const out = path.join(root, 'build-douyin');
const MB = 1024 * 1024;
const LIMIT = { main: 4 * MB, sub: 20 * MB, total: 20 * MB };   // 官方分包限制 (无虚拟支付)

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
  let appid = 'YOUR_DOUYIN_APPID';
  try { const a = JSON.parse(oldProj).appid; if (a) appid = a; } catch (_) { /* 首次构建 */ }

  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(path.join(out, 'js'), { recursive: true });

  await build({
    entryPoints: [path.join(root, 'src/main.douyin.js')], bundle: true, format: 'cjs', platform: 'neutral',
    target: ['es2017'], minify: !process.env.NOMINIFY, legalComments: 'none', charset: 'utf8', outfile: path.join(out, 'js/main.js'),
  });

  await fs.writeFile(path.join(out, 'game.js'),
    `// 《次元破绽！》抖音小游戏入口。配置 (AppID / 广告位) 请改 platform-config.js\n` +
    `const cfg = require('./platform-config.js');\nrequire('./js/main.js').boot(cfg);\n`, 'utf8');
  await fs.writeFile(path.join(out, 'platform-config.js'), oldCfg ?? await fs.readFile(path.join(root, 'platforms/douyin/platform-config.js'), 'utf8'), 'utf8');
  await fs.writeFile(path.join(out, 'game.json'), JSON.stringify({
    deviceOrientation: 'portrait', showStatusBar: false, subPackages: [{ name: 'audio', root: 'audio/' }],
  }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(out, 'project.config.json'), JSON.stringify({
    appid, projectname: '次元破绽',
    setting: { es6: true, urlCheck: true, autoCompile: true },
    packOptions: { ignore: [{ type: 'suffix', value: '.md' }, { type: 'file', value: 'README.txt' }], include: [] },
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
    '《次元破绽！》抖音小游戏工程 (由 npm run build:douyin 生成)',
    '',
    '1. 打开「抖音开发者工具」→ 导入项目 → 选择本文件夹 → 填写你的小游戏 AppID。',
    '2. 打开 platform-config.js，填写 appId (与上一步相同) 和 rewardedAdUnitId (激励视频广告位 id)。',
    '3. 预览 / 真机调试没问题后，点「上传」，到抖音开发者后台提交审核。',
    '详细步骤与资质清单见 docs/上架资料/抖音上架说明.md。',
  ].join('\r\n') + '\r\n', 'utf8');

  // 体积报告
  const subSize = await dirSize(sub);
  const mainSize = await dirSize(out, (p) => p === sub || p.endsWith('README.txt'));
  const detail = {};
  for (const d of ['js', 'images', 'sfx']) detail[d] = await dirSize(path.join(out, d));
  const report = {
    main: mainSize, audio: subSize, total: mainSize + subSize, detail,
    ok: mainSize <= LIMIT.main && subSize <= LIMIT.sub && mainSize + subSize <= LIMIT.total,
  };
  await fs.writeFile(path.join(root, 'build-douyin-size.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`抖音小游戏构建完成 -> build-douyin/  (${Date.now() - t0} ms)`);
  console.log(`  主包     ${fmt(mainSize)} / 4 MB   (代码 ${fmt(detail.js)}，图片 ${fmt(detail.images)}，音效 ${fmt(detail.sfx)})`);
  console.log(`  分包audio ${fmt(subSize)} / 20 MB  (配音 + BGM)`);
  console.log(`  合计     ${fmt(mainSize + subSize)} / 20 MB  ${report.ok ? '✓ 符合限制' : '✗ 超出限制！'}`);
  if (!report.ok) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
