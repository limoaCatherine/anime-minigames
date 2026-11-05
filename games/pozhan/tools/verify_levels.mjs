// 关卡数据校验：node tools/verify_levels.mjs
// 找茬 / 找不同：热区数量 = 目标数、热区不太小、互不重叠 (含彩蛋)、不出界、刁钻点在最后。
// 脱困 / 拼字：BFS 求解，必须同时能到达正经结局 (win) 和沙雕结局 (silly)，所有交互区都能被触发；
//              道具、提示、图层名全部存在。
import { LEVELS, CHAPTERS } from '../src/config/LevelConfig.js';
import { ITEMS } from '../src/config/ItemConfig.js';
import { GameConfig } from '../src/config/GameConfig.js';
import { IMAGE_LIST } from '../src/config/CharacterConfig.js';
import { ART } from '../src/art/index.js';
import { solvePuzzle, findDeadEnds } from '../src/systems/PuzzleSystem.js';
import { shapeOf, radiusOf, boundsOf, gapBetween, centerOf } from '../src/core/geometry.js';

const MIN_R = 0.04;          // 普通热区最小等效半径 (场景宽的比例；540 宽时约 22px，手指能点中)
const MIN_R_TRICKY = 0.035;  // 刁钻点允许更小
const MIN_GAP = 0.012;       // 热区之间最小间隔
const MIN_RECT = 0.027;      // 矩形热区 (文字条等) 的最短边一半，约 30px 高
const images = new Set(IMAGE_LIST.map((i) => i.key));
let errors = 0; let warns = 0;
const err = (lv, m) => { errors++; console.log(`  ✗ ${lv.id} ${m}`); };
const warn = (lv, m) => { warns++; console.log(`  ! ${lv.id} ${m}`); };

function inscribed(z, aspect) {
  const s = shapeOf(z);
  if (s.kind === 'circle') return s.r;
  const [x0, y0, x1, y1] = boundsOf(z, aspect);
  return Math.min(x1 - x0, (y1 - y0) * aspect) / 2;
}

function checkLayers(lv) {
  for (const L of lv.layers || []) {
    if (!ART[L.a]) err(lv, `未知图层 ${L.a}`);
    if (L.key && !images.has(L.key)) err(lv, `图层 ${L.a} 引用了不存在的图片 ${L.key}`);
  }
}

function checkFind(lv) {
  const v = lv.type === 'diff' ? GameConfig.layout.diff.a : GameConfig.layout.scene;
  const aspect = v.h / v.w;
  const want = Number((lv.tag.match(/(\d+)\s*处/) || [])[1]);
  if (want !== lv.spots.length) err(lv, `标签写 ${want} 处，实际 ${lv.spots.length} 处`);
  const ids = new Set();
  const all = [...lv.spots, ...(lv.egg ? [lv.egg] : [])];
  for (const s of all) {
    if (ids.has(s.id)) err(lv, `热区 id 重复 ${s.id}`); ids.add(s.id);
    if (!shapeOf(s)) { err(lv, `${s.id} 没有形状`); continue; }
    const r = inscribed(s, aspect);
    const min = shapeOf(s).kind !== 'circle' ? MIN_RECT : (s.tricky || s === lv.egg ? MIN_R_TRICKY : MIN_R);
    if (r < min - 1e-9) err(lv, `${s.id} 太小 (等效半径 ${r.toFixed(3)} < ${min})`);
    const [x0, y0, x1, y1] = boundsOf(s, aspect);
    const [cx, cy] = centerOf(s);
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1) err(lv, `${s.id} 中心出界`);
    if (x0 < -0.03 || y0 < -0.03 || x1 > 1.03 || y1 > 1.03) err(lv, `${s.id} 出界 [${[x0, y0, x1, y1].map((n) => n.toFixed(2))}]`);
    if (!s.name) err(lv, `${s.id} 缺少名称`);
    if (s !== lv.egg && !s.barrage) warn(lv, `${s.id} 没有弹幕`);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const g = gapBetween(all[i], all[j], aspect);
    if (g < MIN_GAP) err(lv, `${all[i].id} 与 ${all[j].id} 重叠/太近 (间隔 ${g.toFixed(3)})`);
  }
  const tricky = lv.spots.filter((s) => s.tricky);
  if (tricky.length !== 1) err(lv, `应有且只有 1 个刁钻点，实际 ${tricky.length}`);
  else if (lv.spots[lv.spots.length - 1] !== tricky[0]) warn(lv, '刁钻点不在列表最后');
  if (lv.quiz) {
    const q = lv.quiz;
    if (!(q.answer >= 0 && q.answer < q.options.length)) err(lv, 'quiz.answer 越界');
  }
}

