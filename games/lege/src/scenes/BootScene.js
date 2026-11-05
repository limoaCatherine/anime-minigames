// 启动/加载场景：预加载卡牌图片、背景与语音并显示进度条；生成"被压住"的暗色卡牌贴图，完成后进入主菜单。
import { Scene } from '../core/Scene.js';
import { CARDS } from '../config/CardConfig.js';
import { GameConfig } from '../config/GameConfig.js';
import { drawBackground, drawText, roundRectPath } from '../ui/draw.js';
import { platform } from '../platform/index.js';

/** 抖音版：启动页的健康游戏忠告 (国内上架常规要求) */
const HEALTH_NOTICE = ['抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。', '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。'];

/** 生成"被压住"的暗色贴图：轻度去饱和 + 半透明紫灰罩色，保留卡面底色以便辨认 */
function makeDark(img) {
  const w = img.width || img.naturalWidth || 160;
  const h = img.height || img.naturalHeight || 176;
  const c = platform.createCanvas(w, h);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'saturation';
  g.globalAlpha = 0.35;
  g.fillStyle = 'hsl(0,0%,50%)';
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(50,30,70,0.46)';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0, w, h);
  return c;
}

export class BootScene extends Scene {
  constructor(game) {
    super(game, 'boot');
  }

  enter() {
    this.progress = 0;
    this.shown = 0;
    this.done = false;
    const list = CARDS.map((c, i) => ({ key: c.key, src: c.image, color: c.color, label: String(i + 1) }));
    list.push({ key: 'bg', src: 'assets/images/bg.jpg', color: '#ffd9ec', label: '' });
    // 抖音：暗色卡牌在打包时预先渲染好 (原生画布不一定支持 saturation 混合模式)
    const preDark = platform.isMiniGame;
    if (preDark) CARDS.forEach((c, i) => list.push({ key: `${c.key}_dark`, src: c.image.replace('images/', 'images/dark/'), color: '#776688', label: String(i + 1) }));
    let imgP = 0; let voiceP = 0; let subP = 0;
    const report = () => { this.progress = imgP * 0.5 + subP * 0.3 + voiceP * 0.2; };
    Promise.all([
      this.game.assets.loadImages(list, (p) => { imgP = p; report(); }),
      // 抖音：语音 + BGM 在分包 "audio" 里，先下载分包再预载语音
      platform.loadSubpackage('audio', (p) => { subP = p; report(); })
        .then(() => { subP = 1; return this.game.voice.preload((p) => { voiceP = p; report(); }); }),
    ]).then(() => {
      this.game.cardSprites = CARDS.map((c) => {
        const img = this.game.assets.getImage(c.key);
        const dark = preDark && this.game.assets.getImage(`${c.key}_dark`);
        return { normal: img, dark: dark || makeDark(img) };
      });
      this.progress = 1;
      this.done = true;
    });
  }

  update(dt) {
    super.update(dt);
    this.shown += (this.progress - this.shown) * Math.min(1, dt * 10);
    if (this.done && this.time > 0.6 && this.shown > 0.98) {
      this.done = false;
      this.game.scenes.change('menu');
    }
  }

  render(ctx) {
    const { width: w, height: h } = this.game;
    drawBackground(ctx, w, h, this.time);
    drawText(ctx, `《${GameConfig.title}》`, w / 2, h * 0.4, { size: 48, color: GameConfig.colors.primary, stroke: '#fff', strokeWidth: 10 });
    drawText(ctx, GameConfig.subtitle, w / 2, h * 0.4 + 52, { size: 22, color: GameConfig.colors.secondary });
    const bw = 300; const bh = 22; const x = (w - bw) / 2; const y = h * 0.58;
    roundRectPath(ctx, x, y, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    roundRectPath(ctx, x + 3, y + 3, Math.max(bh - 6, (bw - 6) * this.shown), bh - 6, (bh - 6) / 2);
    ctx.fillStyle = GameConfig.colors.primary;
    ctx.fill();
    drawText(ctx, `加载中… ${Math.round(this.shown * 100)}%`, w / 2, y + 50, { size: 18, color: GameConfig.colors.text, weight: 'normal' });
    if (platform.isMiniGame) {
      HEALTH_NOTICE.forEach((t, i) => drawText(ctx, t, w / 2, h - 118 + i * 22, { size: 13, color: GameConfig.colors.text, weight: 'normal' }));
      drawText(ctx, `出品：${GameConfig.producer}  ·  适龄提示 8+  ·  部分美术与语音由 AI 生成`, w / 2, h - 66, { size: 12, color: '#8a6d9e', weight: 'normal' });
    }
  }
}
