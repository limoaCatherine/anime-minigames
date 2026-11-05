// 启动/加载场景：(小游戏：先加载分包) 预加载全部图片与语音并显示进度条，完成后进入主菜单。
// 1.5：底部全文登载《健康游戏忠告》(+ 软著登记号 / 出版物号，若已填写)；小游戏版至少停留 1.5 秒。
import { Scene } from '../core/Scene.js';
import { IMAGES } from '../config/AssetConfig.js';
import { GameConfig } from '../config/GameConfig.js';
import { drawBackground, drawText, roundRectPath } from '../ui/draw.js';

export class BootScene extends Scene {
  constructor(game) {
    super(game, 'boot');
  }

  enter() {
    this.progress = 0;
    this.shown = 0;
    this.done = false;
    let imgP = 0; let voiceP = 0; let subP = 0;
    const g = this.game;
    const plat = g.platform;
    const subs = plat.subpackages || [];      // 抖音：先加载 images / audio 分包
    const hasSubs = subs.length > 0;
    const report = () => { this.progress = hasSubs ? subP * 0.3 + imgP * 0.45 + voiceP * 0.25 : imgP * 0.6 + voiceP * 0.4; };
    let n = 0;
    Promise.all(subs.map((name) => plat.loadSubpackage(name).then(() => { subP = ++n / subs.length; report(); })))
      .then(() => {
        if (plat.deferAudio) g.bgm.init();    // BGM 在 audio 分包里
        return Promise.all([
          g.assets.loadImages(IMAGES, (p) => { imgP = p; report(); }),
          g.voice.preload((p) => { voiceP = p; report(); }),
        ]);
      })
      .then(() => { this.progress = 1; this.done = true; });
  }

  update(dt) {
    super.update(dt);
    this.shown += (this.progress - this.shown) * Math.min(1, dt * 10);
    if (this.done && this.time > (this.game.platform.minigame ? 1.5 : 0.6) && this.shown > 0.98) {
      this.done = false;
      this.game.scenes.change('menu');
    }
  }

  render(ctx) {
    const { width: w, height: h } = this.game;
    drawBackground(ctx, w, h, this.time);
    drawText(ctx, `《${GameConfig.title}》`, w / 2, h * 0.4, { size: 44, color: GameConfig.colors.primary, stroke: '#fff', strokeWidth: 10 });
    drawText(ctx, GameConfig.subtitle, w / 2, h * 0.4 + 52, { size: 22, color: GameConfig.colors.secondary });
    const bw = 300; const bh = 22; const x = (w - bw) / 2; const y = h * 0.58;
    roundRectPath(ctx, x, y, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    roundRectPath(ctx, x + 3, y + 3, Math.max(bh - 6, (bw - 6) * this.shown), bh - 6, (bh - 6) / 2);
    ctx.fillStyle = GameConfig.colors.primary;
    ctx.fill();
    drawText(ctx, `加载中… ${Math.round(this.shown * 100)}%`, w / 2, y + 50, { size: 18, color: GameConfig.colors.text, weight: 'normal' });
    // 《健康游戏忠告》全文
    const ay = h * 0.74;
    drawText(ctx, '健康游戏忠告', w / 2, ay, { size: 17, color: GameConfig.colors.text });
    (GameConfig.healthAdvice || []).forEach((line, i) => drawText(ctx, line, w / 2, ay + 28 + i * 24, { size: 14, color: GameConfig.colors.text, weight: 'normal' }));
    const nos = [GameConfig.copyrightRegNo, GameConfig.publicationNo].filter(Boolean).join('　');
    if (nos) drawText(ctx, nos, w / 2, ay + 84, { size: 13, color: GameConfig.colors.text, weight: 'normal' });
    drawText(ctx, `出品：${GameConfig.publisher}`, w / 2, h - 48, { size: 15, color: GameConfig.colors.text, weight: 'normal' });
  }
}
