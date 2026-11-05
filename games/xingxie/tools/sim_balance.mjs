// 无头平衡模拟：node tools/sim_balance.mjs [局数=20] [角色=hikari|all] [难度=normal] [ai=normal|lazy|idle] [talents=none|max]
// 胜利 = 撑到 5:00 并击败诺克丝 (到点没打死会进入「黎明前最后一搏」)。all = 6 个角色各跑 N 局并输出汇总表 + 武器统计。
// 用随机种子 + 简单走位 AI 跑整局 (5 分钟)，统计存活时间 / 等级 / Boss 击杀 / 进化 / 最大同屏怪数。
// 走位 AI：远离附近怪物的加权中心，顺路吸附近的宝石，避开 Boss 技能区域；三选一优先初始武器、进化所需被动。
import { BattleWorld } from '../src/systems/BattleWorld.js';
import { CHARACTERS } from '../src/config/CharacterConfig.js';
import { TALENTS } from '../src/config/ProgressConfig.js';
import { WEAPONS } from '../src/config/WeaponConfig.js';

const N = +(process.argv[2] || 20);
const CHAR = process.argv[3] || 'hikari';
const DIFF = process.argv[4] || 'normal';
const AI = process.argv[5] || 'normal';
const TAL = process.argv[6] === 'max' ? Object.fromEntries(TALENTS.map((t) => [t.id, t.max])) : {};
const QUIET = CHAR === 'all' || process.env.QUIET;
const DT = 1 / 60;
const tmp = [];

function think(W, t) {
  const p = W.p;
  if (AI === 'idle') { W.input.x = 0; W.input.y = 0; return; }
  let ax = 0; let ay = 0;
  const n = W.grid.queryCircle(p.x, p.y, 170, tmp, 120);
  for (let i = 0; i < n; i++) {
    const e = tmp[i]; const dx = p.x - e.x; const dy = p.y - e.y; const d2 = dx * dx + dy * dy + 1;
    const w = (e.boss || e.elite ? 3 : 1) / d2;
    ax += dx * w; ay += dy * w;
  }
  for (const b of W.projectiles.bullets.active) {
    const dx = p.x - b.x; const dy = p.y - b.y; const d2 = dx * dx + dy * dy + 1;
    if (d2 < 120 * 120) { ax += dx * 2 / d2; ay += dy * 2 / d2; }
  }
  for (const z of W.projectiles.zones) {
    if (!z.hostile) continue;
    const dx = p.x - z.x; const dy = p.y - z.y; const d = Math.hypot(dx, dy) || 1;
    if (z.kind === 'cage') { if (d > z.r - 40) { ax -= dx / d * 0.05; ay -= dy / d * 0.05; } continue; }
    if (z.kind === 'lane') { const s = Math.sign(dy) || 1; if (Math.abs(dy) < 60) ay += s * 0.08; continue; }
    if (d < z.r + 30) { ax += dx / d * 0.08; ay += dy / d * 0.08; }
  }
  for (const h of W.enemies.hazards) { const dy = p.y - h.y; if (Math.abs(dy) < 50) ay += (Math.sign(dy) || 1) * 0.06; }
  // 宝石吸引 (懒惰 AI 不捡)
  if (AI !== 'lazy') {
    let best = null; let bd = 260 * 260;
    for (const g of W.pickups.gems.active) { const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = g; } }
    for (const it of W.pickups.items) { const d2 = (it.x - p.x) ** 2 + (it.y - p.y) ** 2; if (d2 < 600 * 600) { best = it; bd = d2; break; } }
    if (best) { const d = Math.sqrt(bd) || 1; ax += (best.x - p.x) / d * 0.012; ay += (best.y - p.y) / d * 0.012; }
  }
  // 绕圈漂移，避免卡角
  ax += Math.cos(t * 0.35) * 0.004; ay += Math.sin(t * 0.35) * 0.004;
  const m = Math.hypot(ax, ay);
  if (m < 1e-5) { W.input.x = 0; W.input.y = 0; return; }
  W.input.x = ax / m; W.input.y = ay / m;
}

