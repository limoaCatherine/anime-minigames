// 微信小游戏构建：npm run build:wechat → build-wechat/ (直接用「微信开发者工具」导入这个文件夹)
//
//   build-wechat/
//     game.js                入口：先读 wechat.config.js，再启动 js/main.js
//     wechat.config.js       ★ AppID / 激励视频广告位 ID (唯一需要填写的文件)
//     game.json              竖屏 + 分包声明
//     project.config.json    开发者工具项目配置 (appid 从 wechat.config.js 写入)
//     js/main.js             游戏代码 (与网页版同一套源码，esbuild 打包，__WECHAT__=true)
//     assets/images/         卡牌 / 背景 (压缩后) + dark/ 预渲染的暗色卡牌
//     assets/sfx/            预渲染音效 mp3
//     assets/share.png       转发卡片图 (5:4)      assets/share_timeline.png  朋友圈卡片图 (1:1)
//     assets/audio/          ── 分包 "audio" ── 语音 + BGM (mp3)，game.js 占位
//
// 包体上限 (微信开放文档「分包加载」「代码包」，2026-10-11 核对)：主包 ≤ 4 MB，所有主包 + 分包 ≤ 30 MB，普通分包单个不限。
// 资源与抖音版共用缓存 build/douyin-assets/ (音效 / 暗色卡牌 / 分享图 / 无缝循环 BGM)；--render 强制重新预渲染。
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { stubPlatforms } from './build-douyin.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build-wechat');
const cache = path.join(root, 'build/douyin-assets');
const MB = 1024 * 1024;
export const LIMITS = { main: 4 * MB, total: 30 * MB };

