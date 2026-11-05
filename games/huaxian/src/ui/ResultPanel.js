// 结算面板：胜利 (星级逐个弹出 + 用墨量 + 下一关) / 失败 (哭泣立绘 + 重试 + 提示)。
import { GameConfig } from '../config/GameConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText, drawStar, easing } from './draw.js';
import { HEROINE_SPRITES } from '../entities/Heroine.js';

export class ResultPanel {
  /**
   * @param {object} scene GameScene
   * @param {{win:boolean, stars?:number, inkUsed?:number, newBest?:boolean, by?:string}} r
   */
  constructor(scene, r) {
    this.scene = scene;
    this.r = r;
    this.t = 0;
    this.starShown = 0;
    const audio = scene.game.audio;
    const cx = 270;
    const isLast = scene.level.id >= scene.levelCount;
    const mk = (o) => { const b = new Button(o); b.audio = audio; return b; };
    if (r.win) {
      this.buttons = [
        mk({ x: cx, y: 612, w: 260, h: 64, label: isLast ? '全部通关！' : '下一关', fontSize: 28, onClick: () => (isLast ? scene.toLevels() : scene.nextLevel()) }),
        mk({ x: cx - 70, y: 690, w: 124, h: 50, label: '重玩', style: 'secondary', fontSize: 22, onClick: () => scene.restart() }),
        mk({ x: cx + 70, y: 690, w: 124, h: 50, label: '选关', style: 'secondary', fontSize: 22, onClick: () => scene.toLevels() }),
      ];
      // 抖音：分享按钮 (有录屏 -> 发布录屏视频，否则分享卡片)
      const plat = scene.game.platform;
      if (plat.features.share) {
        this.shareBtn = mk({ x: cx, y: 790, w: 220, h: 54, label: plat.hasVideo ? '分享录屏' : '分享给好友', style: 'green', fontSize: 22, onClick: () => plat.share({ video: true }) });
        this.buttons.push(this.shareBtn);
      }
    } else {
      const hint = mk({ x: cx - 70, y: 690, w: 124, h: 50, label: '提示', style: 'green', fontSize: 22, onClick: () => scene.useHint(true) });
      hint.tag = scene.hints.tag;
      this.buttons = [
        mk({ x: cx, y: 612, w: 260, h: 64, label: '再试一次', fontSize: 28, onClick: () => scene.restart() }),
        hint,
        mk({ x: cx + 70, y: 690, w: 124, h: 50, label: '选关', style: 'secondary', fontSize: 22, onClick: () => scene.toLevels() }),
      ];
    }
  }

  update(dt) {
    this.t += dt;
    if (this.shareBtn) this.shareBtn.label = this.scene.game.platform.hasVideo ? '分享录屏' : '分享给好友';   // 录屏在胜利 1.5 秒后才停止
    if (this.r.win) {
      const n = Math.min(this.r.stars, Math.floor((this.t - 0.35) / 0.32) + 1);
      while (this.starShown < n && this.t > 0.35) {
        this.scene.game.events.emit('ui:star', { index: this.starShown });
        this.starShown++;
      }
    }
  }

  render(ctx, dt) {
    const { width: W, height: H } = GameConfig;
    const C = GameConfig.colors;
    const a = Math.min(1, this.t / 0.25);
    ctx.save();
    ctx.globalAlpha = a * 0.45;
    ctx.fillStyle = '#5a3d6e';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const k = easing.backOut(Math.min(1, this.t / 0.4));
    ctx.save();
    ctx.translate(270, 520);
    ctx.scale(k, k);
    ctx.translate(-270, -520);
    const px = 50; const py = 330; const pw = 440; const ph = 410;
    drawPanel(ctx, px, py, pw, ph, 30);
    // 主角立绘探出面板
    const spr = HEROINE_SPRITES[this.r.win ? 'happy' : 'lose'];
    const img = this.scene.game.assets.getImage(spr.key);
    if (img) {
      const h = 190;
      const w = h * (spr.w / spr.h);
      const bob = Math.sin(this.scene.time * (this.r.win ? 5 : 2)) * (this.r.win ? 4 : 1.5);
      ctx.drawImage(img, 270 - w / 2, py - h + 46 + bob, w, h);
    }
    drawText(ctx, this.r.win ? '守护成功！' : '守护失败…', 270, py + 74, { size: 40, color: this.r.win ? C.primary : C.secondary, stroke: '#fff', strokeWidth: 8 });
    if (this.r.win) {
      for (let i = 0; i < 3; i++) {
        const x = 270 + (i - 1) * 76; const y = py + 150 - (i === 1 ? 10 : 0);
        ctx.fillStyle = 'rgba(190,175,210,0.55)';
        drawStar(ctx, x, y, 32, 14);
        if (i < this.starShown) {
          const st = Math.min(1, (this.t - 0.35 - i * 0.32) / 0.3);
          const s = easing.elasticOut(Math.max(0, st));
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(s, s);
          ctx.fillStyle = C.star;
          ctx.shadowColor = 'rgba(255,180,0,0.6)';
          ctx.shadowBlur = 12;
          drawStar(ctx, 0, 0, 32, 14);
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          drawStar(ctx, -4, -5, 10, 4);
          ctx.restore();
        }
      }
      const lv = this.scene.level;
      drawText(ctx, `用墨 ${Math.round(this.r.inkUsed)} / ${lv.ink}`, 270, py + 208, { size: 18, color: C.text, weight: 'normal' });
      const tip = this.r.hintUsed && this.r.stars >= 2
        ? `看过提示最高 ${this.r.stars} 星 · 不看提示再挑战 3 星吧`
        : this.r.stars >= 3 ? '完美守护！'
          : this.r.tooClose ? '线贴得离她太近啦 · 别直接罩在她身上，找到关键位置可得 3 星' : `用墨 ≤ ${lv.stars[this.r.stars >= 2 ? 0 : 1]} 可获得 ${this.r.stars + 1} 星`;
      drawText(ctx, (this.r.newBest && this.r.prevStars > 0 ? '新纪录！ ' : '') + tip, 270, py + 238, { size: 15, color: C.primaryDark, weight: 'normal' });
    } else {
      const why = {
        bee: '被蜜蜂蛰到了！', paper: '被加班文件砸中了！', heart: '被相亲照片砸中了！', boss: '被老板抓去加班了！',
        auntie: '被阿姨拉去相亲了！', rock: '被石头砸到了！', spike: '碰到尖刺了！', fall: '掉下去了！', crate: '被木箱砸到了！', roller: '被石头砸到了！', rockfall: '被石头砸到了！',
      }[this.r.by] || '被碰到了！';
      drawText(ctx, why, 270, py + 140, { size: 22, color: C.text });
      drawText(ctx, '线要把她完全护住哦，试试看提示？', 270, py + 186, { size: 16, color: '#8a6d9e', weight: 'normal' });
    }
    for (const b of this.buttons) b.render(ctx, dt);
    ctx.restore();
  }
}
