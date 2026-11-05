// 第二章《转生成为工位》—— 异世界 × 社畜。坐标为归一化坐标 (见 LevelConfig.js 顶部说明)。

/** 第 6 关：转生成为工位 (找不合理 ×12) */
export const L06 = {
  id: 'L06', type: 'find', title: '转生成为工位', tag: '找不合理 · 12处',
  desc: '被卡车撞了，转生到异世界。睁眼一看：怎么还是要打卡？',
  cast: ['nuonuo', 'zero7'], host: 'nuonuo', sanity: 3,
  layers: [
    { a: 'bg_throne', bg: true },
    { a: 'deliveryDragon', x: 0.5, y: 0.11, s: 0.8 },
    { a: 'banner', x: 0.5, y: 0.25, w: 250, text: '欢迎勇着大人' },
    { a: 'questBoard', x: 0.22, y: 0.4 },
    { a: 'plugTorch', x: 0.78, y: 0.36, cord: [44, 150] },
    { a: 'punchClock', x: 0.074, y: 0.5, s: 0.85 },
    { a: 'subwaySign', x: 0.93, y: 0.2, s: 0.85 },
    { a: 'throne', x: 0.5, y: 0.68 },
    { a: 'excelMonitor', x: 0.5, y: 0.58 },
    { a: 'hourglassUp', x: 0.36, y: 0.537, s: 0.9 },
    { a: 'qrCircle', x: 0.36, y: 0.79, s: 0.8 },
    { a: 'armorStand', x: 0.13, y: 0.9, s: 0.9 },
    { a: 'overtimeChest', x: 0.32, y: 0.985, s: 0.9 },
    { a: 'img', key: 'girl_02', x: 0.78, y: 1.03, h: 250 },
    { a: 'usbSword', x: 0.525, y: 0.93, s: 0.72, rot: 0.06 },
  ],
  spots: [
    { id: 'punch', name: '柱子上的打卡机', c: [0.074, 0.5], r: 0.06, barrage: '转生了还要打卡？？' },
    { id: 'kpi', name: '悬赏板上是 KPI', c: [0.22, 0.4], r: 0.1, barrage: '讨伐史莱姆×300，这是KPI' },
    { id: 'excel', name: '王座上坐着 Excel', c: [0.5, 0.515], r: 0.08, barrage: '国王是一张报表' },
    { id: 'dragon', name: '龙在送外卖', c: [0.5, 0.11], r: 0.08, barrage: '饿了喵，龙骑配送' },
    { id: 'banner', name: '横幅错别字', rect: [0.27, 0.22, 0.45, 0.065], barrage: '勇着大人是谁啊' },
    { id: 'torch', name: '火把插着电', rect: [0.74, 0.28, 0.13, 0.33], barrage: '火把：充电中' },
    { id: 'subway', name: '地铁换乘牌', rect: [0.885, 0.2, 0.1, 0.12], barrage: '异世界通地铁2号线' },
    { id: 'armor', name: '盔甲挂着工牌', rect: [0.05, 0.6, 0.17, 0.3], barrage: '骑士也有工号' },
    { id: 'qr', name: '二维码魔法阵', rect: [0.245, 0.75, 0.225, 0.08], barrage: '扫码召唤，先关注公众号' },
    { id: 'chest', name: '宝箱里是加班券', c: [0.32, 0.93], r: 0.08, barrage: '宝箱开出加班券，血亏' },
    { id: 'sword', name: '圣剑是 USB 接口', c: [0.53, 0.95], r: 0.05, barrage: '圣剑需要驱动程序' },
    { id: 'hourglass', name: '沙漏往上流', c: [0.36, 0.515], r: 0.04, tricky: true, barrage: '时间倒流？不，是在加班' },
  ],
};

