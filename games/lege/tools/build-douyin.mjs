// 抖音小游戏构建：npm run build:douyin → build-douyin/ (直接用「抖音开发者工具」导入这个文件夹)
//
//   build-douyin/
//     game.js                入口：先读 douyin.config.js，再启动 js/main.js
//     douyin.config.js       ★ AppID / 激励视频广告位 ID (唯一需要填写的文件)
//     game.json              竖屏 + 分包声明
//     project.config.json    开发者工具项目配置 (appid 从 douyin.config.js 写入)
//     js/main.js             游戏代码 (与网页版同一套源码，esbuild 打包，__DOUYIN__=true)
//     assets/images/         卡牌 / 背景 (压缩后) + dark/ 预渲染的暗色卡牌
//     assets/sfx/            预渲染音效 mp3
//     assets/share.png       分享卡片图
//     assets/audio/          ── 分包 "audio" ── 语音 + BGM (mp3)，game.js 占位
//
// 包体上限 (抖音开放平台文档，2026-10 核对)：主包 ≤ 4 MB，单个分包 ≤ 20 MB，整包 ≤ 20 MB。
// 选项：--render 强制重新预渲染音效/暗色卡牌/分享图 (否则复用 build/douyin-assets/ 缓存)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build-douyin');
const cache = path.join(root, 'build/douyin-assets');
const MB = 1024 * 1024;
export const LIMITS = { main: 4 * MB, sub: 20 * MB, total: 20 * MB };

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
/** esbuild 插件：把用不到的平台模块换成空壳 (只导出同名类，构造时报错) */
export function stubPlatforms(names, target) {
  return {
    name: 'stub-platforms',
    setup(b) {
      const re = new RegExp(`(${names.join('|')})\\.js$`);
      b.onResolve({ filter: re }, (a) => ({ path: re.exec(a.path)[1], namespace: 'platform-stub' }));
      b.onLoad({ filter: /.*/, namespace: 'platform-stub' }, (a) => ({ contents: `export class ${a.path} { constructor() { throw new Error("${a.path} not in ${target} build"); } }`, loader: 'js' }));
    },
  };
}
const isReal = (id) => !!id && !/^(TODO|填|your|xxx|placeholder)/i.test(id);

