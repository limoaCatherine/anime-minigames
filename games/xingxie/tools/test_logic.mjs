// 逻辑自检 (无浏览器)：node tools/test_logic.mjs
// 覆盖：连升多级排队 / 卡池去重与满级排除 / 满格时的保底卡 / 宝箱 (可进化 & 不可进化) / 进化后退出卡池 /
//       多怪同时接触不会一帧暴毙 / 刷怪不在屏幕内 / Boss 控制抗性 + 拉回 + 羊王超时撤退 / 黎明前最后一搏的胜利流程 /
//       复活只能一次 / 刷新次数上限 / 存档损坏 & 负数 & 重复扣款 / 连续三局不残留
import { BattleWorld } from '../src/systems/BattleWorld.js';
import { SaveSystem } from '../src/systems/SaveSystem.js';
import { WEAPON_IDS, MAX_WEAPON_LEVEL, WEAPONS } from '../src/config/WeaponConfig.js';
import { PASSIVE_IDS, MAX_PASSIVE_LEVEL } from '../src/config/PassiveConfig.js';
import { SLOTS, RUN_RULES, CARD_RULES } from '../src/config/ProgressConfig.js';
import { CC_RULES } from '../src/config/EnemyConfig.js';
import { WAVES } from '../src/config/WaveConfig.js';
import { GameConfig } from '../src/config/GameConfig.js';
import { CHARACTERS } from '../src/config/CharacterConfig.js';
import { VoiceSystem } from '../src/systems/VoiceSystem.js';
import { EventBus } from '../src/core/EventBus.js';
import { VOICE_LINES, ALL_VOICE_LINES, VOICE_CAST, VOICE_CREDITS } from '../src/config/VoiceConfig.js';
import { AdService } from '../src/systems/AdService.js';
import { PlatformConfig } from '../src/config/PlatformConfig.js';
import fs from 'node:fs';

let pass = 0; let fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('  ✗', name); } }
function section(name, fn) { console.log(`· ${name}`); try { fn(); } catch (e) { fail++; console.log('  ✗ 抛出异常', e.stack); } }
const DT = 1 / 60;
const world = (o = {}) => new BattleWorld({ character: 'hikari', seed: 7, ...o });
const keyOf = (c) => `${c.type}:${c.id}`;

section('连升多级：一次吃大量经验，三选一逐个排队，不丢级、不重叠', () => {
  const W = world();
  W.player.gainExp(5000);
  let opened = 0; W.events.on('levelup:open', () => opened++);
  let guard = 0;
  while (guard++ < 400) {
    W.step(DT);
    if (W.state === 'levelup') { ok(W.levelup.offer && W.levelup.offer.length === 3, '每次都是 3 张卡'); W.levelup.choose(0); }
    if (W.state === 'chest') W.levelup.closeChest();
    if (W.p.exp < W.p.expNext && W.state === 'playing') break;
  }
  ok(opened === W.p.level - 1, `开了 ${opened} 次三选一 = 升了 ${W.p.level - 1} 级`);
  ok(W.p.level > 5, `大经验确实连升多级 (Lv${W.p.level})`);
});

section('卡池：不重复、不出满级、进化后的武器不再出现；满格满级时给保底卡', () => {
  const W = world();
  for (let k = 0; k < 300; k++) {
    W.state = 'levelup';
    const cards = W.levelup.generate();
    const keys = cards.map(keyOf);
    ok(new Set(keys).size === keys.length, '同一组没有重复卡');
    for (const c of cards) {
      if (c.type === 'weapon') { const w = W.weapons.has(c.id); ok(!w || (!w.evolved && w.level < MAX_WEAPON_LEVEL), `不出满级/已进化武器 ${c.id}`); }
      if (c.type === 'passive') ok(W.player.passiveLevel(c.id) < MAX_PASSIVE_LEVEL, `不出满级被动 ${c.id}`);
    }
    W.levelup.offer = cards; W.levelup.choose(0);
  }
  ok(W.weapons.list.length <= SLOTS.weapons && W.player.passives.length <= SLOTS.passives, '武器 / 被动不超过格子数');
  // 全部满级后
  for (const w of W.weapons.list) while (!w.evolved && w.level < MAX_WEAPON_LEVEL) W.weapons.add(w.id);
  for (const p of W.player.passives) while (p.level < MAX_PASSIVE_LEVEL) W.player.addPassive(p.id);
  const cards = W.levelup.generate();
  ok(cards.length === 3 && cards.every((c) => c.type === 'filler'), `全满时三张都是保底卡 (${cards.map((c) => c.id)})`);
  ok(cards.some((c) => c.id === 'heal') && cards.some((c) => c.id === 'coins'), '保底卡包含回血和星屑');
  // 保底卡生效
  const before = W.coinsPicked; W.state = 'levelup'; W.levelup.offer = cards; W.levelup.choose(cards.findIndex((c) => c.id === 'coins'));
  ok(W.coinsPicked > before, '星屑保底卡加币');
  const m0 = W.player.s.might; W.levelup.apply(W.levelup.card('filler', 'wish'));
  ok(W.player.s.might > m0, '流星许愿卡加伤害');
});

