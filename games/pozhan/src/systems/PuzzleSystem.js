// 助她脱困 / 文字拼字 / 换装 关卡的状态机 (纯逻辑，无 DOM 依赖；tools/verify_levels.mjs 也用它做可达性检查)。
// 状态 = 一组 flag + 道具栏。关卡配置 (LevelConfig) 里的每个交互区 (zone) 描述：
//   action: 'tap' 点击 | 'hold' 长按 | 'swipe' 滑动 (dir) | 'drag' 把场景物体拖到 to 指定的区域 | 'drop' 接收道具
//   when / unless: 需要 / 排斥的 flag；accept: { 道具id: effect }；effect / deny: 触发的效果
// effect 字段：set / clear (flag)，give / take (道具)，say [角色, 台词组]，barrage 弹幕，penalty 扣理智，
//              fly 拼字飞入槽位，end: 'win' | 'silly' 结局
// rules: [{ if:[flags], unless?, then: effect }] —— 每次效果之后检查 (例如「不对称，重来」)
export class PuzzleState {
  constructor(level) {
    this.level = level;
    this.flags = new Set(level.flags0 || []);
    this.inv = [...(level.inventory || [])];
    this.ended = null;
    this.steps = 0;
  }

  clone() {
    const c = new PuzzleState(this.level);
    c.flags = new Set(this.flags); c.inv = [...this.inv]; c.ended = this.ended; c.steps = this.steps;
    return c;
  }

  key() { return [...this.flags].sort().join(',') + '|' + [...this.inv].sort().join(','); }

  zone(id) { return this.level.zones.find((z) => z.id === id); }

  active(z) {
    if (!z) return false;
    if (z.when && !z.when.every((f) => this.flags.has(f))) return false;
    if (z.unless && z.unless.some((f) => this.flags.has(f))) return false;
    return true;
  }

  activeZones() { return this.level.zones.filter((z) => this.active(z)); }

  /** 应用效果，返回实际执行的效果列表 (含规则触发的效果) */
  apply(effect) {
    const out = [];
    if (!effect) return out;
    const run = (e) => {
      out.push(e);
      for (const f of e.clear || []) this.flags.delete(f);
      for (const f of e.set || []) this.flags.add(f);
      for (const it of e.take || []) { const i = this.inv.indexOf(it); if (i >= 0) this.inv.splice(i, 1); }
      for (const it of e.give || []) this.inv.push(it);
      if (e.end && !this.ended) this.ended = e.end;
    };
    run(effect);
    this.steps++;
    for (let guard = 0; guard < 6 && !this.ended; guard++) {
      const rule = (this.level.rules || []).find((r) => r.if.every((f) => this.flags.has(f)) && !(r.unless || []).some((f) => this.flags.has(f)));
      if (!rule) break;
      run(rule.then);
    }
    return out;
  }

  /** 在区域上执行动作 (tap / hold / swipe / drag)。返回 { ok, effects, reason } */
  act(zoneId, action, extra = {}) {
    const z = this.zone(zoneId);
    if (!z || !this.active(z)) return { ok: false, reason: 'inactive' };
    if (z.action !== action) return { ok: false, reason: 'wrong-action', expected: z.action };
    let eff = z.effect;
    if (action === 'drag') {
      const tz = this.zone(extra.to);
      if (!tz || !this.active(tz)) return { ok: false, reason: 'wrong-target' };
      eff = z.targets ? z.targets[extra.to] : (extra.to === z.to ? z.effect : null);
      if (!eff) return { ok: false, reason: 'wrong-target' };
    }
    return { ok: true, effects: this.apply(eff) };
  }

  /** 把道具拖到区域上 */
  drop(zoneId, item) {
    const z = this.zone(zoneId);
    if (!z || !this.active(z) || z.action !== 'drop') return { ok: false, reason: 'inactive' };
    if (!this.inv.includes(item)) return { ok: false, reason: 'no-item' };
    const eff = z.accept && z.accept[item];
    if (eff) return { ok: true, effects: this.apply({ take: eff.keep ? [] : [item], ...eff }) };
    const d = (z.denyFor && z.denyFor[item]) || z.deny;
    return { ok: false, reason: 'rejected', effects: d ? this.apply(d) : [] };
  }

