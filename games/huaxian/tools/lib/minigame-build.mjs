// 小游戏构建公共逻辑：src/ (与网页版同一份玩法代码) -> douyin/ 或 wechat/
//   game.js              esbuild 打包的单文件 (平台层换成 DouyinPlatform / WeChatPlatform，Matter.js 从 npm 打包，不含 window/document)
//   game.json            竖屏 + 分包声明
//   project.config.json  开发者工具工程配置 (appid 取自 config.js，空则 'YOUR_APPID')
//   config.js            APPID / AD_UNIT_ID (只在不存在时生成，之后由你修改；运行时 require，改广告位不用重新构建)
//   assets/              主包资源：背景 jpg、预渲染音效、分享图
//   subpackages/images/  分包：角色 / 敌人立绘 (量化压缩的 png)
//   subpackages/audio/   分包：语音 mp3 + 背景音乐 mp3 (无缝循环版)
//   licenses/            许可文本 (リダ / AivisSpeech / Matter.js)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rel = (...p) => path.join(root, ...p);
const mkdir = (d) => fs.mkdirSync(d, { recursive: true });
const MB = 1024 * 1024;

export const TARGETS = {
  douyin: {
    label: '抖音',
    dir: 'douyin',
    entry: 'src/main.douyin.js',
    current: 'src/platform/current.douyin.js',
    // 抖音：主包 ≤ 4 MB，单个分包 ≤ 20 MB，整包 ≤ 20 MB (上架说明.md 附官方链接)
    limit: { main: 4 * MB, sub: 20 * MB, total: 20 * MB },
    subKey: 'subPackages',
    configDoc: '上架说明.md',
    appidHint: '抖音开放平台 → 小游戏 → 开发管理 → 开发设置 → AppID (形如 tt0123456789abcdef)',
    adHint: '流量主 → 广告位管理 → 新建「激励视频」广告位后得到的广告位 ID',
    banner: '抖音小游戏版',
    projectConfig: (appid) => ({
      appid,
      projectname: '画线守护美少女',
      description: '画线守护美少女 AnimeDrawLine 抖音小游戏版 (出品：狸猫)',
      compileType: 'game',
      setting: { es6: true, minified: true, urlCheck: false, postcss: false },
      packOptions: { ignore: [{ type: 'folder', value: 'store' }, { type: 'suffix', value: '.md' }] },
    }),
  },
  wechat: {
    label: '微信',
    dir: 'wechat',
    entry: 'src/main.wechat.js',
    current: 'src/platform/current.wechat.js',
    // 微信：主包 ≤ 4 MB，主包 + 全部分包 ≤ 30 MB，普通分包不单独限制 (微信上架说明.md 附官方链接)
    limit: { main: 4 * MB, sub: 30 * MB, total: 30 * MB },
    subKey: 'subpackages',
    configDoc: '微信上架说明.md',
    appidHint: '微信公众平台 mp.weixin.qq.com → 开发 → 开发管理 → 开发设置 → 开发者 ID → AppID (形如 wx0123456789abcdef)',
    adHint: '流量主 → 广告管理 → 新建广告位 →「激励视频」后得到的广告位 ID (形如 adunit-0123456789abcdef)',
    banner: '微信小游戏版',
    projectConfig: (appid) => ({
      appid,
      projectname: '画线守护美少女',
      description: '画线守护美少女 AnimeDrawLine 微信小游戏版 (出品：狸猫)',
      compileType: 'game',
      setting: { urlCheck: false, es6: true, enhance: true, postcss: false, minified: true, uglifyFileName: false, ignoreUploadUnusedFiles: true },
      packOptions: { ignore: [{ type: 'folder', value: 'store' }, { type: 'suffix', value: '.md' }], include: [] },
      condition: {},
      editorSetting: { tabIndent: 'insertSpaces', tabSize: 2 },
    }),
  },
};

function dirSize(d, skip = () => false) {
  let n = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (skip(p, e)) continue;
    n += e.isDirectory() ? dirSize(p, skip) : fs.statSync(p).size;
  }
  return n;
}

