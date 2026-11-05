// 升级三选一 + 宝箱 + 进化。
// 卡池：已有武器升级 100 / 已有被动升级 80 / 新武器 60 / 新被动 50 (CARD_RULES)，不放回加权随机，使用对局种子。
// 修正：满级排除；初始武器 ×1.3；武器 Lv5 时它进化要的被动 ×2；武器格未满且连续 3 次没出新武器则第 4 次必出。
// 进化只从宝箱获得：精英 / Boss 掉落的宝箱，如果有满足条件的武器 (Lv5 + 被动 Lv≥3) 就必定进化，否则送一次免费升级。
import { WEAPONS, EVOLUTIONS, MAX_WEAPON_LEVEL, WEAPON_IDS } from '../config/WeaponConfig.js';
import { PASSIVES, PASSIVE_IDS, MAX_PASSIVE_LEVEL } from '../config/PassiveConfig.js';
import { SLOTS, CARD_RULES, RUN_RULES } from '../config/ProgressConfig.js';

export class LevelUpSystem {
  constructor(world) {
    this.world = world;
    this.offer = null;          // 当前三选一
    this.chestResult = null;    // 当前宝箱结果
    this.pendingChests = 0;
    this.noNewWeapon = 0;
    this.picks = [];            // 选择记录 (模拟统计用)
  }

  freeRefreshes() { return RUN_RULES.freeRefresh + (this.world.talents.reroll || 0); }

  queueChest() { this.pendingChests++; }

  /** 每步检查：先开宝箱，再处理升级 */
  check() {
    const W = this.world;
    if (this.pendingChests > 0) {
      this.pendingChests--;
      this.openChest();
      return;
    }
    if (W.player.tryLevel()) {
      this.offer = this.generate();
      W.state = 'levelup';
      W.events.emit('levelup:open', { level: W.p.level, cards: this.offer });
    }
  }

  evolvable() {
    const W = this.world;
    return W.weapons.list.filter((w) => !w.evolved && w.level >= MAX_WEAPON_LEVEL && w.def.evolve
      && W.player.passiveLevel(w.def.evolve.passive) >= w.def.evolve.passiveLv);
  }

  card(type, id) {
    const W = this.world;
    if (type === 'weapon') {
      const def = WEAPONS[id]; const own = W.weapons.has(id);
      const lv = own ? own.level + 1 : 1;
      const evo = EVOLUTIONS[def.evolve.to];
      return { type, id, level: lv, isNew: !own, name: def.name, icon: def.icon, color: def.color,
        desc: def.levels[lv - 1].note, hint: lv === 1 ? `满级后 + ${PASSIVES[def.evolve.passive].name} 可进化成「${evo.name}」` : null };
    }
    if (type === 'passive') {
      const def = PASSIVES[id]; const lv = W.player.passiveLevel(id) + 1;
      return { type, id, level: lv, isNew: lv === 1, name: def.name, icon: def.icon, color: def.color, desc: def.fmt(def.levels[lv - 1]) };
    }
    const f = CARD_RULES.fillers.find((x) => x.id === id);
    return { type: 'filler', id, level: 0, isNew: false, name: f.name, icon: f.icon, color: f.color, desc: f.desc };
  }

  generate() {
    const W = this.world; const rng = W.rng; const R = CARD_RULES;
    const pool = [];
    const weapons = W.weapons.list; const passives = W.player.passives;
    const lv5Evo = new Set(weapons.filter((w) => !w.evolved && w.level >= MAX_WEAPON_LEVEL).map((w) => w.def.evolve.passive));
    for (const w of weapons) {
      if (w.evolved || w.level >= MAX_WEAPON_LEVEL) continue;
      pool.push({ type: 'weapon', id: w.id, w: R.weights.upgradeWeapon * (w.id === W.char.weapon ? R.starterBias : 1) });
    }
    for (const p of passives) {
      if (p.level >= MAX_PASSIVE_LEVEL) continue;
      pool.push({ type: 'passive', id: p.id, w: R.weights.upgradePassive * (lv5Evo.has(p.id) ? R.evoPassiveBias : 1) });
    }
    const weaponSlotFree = weapons.length < SLOTS.weapons;
    if (weaponSlotFree) for (const id of WEAPON_IDS) if (!W.weapons.has(id)) pool.push({ type: 'weapon', id, w: R.weights.newWeapon, isNew: true });
    if (passives.length < SLOTS.passives) {
      for (const id of PASSIVE_IDS) if (!passives.find((p) => p.id === id)) pool.push({ type: 'passive', id, w: R.weights.newPassive * (lv5Evo.has(id) ? R.evoPassiveBias : 1) });
    }
    const out = [];
    // 保底：必出新武器
    if (weaponSlotFree && this.noNewWeapon >= R.pityNewWeapon) {
      const news = pool.filter((c) => c.isNew);
      if (news.length) { const c = news[rng.int(news.length)]; out.push(c); pool.splice(pool.indexOf(c), 1); }
    }
    while (out.length < R.choices && pool.length) {
      let total = 0;
      for (const c of pool) total += c.w;
      let r = rng.next() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) { r -= pool[idx].w; if (r <= 0) break; }
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    if (out.some((c) => c.isNew)) this.noNewWeapon = 0; else if (weaponSlotFree) this.noNewWeapon++;
    const cards = out.map((c) => this.card(c.type, c.id));
    for (const f of R.fillers) if (cards.length < R.choices) cards.push(this.card('filler', f.id));
    return cards;
  }

