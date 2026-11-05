// 分享：
//   抖音 —— 录屏分享 (下面的录屏逻辑)；
//   微信 —— 没有录屏，结算页「分享给好友」主动拉起 wx.shareAppMessage (右上角转发 / 朋友圈由 platform/wx.js 统一设置)；
//   网页版 —— 所有方法都是空操作，结算页不显示分享按钮。
// - 开战自动录屏 (tt.getGameRecorderManager().start)；暂停 / 切后台时暂停录制，回来继续
// - Boss 击破、武器进化、几秒内割倒一大片 (满屏割草) 时 recordClip 打点
// - 一局结束 stop；有打点就 clipVideo 剪成集锦，没有就用整段录屏
// - 结算页「分享精彩录屏」只在拿到有效 videoPath 后出现 (videoPath 为空会打开拍摄器，审核不允许)
// - tt.shareAppMessage({ channel: 'video', extra: { videoPath, videoTopics } })
import { DouyinConfig } from '../config/PlatformConfig.js';
import { platform } from '../core/platform/index.js';

const RC = DouyinConfig.recorder;

export class ShareService {
  constructor(game) {
    this.game = game;
    this.rec = platform.recorder;
    this.state = 'idle';          // idle | recording | paused | stopping
    this.videoPath = null;        // 可分享的视频 (集锦或整段)
    this.rawPath = null;
    this.clips = [];              // recordClip 返回的 index
    this.startedAt = 0;
    this.lastClip = -999;
    this.killTimes = [];
    this.log = [];                // 调试 / 测试
    this.battleTime = 0;
    if (!this.rec) return;

    const r = this.rec;
    r.onStart && r.onStart(() => { this.state = 'recording'; this.log.push('start'); });
    r.onStop && r.onStop((res) => this._onStop(res));
    r.onError && r.onError((err) => { this.log.push('error'); console.warn('[录屏] 出错', err); this.state = 'idle'; });
    r.onInterruptionBegin && r.onInterruptionBegin(() => this.log.push('interrupt'));

    const ev = game.events;
    ev.on('battle:start', () => this.begin());
    ev.on('boss:die', () => this.mark('boss'));
    ev.on('weapon:evolve', () => this.mark('evolve'));
    ev.on('enemy:die', () => this._countKill());
    ev.on('battle:win', () => { this.mark('win'); });
    ev.on('app:hidden', () => this.pause());
    ev.on('app:visible', () => this.resume());
    ev.on('scene:changed', (name) => { if (name !== 'game') this.end(); });
  }

  get available() { return !!this.rec; }
  /** 'video' (抖音录屏) | 'link' (微信转发) | null */
  get kind() { return this.rec ? 'video' : platform.canShareLink ? 'link' : null; }
  get canShare() { return this.kind === 'link' || !!(this.rec && this.videoPath && platform.canShareVideo); }
  get label() { return this.kind === 'link' ? '分享给好友' : '分享精彩录屏'; }
  get successText() { return this.kind === 'link' ? '' : '录屏发布成功，谢谢分享！'; }

  now() { return platform.now() / 1000; }

  begin() {
    if (!this.rec) return;
    if (this.state === 'recording' || this.state === 'paused') this.end(true);
    this.videoPath = null; this.rawPath = null; this.clips = []; this.killTimes = []; this.lastClip = -999;
    this.startedAt = this.now();
    this.discard = false;
    try {
      this.rec.start({ duration: RC.duration });
      this.state = 'recording';
      this.log.push('begin');
    } catch (err) { console.warn('[录屏] 无法开始', err); this.state = 'idle'; }
  }

  pause() { if (this.rec && this.state === 'recording') { try { this.rec.pause(); this.state = 'paused'; } catch (_) { /* ignore */ } } }
  resume() { if (this.rec && this.state === 'paused' && this.game.scenes.currentName === 'game') { try { this.rec.resume(); this.state = 'recording'; } catch (_) { /* ignore */ } } }

  _countKill() {
    if (this.state !== 'recording') return;
    const t = this.now();
    this.killTimes.push(t);
    while (this.killTimes.length && t - this.killTimes[0] > RC.massKill.window) this.killTimes.shift();
    if (this.killTimes.length >= RC.massKill.count) { this.killTimes = []; this.mark('mass'); }
  }

  /** 高光打点：事件前后各几秒 */
  mark(reason) {
    if (!this.rec || this.state !== 'recording') return false;
    const t = this.now();
    if (this.clips.length >= RC.maxClips || t - this.lastClip < RC.clipGap) return false;
    this.lastClip = t;
    try {
      this.rec.recordClip({
        timeRange: [RC.clipBefore, RC.clipAfter],
        success: (res) => { if (res && res.index != null) this.clips.push(res.index); },
        fail: () => {},
      });
      this.log.push(`clip:${reason}`);
      return true;
    } catch (_) { return false; }
  }

  /** 一局结束 (切出战斗场景) 时停止录屏 */
  end(discard = false) {
    if (!this.rec || (this.state !== 'recording' && this.state !== 'paused')) return;
    this.discard = discard;
    this.recordedFor = this.now() - this.startedAt;
    this.state = 'stopping';
    try { this.rec.stop(); } catch (_) { this.state = 'idle'; }
  }

  _onStop(res) {
    this.state = 'idle';
    const path = res && res.videoPath;
    this.log.push('stop');
    if (this.discard || !path) return;
    if ((this.recordedFor || 0) < RC.minLength) return;     // 太短 (官方要求 > 3 秒)
    this.rawPath = path;
    if (this.clips.length && this.rec.clipVideo) {
      try {
        this.rec.clipVideo({
          path,
          clipRange: this.clips.slice(),
          success: (r) => { this.videoPath = (r && r.videoPath) || path; this.log.push('clipped'); this.game.events.emit('share:ready', { videoPath: this.videoPath }); },
          fail: () => { this.videoPath = path; this.game.events.emit('share:ready', { videoPath: path }); },
        });
        return;
      } catch (_) { /* 退回整段 */ }
    }
    this.videoPath = path;
    this.game.events.emit('share:ready', { videoPath: path });
  }

  /** 结算页按钮：发布录屏 */
  shareVideo() {
    if (this.kind === 'link') {
      return platform.shareLink().then((r) => { this.log.push(`share:${r.reason}`); this.game.events.emit('share:done', r); return r; });
    }
    if (!this.canShare) return Promise.resolve({ ok: false, reason: 'no-video' });
    const S = DouyinConfig.share;
    return platform.shareVideo(this.videoPath, { title: S.title, desc: S.desc, topics: S.topics }).then((r) => {
      this.log.push(`share:${r.ok ? 'ok' : r.reason}`);
      this.game.events.emit('share:done', r);
      return r;
    });
  }
}
