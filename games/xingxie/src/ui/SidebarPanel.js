// 抖音侧边栏复访面板：说明 + 「领取」或「去侧边栏」按钮 (只在 tt.checkScene 返回 isExist 时出现入口)。
import { GameConfig } from '../config/GameConfig.js';
import { Button } from './Button.js';
import { drawPanel, drawText } from './draw.js';

export class SidebarPanel {
  constructor(game, { onClose }) {
    this.game = game;
    this.t = 0;
    const sb = game.sidebar;
    const mk = (o) => { const b = new Button(o); b.audio = game.audio; return b; };
    this.action = mk({ x: game.width / 2, y: 560, w: 260, h: 60, label: '', style: 'gold', fontSize: 22, onClick: () => this.act() });
    this.closeBtn = mk({ x: game.width / 2, y: 640, w: 180, h: 50, label: '关闭', style: 'secondary', fontSize: 20, onClick: onClose });
    this.buttons = [this.action, this.closeBtn];
    this.sb = sb;
    this.sync();
  }

  sync() {
    const sb = this.sb;
    if (sb.claimedToday) { this.action.label = '今天已经领过啦'; this.action.enabled = false; }
    else if (sb.canClaim) { this.action.label = `领取 ${sb.reward} 星屑币`; this.action.enabled = true; }
    else { this.action.label = '去侧边栏'; this.action.enabled = true; }
  }

  act() {
    const sb = this.sb;
    if (sb.canClaim) sb.claim();
    else if (!sb.claimedToday) sb.go();
    this.sync();
  }

  render(ctx, dt = 1 / 60) {
    this.t += dt;
    const w = this.game.width; const C = GameConfig.colors;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.t / 0.2) * 0.6;
    ctx.fillStyle = '#120828'; ctx.fillRect(0, 0, w, this.game.height);
    ctx.restore();
    drawPanel(ctx, 50, 300, w - 100, 390, 26, 'rgba(255,250,255,0.985)');
    drawText(ctx, '侧边栏有礼', w / 2, 345, { size: 26, color: C.primaryDark, stroke: '#fff', strokeWidth: 5 });
    const lines = ['在抖音首页右划打开侧边栏，', '从「最近使用」里点星屑轮舞回来，', `每天可以领 ${this.sb.reward} 星屑币。`];
    lines.forEach((l, i) => drawText(ctx, l, w / 2, 405 + i * 32, { size: 17, color: C.text, weight: 'normal' }));
    if (!this.sb.fromSidebar && !this.sb.claimedToday) drawText(ctx, '(这次不是从侧边栏进来的哦)', w / 2, 508, { size: 14, color: '#b08ac8', weight: 'normal' });
    for (const b of this.buttons) b.render(ctx, dt);
  }
}