  apply(card) {
    const W = this.world;
    if (card.type === 'weapon') W.weapons.add(card.id);
    else if (card.type === 'passive') { W.player.addPassive(card.id); W.weapons.refresh(); }
    else {
      const f = CARD_RULES.fillers.find((x) => x.id === card.id);
      if (f.coins) W.coinsPicked += f.coins;
      if (f.heal) W.player.heal(f.heal);
      if (f.might) { W.bonusMight += f.might; W.player.recalc(); }
    }
    W.weapons.refresh();
    this.picks.push({ t: W.time, id: card.id, level: card.level });
  }

  choose(index) {
    const W = this.world;
    if (W.state !== 'levelup' || !this.offer) return;
    const card = this.offer[index];
    if (!card) return;
    this.apply(card);
    this.offer = null;
    W.state = 'playing';
    W.events.emit('card:pick', { card });
  }

  /** 刷新三选一；viaAd=true 时消耗广告次数 */
  refresh(viaAd = false) {
    const W = this.world;
    if (W.state !== 'levelup') return false;
    if (viaAd) { if (W.refreshAdUsed >= RUN_RULES.adRefresh) return false; W.refreshAdUsed++; }
    else { if (W.refreshFree <= 0) return false; W.refreshFree--; }
    this.offer = this.generate();
    W.events.emit('levelup:refresh', { cards: this.offer });
    return true;
  }

  /** 放弃这次升级：+20 星屑币、回 10 HP */
  skip() {
    const W = this.world;
    if (W.state !== 'levelup') return;
    W.coinsPicked += RUN_RULES.skip.coins;
    W.player.heal(RUN_RULES.skip.heal);
    this.offer = null;
    W.state = 'playing';
    W.events.emit('card:skip', {});
  }

  openChest() {
    const W = this.world;
    const ev = this.evolvable();
    let result;
    if (ev.length) {
      const w = ev[W.rng.int(ev.length)];
      W.weapons.evolve(w.id);
      const evo = EVOLUTIONS[w.evoId];
      result = { type: 'evolve', id: w.evoId, from: w.id, name: evo.name, desc: evo.desc, icon: evo.icon, color: evo.color };
      W.events.emit('weapon:evolve', { id: w.evoId, from: w.id, name: evo.name });
    } else {
      const card = this.chestUpgrade();
      this.apply(card);
      result = { type: 'upgrade', card };
    }
    this.chestResult = result;
    W.state = 'chest';
    W.events.emit('chest:open', result);
  }

  /** 宝箱没有可进化的武器时：随机升级一件已有装备 (不送新装备、不影响三选一保底)；全满就给星屑 */
  chestUpgrade() {
    const W = this.world;
    const opts = [];
    for (const w of W.weapons.list) if (!w.evolved && w.level < MAX_WEAPON_LEVEL) opts.push(['weapon', w.id]);
    for (const p of W.player.passives) if (p.level < MAX_PASSIVE_LEVEL) opts.push(['passive', p.id]);
    if (!opts.length) return this.card('filler', 'coins');
    const [type, id] = opts[W.rng.int(opts.length)];
    return this.card(type, id);
  }

  closeChest() {
    const W = this.world;
    if (W.state !== 'chest') return;
    this.chestResult = null;
    W.state = 'playing';
  }
}
