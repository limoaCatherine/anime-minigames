// 被动道具：8 种，每种 Lv1~Lv5。数值是「累计值」(第 n 级的总加成)，百分比之间加算，再乘到武器面板上。
export const PASSIVES = {
  starGem:        { name: '星辉宝石', icon: 'gem', color: '#ff7ad9', desc: '伤害提高', stat: 'might',    levels: [0.08, 0.16, 0.24, 0.32, 0.40], fmt: (v) => `伤害 +${Math.round(v * 100)}%` },
  rabbitWatch:    { name: '兔子怀表', icon: 'watch', color: '#ffd23f', desc: '武器冷却缩短', stat: 'cooldown', levels: [0.06, 0.12, 0.18, 0.24, 0.30], fmt: (v) => `冷却 -${Math.round(v * 100)}%` },
  magicTome:      { name: '魔导书', icon: 'book', color: '#8f7cff', desc: '攻击范围 / 子弹变大', stat: 'area',     levels: [0.10, 0.20, 0.30, 0.40, 0.50], fmt: (v) => `范围 +${Math.round(v * 100)}%` },
  twinPin:        { name: '双子发饰', icon: 'pin', color: '#6fd6ff', desc: '子弹 / 召唤物更多、持续更久', stat: 'amount',
    levels: [{ amount: 0, duration: 0.1 }, { amount: 1, duration: 0.1 }, { amount: 1, duration: 0.2 }, { amount: 1, duration: 0.3 }, { amount: 2, duration: 0.3 }],
    fmt: (v) => `数量 +${v.amount}，持续 +${Math.round(v.duration * 100)}%` },
  catBell:        { name: '猫铃铛', icon: 'bell', color: '#ffb000', desc: '拾取范围变大', stat: 'magnet',   levels: [0.25, 0.50, 0.75, 1.00, 1.25], fmt: (v) => `拾取范围 +${Math.round(v * 100)}%` },
  strawberryCake: { name: '草莓蛋糕', icon: 'cake', color: '#ff5d7e', desc: '最大 HP 和回血', stat: 'vitality',
    levels: [{ hp: 15, regen: 0.2 }, { hp: 30, regen: 0.4 }, { hp: 45, regen: 0.6 }, { hp: 60, regen: 0.8 }, { hp: 75, regen: 1.0 }],
    fmt: (v) => `最大 HP +${v.hp}，每秒回 ${v.regen}` },
  featherBoots:   { name: '羽翼靴', icon: 'boots', color: '#5ccf8a', desc: '跑得更快', stat: 'speed',    levels: [0.06, 0.12, 0.18, 0.24, 0.30], fmt: (v) => `移速 +${Math.round(v * 100)}%` },
  starCape:       { name: '星纱披风', icon: 'cape', color: '#b6a6ff', desc: '受伤减免 + 无敌时间', stat: 'guard',
    levels: [{ armor: 1, iframe: 0.05 }, { armor: 2, iframe: 0.1 }, { armor: 3, iframe: 0.15 }, { armor: 4, iframe: 0.2 }, { armor: 5, iframe: 0.25 }],
    fmt: (v) => `受伤 -${v.armor}，无敌 +${v.iframe}s` },
};

export const PASSIVE_IDS = Object.keys(PASSIVES);
export const MAX_PASSIVE_LEVEL = 5;
