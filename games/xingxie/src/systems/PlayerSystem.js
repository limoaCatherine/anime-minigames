// 玩家：移动、属性汇总 (角色 × 天赋 × 被动 × 专属被动)、回血 / 护盾、受伤、经验与升级。
import { CHARACTER_BASE } from '../config/CharacterConfig.js';
import { PASSIVES, MAX_PASSIVE_LEVEL } from '../config/PassiveConfig.js';
import { TALENTS, expToNext } from '../config/ProgressConfig.js';
import { clamp } from '../core/math.js';

const TALENT_MAP = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

export class PlayerSystem {
  constructor(world) {
    this.world = world;
    this.passives = [];          // [{id, level}]
    this.p = {
      x: 0, y: 0, vx: 0, vy: 0, r: CHARACTER_BASE.radius,
      hp: 100, maxHp: 100, regen: 0, speed: CHARACTER_BASE.speed, pickup: CHARACTER_BASE.pickup,
      armor: 0, iframe: CHARACTER_BASE.iframe, invuln: 0, contactCd: 0,
      level: 1, exp: 0, expNext: expToNext(1),
      facing: { x: 0, y: -1 }, moving: false,
      shield: 0, shieldTimer: 0, haste: 0, slowZone: 0, hurtFlash: 0,
    };
    this.s = {};                 // 汇总后的属性
  }

  talent(id) {
    const lv = this.world.talents[id] || 0;
    const t = TALENT_MAP[id];
    return t ? lv * t.per : 0;
  }

  passiveValue(id) {
    const e = this.passives.find((q) => q.id === id);
    if (!e) return null;
    return PASSIVES[id].levels[e.level - 1];
  }

  passiveLevel(id) {
    const e = this.passives.find((q) => q.id === id);
    return e ? e.level : 0;
  }

  init() {
    this.recalc();
    this.p.hp = this.p.maxHp;
  }

  /** 重新汇总属性 (获得被动 / 升级时调用) */
  recalc() {
    const w = this.world; const c = w.char; const fx = c.passive.effect; const p = this.p;
    const pv = (id, def = 0) => { const v = this.passiveValue(id); return v == null ? def : v; };
    const vit = pv('strawberryCake', { hp: 0, regen: 0 });
    const guard = pv('starCape', { armor: 0, iframe: 0 });
    const amt = pv('twinPin', { amount: 0, duration: 0 });
    const genki = fx.mightPerLevel ? Math.min(fx.mightPerLevelMax, fx.mightPerLevel * (p.level - 1)) : 0;
    const s = this.s;
    s.might = 1 + pv('starGem') + this.talent('might') + genki + (fx.might || 0) + (w.bonusMight || 0);
    s.cooldown = clamp(1 - pv('rabbitWatch') - (fx.cooldown || 0), 0.4, 1);
    s.area = 1 + pv('magicTome') + (fx.area || 0);
    s.amount = amt.amount;
    s.duration = 1 + amt.duration + (fx.duration || 0);
    s.crit = CHARACTER_BASE.crit;
    s.critMul = CHARACTER_BASE.critMul;
    s.chilledBonus = fx.chilledBonus || 0;
    s.expGain = w.diff.expGain * (1 + this.talent('growth'));
    s.coinGain = w.diff.coinGain * (1 + this.talent('greed') + (fx.coinGain || 0));
    s.dmgReduce = w.weapons ? w.weapons.damageReduce() : 0;
    const oldMax = p.maxHp;
    p.maxHp = Math.round(CHARACTER_BASE.hp * c.hp + vit.hp + this.talent('vitality'));
    if (p.maxHp > oldMax && oldMax > 0) p.hp += p.maxHp - oldMax;   // 加上限时同时回血
    p.hp = Math.min(p.hp, p.maxHp);
    p.regen = vit.regen;
    p.speed = CHARACTER_BASE.speed * c.speed * (1 + pv('featherBoots') + this.talent('speed'));
    p.pickup = CHARACTER_BASE.pickup * c.pickup * (1 + pv('catBell') + this.talent('magnet') + (fx.magnet || 0));
    p.armor = (c.armor || 0) + guard.armor + (fx.armor || 0);
    p.iframe = CHARACTER_BASE.iframe + guard.iframe;
    s.shieldEvery = fx.shieldEvery || 0;
    s.shieldMax = fx.shieldMax || 0;
  }

  addPassive(id) {
    const e = this.passives.find((q) => q.id === id);
    if (e) e.level = Math.min(MAX_PASSIVE_LEVEL, e.level + 1);
    else this.passives.push({ id, level: 1 });
    this.recalc();
  }

  update(dt) {
    const p = this.p; const w = this.world; const inp = w.input;
    let ix = inp.x; let iy = inp.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    let speed = p.speed;
    if (p.haste > 0) { p.haste -= dt; speed *= 1 + (w.char.passive.effect.levelUpHaste || 0); }
    if (p.slowZone > 0) speed *= 1 - p.slowZone;
    p.slowZone = 0;                       // 每帧由催眠泡泡重新设置
    p.vx = ix * speed; p.vy = iy * speed;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.moving = len > 0.08;
    if (p.moving) { const l = Math.hypot(ix, iy) || 1; p.facing.x = ix / l; p.facing.y = iy / l; }

    if (p.invuln > 0) p.invuln -= dt;
    if (p.contactCd > 0) p.contactCd -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    if (p.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    if (this.s.shieldEvery && p.shield < this.s.shieldMax) {
      p.shieldTimer += dt;
      if (p.shieldTimer >= this.s.shieldEvery) { p.shieldTimer = 0; p.shield++; w.events.emit('player:shield', { x: p.x, y: p.y }); }
    }
  }

  /** 受到伤害；返回是否真的掉血 */
  hurt(raw, src = 'contact') {
    const p = this.p; const w = this.world;
    if (p.invuln > 0 || w.state !== 'playing') return false;
    if (p.shield > 0) {
      p.shield--; p.shieldTimer = 0; p.invuln = p.iframe;
      w.events.emit('player:block', { x: p.x, y: p.y });
      return false;
    }
    let dmg = raw * w.diff.enemyDmg - p.armor;
    dmg = Math.max(1, dmg) * (1 - this.s.dmgReduce);
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.invuln = p.iframe;
    p.hurtFlash = 0.25;
    w.stats.dmgTaken += dmg;
    w.events.emit('player:hurt', { dmg, hp: p.hp, maxHp: p.maxHp, x: p.x, y: p.y, src });
    if (p.hp <= 0) { p.hp = 0; w.die(); }
    return true;
  }

  heal(n) {
    const p = this.p;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    if (p.hp > before + 0.5) this.world.events.emit('player:heal', { amount: Math.round(p.hp - before), x: p.x, y: p.y });
  }

  gainExp(v) {
    const p = this.p;
    p.exp += v * this.s.expGain;
  }

  /** 经验够了就升一级；返回是否升级 */
  tryLevel() {
    const p = this.p; const w = this.world;
    if (p.exp < p.expNext) return false;
    p.exp -= p.expNext;
    p.level++;
    p.expNext = expToNext(p.level);
    const fx = w.char.passive.effect;
    if (fx.levelUpHaste) p.haste = fx.levelUpHasteTime;
    if (fx.mightPerLevel) this.recalc();
    w.stats.levelAt[p.level] = w.time;
    w.events.emit('player:level', { level: p.level, x: p.x, y: p.y });
    return true;
  }
}
