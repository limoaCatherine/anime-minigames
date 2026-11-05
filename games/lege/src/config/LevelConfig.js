// 关卡配置 v3：15 关难度曲线 + 每日挑战。
//
// 每关 = 图案 (PatternLibrary 中的形状遮罩) + 错位方式 (mode) + 难度参数：
//   pattern   形状：pyramid 金字塔 / heart 爱心 / diamond 菱形 / cross 十字 / butterfly 蝴蝶 / ring 甜甜圈 / cat 猫猫脸 /
//             star 星星 / bunny 兔耳朵 / crown 皇冠 / moon 月牙 / staircase 阶梯 / xshape X 字 / spiral 回字漩涡 / towers 高塔 / blob 散落 / flower 樱花
//   mode      half 半张错位 / quarter 1/4 错位 / diagonal 斜向堆叠 / brick 砖墙错位 / tower 高塔叠放 / scatter 随机散落
//   layers    层数；shrink 每往上一层形状缩小的比例 (金字塔式收顶)；fill 卡牌 4 个采样点至少几个在形状内
//   maxCards  目标总张数 (含牌堆)。未写 scale 时自动选择图案缩放比例，使张数刚好够用；多余的优先去掉被完全盖住的底层卡
//   scale     (可选) 手动指定图案整体缩放 0.4~1
//   types     使用的卡牌种类数 (取 CardConfig 前 N 种；每种张数都是 3 的倍数)
//   maxHold   生成"参考解"时卡槽最多滞留几张 (1~6)。7 - maxHold = 参考解留给玩家的空格数，越小越难
//   pNew      参考解中"开启新花色"的概率 (0~1)，越大越难
//   piles     侧边牌堆 [{ side:'left'|'right', count }]，只有最上面一张可点
//   verify    'greedy' = 生成后必须能被贪心玩家通关 (新手关)；'reference' = 只保证存在参考解
//   tier      难度档位 (见 TIERS)；boss: true 为难度尖峰关 (每 5 关一次)
//
// 也兼容 v1 的"手绘层"写法：layers: [{ ox, oy, rows: ['XX.X', ...] }, ...]
export const TIERS = {
  easy:      { name: '简单', color: '#5ccf8a' },
  normal:    { name: '普通', color: '#4dabf7' },
  hard:      { name: '困难', color: '#ff922b' },
  nightmare: { name: '噩梦', color: '#9b5de5' },
  hell:      { name: '地狱', color: '#e63946' },
};

const L = (id, title, o) => ({ id, name: `第 ${id} 关`, title, verify: 'reference', piles: [], ...o });