  /** 道具栏里把 a 拖到 b 上组合 */
  combine(a, b) {
    const c = (this.level.combines || []).find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!c || !this.inv.includes(a) || !this.inv.includes(b)) return { ok: false };
    return { ok: true, combine: c, effects: this.apply({ ...(c.effect || {}), take: [a, b], give: [c.result], set: [...(c.set || []), ...((c.effect && c.effect.set) || [])] }) };
  }

  /** 当前可用的提示 (按配置顺序第一个满足条件的) */
  hint() {
    return (this.level.hints || []).find((h) => (!h.when || h.when.every((f) => this.flags.has(f))) && (!h.unless || !h.unless.some((f) => this.flags.has(f))) && (!h.needItem || this.inv.includes(h.needItem))) || null;
  }

  /** 枚举当前所有可执行的动作 (verify 与自动测试用) */
  moves(withDeny = false) {
    const out = [];
    for (const z of this.activeZones()) {
      if (z.action === 'drop') {
        for (const it of new Set(this.inv)) {
          if (z.accept && z.accept[it]) out.push({ type: 'drop', zone: z.id, item: it });
          else if (withDeny) {
            // 被拒绝但会改变状态的放置 (比如扣掉道具 / 改 flag)：死局检查也要考虑
            const d = (z.denyFor && z.denyFor[it]) || z.deny;
            if (d && (d.set || d.clear || d.take || d.give || d.end)) out.push({ type: 'drop', zone: z.id, item: it, deny: true });
          }
        }
      } else if (z.action === 'drag') {
        const targets = z.targets ? Object.keys(z.targets) : [z.to];
        for (const to of targets) if (this.active(this.zone(to))) out.push({ type: 'act', zone: z.id, action: 'drag', to });
      } else if (z.effect) out.push({ type: 'act', zone: z.id, action: z.action });
    }
    for (const c of this.level.combines || []) if (this.inv.includes(c.a) && this.inv.includes(c.b) && (c.a !== c.b || this.inv.filter((x) => x === c.a).length > 1)) out.push({ type: 'combine', a: c.a, b: c.b });
    return out;
  }

  perform(m) {
    if (m.type === 'drop') return this.drop(m.zone, m.item);
    if (m.type === 'combine') return this.combine(m.a, m.b);
    return this.act(m.zone, m.action, { to: m.to });
  }
}

/** 广度优先搜索：找到每种结局的最短操作序列 (verify_levels / 自动测试用) */
export function solvePuzzle(level, maxStates = 20000) {
  const start = new PuzzleState(level);
  const seen = new Set([start.key()]);
  const queue = [{ s: start, path: [] }];
  const endings = {};
  const touchedZones = new Set();
  while (queue.length && seen.size < maxStates) {
    const { s, path } = queue.shift();
    for (const m of s.moves()) {
      const n = s.clone();
      const r = n.perform(m);
      if (!r.ok) continue;
      if (m.zone) touchedZones.add(m.zone);
      const p = [...path, m];
      if (n.ended) { if (!endings[n.ended] || endings[n.ended].length > p.length) endings[n.ended] = p; continue; }
      const k = n.key();
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ s: n, path: p });
    }
  }
  return { endings, states: seen.size, touchedZones };
}

/**
 * 死局检查：枚举所有可达状态，找出「再也到不了正经结局」的状态。
 * stuck = 什么都做不了也没结束 (卡死)；winLost = 还能动，但只能走向沙雕结局 / 永远到不了 win (道具被吃掉等)
 */
export function findDeadEnds(level, maxStates = 20000) {
  const start = new PuzzleState(level);
  const nodes = new Map([[start.key(), { s: start, next: [], ended: null, path: [] }]]);
  const queue = [start.key()];
  while (queue.length && nodes.size < maxStates) {
    const k = queue.shift(); const node = nodes.get(k);
    for (const m of node.s.moves(true)) {
      const n = node.s.clone();
      const r = n.perform(m);
      if (!r.ok && !m.deny) continue;
      if (!n.ended && n.key() === k) continue;
      const nk = n.ended ? `END:${n.ended}` : n.key();
      node.next.push(nk);
      if (!nodes.has(nk)) {
        nodes.set(nk, { s: n, next: [], ended: n.ended, path: [...node.path, m] });
        if (!n.ended) queue.push(nk);
      }
    }
  }
  // 反向传播：哪些状态能到 win
  const canWin = new Set(['END:win']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, nd] of nodes) if (!canWin.has(k) && nd.next.some((x) => canWin.has(x))) { canWin.add(k); changed = true; }
  }
  const stuck = []; const winLost = [];
  for (const [k, nd] of nodes) {
    if (nd.ended) continue;
    if (!nd.next.length) stuck.push({ key: k, path: nd.path });
    else if (!canWin.has(k)) winLost.push({ key: k, path: nd.path });
  }
  return { states: nodes.size, stuck, winLost };
}