export async function buildMiniGame(targetName) {
  const T = TARGETS[targetName];
  if (!T) throw new Error(`unknown target ${targetName}`);
  const out = rel(T.dir);
  const SUBS = [{ name: 'images', root: 'subpackages/images/' }, { name: 'audio', root: 'subpackages/audio/' }];
  const t0 = Date.now();

  // 1) 清理上次生成的内容 (保留 config.js / 文档 / store/)
  for (const p of ['game.js', 'game.json', 'project.config.json', 'assets', 'subpackages', 'licenses']) fs.rmSync(path.join(out, p), { recursive: true, force: true });
  mkdir(out);

  // 2) config.js (只在不存在时生成)
  const cfgPath = path.join(out, 'config.js');
  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(cfgPath, `// ${T.label}小游戏配置 —— 上架前只需要改这一个文件 (详见 ${T.configDoc})。
// APPID 改完后运行 \`node tools/build-${targetName}.mjs\` 会同步到 project.config.json (或者手动改那里的 "appid")。
// AD_UNIT_ID 在运行时读取，改完直接在开发者工具里重新编译即可。
module.exports = {
  // ${T.appidHint}
  APPID: '',
  // ${T.adHint}；留空 = 游戏里不显示任何看广告界面，提示免费 (看过提示的那次最高 2 星)
  AD_UNIT_ID: '',
};
`);
  }
  const require = createRequire(import.meta.url);
  delete require.cache[cfgPath];
  const cfg = require(cfgPath);

  // 3) 资源：主包 / 分包，生成 原路径 -> 小游戏路径 的映射
  const assetMap = {};
  const IMG_SRC = rel('assets/images');
  mkdir(path.join(out, 'assets/images'));
  mkdir(path.join(out, 'subpackages/images'));
  const pngs = [];
  for (const f of fs.readdirSync(IMG_SRC)) {
    const src = path.join(IMG_SRC, f);
    if (!fs.statSync(src).isFile()) continue;
    if (/\.jpe?g$/i.test(f)) {                       // 背景：主包 (启动就要用)
      fs.copyFileSync(src, path.join(out, 'assets/images', f));
      assetMap[`assets/images/${f}`] = `assets/images/${f}`;
    } else if (/\.png$/i.test(f)) {                  // 立绘：images 分包，量化压缩
      pngs.push([src, path.join(out, 'subpackages/images', f)]);
      assetMap[`assets/images/${f}`] = `subpackages/images/${f}`;
    }
  }
  // PNG 量化 (256 色 + alpha，Pillow FASTOCTREE)，保持原尺寸；小游戏 iOS 端对 webp 支持不稳定，所以仍用 png
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
for src, dst in json.loads(sys.argv[1]):
    im = Image.open(src).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(dst, optimize=True)
