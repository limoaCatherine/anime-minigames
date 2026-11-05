// 构建脚本 (esbuild)
//   node tools/build.mjs                  网页版 → dist/ (单个经典脚本 game.js + index.html，可直接双击打开，file:// 无 CORS 问题)
//   node tools/build.mjs --target douyin  抖音小游戏 → 抖音小游戏/ (game.js / game.json / project.config.json / 分包 / 上架资料)
//                                         默认输出到项目根目录的 抖音小游戏/ (用抖音开发者工具导入它)，--out <目录> 可另指定
//   node tools/build.mjs --target wechat  微信小游戏 → 微信小游戏/ (game.js / game.json / project.config.json / 分包 / 上架资料)
//                                         用微信开发者工具导入；--out <目录> 可另指定
// 玩法代码各端共用，平台差异在 src/core/platform/ (define __PLATFORM__ 决定用 web.js / tt.js / wx.js)。
import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const target = argVal('--target') || 'web';

async function copyDir(src, dst, filter = () => true) {
  await fs.mkdir(dst, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    if (entry.isDirectory()) continue; // 只复制当前层文件 (不复制 source 原图)
    if (filter(entry.name)) await fs.copyFile(path.join(src, entry.name), path.join(dst, entry.name));
  }
}

async function copyTree(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name); const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyTree(s, d); else await fs.copyFile(s, d);
  }
}

async function dirSize(dir, skip = () => false) {
  let n = 0;
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (skip(e.name)) continue;
    if (e.isDirectory()) n += await dirSize(p);
    else if (!e.name.startsWith('.') && !e.name.endsWith('.js.map')) n += (await fs.stat(p)).size;
  }
  return n;
}

async function buildWeb() {
  const t0 = Date.now();
  const dist = path.join(root, 'dist');
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });

  await build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true, format: 'iife', target: ['es2018'], minify: true, sourcemap: false,
    outfile: path.join(dist, 'game.js'), legalComments: 'none', charset: 'utf8',
    define: { __PLATFORM__: '"web"' },
  });

  await copyDir(path.join(root, 'assets/images'), path.join(dist, 'assets/images'), (n) => /\.(png|jpe?g|webp)$/i.test(n));
  await copyDir(path.join(root, 'assets/audio/voice'), path.join(dist, 'assets/audio/voice'), (n) => /\.(mp3|ogg|wav|m4a)$/i.test(n));
  await copyDir(path.join(root, 'assets/audio/bgm'), path.join(dist, 'assets/audio/bgm'), (n) => /\.(mp3|ogg)$/i.test(n));
  await fs.copyFile(path.join(root, 'src/style.css'), path.join(dist, 'style.css'));
  await fs.copyFile(path.join(root, 'assets/icons/favicon.png'), path.join(dist, 'favicon.png'));

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <title>《星屑轮舞》AnimeSurvivor</title>
  <link rel="icon" type="image/png" href="favicon.png" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <canvas id="game"></canvas>
  <script src="game.js"></script>
