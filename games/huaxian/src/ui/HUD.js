// 关卡 HUD：返回选关 / 重来 / 提示 (看广告) / 暂停，关卡名，墨水条。
import { GameConfig } from '../config/GameConfig.js';
import { Button, Icons } from './Button.js';
import { drawText } from './draw.js';
import { drawInkBar } from './InkBar.js';

export class HUD {
  constructor(scene) {
    this.scene = scene;
    const audio = scene.game.audio;
    const mk = (o) => { const b = new Button({ style: 'icon', w: 48, h: 48, fontSize: 11, ...o }); b.audio = audio; return b; };
    this.home = mk({ x: 34, y: 44, icon: Icons.grid, onClick: () => scene.toLevels() });
    this.retry = mk({ x: 90, y: 44, icon: Icons.retry, onClick: () => scene.restart() });
    this.hint = mk({ x: 450, y: 44, icon: Icons.hint, onClick: () => scene.useHint() });
    this.pause = mk({ x: 506, y: 44, icon: Icons.pause, onClick: () => scene.togglePause() });
    this.buttons = [this.home, this.retry, this.hint, this.pause];
    this.inkFlash = 0;
  }

  update(dt) {
    if (this.inkFlash > 0) this.inkFlash -= dt;
    const s = this.scene;
    this.hint.tag = s.hints.tag;
    this.hint.enabled = s.world && s.world.state === 'draw';
  }

  render(ctx, dt) {
    const s = this.scene;
    const level = s.level;
    const C = GameConfig.colors;
    // 顶部半透明底
    const g = ctx.createLinearGradient(0, 0, 0, GameConfig.hudHeight);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GameConfig.width, GameConfig.hudHeight);
    drawText(ctx, `第 ${level.id} 关`, 270, 30, { size: 26, color: C.primaryDark, stroke: '#fff', strokeWidth: 6 });
    drawText(ctx, s.chapter ? `${s.chapter.name} · ${level.name}` : level.name, 270, 58, { size: 16, color: C.text, stroke: '#fff', strokeWidth: 4 });
    const d = s.world.drawing;
    drawInkBar(ctx, 160, 80, 230, 16, d.inkRatio, level, s.time, this.inkFlash);
    for (const b of this.buttons) b.render(ctx, dt);
  }
}
