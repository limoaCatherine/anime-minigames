// 物理与规则审计测试 (无头，Node)：穿透 (tunneling)、画线规则、计时 / 胜负判定、存档迁移与损坏恢复。
// 用法: node tools/test_physics.mjs [--only=tunnel,draw,...] [-v]
import { loadSim, rng } from './lib/sim.mjs';

const S = await loadSim();
const { LevelWorld, EventBus, resolveLevel, hazardDef, Rock, Bee, Projectile, Crate, mechanismDef, GameConfig, Matter } = S;
const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',') : null;
const verbose = args.includes('-v');
if (args.includes('--no-cap')) GameConfig.physics.antiTunnel = null;   // 对比：关闭防穿透限速
let failures = 0;
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failures++; };
const section = (name, title) => { if (ONLY && !ONLY.includes(name)) return false; console.log(`\n[${name}] ${title}`); return true; };

/** 测试用小关卡 */
function mkLevel(o = {}) {
  return resolveLevel({
    id: 99, name: 'test', tip: '', time: 60,
    heroine: { x: 270, y: 900 },
    terrain: [{ type: 'rect', x: 0, y: 900, w: 540, h: 60 }, ...(o.terrain || [])],
    hazards: o.hazards || [], mechanisms: o.mechanisms || [],
    solution: o.solution || [[20, 300], [120, 300]], ink: o.ink || 2000,
  });
}
function mkWorld(o, seed = 1) {
  const events = new EventBus();
  const log = [];
  for (const e of ['level:win', 'level:lose', 'line:commit']) events.on(e, (x) => log.push([e, x]));
  const w = new LevelWorld(mkLevel(o), events, seed);
  w.log = log;
  return w;
}

// ---------------------------------------------------------------- 穿透
const PILLARS = [{ type: 'rect', x: 40, y: 500, w: 40, h: 400 }, { type: 'rect', x: 460, y: 500, w: 40, h: 400 }];
function spawnKind(w, kind, x, y, vx, vy) {
  if (kind === 'rock') return w.spawn(new Rock(w, hazardDef('rockfall'), x, y, vx, vy)) || w.hazards.list.at(-1);
  if (kind === 'roller') return w.spawn(new Rock(w, hazardDef('roller'), x, y, vx, vy)) || w.hazards.list.at(-1);
  if (kind === 'paper' || kind === 'heart') return w.spawn(new Projectile(w, hazardDef(kind), x, y, { x: vx, y: vy })) || w.hazards.list.at(-1);
  if (kind === 'bee') return w.spawn(new Bee(w, hazardDef('bee'), x, y, vx, vy)) || w.hazards.list.at(-1);
  if (kind === 'crate') {
    const c = new Crate(w, mechanismDef('crate', { x, y: y + 28 }));
    w.mechanisms.list.push(c);
    Matter.Body.setVelocity(c.body, { x: vx, y: vy });
    return c;
  }
  throw new Error(kind);
}
/** 把一个物体以速度 v 射向挡板 (画的线 / 薄地形)，返回是否穿过 */
function shoot(barrier, kind, v, angleDeg, seed) {
  const terrain = [...PILLARS];
  if (barrier === 'thin') terrain.push({ type: 'rect', x: 80, y: 489, w: 380, h: 18 }); // 关卡里最薄的地形 / 玻璃 = 18px
  const w = mkWorld({ terrain }, seed);
  if (barrier === 'line') {
    const r = w.drawing.drawPolyline([{ x: 60, y: 490 }, { x: 480, y: 490 }]);
    if (!r.line) throw new Error('line rejected');
  } else {
    w.drawing.drawPolyline([{ x: 20, y: 200 }, { x: 60, y: 200 }]);
  }
  w.simulate(0.3);
  const lineY = barrier === 'line' ? w.line.body.position.y : 498;
  const a = (angleDeg * Math.PI) / 180;
  const vx = Math.sin(a) * v; const vy = Math.cos(a) * v;
  const startY = lineY - 60 - (kind === 'crate' ? 30 : 0);
  const e = spawnKind(w, kind, 270 - Math.sin(a) * 60, startY, vx, vy);
  let through = false;
  for (let i = 0; i < 90; i++) {
    w.physics.stepOnce();
    const b = e.body;
    if (b && b.position.y > lineY + 30) { through = b.position.x > 90 && b.position.x < 450; break; } // 从线的两端滚落不算穿透
  }
  w.destroy();
  return through;
}