function pickCard(W) {
  const cards = W.levelup.offer;
  const evoNeeds = new Set(W.weapons.list.map((w) => w.def.evolve && w.def.evolve.passive));
  let bi = 0; let bs = -1;
  cards.forEach((c, i) => {
    let s = W.rng.next() * 2;
    if (c.type === 'weapon' && c.id === W.char.weapon) s += 5;
    else if (c.type === 'weapon' && !c.isNew) s += 3.5;
    else if (c.type === 'weapon') s += 3;
    if (c.type === 'passive' && evoNeeds.has(c.id)) s += 4;
    if (c.type === 'passive') s += 2;
    if (s > bs) { bs = s; bi = i; }
  });
  W.levelup.choose(bi);
}

function run(seed, char) {
  const W = new BattleWorld({ character: char, difficulty: DIFF, seed, talents: TAL });
  const evo = []; let maxEnemies = 0; let hpMinAfter60 = 1; let revived = false;
  const hurtBy = {}; let lastSrc = '';
  W.events.on('player:hurt', (e) => { hurtBy[e.src] = (hurtBy[e.src] || 0) + e.dmg; lastSrc = e.src; });
  const lvAt = {};
  W.events.on('weapon:evolve', (e) => evo.push(`${e.name}@${Math.round(W.time)}s`));
  let t = 0; let steps = 0; let simMs = 0;
  const t0 = performance.now();
  while (steps < 60 * 700) {
    if (W.state === 'playing') { if (steps % 6 === 0) think(W, t); const a = performance.now(); W.step(DT); simMs += performance.now() - a; t += DT; }
    else if (W.state === 'levelup') pickCard(W);
    else if (W.state === 'chest') W.levelup.closeChest();
    else break;
    steps++;
    if (W.enemies.pool.activeCount > maxEnemies) maxEnemies = W.enemies.pool.activeCount;
    for (const m of [60, 120, 150, 180, 240]) if (lvAt[m] == null && W.time >= m) lvAt[m] = W.p.level;
    if (W.time > 60) hpMinAfter60 = Math.min(hpMinAfter60, W.p.hp / W.p.maxHp);
  }
  return { seed, won: W.state === 'won', time: W.time, level: W.p.level, kills: W.kills, bossKills: { ...W.bossKills },
    bossAt: W.stats.bossSpawnAt, evo, maxEnemies, hpMin: hpMinAfter60, weapons: W.weapons.list.map((w) => `${w.id}${w.evolved ? '*' : ''}${w.level}`).join(' '),
    passives: W.player.passives.map((p) => `${p.id}${p.level}`).join(' '), held: W.weapons.list.map((w) => w.id), lastStand: W.lastStand ? W.lastStand.t : 0, inLastStand: !!W.lastStand, lv: W.stats.levelAt, msPerStep: simMs / Math.max(1, t / DT), wall: performance.now() - t0, reached: W.time, dmgTaken: Math.round(W.stats.dmgTaken), hurtBy, lastSrc, lvAt };
}

function batch(char) {
  const res = [];
  for (let i = 0; i < N; i++) {
    const seed = 1000 + (i + (+process.env.SIM_SEED_OFFSET || 0)) * 7919;   // SIM_SEED_OFFSET: 分片并行跑时错开种子
    const r = run(seed, char);
    res.push(r);
    if (!QUIET) console.log(`#${i} seed=${seed} ${r.won ? 'WIN ' : 'DEAD'} t=${r.time.toFixed(0)}s Lv${r.level} kills=${r.kills} boss=${JSON.stringify(r.bossKills)} ls=${r.lastStand.toFixed(0)}s maxE=${r.maxEnemies} hpMin=${(r.hpMin * 100).toFixed(0)}% evo=[${r.evo.join(',')}] | ${r.weapons} | ${r.passives} | lv ${Object.values(r.lvAt).join('/')} | hurt ${JSON.stringify(r.hurtBy)}${r.won ? '' : ' killedBy=' + r.lastSrc}`);
  }
  return res;
}