section('宝箱：条件不满足时送一次已有装备升级；满足时必进化，进化后退出卡池', () => {
  const W = world();
  const lv0 = W.weapons.has('starWand').level;
  W.levelup.queueChest(); W.step(DT);
  ok(W.state === 'chest' && W.levelup.chestResult.type === 'upgrade', '条件不满足 → 升级');
  ok(W.weapons.has('starWand').level === lv0 + 1, '升级的是已有的武器');
  W.levelup.closeChest();
  const pity = W.levelup.noNewWeapon;
  ok(pity === 0, '宝箱不影响三选一保底计数');
  while (W.weapons.has('starWand').level < MAX_WEAPON_LEVEL) W.weapons.add('starWand');
  const need = WEAPONS.starWand.evolve;
  for (let i = 0; i < need.passiveLv; i++) W.player.addPassive(need.passive);
  W.levelup.queueChest(); W.step(DT);
  ok(W.levelup.chestResult && W.levelup.chestResult.type === 'evolve', '条件满足 → 进化');
  W.levelup.closeChest();
  for (let k = 0; k < 100; k++) ok(!W.levelup.generate().some((c) => c.type === 'weapon' && c.id === 'starWand'), '进化后的武器不在卡池');
  // 全部满级、没有可进化：宝箱给星屑
  const W2 = world();
  while (W2.weapons.list.length < SLOTS.weapons) W2.weapons.add(WEAPON_IDS.find((id) => !W2.weapons.has(id) && !WEAPONS[id].evolve.passive.startsWith('x')));
  for (const w of W2.weapons.list) while (w.level < MAX_WEAPON_LEVEL) W2.weapons.add(w.id);
  const unrelated = PASSIVE_IDS.filter((id) => !W2.weapons.list.some((w) => w.def.evolve.passive === id)).slice(0, SLOTS.passives);
  for (const id of unrelated) while (W2.player.passiveLevel(id) < MAX_PASSIVE_LEVEL) W2.player.addPassive(id);
  if (W2.levelup.evolvable().length === 0) {
    const c = W2.levelup.chestUpgrade();
    ok(c.type === 'filler' && c.id === 'coins', '全满且不能进化 → 宝箱给星屑');
  }
});

section('刷新次数：免费次数 + 广告次数用完就不能再刷', () => {
  const W = world();
  W.player.gainExp(50); W.step(DT);
  ok(W.state === 'levelup', '进入三选一');
  let free = 0; while (W.levelup.refresh(false)) free++;
  let ad = 0; while (W.levelup.refresh(true)) ad++;
  ok(free === RUN_RULES.freeRefresh, `免费刷新 ${free} 次`);
  ok(ad === RUN_RULES.adRefresh, `广告刷新 ${ad} 次`);
});

section('受伤：一圈怪同时贴脸，只掉一次血 (无敌帧)；子弹同帧也不叠伤', () => {
  const W = world();
  const p = W.p;
  for (let i = 0; i < 40; i++) W.enemies.spawn('slime', p.x + Math.cos(i) * 4, p.y + Math.sin(i) * 4);
  let hurts = 0; W.events.on('player:hurt', () => hurts++);
  const hp0 = p.hp;
  W.enemies.rebuildGrid(); W.enemies.contact(); W.enemies.contact(); W.enemies.contact();
  ok(hurts === 1, `同一帧只受伤 1 次 (${hurts})`);
  ok(p.hp > hp0 * 0.5, '没有被一帧秒杀');
  for (let k = 0; k < 5; k++) W.player.hurt(30, 'bullet');
  ok(hurts === 1, '无敌帧内子弹不叠伤');
});