if (section('tunnel', '穿透：高速物体不能穿过画的线 / 薄地形')) {
  const kinds = ['rock', 'roller', 'paper', 'heart', 'bee', 'crate'];
  const speeds = [8, 15, 22, 30, 45, 70];
  for (const barrier of ['line', 'thin']) {
    for (const kind of kinds) {
      const bad = [];
      for (const v of speeds) for (const ang of [0, 35]) for (const seed of [1, 2]) if (shoot(barrier, kind, v, ang, seed)) bad.push(`${v}@${ang}°`);
      check(bad.length === 0, `${barrier === 'line' ? '画的线' : '18px 薄地形'} × ${kind.padEnd(6)} 速度 ${speeds.join('/')}：${bad.length ? '穿过 ' + [...new Set(bad)].join(' ') : '全部挡住'}`);
    }
  }
}

// ---------------------------------------------------------------- 画线规则
const plen = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
const inRect = (p, z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
function segHits(a, b, z) { // 采样检测 (测试用，独立于游戏实现)
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 0; i <= n; i++) if (inRect({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }, z)) return true;
  return false;
}
const DRAW_LEVEL = {
  terrain: [{ type: 'rect', x: 300, y: 600, w: 120, h: 40 }],
  mechanisms: [{ type: 'windmill', x: 140, y: 420, r: 60, speed: 2 }, { type: 'nodraw', x: 380, y: 300, w: 120, h: 80 }],
  hazards: [{ type: 'hive', x: 470, y: 200, count: 1, delay: 30 }],
};
if (section('draw', '画线规则：落笔 / 一笔 / 短线 / 墨水 / 禁画区 / 乱涂')) {
  { // 落笔在主角身上 -> 待落笔，拖出去后从第一个合法点开始
    const w = mkWorld(DRAW_LEVEL); const z = w.heroine.zone(0);
    const r = w.drawing.begin({ x: w.heroine.x, y: z.y + z.h / 2 });
    check(r === true && w.drawing.armed && w.drawing.points.length === 0, '在主角身上按下：进入「待落笔」，不产生点');
    for (let x = w.heroine.x; x <= w.heroine.x + 200; x += 5) w.drawing.move({ x, y: z.y + z.h / 2 });
    const zones = w.forbiddenZones();
    check(w.drawing.drawing && w.drawing.points.length > 3 && w.drawing.points.every((p) => !zones.some((zz) => inRect(p, zz))), '拖出主角范围后开始画，线上没有点落在禁画区内');
    w.destroy();
  }
  { // 零长度 / 很短的线
    const w = mkWorld(DRAW_LEVEL);
    w.drawing.begin({ x: 100, y: 250 });
    check(w.drawing.end({ x: 100, y: 250 }) === null && w.state === 'draw' && w.drawing.inkUsed === 0, '零长度点击：取消，不消耗这一笔');
    w.drawing.begin({ x: 100, y: 250 }); w.drawing.move({ x: 110, y: 250 });
    check(w.drawing.end({ x: 115, y: 250 }) === null && w.state === 'draw', `短于 ${GameConfig.line.minLength}px 的线：取消，可以重新画`);
    const r = w.drawing.drawPolyline([{ x: 60, y: 250 }, { x: 250, y: 250 }]);
    check(r.line && w.state === 'survive', '取消后还能正常画一笔');
    check(w.drawing.begin({ x: 60, y: 200 }) === false && w.drawing.end({ x: 200, y: 200 }) === null, '松手后不能再画第二笔');
    w.destroy();
  }
  { // 墨水精确：乱涂 (擦过地形 / 风车 / 禁画区，触发贴边与绕路)
    const R = rng(7); const w = mkWorld({ ...DRAW_LEVEL });
    const zones = w.forbiddenZones();
    w.drawing.begin({ x: 60, y: 520 });
    let x = 60; let y = 520;
    for (let i = 0; i < 400; i++) {
      x = Math.max(10, Math.min(530, x + (R() - 0.45) * 30)); y = Math.max(140, Math.min(880, y + (R() - 0.5) * 30));
      w.drawing.move({ x, y });
    }
    const pts = w.drawing.points.slice();
    const len = plen(pts);
    check(Math.abs(len - w.drawing.inkUsed) < 1e-6, `墨水 = 折线长度 (${w.drawing.inkUsed.toFixed(3)} vs ${len.toFixed(3)})`);
    check(w.drawing.inkUsed <= w.level.ink + 1e-6, `墨水不超过上限 (${w.drawing.inkUsed.toFixed(1)} ≤ ${w.level.ink})`);
    let bad = 0;
    for (let i = 1; i < pts.length; i++) if (zones.some((z) => segHits(pts[i - 1], pts[i], z))) bad++;
    check(bad === 0, `乱涂 ${pts.length} 个点：没有一段穿过主角 / 风车 / 禁画区 / 蜜蜂 (违规 ${bad})`);
    const solid = w.solidBodies(); let inSolid = 0;
    for (const p of pts) if (Matter.Query.point(solid, p).length) inSolid++;
    check(inSolid === 0, `乱涂的点都不在地形里 (违规 ${inSolid})`);
    const line = w.drawing.end({ x, y });
    check(!!line, '乱涂可以提交');
    if (line) {
      w.simulate(4);
      const b = w.line.body; const fin = [b.position.x, b.position.y, b.angle].every(Number.isFinite);
      check(fin && (b.position.y > 1400 || (b.speed < 1 && Math.abs(b.angularVelocity) < 0.05)), `自交乱涂的组合刚体 4 秒后稳定 (速度 ${b.speed.toFixed(3)}, 角速度 ${b.angularVelocity.toFixed(4)})`);
    }
    w.destroy();
  }
  { // 墨水用完
    const w = mkWorld({ ink: 300 });
    w.drawing.begin({ x: 20, y: 300 });
    for (let x = 26; x < 530; x += 6) w.drawing.move({ x, y: 300 });
    check(w.drawing.inkOut && Math.abs(w.drawing.inkUsed - 300) < 1 && w.drawing.inkUsed <= 300 + 1e-9, `墨水 300：在 ${w.drawing.inkUsed.toFixed(2)} 处截断`);
    w.destroy();
  }
  { // 大螺旋 (自交、超长)
    const w = mkWorld({ ink: 3000 });
    const pts = [];
    for (let t = 0; t < Math.PI * 10; t += 0.12) pts.push({ x: 270 + Math.cos(t) * (60 + t * 6), y: 450 + Math.sin(t) * (60 + t * 6) * 0.7 });
    const r = w.drawing.drawPolyline(pts);
    check(!!r.line, `5 圈螺旋 (${r.inkUsed.toFixed(0)}px) 可以提交`);
    w.simulate(5);
    const b = w.line.body;
    check(b.speed < 1 && Math.abs(b.angularVelocity) < 0.05, `大型自交组合刚体落地后不抖动 (速度 ${b.speed.toFixed(3)})`);
    check(w.state === 'survive' || w.state === 'won', `线压在主角身上不算失败 (状态 ${w.state})`);
    w.destroy();
  }
  { // 尖角：V 字线的拐角没有缝，石头不会从拐角漏下去
    let leaks = 0;
    for (const seed of [1, 2, 3]) {
      const w = mkWorld({ terrain: PILLARS }, seed);
      w.drawing.drawPolyline([{ x: 100, y: 300 }, { x: 270, y: 480 }, { x: 440, y: 300 }]);
      w.simulate(0.05);
      const b = w.line.body.position; const lineY = 480 + (b.y - w.line.body.position.y);
      const rock = spawnKind(w, 'rock', 270, 380, 0, 30);
      for (let i = 0; i < 60; i++) { w.physics.stepOnce(); if (rock.body && rock.body.position.y > w.line.body.bounds.max.y + 20 && Math.abs(rock.body.position.x - 270) < 60) { leaks++; break; } }
      w.destroy();
    }
    check(leaks === 0, `V 字线尖角：高速石头不会从拐角漏下 (漏 ${leaks}/3)`);
  }
  { // cancel
    const w = mkWorld(DRAW_LEVEL);
    w.drawing.begin({ x: 60, y: 250 }); for (let x = 66; x < 200; x += 6) w.drawing.move({ x, y: 250 });
    w.drawing.cancel();
    check(!w.drawing.drawing && w.drawing.points.length === 0 && w.drawing.inkUsed === 0 && w.state === 'draw' && w.drawing.end({ x: 200, y: 250 }) === null, '取消 (暂停 / 失焦)：线作废、不扣墨水、不提交');
    w.destroy();
  }
}