async function main() {
  const t0 = Date.now();
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
    const r = spawnSync(process.execPath, [path.join(root, 'tools/build.mjs')], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('网页版构建失败');
  }
  if (process.argv.includes('--render') || !fs.existsSync(path.join(cache, 'share.png'))) {
    console.log('预渲染抖音资源 (音效 / 暗色卡牌 / 分享图)…');
    const { renderDouyinAssets } = await import('./render_douyin_assets.mjs');
    await renderDouyinAssets();
  }

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  await build({
    entryPoints: [path.join(root, 'douyin/entry.js')],
    bundle: true,
    format: 'iife',
    target: ['es2017'],
    minify: true,
    sourcemap: false,
    outfile: path.join(out, 'js/main.js'),
    legalComments: 'none',
    charset: 'utf8',
    define: { 'globalThis.__DOUYIN__': 'true', 'globalThis.__WECHAT__': 'false' },
    banner: { js: '/* 《美少女了个美》抖音小游戏  出品：狸猫 */' },
    // 抖音包里不带网页平台代码 (DOM / localStorage / ogg 探测) 和微信平台代码：换成空壳
    plugins: [stubPlatforms(['WebPlatform', 'WechatPlatform'], 'douyin')],
  });

  // 工程文件
  const dy = (n) => path.join(root, 'douyin', n);
  cp(dy('game.js'), path.join(out, 'game.js'));
  cp(dy('game.json'), path.join(out, 'game.json'));
  cp(dy('douyin.config.js'), path.join(out, 'douyin.config.js'));
  cp(dy('说明.txt'), path.join(out, '说明.txt'));
  const cfg = readConfig(dy('douyin.config.js'));
  const pc = JSON.parse(fs.readFileSync(dy('project.config.json'), 'utf8'));
  pc.appid = cfg.appid; // 还是占位符时原样写入；开发者工具导入时可改选自己的 AppID (或测试号)
  pc.description = '《美少女了个美》抖音小游戏 · 出品：狸猫';
  fs.writeFileSync(path.join(out, 'project.config.json'), JSON.stringify(pc, null, 2) + '\n');

  // 主包资源
  const img = path.join(out, 'assets/images');
  const py = spawnSync('python3', [path.join(root, 'tools/compress_images.py'), path.join(root, 'assets/images'), img], { encoding: 'utf8' });
  if (py.status !== 0) throw new Error(py.stderr);
  console.log(`  图片压缩 ${py.stdout.trim()}`);
  fs.mkdirSync(path.join(img, 'dark'), { recursive: true });
  const py2 = spawnSync('python3', [path.join(root, 'tools/compress_images.py'), path.join(cache, 'dark'), path.join(img, 'dark')], { encoding: 'utf8' });
  if (py2.status !== 0) throw new Error(py2.stderr);
  copyFlat(path.join(cache, 'sfx'), path.join(out, 'assets/sfx'), /\.mp3$/);
  cp(path.join(cache, 'share.png'), path.join(out, 'assets/share.png'));

  // 分包 audio：语音 + BGM (只要 mp3)
  const sub = path.join(out, 'assets/audio');
  copyFlat(path.join(root, 'assets/audio/voice'), path.join(sub, 'voice'), /\.mp3$/);
  // BGM：无缝循环版 (循环体 + 0.5 s 延续尾巴，配合 src/platform/LoopAudio.js 两路交叉淡化)
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
  cp(dy('subpackage-audio-game.js'), path.join(sub, 'game.js'));

  // iOS 抖音不能播 ogg：包里不允许出现 .ogg 文件或引用
  const oggFiles = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.ogg$/i.test(e.name)) oggFiles.push(p); } })(out);
  const oggRefs = (fs.readFileSync(path.join(out, 'js/main.js'), 'utf8').match(/\.ogg\b|audio\/ogg|vorbis/gi) || []).length;
  if (oggFiles.length || oggRefs) throw new Error(`抖音包里出现 ogg：文件 ${oggFiles.length} 个，代码引用 ${oggRefs} 处`);
  console.log('  音频格式：全部 mp3 (无 .ogg 文件、代码无 ogg 引用)');

  // 包体检查
  const total = dirSize(out);
  const subSize = dirSize(sub);
  const main = total - subSize;
  const report = { main, audio: subSize, total, limits: LIMITS, ok: main <= LIMITS.main && subSize <= LIMITS.sub && total <= LIMITS.total,
    appidFilled: isReal(cfg.appid), adUnitFilled: isReal(cfg.rewardedAdUnitId) };
  fs.writeFileSync(path.join(root, 'build/douyin-size.json'), JSON.stringify(report, null, 2));
  const f = (b) => `${(b / MB).toFixed(2)} MB`;
  console.log(`  主包 ${f(main)} / 上限 4 MB · 分包 audio ${f(subSize)} / 上限 20 MB · 整包 ${f(total)} / 上限 20 MB → ${report.ok ? '通过' : '超限!'}`);
  if (!report.appidFilled) console.log('  ⚠ douyin.config.js 里的 appid 还是占位符 (TODO_…)，上线前必须填写');
  console.log(report.adUnitFilled ? '  复活方式：激励视频 (已填广告位 ID)' : (cfg.freeReviveWithoutAd === false ? '  复活方式：无 (未填广告位且 freeReviveWithoutAd=false)' : '  复活方式：免费「再试一次」(未填广告位 ID，包内无广告)'));
  console.log(`抖音小游戏构建完成 -> build-douyin/  (${Date.now() - t0} ms)`);
  if (!report.ok) process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((err) => { console.error(err); process.exit(1); });