</body>
</html>
`;
  await fs.writeFile(path.join(dist, 'index.html'), html, 'utf8');
  console.log(`构建完成 -> dist/  (${Date.now() - t0} ms)`);
}

// 抖音官方包体限制 (开放平台「分包加载」文档)：使用分包时 主包 ≤ 4MB，单个分包 ≤ 20MB，总包 ≤ 20MB
const LIMIT = { main: 4 * 1024 * 1024, sub: 20 * 1024 * 1024, total: 20 * 1024 * 1024 };

async function buildDouyin() {
  const t0 = Date.now();
  const out = path.resolve(root, argVal('--out') || '抖音小游戏');
  const { PlatformConfig, DouyinConfig } = await import(pathToFileURL(path.join(root, 'src/config/PlatformConfig.js')).href);
  const { IMAGES } = await import(pathToFileURL(path.join(root, 'src/config/AssetConfig.js')).href);
  const { SFX_MANIFEST } = await import(pathToFileURL(path.join(root, 'src/config/SfxManifest.js')).href);
  if (!Object.keys(SFX_MANIFEST.files).length) throw new Error('缺少预渲染音效：先运行 node tools/render_sfx.mjs');
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });

  await build({
    entryPoints: [path.join(root, 'src/main.douyin.js')],
    bundle: true, format: 'iife', target: ['es2018'], minify: true, sourcemap: false,
    // 抖音包里的中文一律转义成 \uXXXX (charset ascii)，不依赖运行时按什么编码读脚本
    outfile: path.join(out, 'game.js'), legalComments: 'none', charset: 'ascii',
    define: { __PLATFORM__: '"douyin"' },
    plugins: [{
      // 平台入口换成只含 tt 实现的 index.douyin.js
      name: 'douyin-platform',
      setup(b) {
        b.onResolve({ filter: /platform\/index\.js$/ }, (a) => ({ path: path.join(path.resolve(a.resolveDir, path.dirname(a.path)), 'index.douyin.js') }));
        // BGM 来源换成只含 mp3 的版本 (抖音 iOS 不支持 ogg，包里不出现任何 ogg 引用)
        b.onResolve({ filter: /BgmSources\.js$/ }, (a) => ({ path: path.join(path.resolve(a.resolveDir, path.dirname(a.path)), 'BgmSources.douyin.js') }));
      },
    }],
  });

  const packFor = (src) => DouyinConfig.packs.find((p) => src.startsWith(p.prefix) && p.test.test(src));
  const imgSrc = async (src) => {           // 优先用压缩过的 assets/douyin/images
    const c = path.join(root, 'assets/douyin/images', path.basename(src));
    try { await fs.access(c); return c; } catch (_) { return path.join(root, src); }
  };
  const put = async (from, rel) => { const d = path.join(out, rel); await fs.mkdir(path.dirname(d), { recursive: true }); await fs.copyFile(from, d); };

  // 图片：主包 (头像 / Boss / 菜单背景) 与 立绘分包
  for (const im of IMAGES) {
    const p = packFor(im.src);
    await put(await imgSrc(im.src), p ? p.root + im.src : im.src);
  }
  // 音效 (主包)
  const sfx = new Set([...Object.values(SFX_MANIFEST.files).flat(), SFX_MANIFEST.swarm].filter(Boolean));
  for (const s of sfx) await put(path.join(root, s), s);
  // 语音 / BGM 分包 (只要 mp3；iOS 不支持 ogg)
  for (const p of DouyinConfig.packs.filter((x) => x.name !== 'art')) {
    const dir = path.join(root, p.prefix);
    for (const f of await fs.readdir(dir)) {
      const src = p.prefix + f;
      if (!p.test.test(src)) continue;
      // BGM 优先用 tools/make_tt_bgm.py 生成的「循环 + overrun」版本 (运行时无缝循环用)
      const tt = p.name === 'bgm' ? path.join(root, 'assets/douyin/bgm', f) : null;
      const from = tt && await fs.access(tt).then(() => true, () => false) ? tt : path.join(dir, f);
      if (p.name === 'bgm' && from !== tt) throw new Error(`缺少抖音版 BGM ${f}：先运行 python3 tools/make_tt_bgm.py`);
      await put(from, p.root + src);
    }
  }
  // 每个分包根目录需要一个 game.js 入口 (官方要求)
  for (const p of DouyinConfig.packs) {
    await fs.mkdir(path.join(out, p.root), { recursive: true });
    await fs.writeFile(path.join(out, p.root, 'game.js'), `// 分包「${p.name}」入口 (只放资源，无代码)\n`, 'utf8');
  }

  const gameJson = {
    deviceOrientation: 'portrait',
    showStatusBar: false,
    subPackages: DouyinConfig.packs.map((p) => ({ name: p.name, root: p.root })),
  };
  await fs.writeFile(path.join(out, 'game.json'), JSON.stringify(gameJson, null, 2) + '\n', 'utf8');
  const appid = PlatformConfig.douyin.appid || 'YOUR_TT_APPID';
  const projectConfig = {
    appid,
    projectname: DouyinConfig.projectName,
    setting: { es6: true, urlCheck: true, autoCompile: true },
    // 上架资料 / 说明文件不进代码包 (官方 packOptions.ignore：不出现在预览 / 上传结果里，也不计包体积)
    packOptions: { ignore: [{ type: 'file', value: 'README_抖音工程.txt' }, { type: 'folder', value: '上架资料' }] },
  };
  await fs.writeFile(path.join(out, 'project.config.json'), JSON.stringify(projectConfig, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(out, 'README_抖音工程.txt'), [
    '《星屑轮舞》抖音小游戏工程 (由 tools/build.mjs --target douyin 生成，请勿手改)',
    '出品：狸猫',
    '',
    '用抖音开发者工具「导入项目」选择本目录即可预览 / 真机调试 / 上传。上架步骤见 上架资料/上架说明.md。',
    'AppID 与激励视频广告位 ID 只在源码 src/config/PlatformConfig.js 里填写，填好后执行 npm run build:douyin 重新生成本目录。',
    PlatformConfig.douyin.appid ? `当前 AppID：${appid}` : '当前 AppID 未填写 (project.config.json 里是占位符 YOUR_TT_APPID，导入时可先选测试号)。',
    PlatformConfig.douyin.rewardedAdUnitId ? '当前已配置激励视频广告位。' : '当前未配置激励视频广告位：看广告按钮 (换一批 / 结算翻倍) 全部隐藏，复活改为每局免费一次「再试一次」；填上 ID 重新构建即恢复激励视频。',
    '',
  ].join('\r\n'), 'utf8');

  // 上架资料 (说明 / 隐私政策草案 / 商店文案 / 截图)
  await copyTree(path.join(root, 'docs/douyin'), path.join(out, '上架资料'));

  // 包体统计 (按开发者工具口径：不计 . 开头文件 / node_modules / .js.map；README 已在 packOptions.ignore 里)
  const subRoots = DouyinConfig.packs.map((p) => p.root.replace(/\/$/, ''));
  const skipMain = (n) => subRoots.includes(n) || n === 'node_modules' || n === 'README_抖音工程.txt' || n === 'project.config.json' || n === '上架资料';
  const main = await dirSize(out, skipMain);
  const subs = {};
  for (const p of DouyinConfig.packs) subs[p.name] = await dirSize(path.join(out, p.root));
  const total = main + Object.values(subs).reduce((a, b) => a + b, 0);
  const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  const report = { main, subs, total, limit: LIMIT, ok: main <= LIMIT.main && total <= LIMIT.total && Object.values(subs).every((s) => s <= LIMIT.sub) };
  await fs.writeFile(path.join(root, 'build/douyin_size.json'), JSON.stringify(report, null, 2));
  console.log(`抖音小游戏构建完成 -> ${path.relative(root, out) || out}  (${Date.now() - t0} ms)`);
  console.log(`  主包 ${mb(main)} / 上限 4 MB`);
  for (const p of DouyinConfig.packs) console.log(`  分包 ${p.name.padEnd(5)} (${p.root}) ${mb(subs[p.name])} / 上限 20 MB`);
  console.log(`  总计 ${mb(total)} / 上限 20 MB  ${report.ok ? '✓ 符合限制' : '✗ 超出限制'}`);
  if (!report.ok) process.exit(2);
}