// ---------------------------------------------------------------- 计时 / 胜负
if (section('timing', '胜负判定：只结算一次 / 线砸主角不算 / 箱子砸主角算 / 掉落')) {
  {
    const w = mkWorld({}); w.level.time = 2;
    w.drawing.drawPolyline([{ x: 20, y: 300 }, { x: 120, y: 300 }]);
    w.simulate(6);
    const wins = w.log.filter((e) => e[0] === 'level:win').length; const loses = w.log.filter((e) => e[0] === 'level:lose').length;
    check(wins === 1 && loses === 0 && w.state === 'won', `坚持到时间：只触发 1 次胜利 (win ${wins}, lose ${loses})`);
    w.lose({ type: 'test' }); w.win();
    check(w.log.filter((e) => e[0] === 'level:lose').length === 0 && w.log.filter((e) => e[0] === 'level:win').length === 1, '结算后再调用 win/lose 无效');
    w.destroy();
  }
  {
    const w = mkWorld({}); w.level.time = 4; const z = w.heroine.zone(0);
    const r = w.drawing.drawPolyline([{ x: w.heroine.x - 90, y: z.y - 150 }, { x: w.heroine.x + 90, y: z.y - 150 }]);
    w.simulate(5);
    check(r.line && w.state === 'won', `自己画的线从 150px 高处砸到主角头上：不算失败 (${w.state})`);
    w.destroy();
  }
  {
    const w = mkWorld({}); const z = w.heroine.zone(0);
    w.drawing.drawPolyline([{ x: 20, y: 300 }, { x: 120, y: 300 }]);
    spawnKind(w, 'crate', w.heroine.x, z.y - 120, 0, 14);
    w.simulate(2);
    const l = w.log.filter((e) => e[0] === 'level:lose');
    check(l.length === 1 && l[0][1].type === 'crate', `高速木箱砸到主角：失败 1 次 (${l.map((e) => e[1].type).join(',') || '无'})`);
    w.destroy();
  }
  {
    const w = mkWorld({}); w.level.time = 10;
    w.drawing.drawPolyline([{ x: 20, y: 300 }, { x: 120, y: 300 }]);
    w.simulate(0.2);
    Matter.Body.setPosition(w.heroine.body, { x: 585, y: 700 }); Matter.Body.setVelocity(w.heroine.body, { x: 1, y: -4 }); // 被撞飞到屏幕右侧外
    w.simulate(4);
    const l = w.log.filter((e) => e[0] === 'level:lose');
    check(l.length === 1 && l[0][1].type === 'fall' && w.state === 'lost', `主角被撞出屏幕：干净地失败 1 次 (${l.map((e) => e[1].type).join(',') || '无'})`);
    w.destroy();
  }
}