/** 第 7 关：史莱姆的报销 (助她脱困：申请经费 → 盖章 → 撒盐 → 擦干净) */
export const L07 = {
  id: 'L07', type: 'puzzle', title: '史莱姆的报销', tag: '助她脱困',
  desc: '苏夜绫被史莱姆吞了一半。盐就在柜子里，可是——经费没批。',
  goal: '把苏夜绫从史莱姆里救出来',
  cast: ['yeling', 'shezhang', 'zero7'], host: 'yeling', sanity: 4,
  introSay: ['yeling', 'stuck'],
  introText: ['shezhang', '柜子里的盐是公物喵。要用？先走报销流程喵。'],
  inventory: [],
  layers: [
    { a: 'bg_guild', bg: true },
    { a: 'banner', x: 0.5, y: 0.075, w: 300, text: '冒险者公会 · 财务部', size: 18, color: '#8fd3b0', ink: '#1f6b4a' },
    { a: 'shelf', x: 0.17, y: 0.33, w: 150 },
    { a: 'potions', x: 0.17, y: 0.322 },
    { a: 'wallClock', x: 0.83, y: 0.34 },
    { a: 'poster', x: 0.5, y: 0.17, w: 120, h: 92, band: '#d3455b', lines: ['报销须知', '1. 不报', '2. 见第1条'], colors: ['#ffffff', INK0(), INK0()], sizes: [13, 13, 13], lh: 22 },
    { a: 'saltCabinet', x: 0.13, y: 0.72, unless: ['approved'] },
    { a: 'saltCabinet', x: 0.13, y: 0.72, open: true, when: ['approved'], unless: ['got_salt'] },
    { a: 'saltCabinet', x: 0.13, y: 0.72, open: true, taken: true, when: ['got_salt'] },
    { a: 'dango', x: 0.77, y: 0.745, s: 1.1, badge: '社长', mood: 'normal', unless: ['invoice_in', 'pickled'] },
    { a: 'dango', x: 0.77, y: 0.745, s: 1.1, badge: '社长', mood: 'happy', when: ['invoice_in'], unless: ['pickled'] },
    { a: 'dango', x: 0.77, y: 0.745, s: 1.1, badge: '腌', mood: 'angry', sweat: true, when: ['pickled'] },
    { a: 'bossDesk', x: 0.78, y: 0.85, unless: ['approved'] },
    { a: 'bossDesk', x: 0.78, y: 0.85, approved: true, when: ['approved'] },
    { a: 'slime', x: 0.37, y: 0.87, unless: ['freed'] },
    { a: 'img', key: 'girl_12', x: 0.37, y: 0.85, h: 235, unless: ['freed'] },
    { a: 'slimeFront', x: 0.37, y: 0.87, unless: ['freed'] },
    { a: 'slime', x: 0.16, y: 0.99, size: 0.35, face: true, when: ['freed'] },
    { a: 'img', key: 'girl_12', x: 0.42, y: 1.04, h: 330, when: ['freed'] },
    { a: 'slimeDrips', x: 0.42, y: 0.62, when: ['freed'], unless: ['clean'] },
    { a: 'sfxText', x: 0.42, y: 0.3, text: '清洁溜溜！', when: ['clean'] },
    { a: 'fileDrawer', x: 0.12, y: 0.985, unless: ['drawer_open'] },
    { a: 'fileDrawer', x: 0.12, y: 0.985, open: true, when: ['drawer_open'], unless: ['got_invoice'] },
    { a: 'fileDrawer', x: 0.12, y: 0.985, open: true, taken: true, when: ['got_invoice'] },
    { a: 'sideTable', x: 0.63, y: 0.985 },
    { a: 'tissueBox', x: 0.63, y: 0.9, unless: ['got_tissue'] },
    { a: 'sfxText', x: 0.75, y: 0.4, text: '被腌入味了喵！', size: 26, stroke: '#f0a23b', when: ['pickled'] },
  ],
  zones: [
    { id: 'cabinet', action: 'tap', c: [0.13, 0.62], r: 0.1, unless: ['approved'],
      effect: { set: ['asked'], say: ['shezhang', 'refuse'], text: ['shezhang', '没批的经费不许动喵！先拿发票来报销。'] } },
    { id: 'salt', action: 'tap', c: [0.13, 0.62], r: 0.1, when: ['approved'], unless: ['got_salt'], effect: { give: ['salt'], set: ['got_salt'], text: ['zero7', '盐，到手。经费流程走了三分钟。'] } },
    { id: 'drawer', action: 'tap', c: [0.12, 0.88], r: 0.08, unless: ['got_invoice'], effect: { give: ['invoice'], set: ['got_invoice', 'drawer_open'], text: ['zero7', '报销柜里还剩一张空白发票。'] } },
    { id: 'boss', action: 'drop', c: [0.77, 0.6], r: 0.1, unless: ['pickled'],
      accept: {
        invoice: { set: ['invoice_in'], text: ['shezhang', '发票收到喵。章在桌上，自己盖喵（爪子短）。'] },
        salt: { set: ['pickled'], text: ['shezhang', '喵？！不要往社长身上撒盐喵！！'], barrage: ['腌制社长', '社长入味了', '这就是报销的代价'], end: 'silly', endDelay: 1800 },
      },
      denyFor: { tissue: { text: ['shezhang', '给社长擦汗喵？……下不为例喵。'] } } },
    { id: 'stamp0', action: 'tap', c: [0.91, 0.69], r: 0.055, unless: ['invoice_in'], effect: { text: ['shezhang', '没有发票盖什么章喵！'] } },
    { id: 'stamp', action: 'hold', c: [0.91, 0.69], r: 0.055, when: ['invoice_in'], unless: ['approved'],
      teach: ['shezhang', '盖章要用力按住喵！'],
      effect: { set: ['approved'], say: ['shezhang', 'approve'], barrage: ['盖章！', '经费批下来了'] } },
    { id: 'slime', action: 'drop', c: [0.37, 0.75], r: 0.15, unless: ['freed'],
      accept: { salt: { set: ['freed'], say: ['yeling', 'step'], text: ['zero7', '史莱姆脱水缩小了。人出来了，但是一身黏液。'], barrage: ['盐 克 史莱姆', '缩水了'] } },
      denyFor: { invoice: { text: ['zero7', '史莱姆把发票吃了。……还好是复印件。'] }, tissue: { penalty: true, text: ['zero7', '纸巾瞬间被吸干。浪费公物，记一笔。'] } } },
    { id: 'yeling', action: 'tap', rect: [0.25, 0.5, 0.24, 0.13], unless: ['freed'], effect: { say: ['yeling', 'stuck'] } },
    { id: 'tissue', action: 'tap', c: [0.63, 0.86], r: 0.055, unless: ['got_tissue'], effect: { give: ['tissue'], set: ['got_tissue'] } },
    { id: 'wipe0', action: 'swipe', rect: [0.25, 0.5, 0.34, 0.4], when: ['freed'], unless: ['got_tissue'], teach: ['yeling', '别、别用手碰！拿纸巾来擦！'], effect: { text: ['yeling', '别用手！好恶心！拿纸巾来啦！'] } },
    { id: 'wipe', action: 'swipe', rect: [0.25, 0.5, 0.34, 0.4], when: ['freed', 'got_tissue'], unless: ['clean'],
      teach: ['zero7', '拿着纸巾，在她身上划几下擦干净。'],
      effect: { set: ['clean'], take: ['tissue'], say: ['yeling', 'win'], barrage: ['擦干净了', '大小姐：吾是故意的'], end: 'win', endDelay: 1800 } },
  ],
  hints: [
    { unless: ['asked', 'approved'], zone: 'cabinet', text: '盐在左边柜子里。先点一下试试。' },
    { unless: ['got_invoice'], zone: 'drawer', text: '左下的报销柜里有发票。' },
    { unless: ['invoice_in'], zone: 'boss', item: 'invoice', text: '把发票拖给社长。' },
    { unless: ['approved'], zone: 'stamp', text: '社长桌上的印章，长按盖下去。' },
    { unless: ['got_salt'], zone: 'salt', text: '柜子开了，拿盐。' },
    { unless: ['freed'], zone: 'slime', item: 'salt', text: '把盐撒在史莱姆身上。' },
    { unless: ['got_tissue'], zone: 'tissue', text: '小桌上有纸巾。' },
    { zone: 'wipe', text: '在苏夜绫身上划几下，擦干净。' },
  ],
  ending: { who: 'yeling', quote: '吾是故意被吞的，为了调查史莱姆！', recap: ['拿发票找社长报销', '长按盖章，经费批了', '盐撒向史莱姆', '纸巾擦干净'] },
  silly: { who: 'shezhang', pose: 'angry', badge: '腌制社长', quote: '这笔精神损失费要报销喵！' },
};

