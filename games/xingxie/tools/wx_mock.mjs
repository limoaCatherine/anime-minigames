// 微信小游戏 wx API 模拟 (Node vm，无 DOM)，供 tools/test_wechat.mjs 使用。
// 复用 tt_mock 的运行环境 (模拟时间 / 画布 / InnerAudioContext / 分包 / 激励视频)，在其上按微信开放文档调整：
//   · 全局是 wx，没有 tt；没有录屏 (getGameRecorderManager) 和侧边栏 (checkScene / navigateToScene)
//   · wx.getWindowInfo (安全区) / wx.getMenuButtonBoundingClientRect (胶囊)
//   · wx.loadSubpackage 的 success / fail / complete
//   · wx.showShareMenu / wx.onShareAppMessage / wx.onShareTimeline / wx.shareAppMessage (无 success 回调)
//   · wx.vibrateShort({ type })
import { createEnv as createTTEnv } from './tt_mock.mjs';

export function createEnv() {
  const env = createTTEnv();
  const t = env.tt;
  const L = (name, arg) => env.log.push({ name, arg: arg === undefined ? null : JSON.parse(JSON.stringify(arg, (k, v) => (typeof v === 'function' ? `[fn:${k}]` : v))) });
  const share = { app: null, timeline: null };
  const wx = { ...t };
  delete wx.getGameRecorderManager; delete wx.checkScene; delete wx.navigateToScene;
  wx.getWindowInfo = () => { L('getWindowInfo'); return JSON.parse(JSON.stringify(env.cfg.sys)); };
  wx.getSystemInfoSync = () => { L('getSystemInfoSync'); return JSON.parse(JSON.stringify(env.cfg.sys)); };
  wx.loadSubpackage = (o) => {
    const wrap = { ...o,
      success: (r) => { o.success && o.success(r); o.complete && o.complete(r); },
      fail: (r) => { o.fail && o.fail(r); o.complete && o.complete(r); } };
    if (typeof o.complete !== 'function') L('loadSubpackage.noComplete', o.name);
    return t.loadSubpackage(wrap);
  };
  wx.showShareMenu = (o) => L('showShareMenu', o);
  wx.onShareAppMessage = (f) => { share.app = f; L('onShareAppMessage.listen'); };
  wx.onShareTimeline = (f) => { share.timeline = f; L('onShareTimeline.listen'); };
  wx.shareAppMessage = (o) => L('shareAppMessage', o);
  wx.vibrateShort = (o) => L('vibrateShort', o);
  env.wx = wx;
  env.share = share;
  env.tt = undefined;
  const g = { ...env.globals, wx };
  delete g.tt;
  env.globals = g;
  return env;
}