// ---------------------------------------------------------------- 移动平台
if (section('platform', '移动平台：两腿垂在平台外侧的线也会被带着走')) {
  for (const seed of [1, 2]) {
    const w = mkWorld({ mechanisms: [{ type: 'platform', x: 190, y: 500, w: 160, h: 24, path: [[0, 0], [150, 0]], speed: 60, wait: 0.2 }] }, seed);
    const r = w.drawing.drawPolyline([{ x: 170, y: 560 }, { x: 170, y: 470 }, { x: 370, y: 470 }, { x: 370, y: 560 }]);
    const p = w.mechanisms.list[0].body;
    w.simulate(0.4);
    const dx0 = w.line.body.position.x - p.position.x;
    let worst = 0;
    for (let i = 0; i < 6 * 60; i++) { w.physics.stepOnce(); worst = Math.max(worst, Math.abs(w.line.body.position.x - p.position.x - dx0)); }
    check(r.line && w.line.body.position.y < 520 && worst < 25, `seed ${seed}：线跟着平台走 (最大相对滑动 ${worst.toFixed(1)}px)`);
    w.destroy();
  }
}

// ---------------------------------------------------------------- 1.3 罩子 / 间距
if (section('dome', '1.3：通用罩子拿不到三星 / 参考解法三星 / 教学关不限间距')) {
  const { LevelWorld, EventBus, getLevel } = S;
  const { play, genericDome } = await import('./lib/bots.mjs');
  const P = (id, pts) => play(getLevel(id), pts, 1, LevelWorld, EventBus);
  for (const id of [7, 16, 34]) {
    const L = getLevel(id); let wins = 0; let three = 0;
    for (let i = 0; i < 12; i++) { const r = P(id, genericDome(L, i, LevelWorld, EventBus)); if (r.won) { wins++; if (r.stars >= 3) three++; } }
    check(three === 0 || three < wins / 2, `L${id}：贴着她画的罩子 ${wins}/12 过关、三星 ${three} 个 (间距不够最多 2 星)`);
  }
  const w = new LevelWorld(getLevel(7), new EventBus(), 1);
  check(w.clearanceNeed() > 20, `L7 三星要求间距 ${w.clearanceNeed()}px`); w.destroy();
  const w1 = new LevelWorld(getLevel(1), new EventBus(), 1);
  check(w1.clearanceNeed() === 0, '第 1 关 (教学) 不要求间距'); w1.destroy();
  const r1 = P(1, genericDome(getLevel(1), 0, LevelWorld, EventBus));
  check(r1.won && r1.stars === 3, `第 1 关画罩子照样三星 (${r1.stars} 星)`);
  for (const id of [4, 18, 27, 39]) { const r = P(id, getLevel(id).solution); check(r.won && r.stars === 3, `L${id} 参考解法三星`); }
}

