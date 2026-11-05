// 战斗世界：一局的全部纯数据状态 + 固定步长推进。只操作数据，不访问 DOM / Canvas / tt，
// 所以 tools/sim_balance.mjs 可以在 Node 里直接 import 跑整局。渲染由 ui/BattleRenderer.js 读取这里的数据完成。
//
// 组成：PlayerSystem (移动/属性/受伤/升级) · SpawnSystem (刷怪时间轴) · EnemySystem (怪物 AI/碰撞/死亡掉落)
//       WeaponSystem (各攻击形态) · ProjectileSystem (子弹/区域/敌弹) · PickupSystem (宝石/道具/宝箱)
//       LevelUpSystem (三选一/进化) · BossSystem (Boss 技能)
// 系统之间通过 world 共享数据，表现层 (音效/特效/语音) 只订阅 world.events。
import { EventBus } from '../core/EventBus.js';
import { createRng } from '../core/Random.js';
import { SpatialGrid } from '../core/SpatialGrid.js';
import { GameConfig } from '../config/GameConfig.js';
import { DifficultyConfig } from '../config/DifficultyConfig.js';
import { WAVES } from '../config/WaveConfig.js';
import { CHARACTER_MAP } from '../config/CharacterConfig.js';
import { PlayerSystem } from './PlayerSystem.js';
import { SpawnSystem } from './SpawnSystem.js';
import { EnemySystem } from './EnemySystem.js';
import { WeaponSystem } from './WeaponSystem.js';
import { ProjectileSystem } from './ProjectileSystem.js';
import { PickupSystem } from './PickupSystem.js';
import { LevelUpSystem } from './LevelUpSystem.js';
import { BossSystem } from './BossSystem.js';

export class BattleWorld {
  /**
   * @param {{character:string, difficulty?:string, wave?:string, talents?:object, seed?:number, events?:EventBus}} opts
   */
  constructor(opts) {
    this.opts = opts;
    this.events = opts.events || new EventBus();
    this.rng = createRng(opts.seed != null ? opts.seed : (Date.now() & 0x7fffffff));
    this.char = CHARACTER_MAP[opts.character] || CHARACTER_MAP.hikari;
    this.diff = DifficultyConfig[opts.difficulty || 'normal'];
    this.wave = WAVES[opts.wave || 'standard'];
    this.talents = opts.talents || {};
    this.caps = GameConfig.caps;
    this.view = { w: GameConfig.width, h: GameConfig.height };

    this.time = 0;            // 战斗已进行秒数 (暂停 / 三选一时不走)
    this.state = 'playing';   // playing | levelup | chest | dead | won
    this.input = { x: 0, y: 0 };   // 摇杆方向 (长度 0..1)
    this.kills = 0;
    this.coinsPicked = 0;     // 局内额外星屑币 (保底卡 / 放弃升级)
    this.reviveUsed = 0;
    this.refreshFree = 0;
    this.refreshAdUsed = 0;
    this.boss = null;         // 当前 Boss
    this.lastStand = null;    // 黎明前最后一搏 {t}
    this.dmgMul = 1;          // 全局伤害倍率 (最后一搏的晨光增伤)
    this.bonusMight = 0;      // 局内彩蛋卡「流星许愿」累计的伤害加成
    this.bossKills = {};
    this.evolutions = [];     // 本局达成的进化 [{id, time}]
    this.stats = { dmgDealt: 0, dmgTaken: 0, levelAt: {}, bossSpawnAt: {}, bossKillAt: {} };

    this.grid = new SpatialGrid(64, 1024, 4096);
    this.gemGrid = new SpatialGrid(64, 1024, 4096);

    this.player = new PlayerSystem(this);
    this.enemies = new EnemySystem(this);
    this.projectiles = new ProjectileSystem(this);
    this.pickups = new PickupSystem(this);
    this.weapons = new WeaponSystem(this);
    this.levelup = new LevelUpSystem(this);
    this.bosses = new BossSystem(this);
    this.spawner = new SpawnSystem(this);

    this.player.init();
    this.weapons.add(this.char.weapon);
    this.refreshFree = this.levelup.freeRefreshes();
  }

  get p() { return this.player.p; }

  /** 推进一个固定步长 */
  step(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    this.player.update(dt);
    this.spawner.update(dt);
    this.enemies.rebuildGrid();
    this.enemies.update(dt);
    this.bosses.update(dt);
    this.weapons.update(dt);
    this.projectiles.update(dt);
    this.pickups.update(dt);
    this.enemies.sweep();
    if (this.state === 'playing') this.levelup.check();
    if (this.state === 'playing' && this.time >= this.wave.duration) this.dawnCheck(dt);
  }

  /** 到点后：最终 Boss 已击败 → 胜利；否则进入 / 推进「黎明前最后一搏」 */
  dawnCheck(dt) {
    const fb = this.wave.finalBoss;
    if (!fb || this.bossKills[fb]) { this.win(); return; }
    const ls = this.wave.lastStand;
    if (!this.lastStand) {
      if (!this.boss || !this.boss.alive || this.boss.type !== fb) this.bosses.spawnBoss(fb);   // 万一还没出场 (例如刷新失败)
      this.lastStand = { t: 0 };
      this.events.emit('dawn:laststand', { type: fb });
    }
    this.lastStand.t += dt;
    this.dmgMul = ls.dmgMul + ls.dmgPerSec * this.lastStand.t;
    const b = this.boss;
    if (b && b.alive && b.type === fb) {
      b.hp -= b.maxHp * ls.burn * dt;
      if (b.hp <= 0) { b.hp = 0; this.enemies.kill(b); }
    }
    if (this.bossKills[fb]) this.win();
  }

  win() {
    if (this.state === 'won') return;
    this.state = 'won';
    this.events.emit('battle:win', { time: this.time });
  }

  /** 玩家死亡 → 等待复活 / 结算 */
  die() {
    this.state = 'dead';
    this.events.emit('player:die', { time: this.time });
  }

  /** 看广告复活：回一半血 + 冲击波 + 2 秒无敌 */
  revive(rule) {
    this.reviveUsed++;
    const p = this.p;
    p.hp = Math.round(p.maxHp * rule.hpRatio);
    p.invuln = rule.invuln;
    this.enemies.blast(p.x, p.y, rule.blastRadius, rule.blastDmg, 160);
    this.projectiles.clearEnemyBullets();
    this.state = 'playing';
    this.events.emit('player:revive', {});
  }

  /** 一局的结算数据 */
  summary() {
    return {
      character: this.char.id,
      difficulty: this.diff.id,
      time: this.time,
      won: this.state === 'won',
      kills: this.kills,
      level: this.p.level,
      weapons: this.weapons.list.map((w) => ({ id: w.id, level: w.level, evolved: w.evolved, evoId: w.evoId })),
      passives: this.player.passives.map((p) => ({ id: p.id, level: p.level })),
      bossKills: { ...this.bossKills },
      lastStand: this.lastStand ? Math.round(this.lastStand.t) : 0,
      evolutions: this.evolutions.slice(),
      coinsPicked: this.coinsPicked,
    };
  }
}