function report(char, res) {
  const wins = res.filter((r) => r.won).length;
  const avg = (f) => (res.reduce((s, r) => s + f(r), 0) / res.length);
  const n = res.length;
  const ls = res.filter((r) => r.inLastStand);
  return {
    char, n, win: wins / n, avgTime: avg((r) => r.time), early: res.filter((r) => !r.won && r.time < 60).length,
    reachSheep: res.filter((r) => r.time >= 150).length / n, reachNox: res.filter((r) => r.time >= 240).length / n,
    sheepKill: res.filter((r) => r.bossKills.sheepKing).length / n, noxKill: res.filter((r) => r.bossKills.nox).length / n,
    noxBefore300: res.filter((r) => r.bossKills.nox && !r.inLastStand).length / n,
    lastStandRuns: ls.length, lastStandAvg: ls.length ? ls.reduce((s, r) => s + r.lastStand, 0) / ls.length : 0,
    lastStandWin: ls.length ? ls.filter((r) => r.won).length / ls.length : 0,
    level: avg((r) => r.level), kills: avg((r) => r.kills), maxE: avg((r) => r.maxEnemies), evo: avg((r) => r.evo.length),
    msPerStep: avg((r) => r.msPerStep),
  };
}

const pct = (v) => `${Math.round(v * 100)}%`;
const chars = CHAR === 'all' ? CHARACTERS.map((c) => c.id) : [CHAR];
const all = [];
const rows = [];
for (const c of chars) { const res = batch(c); all.push(...res); rows.push(report(c, res)); }
console.log('—'.repeat(40));
console.log(`难度=${DIFF} AI=${AI} 天赋=${process.argv[6] === 'max' ? '满' : '无'} 每角色 ${N} 局`);
console.log('角色      通关  诺克丝击杀(5:00前)  最后一搏(局数/平均秒/胜率)  羊王击杀  平均存活  1分钟内死  等级  进化');
for (const r of rows) {
  console.log(`${r.char.padEnd(9)} ${pct(r.win).padStart(4)}  ${pct(r.noxKill).padStart(4)} (${pct(r.noxBefore300)})          ${String(r.lastStandRuns).padStart(2)}/${r.lastStandAvg.toFixed(0).padStart(3)}s/${pct(r.lastStandWin).padStart(4)}            ${pct(r.sheepKill).padStart(4)}    ${r.avgTime.toFixed(0)}s      ${r.early}       ${r.level.toFixed(1)}  ${r.evo.toFixed(1)}`);
}
const tot = report('total', all);
console.log(`合计: 通关 ${pct(tot.win)}  诺克丝击杀 ${pct(tot.noxKill)}  平均最大同屏 ${tot.maxE.toFixed(0)}  逻辑 ${tot.msPerStep.toFixed(3)} ms/步`);
if (chars.length > 1 || process.env.WEAPON_STATS) {
  console.log('武器统计 (局末持有该武器的局数 / 这些局的通关率)：');
  for (const id of Object.keys(WEAPONS)) {
    const h = all.filter((r) => r.held.includes(id));
    console.log(`  ${WEAPONS[id].name.padEnd(8, '　')} ${String(h.length).padStart(4)} 局  通关 ${h.length ? pct(h.filter((r) => r.won).length / h.length) : '-'}`);
  }
}
if (process.env.SIM_JSON) { const fs = await import('node:fs'); const weapons = Object.fromEntries(Object.keys(WEAPONS).map((id) => { const h = all.filter((r) => r.held.includes(id)); return [id, { held: h.length, won: h.filter((r) => r.won).length }]; }));
  fs.writeFileSync(process.env.SIM_JSON, JSON.stringify({ diff: DIFF, rows, total: tot, weapons, results: all.map((r) => ({ won: r.won, time: r.time, ls: r.inLastStand, noxBefore: !!(r.bossKills.nox && !r.inLastStand) })) }, null, 2)); }