// —— 第 8 关的招牌字：按招牌摆放生成每个字的热区 ——
const SIGN_CW = 40;
function signChars(cx, cy, chars, { cw = SIGN_CW, s = 1, good = {}, sign = '' } = {}) {
  const w = (chars.length * cw + 24) * s;
  return chars.map((c, i) => {
    const x = cx + (-w / 2 + (12 + cw / 2 + i * cw) * s) / 540;
    return { c, x, y: cy, r: (cw * s * 0.5) / 540, good: !!good[c], sign };
  });
}
const SPELL = '星光加班变身';
const slotTo = (c) => [140 + SPELL.indexOf(c) * 52, 167];
function charZone(p) {
  if (p.good) {
    return { id: `c_${p.c}`, action: 'tap', c: [p.x, p.y], r: Math.max(0.035, p.r), unless: [`w_${p.c}`],
      effect: { set: [`w_${p.c}`], fly: { glyph: p.c, to: slotTo(p.c) }, float: `「${p.c}」` } };
  }
  return { id: `x_${p.c}${p.sign}`, action: 'tap', c: [p.x, p.y], r: Math.max(0.035, p.r),
    effect: { penalty: true, barrage: `星光${p.c}${p.c}变身？？` } };
}
const SIGN1 = signChars(0.21, 0.29, ['星', '光', '便', '利', '店'], { cw: 36, good: { 星: 1, 光: 1 }, sign: 'a' });
const SIGN2 = signChars(0.83, 0.25, ['健', '身', '房'], { cw: 40, good: { 身: 1 }, sign: 'b' });
const SIGN3 = signChars(0.74, 0.47, ['旧', '书', '架'], { cw: 36, sign: 'c' });
const SIGN3B = signChars(0.74, 0.47, ['旧', '书', '加', '木'], { cw: 36, good: { 加: 1 }, sign: 'd' });

