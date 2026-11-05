// 可选角色：基础属性按基准值的百分比修正；每人一把专属初始武器 + 一个专属被动。
// 专属被动的效果全部写成数据 (effect)，由 PlayerSystem 统一读取。
// unlock: default 默认 | coins 花星屑币 | clears 通关次数 | noxKills 击败诺克丝次数
export const CHARACTER_BASE = {
  hp: 100,
  speed: 128,          // px/s
  pickup: 72,          // 拾取半径
  armor: 0,            // 每次受伤固定减免
  iframe: 0.5,         // 受击后无敌秒数
  radius: 15,          // 碰撞半径
  crit: 0.05,          // 基础暴击率
  critMul: 1.5,
};

export const CHARACTERS = [
  {
    id: 'hikari', name: '星野 光', title: '新人魔法少女', color: '#b57bff',
    avatar: 'char_hikari_avatar', card: 'char_hikari_card',
    intro: '入职第三天的魔法少女，咒语还背不全，胆子倒是挺大。',
    weapon: 'starWand',
    passive: { name: '越战越勇', desc: '每升 1 级，伤害 +1%（最多 +10%）', effect: { mightPerLevel: 0.01, mightPerLevelMax: 0.1 } },
    hp: 1.0, speed: 1.0, pickup: 1.0, armor: 0,
    unlock: { type: 'default' },
  },
  {
    id: 'kanon', name: '星川 歌音', title: '梦里开演唱会的偶像', color: '#36c6e8',
    avatar: 'char_kanon_avatar', card: 'char_kanon_card',
    intro: '梦想是在每个人的梦里都开一场演唱会，噩梦也得乖乖听歌。',
    weapon: 'chainSpark',
    passive: { name: '返场', desc: '全部武器冷却 -5%；每次升级后 3 秒内移速 +20%', effect: { cooldown: 0.05, levelUpHaste: 0.2, levelUpHasteTime: 3 } },
    hp: 0.9, speed: 1.03, pickup: 1.0, armor: 0,
    unlock: { type: 'coins', cost: 600 },
  },
  {
    id: 'rinne', name: '稻荷 铃音', title: '稻荷神社的巫女', color: '#e85a5a',
    avatar: 'char_rinne_avatar', card: 'char_rinne_card',
    intro: '说话客客气气的，结界倒是从来没漏过一只怪。',
    weapon: 'talisman',
    passive: { name: '狐火护身', desc: '每 16 秒得 1 层护盾；伤害 +10%，持续时间 +20%', effect: { shieldEvery: 16, shieldMax: 1, might: 0.1, duration: 0.2 } },
    hp: 1.0, speed: 1.0, pickup: 1.3, armor: 0,
    unlock: { type: 'clears', count: 1, text: '通关 1 次（撑到黎明）' },
  },
  {
    id: 'momo', name: '桃濑 萌', title: '偶像练习生', color: '#ff8fc7',
    avatar: 'char_momo_avatar', card: 'char_momo_card',
    intro: '练习生第 2 年，丢应援爱心比唱歌还准。',
    weapon: 'heartRang',
    passive: { name: '粉丝福利', desc: '拾取范围 +30%，星屑币 +15%', effect: { magnet: 0.3, coinGain: 0.15 } },
    hp: 1.0, speed: 1.02, pickup: 1.0, armor: 0,
    unlock: { type: 'coins', cost: 800 },
  },
  {
    id: 'tsukimi', name: '月见 雪乃', title: '月宫的小公主', color: '#a99cff',
    avatar: 'char_tsukimi_avatar', card: 'char_tsukimi_card',
    intro: '说话慢吞吞的，冻住的怪会被她轻轻敲碎。',
    weapon: 'frostPrism',
    passive: { name: '寒月', desc: '对冻结或减速中的敌人伤害 +25%', effect: { chilledBonus: 0.25 } },
    hp: 1.0, speed: 1.0, pickup: 1.0, armor: 0,
    unlock: { type: 'coins', cost: 1000 },
  },
  {
    id: 'regina', name: '蕾吉娜', title: '天空女王', color: '#ffd23f',
    avatar: 'char_regina_avatar', card: 'char_regina_card',
    intro: '自称噩梦的天敌，其实只是起床气很大。',
    weapon: 'meteor',
    passive: { name: '女王威仪', desc: '攻击范围 +6%，护甲 +1', effect: { area: 0.06, armor: 1 } },
    hp: 1.0, speed: 0.94, pickup: 1.0, armor: 0,
    unlock: { type: 'noxKills', count: 1, text: '击败梦魇女王 1 次', altCost: 1500 },
  },
];

export const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
