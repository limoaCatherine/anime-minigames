// 生存判定系统：线画好后开始倒计时；期间主角被任何有伤害的危险物碰到 / 碰到尖刺 / 掉出屏幕 -> 失败；
// 坚持到时间结束 -> 胜利 (按用墨量计算星级)。
import { GameConfig } from '../config/GameConfig.js';

export function computeStars(inkUsed, level) {
  const [three, two] = level.stars;
  if (inkUsed <= three) return 3;
  if (inkUsed <= two) return 2;
  return 1;
}

export class SurvivalSystem {
  constructor(world) {
    this.world = world;
    this.lastTick = -1;
  }

  /** 每个物理步 */
  step() {
    const w = this.world;
    if (w.state !== 'survive') return;
    w.time += 1 / 60;
    const left = w.level.time - w.time;
    const sec = Math.ceil(left);
    if (sec !== this.lastTick && sec <= 3 && sec >= 1) {
      this.lastTick = sec;
      w.events.emit('timer:tick', { seconds: sec });
    }
    const h = w.heroine;
    if (h.feetY > GameConfig.physics.killY - 100 || h.x < -60 || h.x > GameConfig.width + 60) {
      w.lose({ type: 'fall', x: h.x, y: Math.min(h.y, GameConfig.height - 40) });
      return;
    }
    if (left <= 0) w.win();
  }

  /** 物理碰撞回调 */
  onPairs(pairs) {
    const w = this.world;
    if (w.state !== 'survive') return;
    for (const pair of pairs) {
      const a = pair.bodyA.parent; const b = pair.bodyB.parent;
      let other = null;
      if (a === w.heroine.body) other = b; else if (b === w.heroine.body) other = a;
      if (!other) continue;
      if (other.label === 'spike') {
        w.lose({ type: 'spike', x: w.heroine.x, y: w.heroine.feetY - 10 });
        return;
      }
      const ent = other.plugin && other.plugin.entity;
      if (ent && ent.harmful && ent.harmful() && ent !== w.line) {
        const s = pair.collision.supports && pair.collision.supports[0];
        w.lose({ type: ent.type, x: s ? s.x : other.position.x, y: s ? s.y : other.position.y });
        return;
      }
    }
  }
}