/** 第 8 关：变身咒语拼错了 (文字拼字：从招牌里凑咒语) */
export const L08 = {
  id: 'L08', type: 'word', title: '变身咒语拼错了', tag: '文字拼字',
  desc: '魔法少女要变身，咒语卡片却弄丢了。好在这条街上，招牌、箱子、工牌上的字凑一凑就够。',
  goal: '从招牌上凑齐「星光加班变身」',
  cast: ['zero7', 'shezhang'], host: 'nuonuo', sanity: 4, introSay: ['zero7', 'intro'],
  introText: ['zero7', '咒语就六个字：星光加班变身。按顺序无所谓，点错字要扣理智。'],
  inventory: [],
  layers: [
    { a: 'bg_nightstreet', bg: true },
    { a: 'shopSign', x: 0.21, y: 0.29, chars: ['星', '光', '便', '利', '店'], cw: 36, picked: ['星', '光'], glow: '#ffb3d1' },
    { a: 'shopSign', x: 0.83, y: 0.25, chars: ['健', '身', '房'], cw: 40, picked: ['身'], bgc: '#1f4e79', glow: '#7cf0ff', color: '#ffffff', ink: '#2b6fd6' },
    { a: 'shopSign', x: 0.74, y: 0.47, chars: ['旧', '书', '架'], cw: 36, bgc: '#6b3e26', glow: '#ffcf5a', color: '#fff3d6', ink: '#7a3b16', unless: ['split'] },
    { a: 'shopSign', x: 0.74, y: 0.47, chars: ['旧', '书', '加', '木'], cw: 36, picked: ['加'], bgc: '#6b3e26', glow: '#ffcf5a', color: '#fff3d6', ink: '#7a3b16', when: ['split'] },
    { a: 'transformerBox', x: 0.11, y: 0.74 },
    { a: 'dango', x: 0.885, y: 0.75, s: 0.9, badge: '值班', unless: ['w_班'] },
    { a: 'dango', x: 0.885, y: 0.75, s: 0.9, badge: '值', mood: 'angry', when: ['w_班'] },
    { a: 'img', key: 'girl_06', x: 0.47, y: 1.03, h: 285, unless: ['transformed', 'overtime'] },
    { a: 'focusLines', bg: true, cx: 0.5, cy: 0.7, color: 'rgba(255,230,255,0.7)', when: ['transformed'] },
    { a: 'img', key: 'girl_06', x: 0.5, y: 1.03, h: 360, when: ['transformed'] },
    { a: 'sfxText', x: 0.5, y: 0.5, text: '星光加班变身！', size: 34, stroke: '#8b5cf6', when: ['transformed'] },
    { a: 'img', key: 'girl_06', x: 0.5, y: 1.06, h: 300, rot: -0.1, when: ['overtime'] },
    { a: 'sfxText', x: 0.5, y: 0.52, text: '变身成功：加班狗', size: 30, stroke: '#7d7896', when: ['overtime'] },
    { a: 'spellBar', x: 0.5, y: 0.09 },
  ],
  zones: [
    ...SIGN1.map(charZone),
    ...SIGN2.map(charZone),
    ...SIGN3.map((p) => (p.c === '架'
      ? { id: 'c_架', action: 'hold', c: [p.x, p.y], r: 0.04, unless: ['split'], teach: ['zero7', '「架」里藏着一个字。按住它，拆开看看。'],
        effect: { set: ['split'], text: ['zero7', '架 = 加 + 木。拆出来了。'], barrage: ['拆字大法', '架 → 加 + 木'] } }
      : { ...charZone(p), unless: ['split'] })),
    ...SIGN3B.filter((p) => p.c !== '旧' && p.c !== '书').map((p) => ({ ...charZone(p), when: ['split'] })),
    ...SIGN3B.filter((p) => p.c === '旧' || p.c === '书').map((p) => ({ ...charZone(p), id: `x_${p.c}d`, when: ['split'] })),
    { id: 'c_变', action: 'tap', c: [0.07, 0.698], r: 0.04, unless: ['w_变'], effect: { set: ['w_变'], fly: { glyph: '变', to: slotTo('变') }, float: '「变」' } },
    { id: 'x_电', action: 'tap', c: [0.14, 0.698], r: 0.035, effect: { penalty: true, barrage: '星光电电变身？？' } },
    { id: 'c_班', action: 'tap', c: [0.84, 0.76], r: 0.045, unless: ['w_班'], effect: { set: ['w_班'], fly: { glyph: '班', to: slotTo('班') }, say: ['shezhang', 'refuse'], text: ['shezhang', '喵！工牌上的字不许抠喵！'] } },
    { id: 'girl_early', action: 'tap', rect: [0.27, 0.66, 0.4, 0.3], unless: ['w_星'], effect: { text: ['zero7', '咒语还一个字都没凑齐呢。'] } },
    // 咒语没齐就点她：先警告一次，再点才进沙雕结局 (不让玩家「点一下看看」就意外结束)
    { id: 'girl_warn', action: 'tap', rect: [0.27, 0.66, 0.4, 0.3], when: ['w_星'], unless: ['spell_done', 'warned'],
      effect: { set: ['warned'], text: ['zero7', '咒语还没齐，现在念会出事的。真要念就再点一次。'] } },
    { id: 'girl_silly', action: 'tap', rect: [0.27, 0.66, 0.4, 0.3], when: ['w_星', 'warned'], unless: ['spell_done', 'overtime'],
      effect: { set: ['overtime'], text: ['zero7', '咒语没凑齐就念……变身成「加班狗」了。'], barrage: ['变身失败', '加 班 狗', '咒语念错的下场'], end: 'silly', endDelay: 1800 } },
    { id: 'girl_win', action: 'tap', rect: [0.27, 0.66, 0.4, 0.3], when: ['spell_done'], unless: ['transformed'],
      effect: { set: ['transformed'], barrage: ['星光加班变身！', '变身BGM响起', '魔法少女也要加班'], text: ['zero7', '变身完成。……为什么咒语里有「加班」？'], end: 'win', endDelay: 2000 } },
  ],
  rules: [{ if: [...SPELL].map((c) => `w_${c}`), unless: ['spell_done'], then: { set: ['spell_done'], text: ['zero7', '咒语齐了。点她，念出来。'], float: '咒语集齐！' } }],
  hints: [
    { unless: ['w_星'], zone: 'c_星', text: '左边便利店招牌：星光便利店。' },
    { unless: ['w_光'], zone: 'c_光', text: '「光」也在便利店招牌上。' },
    { unless: ['w_身'], zone: 'c_身', text: '右上健身房的「身」。' },
    { unless: ['w_变'], zone: 'c_变', text: '左下变电箱上写着「变」。' },
    { unless: ['split'], zone: 'c_架', text: '「加」藏在书店招牌的「架」里，长按拆开。' },
    { unless: ['w_加'], zone: 'c_加', text: '拆出来的「加」，点它。' },
    { unless: ['w_班'], zone: 'c_班', text: '社长工牌上写着「值班」。' },
    { zone: 'girl_win', text: '咒语齐了，点魔法少女念咒。' },
  ],
  ending: { who: 'zero7', quote: '变身完成。加班费另算。', recap: ['星光：便利店招牌', '加：从「架」里拆出', '班：社长工牌', '变：变电箱 / 身：健身房'] },
  silly: { who: 'zero7', badge: '变身：加班狗', quote: '咒语没念全，后果自负。' },
};