export const LEVELS = [
  L(1,  '先叠个三角', { tier: 'easy', pattern: 'pyramid', mode: 'half', layers: 3, types: 3, maxCards: 27, maxHold: 3, pNew: 0.2, verify: 'greedy' }),
  L(2,  '告白信',   { tier: 'easy', pattern: 'heart', mode: 'half', layers: 3, types: 4, maxCards: 36, maxHold: 3, pNew: 0.3, verify: 'greedy' }),
  L(3,  '菱形饼干',   { tier: 'easy', pattern: 'diamond', mode: 'quarter', layers: 3, types: 5, maxCards: 45, maxHold: 4, pNew: 0.3 }),
  L(4,  '甜甜圈',     { tier: 'normal', pattern: 'ring', mode: 'diagonal', layers: 3, shrink: 0, types: 6, maxCards: 63, maxHold: 4, pNew: 0.6 }),
  // 第 5 关是第一个 BOSS：难度明显上一个台阶 (贪心约 20%)，但不是 v2 那种 3% 的"劝退墙"；真正的地狱留给第 10 / 15 关
  L(5,  '花蝴蝶来了',   { tier: 'hard', boss: true, pattern: 'butterfly', mode: 'half', layers: 6, types: 8, maxCards: 96, maxHold: 5, pNew: 0.55,
    piles: [{ side: 'left', count: 6 }, { side: 'right', count: 6 }] }),
  L(6,  '十字路口',   { tier: 'normal', pattern: 'cross', mode: 'brick', layers: 5, types: 6, maxCards: 66, maxHold: 4, pNew: 0.28 }),
  L(7,  '猫在看你',     { tier: 'normal', pattern: 'cat', mode: 'half', layers: 5, types: 7, maxCards: 72, maxHold: 5, pNew: 0.55,
    piles: [{ side: 'left', count: 6 }, { side: 'right', count: 6 }] }),
  L(8,  '兔耳朵',   { tier: 'hard', pattern: 'bunny', mode: 'brick', layers: 6, types: 8, maxCards: 96, maxHold: 5, pNew: 0.4,
    piles: [{ side: 'left', count: 6 }, { side: 'right', count: 6 }] }),
  L(9,  '一闪一闪',   { tier: 'hard', pattern: 'star', mode: 'half', layers: 5, fill: 2, types: 7, maxCards: 84, maxHold: 5, pNew: 0.38 }),
  L(10, '女王驾到', { tier: 'hell', boss: true, pattern: 'crown', mode: 'half', layers: 7, types: 12, maxCards: 150, maxHold: 6, pNew: 0.74,
    piles: [{ side: 'left', count: 12 }, { side: 'right', count: 12 }] }),
  L(11, '半个月亮',   { tier: 'hard', pattern: 'moon', mode: 'quarter', layers: 7, types: 7, maxCards: 123, maxHold: 4, pNew: 0.45 }),
  L(12, '楼梯别踩空',   { tier: 'nightmare', pattern: 'staircase', mode: 'diagonal', layers: 6, types: 8, maxCards: 102, maxHold: 4, pNew: 0.45 }),
  L(13, '打个叉',   { tier: 'nightmare', pattern: 'xshape', mode: 'half', layers: 7, types: 9, maxCards: 111, maxHold: 5, pNew: 0.55,
    piles: [{ side: 'left', count: 8 }, { side: 'right', count: 8 }] }),
  L(14, '叠罗汉',   { tier: 'nightmare', pattern: 'towers', mode: 'tower', layers: 9, types: 14, maxCards: 135, maxHold: 6, pNew: 0.78, towerStep: 2.5, towerFalloff: 3.5,
    piles: [{ side: 'left', count: 9 }, { side: 'right', count: 9 }] }),
  L(15, '樱花暴风雪', { tier: 'hell', boss: true, pattern: 'blob', mode: 'scatter', layers: 8, perLayer: 22, types: 14, maxCards: 168, maxHold: 6, pNew: 0.76,
    piles: [{ side: 'left', count: 12 }, { side: 'right', count: 12 }] }),
];

// 每日挑战：按日期作为随机种子生成 (同一天所有人布局与花色相同)，图案按星期轮换
const DAILY_PATTERNS = ['flower', 'heart', 'star', 'cat', 'butterfly', 'bunny', 'crown'];
export const DAILY_LEVEL = {
  id: 'daily',
  name: '每日挑战',
  title: '今日份',
  tier: 'hard',
  pattern: 'flower',
  mode: 'half',
  layers: 5,
 
  types: 8,
  maxCards: 84,
  maxHold: 5,
  pNew: 0.55,
  verify: 'reference',
  piles: [{ side: 'left', count: 6 }, { side: 'right', count: 6 }],
};

export function getDailyLevel(d = new Date()) {
  return { ...DAILY_LEVEL, pattern: DAILY_PATTERNS[d.getDay() % DAILY_PATTERNS.length] };
}

export function getLevel(id) {
  if (id === 'daily') return getDailyLevel();
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

export function tierOf(level) {
  return TIERS[level.tier] || TIERS.normal;
}

/** 每关的标签文字，如「简单」「BOSS·地狱」 */
export function levelTag(level) {
  const t = tierOf(level).name;
  return level.boss ? `BOSS·${t}` : t;
}

export const MAX_LEVEL = LEVELS.length;