function checkPuzzle(lv) {
  const aspect = GameConfig.layout.scene.h / GameConfig.layout.scene.w;
  const itemIds = new Set();
  const addItems = (e) => { for (const it of [...((e && e.give) || []), ...((e && e.take) || [])]) itemIds.add(it); };
  for (const it of lv.inventory || []) itemIds.add(it);
  for (const z of lv.zones) {
    if (z.action !== 'target' && z.action !== 'drop' && !z.effect && !z.targets) err(lv, `${z.id} 没有效果`);
    if (!shapeOf(z)) err(lv, `${z.id} 没有形状`);
    else {
      const [x0, y0, x1, y1] = boundsOf(z, aspect);
      if (x0 < -0.03 || y0 < -0.03 || x1 > 1.03 || y1 > 1.03) err(lv, `${z.id} 出界`);
      if (inscribed(z, aspect) < (shapeOf(z).kind === 'circle' ? 0.035 : MIN_RECT)) err(lv, `${z.id} 太小`);
    }
    addItems(z.effect);
    for (const [it, e] of Object.entries(z.accept || {})) { itemIds.add(it); addItems(e); }
    for (const it of Object.keys(z.denyFor || {})) itemIds.add(it);
    for (const [to, e] of Object.entries(z.targets || {})) { if (!lv.zones.find((t) => t.id === to)) err(lv, `${z.id} 的目标 ${to} 不存在`); addItems(e); }
    if (z.to && !lv.zones.find((t) => t.id === z.to)) err(lv, `${z.id} 的目标 ${z.to} 不存在`);
  }
  for (const c of lv.combines || []) { itemIds.add(c.a); itemIds.add(c.b); itemIds.add(c.result); }
  for (const r of lv.rules || []) addItems(r.then);
  for (const it of itemIds) if (!ITEMS[it]) err(lv, `道具 ${it} 不在 ItemConfig 里`);
  for (const h of lv.hints || []) {
    if (h.zone && !lv.zones.find((z) => z.id === h.zone)) err(lv, `提示指向不存在的区域 ${h.zone}`);
    if (h.item && !ITEMS[h.item]) err(lv, `提示指向不存在的道具 ${h.item}`);
    if (!h.text) err(lv, '提示缺少文字');
  }
  const res = solvePuzzle(lv);
  if (!res.endings.win) err(lv, `无法到达正经结局 (搜索了 ${res.states} 个状态)`);
  if (!res.endings.silly) err(lv, '无法到达沙雕结局');
  for (const z of lv.zones) {
    if (z.action === 'target') continue;
    if (!res.touchedZones.has(z.id) && (z.effect || z.accept || z.targets)) err(lv, `区域 ${z.id} 永远触发不了`);
  }
  if (!lv.ending || !lv.silly) err(lv, '缺少 ending / silly 配置');
  // 死局：任何可达状态都必须还能走到正经结局 (沙雕结局本身是终点，不算死局)
  const dead = findDeadEnds(lv);
  const fmtPath = (p) => p.map((m) => m.type === 'drop' ? `${m.item}→${m.zone}` : m.type === 'combine' ? `${m.a}+${m.b}` : `${m.action}:${m.zone}${m.to ? '→' + m.to : ''}`).join(', ');
  for (const d of dead.stuck.slice(0, 3)) err(lv, `卡死状态 (无路可走): ${d.key}  ← ${fmtPath(d.path)}`);
  for (const d of dead.winLost.slice(0, 3)) err(lv, `走到这里就再也通不了关: ${d.key}  ← ${fmtPath(d.path)}`);
  return res;
}

console.log(`《次元破绽！》关卡校验：${LEVELS.length} 关`);
if (LEVELS.length < 12) { errors++; console.log('  ✗ 关卡数不足 12'); }
const inChapters = new Set(CHAPTERS.flatMap((c) => c.levels));
for (const lv of LEVELS) {
  if (!inChapters.has(lv.id)) err(lv, '没有归属章节');
  checkLayers(lv);
  if (lv.type === 'find' || lv.type === 'diff') {
    checkFind(lv);
    console.log(`  ✓ ${lv.id} ${lv.title.padEnd(10, '　')} ${lv.type.padEnd(6)} ${lv.spots.length} 处${lv.egg ? ' + 彩蛋' : ''}${lv.quiz ? ' + 问答' : ''}`);
  } else {
    const r = checkPuzzle(lv);
    const fmt = (p) => (p ? `${p.length} 步` : '—');
    console.log(`  ✓ ${lv.id} ${lv.title.padEnd(10, '　')} ${lv.type.padEnd(6)} 正经结局 ${fmt(r.endings.win)}，沙雕结局 ${fmt(r.endings.silly)}，状态 ${r.states}`);
  }
}
console.log(errors ? `\n✗ ${errors} 个错误，${warns} 个警告` : `\n✓ 全部通过 (${warns} 个警告)`);
process.exit(errors ? 1 : 0);