`, JSON.stringify(pngs)]);

  // 预渲染音效 (主包)
  const sfxDir = rel('assets/sfx');
  if (!fs.existsSync(sfxDir) || fs.readdirSync(sfxDir).length < 10) throw new Error('缺少 assets/sfx：请先运行 node tools/render-sfx.mjs');
  mkdir(path.join(out, 'assets/sfx'));
  for (const f of fs.readdirSync(sfxDir)) {
    fs.copyFileSync(path.join(sfxDir, f), path.join(out, 'assets/sfx', f));
    assetMap[`assets/sfx/${f}`] = `assets/sfx/${f}`;
  }

  // 分享图 (5:4)：assets/douyin/share.jpg (两个平台共用)，没有就从菜单背景裁一张；微信朋友圈另加一张正方形图
  const shareSrc = rel('assets/douyin/share.jpg');
  const bgMenu = rel('assets/images/bg_menu.jpg');
  if (fs.existsSync(shareSrc)) fs.copyFileSync(shareSrc, path.join(out, 'assets/share.jpg'));
  else {
    execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open('${bgMenu}').convert('RGB')
w, h = im.size
ch = int(w * 4 / 5)
im.crop((0, int(h * 0.12), w, int(h * 0.12) + ch)).resize((500, 400), Image.LANCZOS).save('${path.join(out, 'assets/share.jpg')}', quality=82)
`]);
  }
  assetMap['assets/share.jpg'] = 'assets/share.jpg';
  if (targetName === 'wechat') {
    const sq = rel('assets/wechat/share_timeline.jpg');
    if (fs.existsSync(sq)) fs.copyFileSync(sq, path.join(out, 'assets/share_timeline.jpg'));
    else {
      execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open('${path.join(out, 'assets/share.jpg')}').convert('RGB')
w, h = im.size
s = min(w, h)
im.crop(((w - s) // 2, 0, (w - s) // 2 + s, s)).resize((300, 300), Image.LANCZOS).save('${path.join(out, 'assets/share_timeline.jpg')}', quality=85)
`]);
    }
    assetMap['assets/share_timeline.jpg'] = 'assets/share_timeline.jpg';
  }

  // 音频分包：语音 + BGM (只要 mp3；小游戏 iOS 不支持 ogg)
  mkdir(path.join(out, 'subpackages/audio/voice'));
  mkdir(path.join(out, 'subpackages/audio/bgm'));
  for (const f of fs.readdirSync(rel('assets/audio/voice'))) {
    if (!/\.mp3$/i.test(f)) continue;
    fs.copyFileSync(rel('assets/audio/voice', f), path.join(out, 'subpackages/audio/voice', f));
    assetMap[`assets/audio/voice/${f}`] = `subpackages/audio/voice/${f}`;
  }
  // BGM：mp3 编码器会在首尾补静音 (LAME 前 1105 / 后约 940 个采样 ≈ 46 ms)，InnerAudioContext 的 loop=true 不会去掉，
  // 接缝处会有空白。所以从无缝的 ogg 重新编码一份「完整一遍 + 开头 1.5 秒」的 mp3，运行时用两个 InnerAudioContext
  // 在 loopLength 处交替并交叉淡化 (src/platform/TTAudio.js 的 TTLoopAudio)。
  const loops = {};
  {
    const src = rel('assets/audio/bgm/bgm_main.ogg');
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,duration_ts', '-of', 'json', src]).toString()).streams[0];
    const loopLength = Number(probe.duration_ts) / Number(probe.sample_rate);
    const TAIL = 1.5;
    const dst = path.join(out, 'subpackages/audio/bgm/bgm_main_loop.mp3');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-filter_complex', `[0:a]asplit[a][b];[b]atrim=0:${TAIL},asetpts=N/SR/TB[h];[a][h]concat=n=2:v=0:a=1[o]`, '-map', '[o]', '-codec:a', 'libmp3lame', '-b:a', '128k', dst]);
    assetMap['assets/audio/bgm/bgm_main.mp3'] = 'subpackages/audio/bgm/bgm_main_loop.mp3';
    loops['subpackages/audio/bgm/bgm_main_loop.mp3'] = { loopLength: +loopLength.toFixed(6), tail: TAIL };
  }
  for (const s of SUBS) fs.writeFileSync(path.join(out, s.root, 'game.js'), `// ${s.name} 分包入口 (纯资源分包，没有代码)。\n`);

  // 许可文本：.md 会被 packOptions 忽略，统一改成 .txt 随包发布
  mkdir(path.join(out, 'licenses'));
  for (const f of fs.readdirSync(rel('docs/licenses'))) fs.copyFileSync(rel('docs/licenses', f), path.join(out, 'licenses', f.replace(/\.md$/i, '.txt')));

  // 4) 打包 game.js
  const plugin = {
    name: 'minigame-platform',
    setup(b) {
      b.onResolve({ filter: /platform\/current\.js$/ }, () => ({ path: rel(T.current) }));
      b.onResolve({ filter: /lib\/matter\.js$/ }, () => ({ path: rel('src/platform/matter.douyin.js') }));
      b.onResolve({ filter: /^minigame:assets$/ }, () => ({ path: 'minigame:assets', namespace: 'minigame-virtual' }));
      b.onLoad({ filter: /.*/, namespace: 'minigame-virtual' }, () => ({ contents: `export const MG_ASSETS = ${JSON.stringify(assetMap)};\nexport const MG_LOOPS = ${JSON.stringify(loops)};`, loader: 'js' }));
      // config.js 运行时 require (与 game.js 同目录)
      b.onResolve({ filter: /^\.\/config\.js$/ }, (a) => (a.kind === 'require-call' ? { path: './config.js', external: true } : undefined));
    },
  };
  // 只打包当前平台：另一个平台的类不会被引用 (current.*.js 只 import 自己)
  const res = await build({
    entryPoints: [rel(T.entry)],
    bundle: true,
    format: 'iife',
    target: ['es2017'],
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
    outfile: path.join(out, 'game.js'),
    plugins: [plugin],
    // 小游戏没有 window / document：Matter.js 里 typeof window 的探测直接变成 undefined 分支
    define: process.env.NODEFINE ? {} : { window: 'undefined', document: 'undefined', 'process.env.NODE_ENV': '"production"' },
    banner: { js: `/* 画线守护美少女 AnimeDrawLine — ${T.banner}。出品：狸猫。角色语音：AivisSpeech「リダ / Lida」(作者许可，署名 リダ https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join)；物理引擎 Matter.js (MIT)。许可全文见 licenses/ */` },
    logLevel: 'warning',
    metafile: true,
  });

  // 5) game.json / project.config.json
  fs.writeFileSync(path.join(out, 'game.json'), JSON.stringify({
    deviceOrientation: 'portrait',
    showStatusBar: false,
    networkTimeout: { request: 10000, connectSocket: 10000, uploadFile: 10000, downloadFile: 10000 },
    [T.subKey]: SUBS,
  }, null, 2) + '\n');
  const appid = String(cfg.APPID || '').trim() || 'YOUR_APPID';
  fs.writeFileSync(path.join(out, 'project.config.json'), JSON.stringify(T.projectConfig(appid), null, 2) + '\n');

  // 6) 体积统计 (store/ 与 .md 不上传)
  const ignored = (p, e) => (e.isDirectory() && e.name === 'store' && path.dirname(p) === out) || (!e.isDirectory() && /\.md$/i.test(e.name));
  const sizes = {
    main: dirSize(out, (p, e) => ignored(p, e) || p === path.join(out, 'subpackages')),
    game_js: fs.statSync(path.join(out, 'game.js')).size,
  };
  for (const s of SUBS) sizes[s.name] = dirSize(path.join(out, s.root));
  sizes.total = sizes.main + SUBS.reduce((a, s) => a + sizes[s.name], 0);
  const mb = (n) => `${(n / MB).toFixed(2)} MB`;
  const LIMIT = T.limit;
  const okMain = sizes.main <= LIMIT.main; const okTotal = sizes.total <= LIMIT.total; const okSubs = SUBS.every((s) => sizes[s.name] <= LIMIT.sub);
  fs.writeFileSync(path.join(out, 'build-info.json'), JSON.stringify({ builtAt: new Date().toISOString(), target: targetName, appid, adUnitIdSet: !!String(cfg.AD_UNIT_ID || '').trim(), sizes, limits: LIMIT, assetMap, loops }, null, 2) + '\n');
  console.log(`${T.label}构建完成 -> ${T.dir}/ (${Date.now() - t0} ms)  game.js ${mb(sizes.game_js)}`);
  console.log(`  主包 ${mb(sizes.main)} / ${LIMIT.main / MB} MB ${okMain ? '✔' : '✘'}   images 分包 ${mb(sizes.images)}   audio 分包 ${mb(sizes.audio)}   总计 ${mb(sizes.total)} / ${LIMIT.total / MB} MB ${okTotal ? '✔' : '✘'}`);
  if (res.warnings.length) console.log(`  esbuild 警告 ${res.warnings.length} 条`);
  return { ok: okMain && okTotal && okSubs, sizes, limits: LIMIT };
}