// 微信官方包体限制 (小游戏开发文档「分包加载」「代码包」)：
//   整个小游戏所有主包+分包 ≤ 30M；主包 ≤ 4M；单个普通分包不限制大小；单个独立分包 ≤ 4M (本工程不用独立分包)
const WX_LIMIT = { main: 4 * 1024 * 1024, sub: Infinity, total: 30 * 1024 * 1024 };
// 代码包文件类型白名单里与本工程相关的部分 (其余后缀上传时会被丢弃)
const WX_UPLOAD_EXT = /\.(js|json|png|jpe?g|mp3|wav|txt)$/i;

async function buildWechat() {
  const t0 = Date.now();
  const out = path.resolve(root, argVal('--out') || '微信小游戏');
  const { PlatformConfig, WechatConfig } = await import(pathToFileURL(path.join(root, 'src/config/PlatformConfig.js')).href);
  const { IMAGES } = await import(pathToFileURL(path.join(root, 'src/config/AssetConfig.js')).href);
  const { SFX_MANIFEST } = await import(pathToFileURL(path.join(root, 'src/config/SfxManifest.js')).href);
  if (!Object.keys(SFX_MANIFEST.files).length) throw new Error('缺少预渲染音效：先运行 node tools/render_sfx.mjs');
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });

  await build({
    entryPoints: [path.join(root, 'src/main.wechat.js')],
    bundle: true, format: 'iife', target: ['es2018'], minify: true, sourcemap: false,
    outfile: path.join(out, 'game.js'), legalComments: 'none', charset: 'ascii',
    define: { __PLATFORM__: '"wechat"' },
    plugins: [{
      name: 'wechat-platform',
      setup(b) {
        b.onResolve({ filter: /platform\/index\.js$/ }, (a) => ({ path: path.join(path.resolve(a.resolveDir, path.dirname(a.path)), 'index.wechat.js') }));
        // BGM 只用 mp3 + 「循环 + overrun」版本 (与抖音版同一套文件)，由 TTLoopAudio 双实例交叉淡化
        b.onResolve({ filter: /BgmSources\.js$/ }, (a) => ({ path: path.join(path.resolve(a.resolveDir, path.dirname(a.path)), 'BgmSources.douyin.js') }));
        // 抖音专有的侧边栏复访：换成空实现，微信包里不带相关代码和文案
        b.onResolve({ filter: /(SidebarService|SidebarPanel)\.js$/ }, (a) => ({ path: path.join(path.resolve(a.resolveDir, path.dirname(a.path)), path.basename(a.path, '.js') + '.none.js') }));
        // 抖音专有的录屏分享：换成只有「转发给好友」的微信版
        b.onResolve({ filter: /ShareService\.js$/ }, (a) => ({ path: path.join(path.resolve(a.resolveDir, path.dirname(a.path)), 'ShareService.wechat.js') }));
      },
    }],
  });

  const packFor = (src) => WechatConfig.packs.find((p) => src.startsWith(p.prefix) && p.test.test(src));
  const imgSrc = async (src) => {           // 与抖音版共用压缩过的 assets/douyin/images
    const c = path.join(root, 'assets/douyin/images', path.basename(src));
    try { await fs.access(c); return c; } catch (_) { return path.join(root, src); }
  };
  const put = async (from, rel) => { const d = path.join(out, rel); await fs.mkdir(path.dirname(d), { recursive: true }); await fs.copyFile(from, d); };

  for (const im of IMAGES) { const p = packFor(im.src); await put(await imgSrc(im.src), p ? p.root + im.src : im.src); }
  const sfx = new Set([...Object.values(SFX_MANIFEST.files).flat(), SFX_MANIFEST.swarm].filter(Boolean));
  for (const s of sfx) await put(path.join(root, s), s);
  for (const p of WechatConfig.packs.filter((x) => x.name !== 'art')) {
    const dir = path.join(root, p.prefix);
    for (const f of await fs.readdir(dir)) {
      const src = p.prefix + f;
      if (!p.test.test(src)) continue;
      const loopFile = p.name === 'bgm' ? path.join(root, 'assets/douyin/bgm', f) : null;
      const from = loopFile && await fs.access(loopFile).then(() => true, () => false) ? loopFile : path.join(dir, f);
      if (p.name === 'bgm' && from !== loopFile) throw new Error(`缺少循环版 BGM ${f}：先运行 python3 tools/make_tt_bgm.py`);
      await put(from, p.root + src);
    }
  }
  // 转发卡片图 (5:4)
  await put(path.join(root, 'assets/wechat/share_5x4.jpg'), WechatConfig.share.imageUrl);
  // 每个分包目录根下的 game.js 是分包入口 (官方：目录根目录下的 game.js 会作为入口文件)
  for (const p of WechatConfig.packs) {
    await fs.mkdir(path.join(out, p.root), { recursive: true });
    await fs.writeFile(path.join(out, p.root, 'game.js'), `// 分包「${p.name}」入口 (只放资源，无代码)\n`, 'utf8');
  }

  const gameJson = {
    deviceOrientation: 'portrait',
    showStatusBar: false,
    networkTimeout: { request: 10000, connectSocket: 10000, uploadFile: 10000, downloadFile: 10000 },
    subpackages: WechatConfig.packs.map((p) => ({ name: p.name, root: p.root })),
  };
  await fs.writeFile(path.join(out, 'game.json'), JSON.stringify(gameJson, null, 2) + '\n', 'utf8');
  const appid = PlatformConfig.wechat.appid || 'touristappid';
  const projectConfig = {
    description: '《星屑轮舞》微信小游戏工程 (tools/build.mjs --target wechat 生成)',
    compileType: 'game',
    appid,
    projectname: WechatConfig.projectName,
    libVersion: '3.0.0',
    setting: { urlCheck: true, es6: true, enhance: false, postcss: false, minified: true, uglifyFileName: false, ignoreUploadUnusedFiles: true },
    condition: {},
    editorSetting: { tabIndent: 'insertSpaces', tabSize: 2 },
    // 上架资料 / 说明文件不进代码包 (packOptions.ignore：不参与预览 / 上传，不计包体)
    packOptions: { ignore: [{ type: 'file', value: 'README_微信工程.txt' }, { type: 'folder', value: '上架资料' }], include: [] },
  };
  await fs.writeFile(path.join(out, 'project.config.json'), JSON.stringify(projectConfig, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(out, 'README_微信工程.txt'), [
    '《星屑轮舞》微信小游戏工程 (由 tools/build.mjs --target wechat 生成，请勿手改)',
    '出品：狸猫',
    '',
    '用「微信开发者工具」→ 导入项目 → 选择本目录。上架步骤见 上架资料/微信上架说明.md。',
    'AppID 与激励视频广告位 ID 只在源码 src/config/PlatformConfig.js 的 wechat 字段填写，填好后执行 npm run build:wechat 重新生成本目录。',
    PlatformConfig.wechat.appid ? `当前 AppID：${appid}` : '当前 AppID 未填写 (project.config.json 里是 touristappid：开发者工具以游客模式打开，只能在模拟器里跑，不能真机预览 / 上传；导入时也可以在工具里直接填正式 AppID)。',
    PlatformConfig.wechat.rewardedAdUnitId ? '当前已配置激励视频广告位。' : '当前未配置激励视频广告位：看广告按钮 (换一批 / 结算翻倍) 全部隐藏，复活改为每局免费一次「再试一次」；开通流量主、填上广告单元 ID 重新构建即恢复激励视频。',
    '',
  ].join('\r\n'), 'utf8');

  // 上架资料 (微信版说明 / 隐私协议草案 / 商店文案 / 截图)
  await copyTree(path.join(root, 'docs/wechat'), path.join(out, '上架资料'));
  await fs.copyFile(path.join(root, 'docs/微信上架说明.md'), path.join(out, '上架资料/微信上架说明.md'));

  // 包体统计 + 上传白名单检查
  const subRoots = WechatConfig.packs.map((p) => p.root.replace(/\/$/, ''));
  const skipMain = (n) => subRoots.includes(n) || n === 'node_modules' || n === 'README_微信工程.txt' || n === 'project.config.json' || n === '上架资料';
  const main = await dirSize(out, skipMain);
  const subs = {};
  for (const p of WechatConfig.packs) subs[p.name] = await dirSize(path.join(out, p.root));
  const total = main + Object.values(subs).reduce((a, b) => a + b, 0);
  const walk = async (d) => (await Promise.all((await fs.readdir(d, { withFileTypes: true })).map((e) => (e.isDirectory() ? (e.name === '上架资料' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])))).flat();
  const files = (await walk(out)).filter((f) => !/README_微信工程\.txt$/.test(f));
  const badExt = files.filter((f) => !WX_UPLOAD_EXT.test(f)).map((f) => path.relative(out, f));
  const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  const report = { main, subs, total, limit: { main: WX_LIMIT.main, sub: 'unlimited', total: WX_LIMIT.total }, badExt, ok: main <= WX_LIMIT.main && total <= WX_LIMIT.total && !badExt.length };
  await fs.mkdir(path.join(root, 'build'), { recursive: true });
  await fs.writeFile(path.join(root, 'build/wechat_size.json'), JSON.stringify(report, null, 2));
  console.log(`微信小游戏构建完成 -> ${path.relative(root, out) || out}  (${Date.now() - t0} ms)`);
  console.log(`  主包 ${mb(main)} / 上限 4 MB`);
  for (const p of WechatConfig.packs) console.log(`  分包 ${p.name.padEnd(5)} (${p.root}) ${mb(subs[p.name])} / 普通分包不限`);
  console.log(`  总计 ${mb(total)} / 上限 30 MB  ${report.ok ? '✓ 符合限制' : '✗ 超出限制'}${badExt.length ? '  非白名单文件: ' + badExt.join(', ') : ''}`);
  if (!report.ok) process.exit(2);
}

({ douyin: buildDouyin, wechat: buildWechat }[target] || buildWeb)().catch((err) => { console.error(err); process.exit(1); });