section('刷怪：刷新点都在屏幕外', () => {
  const W = world();
  const hw = W.view.w / 2; const top = W.view.h * GameConfig.camera.playerScreenY; const bottom = W.view.h - top;
  let inside = 0;
  for (let i = 0; i < 3000; i++) {
    W.p.moving = i % 2 === 0; W.p.facing = { x: Math.cos(i), y: Math.sin(i) };
    const s = W.spawner.spawnPoint();
    const dx = s.x - W.p.x; const dy = s.y - W.p.y;
    if (Math.abs(dx) < hw && dy > -top && dy < bottom) inside++;
  }
  ok(inside === 0, `3000 个刷新点在屏幕内的个数 = ${inside}`);
});

section('Boss：不被冻住 / 晕住，减速有上限；被甩远会拉回；羊王超时撤退；出场在玩家上方', () => {
  const W = world();
  const b = W.bosses.spawnBoss('sheepKing');
  ok(b && b.y < W.p.y, 'Boss 从玩家上方出场');
  W.enemies.damage(b, 1, { freezeChance: 1, freezeTime: 5, stun: 3, slow: 0.95, slowTime: 5 });
  ok(b.freeze === 0 && b.stun === 0, 'Boss 不会被冻结 / 眩晕');
  ok(b.slow <= CC_RULES.bossSlowMax + 1e-9, `Boss 减速封顶 ${b.slow}`);
  b.x = W.p.x + 2000; W.bosses.update(DT);
  ok(Math.hypot(b.x - W.p.x, b.y - W.p.y) < CC_RULES.leash, 'Boss 被甩远后拉回屏幕边');
  let retreated = null; W.events.on('boss:retreat', (e) => { retreated = e; });
  W.time = b.spawnAt + b.def.leaveAfter + 0.1; W.bosses.update(DT);
  ok(!b.alive && retreated && retreated.reason === 'timeout' && W.boss === null, '羊王超时撤退，不留冻结残影');
  const W2 = world();
  const s = W2.bosses.spawnBoss('sheepKing'); let why = null; W2.events.on('boss:retreat', (e) => { why = e.reason; });
  W2.bosses.spawnBoss('nox');
  ok(!s.alive && why === 'replaced' && W2.boss.type === 'nox', '诺克丝出场时羊王先撤 (replaced)');
  // 精英
  const el = W2.enemies.spawn('bearGeneral', W2.p.x + 300, W2.p.y);
  if (el) { el.elite = true; W2.enemies.damage(el, 1, { freezeChance: 1, freezeTime: 5 }); ok(el.freeze === 0 && el.slow <= CC_RULES.eliteSlowMax, '精英不被冻住，减速封顶'); }
});

section('胜利：必须击败诺克丝；5:00 时 Boss 还活着 → 黎明前最后一搏，晨光增伤直到打倒', () => {
  const W = world();
  const dur = W.wave.duration;
  W.time = dur - DT * 2; W.p.invuln = 1e9;
  W.bosses.spawnBoss('nox');
  let ls = 0; let won = 0; W.events.on('dawn:laststand', () => ls++); W.events.on('battle:win', () => won++);
  for (let i = 0; i < 10; i++) W.step(DT);
  ok(ls === 1 && W.state === 'playing' && W.lastStand, '到点没打倒诺克丝 → 进入最后一搏而不是直接胜利');
  const m1 = W.dmgMul; for (let i = 0; i < 600; i++) { W.p.invuln = 1e9; W.step(DT); if (W.state === 'levelup') W.levelup.choose(0); if (W.state === 'chest') W.levelup.closeChest(); }
  ok(W.dmgMul > m1, '晨光增伤随时间上升');
  let guard = 0; while (W.state !== 'won' && guard++ < 60 * 400) { W.p.invuln = 1e9; W.step(DT); if (W.state === 'levelup') W.levelup.choose(0); if (W.state === 'chest') W.levelup.closeChest(); }
  ok(W.state === 'won' && won === 1 && W.bossKills.nox, `诺克丝最终会被晨光烧死并胜利 (${Math.round(W.lastStand.t)}s)`);
  ok(W.summary().lastStand, '结算记录了最后一搏');
  const W2 = world(); W2.bossKills.nox = 1; W2.time = W2.wave.duration; W2.step(DT);
  ok(W2.state === 'won', '提前击败诺克丝 → 5:00 直接胜利');
});

