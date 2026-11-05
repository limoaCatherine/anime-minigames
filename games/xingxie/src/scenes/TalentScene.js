// 天赋：用星屑币买永久加成，每局开始时由 BattleWorld 读取 (save.talents())。
import { Scene } from '../core/Scene.js';
import { GameConfig } from '../config/GameConfig.js';
import { TALENTS } from '../config/ProgressConfig.js';
import { Button } from '../ui/Button.js';
import { drawBackground, drawText, roundRectPath, drawPanel } from '../ui/draw.js';
import { drawIcon } from '../ui/icons.js';

const W = GameConfig.width;
const C = GameConfig.colors;
const ROW_H = 92;
const TOP = 132;

export class TalentScene extends Scene {
  constructor(game) { super(game, 'talent'); }

  enter() {
    const g = this.game;
    const mk = (o) => { const b = new Button(o); b.audio = null; return b; };
    this.back = mk({ x: 50, y: 40, w: 80, h: 42, label: '返回', style: 'ghost', fontSize: 17, onClick: () => g.scenes.change('menu') });
    this.back.audio = g.audio;
    this.rows = TALENTS.map((t, i) => ({ t, btn: mk({ x: W - 92, y: TOP + i * ROW_H + ROW_H / 2 - 6, w: 128, h: 52, label: '', style: 'gold', fontSize: 18, onClick: () => this.buy(t) }), pop: 0 }));
    this.coinPop = 0;
    this.refresh();
  }

  buy(t) {
    const g = this.game;
    if (g.save.buyTalent(t.id)) {
      g.audio.play('buy');
      const r = this.rows.find((x) => x.t === t); r.pop = 1; this.coinPop = 1;
    } else g.audio.play('deny');
    this.refresh();
  }

  refresh() {
    const s = this.game.save;
    for (const r of this.rows) {
      const cost = s.talentCost(r.t.id);
      if (cost == null) { r.btn.label = '满级'; r.btn.style = 'dark'; r.btn.enabled = false; r.btn.sub = null; }
      else { r.btn.label = `${cost}`; r.btn.style = 'gold'; r.btn.enabled = s.coins >= cost; r.btn.sub = null; }
    }
  }

  activeButtons() { return [this.back, ...this.rows.map((r) => r.btn)]; }
  onKeyDown(e) { if (e.code === 'Escape') this.game.scenes.change('menu'); }

  update(dt) {
    super.update(dt);
    for (const r of this.rows) r.pop = Math.max(0, r.pop - dt * 3);
    this.coinPop = Math.max(0, this.coinPop - dt * 3);
  }

  render(ctx, dt) {
    const g = this.game; const s = g.save;
    drawBackground(ctx, W, g.height, this.time);
    drawText(ctx, '天赋', W / 2, 40, { size: 26, color: '#fff', stroke: '#8a3ab0', strokeWidth: 6 });
    drawText(ctx, '永久生效，每局都带着', W / 2, 76, { size: 14, color: '#d8ccff', weight: 'normal' });
    const k = 1 + this.coinPop * 0.15;
    roundRectPath(ctx, W - 150, 22, 136, 36, 18); ctx.fillStyle = 'rgba(20,10,40,0.6)'; ctx.fill();
    drawIcon(ctx, 'coin', W - 130, 40, 20 * k, C.gold);
    drawText(ctx, `${s.coins}`, W - 114, 41, { size: 17 * k, color: '#ffe08a', align: 'left' });
    this.back.render(ctx, dt);
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i]; const t = r.t;
      const y = TOP + i * ROW_H;
      const lv = s.talentLevel(t.id);
      ctx.save();
      ctx.translate(W / 2, y + ROW_H / 2 - 6); ctx.scale(1 + r.pop * 0.04, 1 + r.pop * 0.04); ctx.translate(-W / 2, -(y + ROW_H / 2 - 6));
      drawPanel(ctx, 20, y, W - 40, ROW_H - 12, 18, 'rgba(255,250,255,0.94)');
      ctx.fillStyle = '#3a2d6e'; roundRectPath(ctx, 34, y + 13, 54, 54, 14); ctx.fill();
      drawIcon(ctx, t.icon, 61, y + 40, 40, t.color);
      drawText(ctx, t.name, 102, y + 26, { size: 18, color: C.text, align: 'left' });
      drawText(ctx, t.desc, 102, y + 50, { size: 13, color: '#8a6aa0', align: 'left', weight: 'normal' });
      for (let j = 0; j < t.max; j++) {
        ctx.fillStyle = j < lv ? t.color : 'rgba(150,120,180,0.25)';
        roundRectPath(ctx, 102 + j * 22, y + 64, 18, 6, 3); ctx.fill();
      }
      ctx.restore();
      r.btn.render(ctx, dt);
      if (r.btn.label !== '满级') drawIcon(ctx, 'coin', r.btn.x - 40, r.btn.y, 18, '#fff3c0');
    }
    drawText(ctx, '星屑币：打怪、撑时间、通关都会给', W / 2, g.height - 40, { size: 13, color: '#c8b8ff', weight: 'normal' });
  }
}
