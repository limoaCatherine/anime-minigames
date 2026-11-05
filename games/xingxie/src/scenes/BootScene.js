// 启动场景：预加载图片与语音，显示进度条，完成后进主菜单。
import { Scene } from '../core/Scene.js';
import { IMAGES } from '../config/AssetConfig.js';
import { GameConfig } from '../config/GameConfig.js';
import { PackManager } from '../core/PackManager.js';
import { drawBackground, drawText, roundRectPath } from '../ui/draw.js';

export class BootScene extends Scene {
  constructor(game) { super(game, 'boot'); }

  enter() {
    this.progress = 0; this.shown = 0; this.done = false;
    let imgP = 0; let voiceP = 0;
    const report = () => { this.progress = imgP * 0.6 + voiceP * 0.4; };
    // 抖音版只读主包里的图片；分包 (立绘 / 音乐 / 语音) 进菜单后在后台下载 (PackManager)
    const list = this.game.packs.list.length ? PackManager.mainImages() : IMAGES;
    Promise.all([
      this.game.assets.loadImages(list, (p) => { imgP = p; report(); }),
      this.game.voice.preload((p) => { voiceP = p; report(); }),
    ]).then(() => { this.progress = 1; this.done = true; });
  }

  update(dt) {
    super.update(dt);
    this.shown += (this.progress - this.shown) * Math.min(1, dt * 10);
    if (this.done && this.time > 0.5 && this.shown > 0.98) { this.done = false; this.game.scenes.change('menu'); }
  }

  render(ctx) {
    const { width: w, height: h } = this.game;
    drawBackground(ctx, w, h, this.time);
    drawText(ctx, GameConfig.title, w / 2, h * 0.4, { size: 54, color: '#ffe6f4', stroke: '#8a3ab0', strokeWidth: 10 });
    drawText(ctx, GameConfig.subtitle, w / 2, h * 0.4 + 52, { size: 20, color: '#c8b8ff' });
    drawText(ctx, `出品：${GameConfig.publisher}`, w / 2, h - 40, { size: 13, color: 'rgba(232,220,255,0.7)', weight: 'normal' });
    const bw = 300; const bh = 18; const x = (w - bw) / 2; const y = h * 0.58;
    roundRectPath(ctx, x, y, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
    roundRectPath(ctx, x + 3, y + 3, Math.max(bh - 6, (bw - 6) * this.shown), bh - 6, (bh - 6) / 2); ctx.fillStyle = '#ff8fc7'; ctx.fill();
    drawText(ctx, `正在把星星装进口袋… ${Math.round(this.shown * 100)}%`, w / 2, y + 44, { size: 15, color: '#e8dcff', weight: 'normal' });
  }
}
