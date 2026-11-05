// 占位激励视频广告的画面 (AdService 没有接入真实广告时使用)。
// 明确标注「广告占位」，倒计时结束后才能「领取奖励」；提前关闭则没有奖励。
import { GameConfig } from '../config/GameConfig.js';
import { Button } from './Button.js';
import { drawText, roundRectPath, drawStar } from './draw.js';

export class AdOverlay {
  constructor(ads, audio) {
    this.ads = ads;
    const W = GameConfig.width;
    this.closeBtn = new Button({ x: W - 70, y: 64, w: 112, h: 40, label: '关闭广告', style: 'ghost', fontSize: 17, onClick: () => ads.closeFake(false) });
    this.claimBtn = new Button({ x: W / 2, y: 760, w: 300, h: 66, label: '领取奖励：复活', style: 'gold', fontSize: 26, onClick: () => ads.closeFake(true) });
    this.closeBtn.audio = audio;
    this.claimBtn.audio = audio;
    this.t = 0;
  }

  get buttons() {
    this.claimBtn.visible = this.ads.fakeFinished;
    this.closeBtn.label = this.ads.fakeFinished ? '关闭' : '跳过(无奖励)';
    return [this.claimBtn, this.closeBtn];
  }

  update(dt) { this.t += dt; }

  render(ctx, dt) {
    const W = GameConfig.width;
    const H = GameConfig.height;
    const t = this.t;
    ctx.save();
    ctx.fillStyle = 'rgba(20,10,30,0.92)';
    ctx.fillRect(0, 0, W, H);
    // 模拟视频区域 (渐变 + 漂浮星星)
    const vx = 30; const vy = 200; const vw = W - 60; const vh = 420;
    const g = ctx.createLinearGradient(vx, vy, vx + vw, vy + vh);
    const hue = (t * 40) % 360;
    g.addColorStop(0, `hsl(${hue},70%,72%)`);
    g.addColorStop(1, `hsl(${(hue + 80) % 360},70%,62%)`);
    roundRectPath(ctx, vx, vy, vw, vh, 22);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    roundRectPath(ctx, vx, vy, vw, vh, 22);
    ctx.clip();
    for (let i = 0; i < 14; i++) {
      const sx = vx + ((i * 97 + t * 40) % vw);
      const sy = vy + ((i * 61 + t * (20 + i * 3)) % vh);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      drawStar(ctx, sx, sy, 8 + (i % 3) * 3, 3);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // 标签
    roundRectPath(ctx, vx + 14, vy + 14, 110, 34, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    drawText(ctx, '广告占位', vx + 69, vy + 31, { size: 18, color: '#ffe14d' });
    drawText(ctx, '这里将播放激励视频广告', W / 2, vy + vh / 2 - 34, { size: 26, color: '#fff', stroke: 'rgba(80,30,90,0.6)', strokeWidth: 5 });
    drawText(ctx, '(抖音小游戏 tt.createRewardedVideoAd)', W / 2, vy + vh / 2 + 4, { size: 16, color: '#fff', weight: 'normal' });
    drawText(ctx, '当前为本地测试占位，未接入任何广告 SDK', W / 2, vy + vh / 2 + 30, { size: 15, color: 'rgba(255,255,255,0.85)', weight: 'normal' });
    // 倒计时圆环
    const left = this.ads.fakeRemaining;
    const dur = this.ads.fake ? this.ads.fake.duration : 1;
    const cx = W / 2; const cy = vy + vh - 80;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(cx, cy, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / dur)); ctx.stroke();
    drawText(ctx, left > 0 ? String(Math.ceil(left)) : '✓', cx, cy + 2, { size: 34, color: '#fff' });
    drawText(ctx, left > 0 ? `还剩 ${Math.ceil(left)} 秒` : '看完了', W / 2, 680, { size: 22, color: '#fff' });
    for (const b of this.buttons) b.render(ctx, dt);
    ctx.restore();
  }
}
