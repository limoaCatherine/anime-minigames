// 微信版构建用的分享服务 (tools/build.mjs --target wechat 用它替换 ShareService.js)：
// 微信没有抖音的游戏录屏，这里不带任何录屏逻辑。
//   · 右上角「转发」「分享到朋友圈」由 platform/wx.js 启动时统一设置 (showShareMenu + onShareAppMessage + onShareTimeline)
//   · 结算页「分享给好友」→ wx.shareAppMessage 主动拉起转发 (微信不回传是否发出，所以不弹成功提示)
import { platform } from '../core/platform/index.js';

export class ShareService {
  constructor(game) {
    this.game = game;
    this.rec = null;
    this.videoPath = null;
    this.log = [];
  }
  get available() { return false; }
  get kind() { return platform.canShareLink ? 'link' : null; }
  get canShare() { return this.kind === 'link'; }
  get label() { return '分享给好友'; }
  get successText() { return ''; }
  begin() {} pause() {} resume() {} mark() { return false; } end() {}
  shareVideo() {
    if (!this.canShare) return Promise.resolve({ ok: false, reason: 'unsupported' });
    return platform.shareLink().then((r) => { this.log.push(`share:${r.reason}`); this.game.events.emit('share:done', r); return r; });
  }
}
