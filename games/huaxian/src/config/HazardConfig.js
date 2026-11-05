// 危险物 (敌人) 类型表：每种类型的默认参数。关卡里的 hazards 条目会覆盖这里的同名字段。
// 新增敌人类型：在这里加一项默认参数 + 在 src/entities/ 写实体类 + 在 HazardSystem 的 FACTORY 注册。
export const HAZARD_TYPES = {
  // 蜂巢：生存计时开始后陆续放出蜜蜂
  hive: {
    name: '蜂巢',
    image: 'enemy_hive',
    drawW: 104,             // 绘制宽度 (高度按图片比例)
    count: 24,              // 蜜蜂数量
    delay: 0.2,             // 计时开始后多久开始放蜂 (秒)
    interval: 0.06,         // 两只蜜蜂的间隔 (秒)
    holeX: 0, holeY: 0.15,   // 洞口相对巢体中心的偏移 (占绘制宽/高比例)
  },
  bee: {
    name: '蜜蜂',
    image: 'enemy_bee',
    radius: 11,
    drawW: 34,
    speed: 4.4,             // 最大速度 (像素/物理步)
    steer: 0.065,           // 转向灵敏度 (0~1)
    jitter: 0.55,           // 随机抖动
    spread: 40,             // 目标点在主角周围的散布
    density: 0.0007,
    restitution: 0.7,
    recoil: 0.35,           // 撞线后后退的时间 (秒)：避免蜂群把线推着走
  },
  // 加班老板：走向主角，并定时扔出一叠文件
  boss: {
    name: '加班老板',
    image: 'enemy_boss',
    bodyW: 62, bodyH: 98,
    drawH: 132,
    density: 0.0035,
    walkSpeed: 1.3,         // 行走速度 (像素/物理步)
    walkForce: 0.001,       // 推力 (乘以质量)
    walk: true,             // 是否走向主角
    throwEvery: 1.7,        // 扔文件间隔 (秒)，0 = 不扔
    throwDelay: 0.8,
    flight: 1.0,            // 抛物线飞行时间 (秒)
    lines: ['今晚加班！', '方案再改改！', '周末来一下~', '这个需求很简单！'],
  },
  // 催婚亲戚：从天而降 / 从侧面走入，抛出爱心照片
  auntie: {
    name: '催婚亲戚',
    image: 'enemy_auntie',
    bodyW: 64, bodyH: 100,
    drawH: 132,
    density: 0.003,
    entry: 'stand',         // stand | drop (从屏幕上方落下) | walk (从屏幕外走入)
    walkSpeed: 0.9,
    walkForce: 0.0012,
    walk: false,            // 落地后是否继续走向主角
    stopX: null,            // entry=walk 时走到哪里停下
    throwEvery: 1.9,
    throwDelay: 1.0,
    flight: 1.25,
    lines: ['什么时候结婚呀？', '这小伙子不错！', '去相亲吧~', '阿姨给你介绍！'],
  },
  // 落石：按时间表从上方掉落
  rockfall: {
    name: '落石',
    radius: 22,
    times: [2, 5, 8],       // 掉落时刻 (秒)
    x: 270,                 // 掉落 x，可为数组 (与 times 一一对应)
    y: -40,
    density: 0.004,
  },
  // 滚石：按时间表从某点滚出
  roller: {
    name: '滚石',
    radius: 26,
    times: [1.5, 6],
    x: 30, y: 300,
    vx: 4,                  // 初速度 (像素/物理步)
    density: 0.004,
  },
  // 投射物 (由老板/亲戚生成)
  paper: { name: '加班文件', w: 24, h: 18, density: 0.0015, life: 6 },
  heart: { name: '爱心照片', radius: 13, density: 0.0012, life: 6 },
};

export function hazardDef(type, overrides = {}) {
  const base = HAZARD_TYPES[type];
  if (!base) throw new Error(`[HazardConfig] 未知的危险物类型: ${type}`);
  return { type, ...base, ...overrides };
}