/** 第 9 关：零七的加班夜 (找不合理 ×10) */
export const L09 = {
  id: 'L09', type: 'find', title: '零七的加班夜', tag: '找不合理 · 10处',
  desc: '深夜十一点，零七还在改第 18 版 PPT。办公室里怪事越来越多。',
  cast: ['nuonuo', 'zero7'], host: 'nuonuo', sanity: 3,
  introSay: ['zero7', 'intro'],
  layers: [
    { a: 'bg_office', bg: true },
    { a: 'squareMoon', x: 0.2, y: 0.13 },
    { a: 'dayReflection', x: 0.62, y: 0.2 },
    { a: 'clock13', x: 0.1, y: 0.56 },
    { a: 'exitSign', x: 0.36, y: 0.53 },
    { a: 'calendarFeb30', x: 0.88, y: 0.56 },
    { a: 'waterDispenser', x: 0.1, y: 0.96 },
    { a: 'zero7', x: 0.52, y: 0.86, h: 250, holo: false },
    { a: 'officeDesk', x: 0.5, y: 0.95, w: 330 },
    { a: 'backMonitor', x: 0.3, y: 0.79 },
    { a: 'mug', x: 0.6, y: 0.79, label: '第8杯' },
    { a: 'headphoneCactus', x: 0.72, y: 0.79 },
    { a: 'stickyNote', x: 0.5, y: 0.875 },
    { a: 'copierCopier', x: 0.84, y: 0.975 },
  ],
  spots: [
    { id: 'moon', name: '方形的月亮', c: [0.2, 0.13], r: 0.06, barrage: '月亮也被做成了方块' },
    { id: 'clock', name: '13 点的钟', c: [0.1, 0.56], r: 0.065, barrage: '一天有13个小时？' },
    { id: 'exit', name: '出口小人往回跑', c: [0.36, 0.53], r: 0.085, barrage: '安全出口：不准走' },
    { id: 'calendar', name: '2 月 30 日', c: [0.88, 0.56], r: 0.07, barrage: '2月30日星期八' },
    { id: 'monitor', name: '显示器背面也有画面', c: [0.3, 0.73], r: 0.1, barrage: '双面屏，背面也要赋能' },
    { id: 'cactus', name: '仙人掌戴耳机', c: [0.72, 0.745], r: 0.055, barrage: '仙人掌在听摸鱼歌单' },
    { id: 'sticky', name: '加班 25 小时', c: [0.5, 0.875], r: 0.06, barrage: '一天加班25小时' },
    { id: 'copier', name: '复印机复印复印机', rect: [0.74, 0.8, 0.26, 0.17], barrage: '套娃复印' },
    { id: 'water', name: '气泡往下沉', rect: [0.03, 0.66, 0.15, 0.3], barrage: '饮水机反重力' },
    { id: 'reflection', name: '窗上倒影是白天', rect: [0.53, 0.11, 0.18, 0.18], tricky: true, barrage: '倒影还停在白天' },
  ],
  egg: { id: 'mug', name: '第 8 杯咖啡', c: [0.6, 0.765], r: 0.036, barrage: '第8杯了零七姐…' },
};

function INK0() { return '#4a3656'; }
