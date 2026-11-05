// 游戏内 HUD：顶部 (关卡 / 难度标签 / 剩余张数 + 进度条 / 静音 / 暂停) 与底部道具按钮 (移出 / 撤回 / 洗牌)。
import { GameConfig } from '../config/GameConfig.js';
import { Button, Icons } from './Button.js';
import { PROP_DEFS } from '../systems/PropSystem.js';
import { drawText, roundRectPath } from './draw.js';
import { tierOf, levelTag } from '../config/LevelConfig.js';

export class HUD {
  /**
   * @param {object} o
   * @param {object} o.level 关卡定义
   * @param {import('../core/Game.js').Game} o.game
   * @param {()=>void} o.onPause
   * @param {(key:string)=>void} o.onProp
   */
  constructor({ level, game, onPause, onProp }) {
    this.level = level;
    this.game = game;
    const W = GameConfig.width;
    this.pauseBtn = new Button({ x: W - 36, y: 34, w: 48, h: 48, style: 'icon', icon: Icons.pause, onClick: onPause });
    this.soundBtn = new Button({ x: W - 92, y: 34, w: 48, h: 48, style: 'icon', icon: Icons.sound(game.audio.muted), onClick: () => {
      game.audio.toggleMute();
      this.syncSound();
    } });
    const bw = 152; const gap = 14;
    const x0 = (W - (bw * 3 + gap * 2)) / 2 + bw / 2;
    this.propBtns = PROP_DEFS.map((d, i) => new Button({
      x: x0 + i * (bw + gap), y: GameConfig.propsY, w: bw, h: 62, style: 'prop', label: d.label, fontSize: 24,
      icon: Icons[d.key], badge: 1, key: d.key, onClick: () => onProp(d.key),
    }));
    this.buttons = [this.pauseBtn, this.soundBtn, ...this.propBtns];
    for (const b of this.buttons) b.audio = game.audio;
  }

  syncSound() { this.soundBtn.icon = Icons.sound(this.game.audio.muted); }

  /** 同步道具剩余次数 */
  syncProps(props) {
    for (const b of this.propBtns) b.badge = props.remaining(b.key);
  }

  render(ctx, dt, { remaining, total, time }) {
    const W = GameConfig.width;
    const C = GameConfig.colors;
    const lv = this.level;
    const tier = tierOf(lv);
    const pw = W - 130;
    // 顶部面板
    ctx.save();
    ctx.shadowColor = 'rgba(120,60,140,0.22)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    roundRectPath(ctx, 10, 8, pw, 52, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
    // 关卡号圆章
    ctx.fillStyle = tier.color;
    ctx.beginPath(); ctx.arc(38, 34, 20, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    drawText(ctx, lv.id === 'daily' ? '日' : String(lv.id), 38, 35, { size: lv.id === 'daily' ? 18 : 20, color: '#fff' });
    drawText(ctx, lv.title, 66, 24, { size: 18, color: C.primaryDark, align: 'left' });
    // 难度标签 (BOSS 关闪烁)
    const tag = levelTag(lv);
    ctx.save();
    ctx.font = `bold 12px ${GameConfig.fontFamily}`;
    const tw = ctx.measureText(tag).width + 16;
    roundRectPath(ctx, 66, 38, tw, 18, 9);
    ctx.fillStyle = lv.boss ? `rgba(230,40,80,${0.8 + 0.2 * Math.sin(time * 5)})` : tier.color;
    ctx.fill();
    ctx.restore();
    drawText(ctx, tag, 66 + tw / 2, 47.5, { size: 12, color: '#fff' });
    // 剩余张数 + 进度条
    const px = 214; const bw = pw - px + 2;
    drawText(ctx, `还剩 ${remaining} 张`, px, 23, { size: 16, color: C.text, align: 'left' });
    const k = total ? 1 - remaining / total : 0;
    drawText(ctx, `${Math.floor(k * 100)}%`, px + bw, 23, { size: 14, color: C.primaryDark, align: 'right' });
    roundRectPath(ctx, px, 37, bw, 13, 6.5);
    ctx.fillStyle = 'rgba(200,170,220,0.45)';
    ctx.fill();
    if (k > 0) {
      roundRectPath(ctx, px, 37, Math.max(13, bw * k), 13, 6.5);
      const g = ctx.createLinearGradient(px, 0, px + bw, 0);
      g.addColorStop(0, '#ff9ccc');
      g.addColorStop(1, '#ff5c9a');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      roundRectPath(ctx, px + 3, 39, Math.max(7, bw * k - 6), 4, 2);
      ctx.fill();
    }
    for (const b of this.buttons) b.render(ctx, dt);
  }
}
