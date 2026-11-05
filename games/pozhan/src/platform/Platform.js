// 平台抽象层：核心游戏代码 (core / scenes / systems / ui) 只通过这里访问运行环境，
// 不直接碰 window / document / localStorage / Audio / Image。
//   - 浏览器 / Electron：platform/web.js      (入口 src/main.js)
//   - 抖音小游戏：      platform/douyin.js   (入口 src/main.douyin.js，无 DOM，tt.* API)
//   - 微信小游戏：      platform/wechat.js   (入口 src/main.wechat.js，无 DOM，wx.* API)
// 入口文件在创建 Game 之前调用 usePlatform(...) 装入具体实现。
export const Platform = {
  name: 'none',
  features: { record: false, share: false, sidebar: false, keyboard: false, wheel: false },
  /** 语音只用一个播放器切换 src (小游戏里 InnerAudioContext 实例数有限) */
  singleVoicePlayer: false,
  /** 'webaudio' = 实时合成音效；'files' = 播放预渲染的音效文件 (assets/audio/sfx/*.mp3) */
  sfxMode: 'webaudio',
  /** 是否配置了可用的激励视频广告位 (false → 不显示任何看广告按钮) */
  adsAvailable() { return false; },
  rewardedAd: null,
  /** 普通分享 (微信 wx.shareAppMessage)；没有则为 null */
  shareApp: null,
};

export function usePlatform(impl) {
  Object.assign(Platform, impl);
  return Platform;
}
