// 字幕：语音台词的日文 + 中文小字，画在屏幕下方，左边带说话人头像。静音时也显示。
import { GameConfig } from '../config/GameConfig.js';
import { VoiceConfig } from '../config/VoiceConfig.js';
import { CHARACTER_MAP } from '../config/CharacterConfig.js';
import { ENEMIES } from '../config/EnemyConfig.js';
import { roundRectPath } from '../ui/draw.js';

export class SubtitleSystem {
  constructor(game, scene) {
    this.game = game;
    this.current = null;
    scene.listen('voice:line', (e) => this.show(e));
  }

  show({ line, who, group }) {
    const ch = CHARACTER_MAP[who];
    const boss = ENEMIES[who];
    this.current = {
      line, who, group, life: 0, max: VoiceConfig.subtitleTime + Math.min(1.2, line.text.length * 0.04),
      name: ch ? ch.name : boss ? boss.name : '', color: ch ? ch.color : '#b048ff',
      avatar: ch ? this.game.assets.get(ch.avatar) : who === 'nox' ? this.game.assets.get('boss_nox') : null,
    };
  }

  update(dt) {
    if (!this.current) return;
    this.current.life += dt;
    if (this.current.life >= this.current.max) this.current = null;
  }

  render(ctx, y = GameConfig.height - 210) {
    const s = this.current;
    if (!s) return;
    const W = GameConfig.width; const font = GameConfig.fontFamily;
    const k = s.life / s.max;
    const appear = Math.min(1, s.life / 0.2);
    ctx.save();
    ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : appear;
    ctx.font = `bold 19px ${font}`;
    const w1 = ctx.measureText(s.line.text).width;
    ctx.font = `13px ${font}`;
    const w2 = ctx.measureText(s.line.zh).width;
    const bw = Math.min(W - 24, Math.max(w1, w2) + 96);
    const bx = (W - bw) / 2; const bh = 64; const by = y + (1 - appear) * 12;
    roundRectPath(ctx, bx, by, bw, bh, 18);
    ctx.fillStyle = 'rgba(20,10,40,0.78)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = s.color; ctx.stroke();
    // 头像
    const ax = bx + 36; const ay = by + bh / 2;
    ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, 24, 0, 6.283); ctx.clip();
    if (s.avatar) ctx.drawImage(s.avatar, ax - 26, ay - 26, 52, 52);
    else if (s.who === 'sheepKing' && this.game.sprites) { const sp = this.game.sprites.enemy(ENEMIES.sheepKing, 22); ctx.drawImage(sp.img, ax - sp.size / 2, ay - sp.size / 2 + 4, sp.size, sp.size); }
    else { ctx.fillStyle = s.color; ctx.fillRect(ax - 24, ay - 24, 48, 48); }
    ctx.restore();
    ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, 24, 0, 6.283); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `bold 19px ${font}`; ctx.fillStyle = '#ffffff';
    ctx.fillText(s.line.text, bx + 70, by + 24);
    ctx.font = `13px ${font}`; ctx.fillStyle = '#d8c8ff';
    ctx.fillText(s.line.zh, bx + 70, by + 46);
    ctx.restore();
  }
}
