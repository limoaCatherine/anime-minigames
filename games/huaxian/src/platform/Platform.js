// 平台抽象层 (1.4)：玩法代码只通过这里访问运行环境，不直接用 window / document / localStorage / tt。
//   WebPlatform      浏览器 (dist/index.html 双击 / 本地服务器)
//   ElectronPlatform 桌面版 (Electron 里跑的同一份网页，只是 name 不同、自动播放不受限)
//   DouyinPlatform   抖音小游戏 (tt.* API，douyin/ 工程，由 tools/build-douyin.mjs 打包)
// 当前平台由 ./current.js 导出：网页构建指向 Web/Electron，抖音构建在 esbuild 里把它替换成 ./current.douyin.js。
//
// 接口约定 (各平台实现同名方法，缺省实现见下面的基类)：
//   createMainCanvas()            主画布
//   createCanvas(w, h)            离屏画布 (占位图等)
//   createImage()                 图片对象 (onload / onerror / src)
//   resolveAsset(src)             'assets/images/x.png' -> 平台实际路径 (抖音：压缩后的文件 / 分包目录)
//   loadSubpackage(name)          加载分包 -> Promise (网页直接 resolve)
//   createAudio()                 类 HTMLAudioElement 对象：src / loop / volume / currentTime / paused / ended / duration /
//                                 play() -> Promise / pause() / load() / addEventListener(canplaythrough|loadeddata|error|ended) / onended
//   createAudioContext()          WebAudio 上下文 (没有则返回 null -> 音效改用预渲染的音频文件)
//   speech                        speechSynthesis (没有为 null)
//   storage                       { getItem, setItem, removeItem } (没有为 null)
//   now() / raf(cb)               时间 / 下一帧
//   viewport()                    { width, height, dpr, safeArea:{left,top,right,bottom}, fullscreen }
//   layout(canvas, view)          网页：设置 CSS 尺寸；抖音：无
//   canvasRect(canvas, view)      画面在屏幕上的位置 (把触点换算成逻辑坐标)
//   onResize(cb) / onVisibility(cb(hidden)) / isHidden()
//   bindInput(canvas, h)          h.down/move/up({id, clientX, clientY, type}) / h.cancel() / h.key(e)
//   features                      { keyboard, share, recorder, sidebar, autoplay }
//   init(game)                    平台服务 (录屏 / 分享菜单 / 侧边栏) 订阅游戏事件
//   showRewardedVideo(placement)  激励视频 -> Promise<{ok}> ；返回 null = 当前平台没有广告 SDK，AdService 走桩实现
//   share(opts)                   分享 (抖音：带录屏视频) -> Promise<boolean>
export class Platform {
  constructor(name) {
    this.name = name;
    this.features = { keyboard: false, share: false, recorder: false, sidebar: false, autoplay: false };
  }

  init() {}
  resolveAsset(src) { return src; }
  loadSubpackage() { return Promise.resolve(true); }
  createAudioContext() { return null; }
  get speech() { return null; }
  get storage() { return null; }
  now() { return Date.now(); }
  raf(cb) { return setTimeout(() => cb(this.now()), 16); }
  isHidden() { return false; }
  onResize() {}
  onVisibility() {}
  showRewardedVideo() { return null; }
  share() { return Promise.resolve(false); }
  toast(msg) { console.log(`[toast] ${msg}`); }
}