// ---------------------------------------------------------------- 存档
if (section('save', '存档：损坏恢复 / v1→v4、v3→v4 迁移 / 重新设计关卡')) {
  const store = new Map();
  globalThis.window.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { SaveSystem } = S;
  const K = 'adl.save.v2'; const L = ['adl.save.v1'];
  const v1 = { levels: {} }; for (let i = 1; i <= 20; i++) v1.levels[i] = { stars: 3, bestInk: 300 + i };
  v1.hints = { 5: true, 12: true };
  store.set(L[0], JSON.stringify(v1));
  let s = new SaveSystem(K, { legacyKeys: L });
  check(s.migratedFrom === L[0] && s.stars(3) === 3 && s.stars(4) === 0 && s.stars(10) === 0 && s.stars(20) === 0, 'v1 → v4：1~3 关星级保留，4~20 关 (重新设计) 星级清零');
  check(s.isUnlocked(21) && s.isUnlocked(15) && s.isRedesigned(12) && s.isRedesigned(5) && !s.isRedesigned(2) && s.hintUnlocked(12), '解锁进度 / 提示保留，重新设计的关卡标记为「新」');
  s.submit(12, 2, 280);
  check(!s.isRedesigned(12) && s.stars(12) === 2, '重新通关后「新」标记消失');
  // v2 存档 (由 v1 原样复制而来) -> v4
  store.clear(); store.set(L[0], JSON.stringify(v1));
  const v2 = JSON.parse(JSON.stringify(v1)); v2.version = 2; v2.levels[11] = { stars: 2, bestInk: 999, clears: 3 };
  store.set(K, JSON.stringify(v2));
  s = new SaveSystem(K, { legacyKeys: L });
  check(s.stars(10) === 0 && s.stars(11) === 0 && s.stars(3) === 3 && s.isUnlocked(21), 'v2 → v4：1~3 关保留，4~40 关星级清零 (1.3 重新设计)');
  check(JSON.parse(store.get(K)).version === 4 && store.has(`${K}.bak`), '迁移后写回 v4 并生成备份');
  // v3 存档 (1.2) -> v4 (1.3)：第 4~40 关星级 / 最少用墨清零，通关记录 / 解锁 / 提示保留，显示「新」
  store.clear();
  const v3 = { version: 3, levels: {}, hints: { 7: true }, settingsVersion: 3 };
  for (let i = 1; i <= 33; i++) v3.levels[i] = { stars: 3, bestInk: 100 + i, clears: 2 };
  store.set(K, JSON.stringify(v3));
  s = new SaveSystem(K, { legacyKeys: L });
  check(s.stars(1) === 3 && s.stars(3) === 3 && s.stars(4) === 0 && s.stars(33) === 0 && s.data.levels[20].bestInk === null, 'v3 → v4：1~3 关保留，4~40 关星级 / 最少用墨清零');
  check(s.isUnlocked(34) && !s.isUnlocked(35) && s.isRedesigned(4) && s.isRedesigned(33) && !s.isRedesigned(3) && !s.isRedesigned(34) && s.hintUnlocked(7), 'v3 → v4：解锁进度 / 提示保留，4~33 关显示「新」');
  check(JSON.parse(store.get(K)).version === 4, 'v3 → v4 迁移后写回');
  s = new SaveSystem(K, { legacyKeys: L });
  s.submit(4, 3, 150);
  s = new SaveSystem(K, { legacyKeys: L });
  check(s.stars(4) === 3 && !s.isRedesigned(4) && s.isRedesigned(5), '已是 v4 的存档不会再次清零');
  // 损坏恢复
  s.submit(30, 3, 100);
  const s2 = new SaveSystem(K, { legacyKeys: L }); // 正常读档 -> 刷新备份
  store.set(K, '{"levels": {"1": {"sta'); // 写到一半被打断
  s = new SaveSystem(K, { legacyKeys: L });
  check(s.corrupted && s.recoveredFromBackup && s.stars(30) === 3 && store.get(`${K}.corrupt`) === '{"levels": {"1": {"sta', '主存档损坏：从备份恢复，损坏原文保存到 .corrupt');
  check(JSON.parse(store.get(K)).levels[30].stars === 3, '恢复后的存档已写回主键');
  store.set(K, '[]'); store.set(`${K}.bak`, 'garbage');
  s = new SaveSystem(K, { legacyKeys: [] });
  check(s.corrupted && !s.recoveredFromBackup && s.isUnlocked(1) && !s.isUnlocked(2), '主存档和备份都坏了：从头开始，不崩溃');
  void s2;
  delete globalThis.window.localStorage;
}

export { mkWorld, mkLevel, check };
console.log(failures ? `\n失败 ${failures} 项` : '\n全部通过 ✔');
process.exit(failures ? 1 : 0);