section('复活只能一次；复活后无敌 + 推开怪', () => {
  const W = world();
  W.p.hp = 1; W.p.invuln = 0; W.player.hurt(999);
  ok(W.state === 'dead', '死亡');
  const e = W.enemies.spawn('slime', W.p.x + 50, W.p.y); W.enemies.rebuildGrid();
  W.revive(RUN_RULES.revive);
  ok(W.state === 'playing' && W.p.invuln >= 2 && W.p.hp > 0, '复活后有血 + 2 秒无敌');
  ok(!e.alive || Math.hypot(e.x - W.p.x, e.y - W.p.y) > 50 || e.kvx !== 0, '复活冲击波打到 / 推开附近的怪');
  ok(W.reviveUsed === 1 && W.reviveUsed >= RUN_RULES.revive.adPerRun, '复活次数用完 (GameScene 据此不再弹复活)');
});

section('存档：损坏不崩、负数 / NaN 修正、重复扣款被拒', () => {
  const store = {};
  globalThis.window = { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
  store.t1 = '{"coins": 50, "talents": {broken';
  const s1 = new SaveSystem('t1');
  ok(s1.data.coins === 0 && store['t1.broken'], '损坏存档 → 备份并重置');
  s1.addCoins(10); ok(JSON.parse(store.t1).coins === 10, '重置后还能正常保存');
  store.t2 = JSON.stringify({ coins: -500, talents: { might: 99, bogus: 3 }, unlocked: { kanon: true, hacker: true }, lastChar: 'nobody', difficulty: 'god', stats: { runs: 'NaN', clears: -2 } });
  const s2 = new SaveSystem('t2');
  ok(s2.data.coins === 0, '负数星屑 → 0');
  ok(Object.values(s2.data.talents).every((v) => v >= 0) && !('bogus' in s2.data.talents), '天赋修正');
  ok(!s2.data.unlocked.hacker && s2.data.unlocked.kanon, '未知角色解锁被清掉');
  ok(s2.data.lastChar === 'hikari' && s2.data.difficulty === 'normal', '非法角色 / 难度回退默认');
  ok(s2.data.stats.runs === 0 && s2.data.stats.clears === 0, '统计数字修正');
  ok(!s2.spend(-100) && !s2.spend(NaN) && s2.data.coins === 0, '负数 / NaN 扣款被拒');
  s2.addCoins(100); ok(!s2.spend(101) && s2.data.coins === 100, '余额不足不扣');
  const kanon = CHARACTERS.find((c) => c.unlock.type === 'coins');
  const s3 = new SaveSystem('t3'); s3.addCoins(kanon.unlock.cost * 2);
  s3.tryUnlock(kanon); s3.tryUnlock(kanon);
  ok(s3.data.coins === kanon.unlock.cost, '重复解锁只扣一次');
  delete globalThis.window;
});

section('连续三局：每局新世界，无残留', () => {
  const sums = [];
  for (let r = 0; r < 3; r++) {
    const W = world({ seed: 100 + r });
    ok(W.time === 0 && W.kills === 0 && W.p.level === 1 && W.weapons.list.length === 1 && !W.lastStand && W.dmgMul === 1 && W.bonusMight === 0, `第 ${r + 1} 局初始状态干净`);
    for (let i = 0; i < 60 * 40; i++) { W.step(DT); if (W.state === 'levelup') W.levelup.choose(0); if (W.state === 'chest') W.levelup.closeChest(); if (W.state === 'dead') break; }
    sums.push(W.summary());
  }
  ok(sums.length === 3, '三局都能跑');
});

section('语音：事件接线 / 优先级 / 变体 / 文件齐全', () => {
  const ev = new EventBus();
  const v = new VoiceSystem(ev, { get: (k, d) => d, set() {} }, { muted: false }, null);
  v.random = () => 0;
  const playing = () => { v.current = { group: v.history[v.history.length - 1].split('.')[1], priority: 5, el: { paused: false, ended: false, pause() {} } }; };
  ev.emit('battle:start', { character: 'hikari' });
  ev.emit('boss:spawn', { type: 'nox' }); playing();
  ok(v.history.at(-1) === 'nox.appear', 'Boss 登场台词');
  ev.emit('dawn:laststand', { type: 'nox' });
  ok(v.history.at(-1) === 'nox.laststand' && v.queue && v.queue.group === 'dawn', '最后一搏：诺克丝台词打断登场台词，角色台词排队');
  v.current = null; v.cooldown = 0; v.update(0.01);
  ok(v.history.at(-1) === 'hikari.dawn', '排队的角色台词随后播放');
  v.cooldown = 0; v.current = null; ev.emit('boss:retreat', { type: 'sheepKing', reason: 'timeout' });
  ok(v.history.at(-1) === 'sheepKing.retreat', '羊王超时撤退台词');
  const n0 = v.history.length; v.cooldown = 0; v.current = null; ev.emit('boss:retreat', { type: 'sheepKing', reason: 'replaced' });
  ok(v.history.length === n0, '被诺克丝顶替时羊王不说撤退台词 (不抢诺克丝登场)');
  v.cooldown = 0; v.current = null; ev.emit('boss:skill', { type: 'nox', skill: 'mirror' });
  ok(v.history.at(-1) === 'nox.mirror', '镜像分身台词');
  v.cooldown = 0; v.current = null; ev.emit('enemy:die', { elite: true, boss: false });
  ok(v.history.at(-1) === 'hikari.kill', '打倒精英台词');
  v.cooldown = 0; v.current = null; const n1 = v.history.length; ev.emit('enemy:die', { elite: true, boss: false });
  ok(v.history.length === n1, '打倒精英台词有 20 秒限频');
  for (const [who, groups] of Object.entries(VOICE_LINES)) for (const [g, list] of Object.entries(groups)) {
    if (CHARACTERS.find((c) => c.id === who)) ok(list.length >= 2, `${who}.${g} 有 ${list.length} 条变体`);
  }
  const missing = ALL_VOICE_LINES.filter((l) => !fs.existsSync(new URL('../' + l.file, import.meta.url)));
  ok(missing.length === 0, `语音文件齐全 (缺 ${missing.length})`);
  ok(ALL_VOICE_LINES.every((l) => l.emo && l.voice && l.voice.styleId != null), '每句都有情绪标签和风格声线');
  ok(!JSON.stringify(ALL_VOICE_LINES).includes('もち子'), '不使用もち子さん');
});


section('声优条款 (v1.3)：只用允许法人直接商用的声线，署名与 docs/licenses 一一对应', () => {
  const banned = ['猫使アル', '猫使ビィ', 'もち子さん', 'ユーレイちゃん'];
  ok(!Object.values(VOICE_CAST).some((c) => banned.includes(c.speaker)), '不使用需事前联系 / 被排除的声线');
  ok(VOICE_CAST.momo.speaker === 'あんこもん' && VOICE_CAST.tsukimi.speaker === '中国うさぎ', '桃濑萌 = あんこもん，月见雪乃 = 中国うさぎ');
  ok(!ALL_VOICE_LINES.some((l) => banned.includes(l.voice.speaker)), '所有台词都不再用猫使アル / 猫使ビィ');
  const dir = new URL('../docs/licenses/', import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('VOICEVOX_') && !f.includes('ソフトウェア'));
  const names = files.map((f) => f.replace(/^VOICEVOX_|\.md$/g, ''));
  const used = VOICE_CREDITS.map((c) => c.replace('VOICEVOX:', ''));
  ok(used.every((n) => names.includes(n)), `每位声优都有条款文件 (${used.join('/')})`);
  ok(names.every((n) => used.includes(n)), `没有残留未使用的条款 (${names.join('/')})`);
  ok(fs.existsSync(new URL('VOICEVOX_ソフトウェア利用規約.md', dir)), 'VOICEVOX 软件规约在');
});

console.log('· 广告 (v1.3)：网页版 / 未填广告位 → 不提供激励视频，不弹占位；注入 provider 后恢复');
{
  const ev = new EventBus(); const seen = [];
  ['ad:open', 'ad:closed', 'ad:error'].forEach((n) => ev.on(n, () => seen.push(n)));
  const ads = new AdService(ev);
  ok(PlatformConfig.douyin.rewardedAdUnitId === '', '仓库里广告位 ID 为空 (占位)');
  ok(ads.enabled === false && ads.mode === 'off', '网页版 / exe 无广告 SDK → enabled=false');
  ok(!('fake' in ads) && typeof ads.closeFake === 'undefined', '已移除 5 秒占位广告');
  const r = await ads.showRewardedAd('double');
  ok(r === false && ads.lastReason === 'disabled' && seen.length === 0, '误调用直接返回 false，不弹任何东西');
  ads.setProvider(() => Promise.resolve(true));
  ok(ads.enabled && ads.mode === 'provider', '注入 provider 后 enabled=true');
  ok(await ads.showRewardedAd('revive') === true && seen.includes('ad:closed'), 'provider 看完 → 发奖励');
}

section('配置：所有数值在 config，最终 Boss / 最后一搏参数存在', () => {
  ok(WAVES.standard.finalBoss === 'nox' && WAVES.standard.lastStand.dmgPerSec > 0, '最后一搏配置');
  ok(CARD_RULES.fillers.length >= 2, '保底卡配置');
});

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