const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
const copyFlat = (src, dst, re) => { for (const n of fs.readdirSync(src)) { const p = path.join(src, n); if (fs.statSync(p).isFile() && re.test(n)) cp(p, path.join(dst, n)); } };
function dirSize(d) {
  let s = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    s += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return s;
}
function readConfig(file) {
  const ctx = { module: { exports: {} }, GameGlobal: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
  return ctx.module.exports;
}
const isReal = (id) => !!id && !/^(TODO|填|your|xxx|placeholder)/i.test(id);
const py = (args) => { const r = spawnSync('python3', args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr || r.stdout); return r.stdout.trim(); };

async function main() {
  const t0 = Date.now();
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
    const r = spawnSync(process.execPath, [path.join(root, 'tools/build.mjs')], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('网页版构建失败');
  }
  if (process.argv.includes('--render') || !fs.existsSync(path.join(cache, 'share.png'))) {
    console.log('预渲染小游戏资源 (音效 / 暗色卡牌 / 分享图)…');
    const { renderDouyinAssets } = await import('./render_douyin_assets.mjs');
    await renderDouyinAssets();
  }

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  await build({
    entryPoints: [path.join(root, 'wechat/entry.js')],
    bundle: true,
    format: 'iife',
    target: ['es2017'],
    minify: true,
    sourcemap: false,
    outfile: path.join(out, 'js/main.js'),
    legalComments: 'none',
    charset: 'utf8',
    define: { 'globalThis.__DOUYIN__': 'false', 'globalThis.__WECHAT__': 'true' },
    banner: { js: '/* 《美少女了个美》微信小游戏  出品：狸猫 */' },
    // 微信包里不带网页平台代码 (DOM / localStorage / ogg 探测)
    plugins: [stubPlatforms(['WebPlatform'], 'wechat')],
  });
  const mainJs = fs.readFileSync(path.join(out, 'js/main.js'), 'utf8');

  // 工程文件
  const wc = (n) => path.join(root, 'wechat', n);
  cp(wc('game.js'), path.join(out, 'game.js'));
  cp(wc('game.json'), path.join(out, 'game.json'));
  cp(wc('wechat.config.js'), path.join(out, 'wechat.config.js'));
  cp(wc('说明.txt'), path.join(out, '说明.txt'));
  const cfg = readConfig(wc('wechat.config.js'));
  const pc = JSON.parse(fs.readFileSync(wc('project.config.json'), 'utf8'));
  pc.appid = cfg.appid; // 还是占位符时原样写入；开发者工具导入时可改成自己的 AppID (或测试号)
  pc.description = '《美少女了个美》微信小游戏 · 出品：狸猫';
  fs.writeFileSync(path.join(out, 'project.config.json'), JSON.stringify(pc, null, 2) + '\n');

  // 主包资源
  const img = path.join(out, 'assets/images');
  console.log(`  图片压缩 ${py([path.join(root, 'tools/compress_images.py'), path.join(root, 'assets/images'), img])}`);
  fs.mkdirSync(path.join(img, 'dark'), { recursive: true });
  py([path.join(root, 'tools/compress_images.py'), path.join(cache, 'dark'), path.join(img, 'dark')]);
  copyFlat(path.join(cache, 'sfx'), path.join(out, 'assets/sfx'), /\.mp3$/);
  cp(path.join(cache, 'share.png'), path.join(out, 'assets/share.png'));
  // 朋友圈卡片 1:1：由图标生成 (500×500)
  py(['-c', `from PIL import Image; im=Image.open(${JSON.stringify(path.join(root, 'docs/douyin/store/icon_1024.png'))}).convert('RGB').resize((500,500), Image.LANCZOS); im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(${JSON.stringify(path.join(out, 'assets/share_timeline.png'))}, optimize=True)`]);

  // 商店 / 后台用的分享图也同步一份到 docs/wechat/store/
  fs.mkdirSync(path.join(root, 'docs/wechat/store'), { recursive: true });
  cp(path.join(out, 'assets/share.png'), path.join(root, 'docs/wechat/store/share_500x400.png'));
  cp(path.join(out, 'assets/share_timeline.png'), path.join(root, 'docs/wechat/store/share_timeline_500x500.png'));

  // 分包 audio：语音 + BGM (只要 mp3)
  const sub = path.join(out, 'assets/audio');
  copyFlat(path.join(root, 'assets/audio/voice'), path.join(sub, 'voice'), /\.mp3$/);
  const bgmCache = path.join(cache, 'bgm');
  const bgmSrcNewer = fs.existsSync(path.join(bgmCache, 'report.json')) && fs.readdirSync(path.join(root, 'assets/audio/bgm')).every((n) => fs.statSync(path.join(root, 'assets/audio/bgm', n)).mtimeMs < fs.statSync(path.join(bgmCache, 'report.json')).mtimeMs);
  if (process.argv.includes('--render') || !bgmSrcNewer) {
    console.log('  生成无缝循环 BGM (tools/douyin_bgm.py)…');
    const r = spawnSync('python3', [path.join(root, 'tools/douyin_bgm.py'), bgmCache], { encoding: 'utf8' });
    process.stdout.write(r.stdout || '');
    if (r.status !== 0) throw new Error('BGM 无缝循环校验失败\n' + r.stderr);
  }
  copyFlat(bgmCache, path.join(sub, 'bgm'), /\.mp3$/);
  const bgmReport = JSON.parse(fs.readFileSync(path.join(bgmCache, 'report.json'), 'utf8'));
  console.log('  BGM 接缝：' + Object.entries(bgmReport).map(([k, r]) => `${k} 首/尾多出静音 ${r.extraLeadSilenceMs}/${r.extraTrailSilenceMs} ms${r.ok ? ' ✔' : ' ✘'}`).join('，'));
  cp(wc('subpackage-audio-game.js'), path.join(sub, 'game.js'));

  // 只用 mp3：包里不允许出现 .ogg 文件或引用 (iOS 微信不能播 ogg)
  const oggFiles = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.ogg$/i.test(e.name)) oggFiles.push(p); } })(out);
  const oggRefs = (mainJs.match(/\.ogg\b|audio\/ogg|vorbis/gi) || []).length;
  if (oggFiles.length || oggRefs) throw new Error(`微信包里出现 ogg：文件 ${oggFiles.length} 个，代码引用 ${oggRefs} 处`);
  console.log('  音频格式：全部 mp3 (无 .ogg 文件、代码无 ogg 引用)');

  // 包体检查 (开发者工具上传时不计 project.config.json / 说明.txt，这里按全部文件算，偏保守)
  const total = dirSize(out);
  const subSize = dirSize(sub);
  const main = total - subSize;
  const report = { main, audio: subSize, total, limits: LIMITS, ok: main <= LIMITS.main && total <= LIMITS.total,
    appidFilled: isReal(cfg.appid), adUnitFilled: isReal(cfg.rewardedAdUnitId) };
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build/wechat-size.json'), JSON.stringify(report, null, 2));
  const f = (b) => `${(b / MB).toFixed(2)} MB`;
  console.log(`  主包 ${f(main)} / 上限 4 MB · 分包 audio ${f(subSize)} (普通分包不限) · 整包 ${f(total)} / 上限 30 MB → ${report.ok ? '通过' : '超限!'}`);
  if (!report.appidFilled) console.log('  ⚠ wechat.config.js 里的 appid 还是占位符 (TODO_…)，上线前必须填写');
  console.log(report.adUnitFilled ? '  复活方式：激励视频 (已填广告位 ID)' : (cfg.freeReviveWithoutAd === false ? '  复活方式：无 (未填广告位且 freeReviveWithoutAd=false)' : '  复活方式：免费「再试一次」(未填广告位 ID，包内无广告)'));
  console.log(`微信小游戏构建完成 -> build-wechat/  (${Date.now() - t0} ms)`);
  if (!report.ok) process.exit(2);
}

main().catch((err) => { console.error(err); process.exit(1); });
