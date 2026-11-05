// 关卡数据 (数据驱动)：40 个手工关卡，分 4 章 (见 ChapterConfig.js)。
//
// 每关字段：
//   id, name, tip              编号、关卡名、开局提示
//   heroine: {x, y}            主角脚底中心位置
//   terrain: [...]             地形 (rect / poly / spikes，见 TerrainSystem.js)
//   hazards: [...]             危险物 (type + 覆盖 HazardConfig 默认值的参数)
//   mechanisms: [...]          机关 (platform / seesaw / crate / portal / spring / glass / windmill / nodraw，见 MechanismConfig.js)
//   time                       需要坚持的秒数 (默认 10)
//   solution: [[x,y],...]      参考解法折线 (提示功能显示它；自动化测试用它验证关卡可解)
//   ink / inkFactor            墨水上限 (像素长度)，默认 = 解法长度 × inkFactorFor(id) (1.3：约 1.6 → 1.45 倍)
//   clearance                  三星要求线离她的最小距离 (px)；默认 = 参考解法间距 × 0.65 (≤ 40)，第 1~3 关为 0
//   stars / starFactor         三星 / 二星的用墨上限，默认 = 解法长度 × GameConfig.stars.three / two (且不超过墨水的 80% / 92%)
//   1.3 设计原则：第 4 关起每关都有一个专门的点子 (盖坑口 / 堵门 / 卡住老板 / 托住塌陷的地板…)，
//   参考解法很短，墨水只有它的 ~1.5 倍，随手画一个包住主角的大罩子会墨水不够或者挡不住。
//
// 坐标系：逻辑分辨率 540×960，左上角为原点；顶部 112 像素是 HUD，不能画线。
import { GameConfig } from './GameConfig.js';

const G = 820; // 标准地面高度

// ---------- 编写关卡用的小工具 ----------
const floor = (y = G, x = 0, w = 540) => ({ type: 'rect', x, y, w, h: 960 - y + 40 });
const block = (x, y, w, h) => ({ type: 'rect', x, y, w, h });
const plat = (x, y, w, h = 28) => ({ type: 'rect', x, y, w, h });
const slope = (x1, y1, x2, y2, bottom) => ({ type: 'poly', points: [[x1, y1], [x2, y2], [x2, bottom], [x1, bottom]] });
const spikes = (x, y, w, h = 22) => ({ type: 'spikes', x, y, w, h });
const island = (x, y, w, h = 36) => ({ type: 'rect', x, y, w, h, style: 'island' });
/** 台阶：从 (x, y) 开始，每级宽 sw、高 sh，共 n 级；dir = 1 向右下降，-1 向左下降。每级是一根落地的柱子 */
function stairs(x, y, sw, sh, n, dir = 1, bottom = 960) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const top = y + i * sh;
    out.push({ type: 'rect', x: dir > 0 ? x + i * sw : x - (i + 1) * sw, y: top, w: sw + 1, h: bottom - top });
  }
  return out;
}

// ---------- 机关 ----------
const crate = (x, y = G, size = 56, o = {}) => ({ type: 'crate', x, y, w: size, h: size, ...o });
const glass = (x, y, w, h, o = {}) => ({ type: 'glass', x, y, w, h, ...o });
const nodraw = (x, y, w, h) => ({ type: 'nodraw', x, y, w, h });
const mover = (x, y, w, path, o = {}) => ({ type: 'platform', x, y, w, path, ...o });
const spring = (x, y, o = {}) => ({ type: 'spring', x, y, ...o });
const seesaw = (x, y, w, o = {}) => ({ type: 'seesaw', x, y, w, ...o });
const portal = (a, b, o = {}) => ({ type: 'portal', a, b, ...o });
const windmill = (x, y, r, o = {}) => ({ type: 'windmill', x, y, r, ...o });

/** 罩子形解法：以 cx 为中心、两脚落在 groundY 上方的半椭圆 */
function dome(cx, groundY, halfW, topY, n = 16) {
  const pts = [];
  const base = groundY - 9;
  const hgt = base - topY;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push([Math.round(cx + Math.cos(a) * halfW), Math.round(base - Math.sin(a) * hgt)]);
  }
  return pts;
}

/** 方顶罩子：左脚 -> 左上 -> 右上 -> 右脚 (圆角) */
function box(x1, x2, groundY, topY) {
  const b = groundY - 9; const r = 18;
  return [[x1, b], [x1, topY + r], [x1 + r * 0.3, topY + r * 0.3], [x1 + r, topY], [x2 - r, topY], [x2 - r * 0.3, topY + r * 0.3], [x2, topY + r], [x2, b]];
}

export const LEVELS = [
  // ---------------- 1-5：蜜蜂教学 ----------------
  {
    id: 1, inkFactor: 2.4, starFactor: [1.3, 1.8], name: '初次守护', tip: '按住拖动画一条线，把她罩起来！',
    heroine: { x: 270, y: G },
    terrain: [floor()],
    hazards: [{ type: 'hive', x: 110, y: 300, count: 16 }],
    time: 8,
    solution: dome(270, G, 100, 640),
  },
  {
    id: 2, inkFactor: 2.4, starFactor: [1.3, 1.8], name: '墙角的约定', tip: '方方正正的罩子也很稳哦',
    heroine: { x: 70, y: G },
    terrain: [floor()],
    hazards: [{ type: 'hive', x: 420, y: 300, count: 18 }],
    time: 8,
    solution: box(10, 172, G, 640),
  },
  {
    id: 3, inkFactor: 2.4, starFactor: [1.3, 1.8], name: '天台高处', tip: '线的两端要稳稳地落在平台上',
    heroine: { x: 270, y: 620 },
    terrain: [floor(), plat(150, 620, 240, 30), block(250, 650, 40, 170)],
    hazards: [{ type: 'hive', x: 430, y: 260, count: 20 }],
    time: 10,
    solution: dome(270, 620, 100, 440),
  },
  // ---------------- 4-5：蜜蜂教学 · 用地形省墨水 ----------------
  // 1.3：从第 4 关起每关都有一个「专门的点子」，墨水 ≈ 参考解法的 1.5 倍——随手画个大罩子会画到一半没墨水。
  {
    id: 4, name: '盖上盖子', tip: '她躲在地下室里，蜜蜂只能从天窗进来——盖住天窗！',
    heroine: { x: 150, y: G },
    terrain: [floor(), block(0, 640, 380, 42), block(460, 640, 80, 42), block(0, 682, 20, 138)],
    hazards: [{ type: 'hive', x: 120, y: 280, count: 20, route: [[420, 600]] }],
    time: 10,
    solution: [[350, 632], [490, 632]],
  },
  {
    id: 5, name: '关好门', tip: '屋顶很矮，罩子放不下。把线靠在门框外面堵住门！',
    heroine: { x: 250, y: G },
    terrain: [floor(), block(110, 640, 340, 42), block(110, 682, 30, 138), block(420, 682, 30, 60), block(436, 800, 14, 20)],
    hazards: [
      { type: 'hive', x: 80, y: 280, count: 14, route: [[480, 560], [500, 770]] },
      { type: 'hive', x: 470, y: 280, count: 14, delay: 1, route: [[500, 770]] },
    ],
    time: 10,
    solution: [[458, 700], [458, 811], [500, 811]],
  },

  // ---------------- 6-8：加班老板登场 ----------------
  {
    id: 6, name: '加班老板来了', tip: '老板把文件往门里扔！用线靠着门框挡住',
    heroine: { x: 140, y: G },
    terrain: [floor(), block(0, 640, 360, 42), block(346, 800, 14, 20)],
    hazards: [{ type: 'boss', x: 480, y: G, walk: false, throwEvery: 1.3, flight: 0.5 }],
    time: 10,
    solution: [[368, 660], [368, 811], [410, 811]],
  },
  {
    id: 7, name: '下班别想走', tip: '老板会一直冲过来！用线卡在地面和屋檐之间顶住他',
    heroine: { x: 90, y: G },
    terrain: [floor(), block(0, 640, 340, 40)],
    hazards: [{ type: 'boss', x: 480, y: G, walk: true, throwEvery: 2.2 }],
    time: 10,
    solution: [[278, 690], [278, 811], [334, 811]],
  },
  {
    id: 8, name: '老板与蜂群', tip: '屋顶和墙之间有个斜口子，斜着搭一根线封住它',
    heroine: { x: 250, y: G },
    terrain: [floor(), block(140, 640, 24, 180), block(140, 640, 220, 42), block(420, 720, 40, 100)],
    hazards: [
      { type: 'boss', x: 60, y: G, walk: false, throwEvery: 2.0 },
      { type: 'hive', x: 470, y: 250, count: 16, route: [[400, 600]] },
    ],
    time: 10,
    solution: [[300, 632], [362, 632], [450, 712]],
  },

  // ---------------- 9-10：催婚亲戚登场 ----------------
  {
    id: 9, name: '催婚亲戚', tip: '爱心照片会从天窗掉进来，盖住天窗！',
    heroine: { x: 270, y: G },
    terrain: [floor(), block(130, 650, 95, 32), block(315, 650, 95, 32), block(130, 682, 24, 138), block(386, 682, 24, 138)],
    hazards: [
      { type: 'auntie', x: 40, y: G, throwEvery: 1.5, flight: 1.6, target: [270, 700] },
      { type: 'auntie', x: 500, y: G, throwEvery: 1.5, throwDelay: 1.8, flight: 1.6, target: [270, 700] },
    ],
    time: 10,
    solution: [[208, 642], [332, 642]],
  },
  {
    id: 10, name: '木箱帮帮忙', tip: '新机关：木箱！把线搭在墙和木箱上，做个屋顶',
    heroine: { x: 106, y: G },
    terrain: [floor(), block(0, 600, 44, 220)],
    mechanisms: [crate(204, G, 68), crate(204, G - 68, 68)],
    hazards: [
      { type: 'hive', x: 440, y: 260, count: 16, delay: 0.6 },
      { type: 'auntie', entry: 'drop', x: 430, y: G, enterAt: 1.0, throwEvery: 2.0 },
    ],
    time: 10,
    solution: [[24, 592], [56, 592], [206, 676]],
  },

  // ================= 第二章 公司加班：电梯平台 / 玻璃隔断 / 禁画区 =================
  {
    id: 11, name: '电梯上班', tip: '新机关：电梯！蜂巢在隔壁房间，把窗口从外面堵上',
    heroine: { x: 270, y: 760 },
    terrain: [
      floor(), block(184, 380, 172, 20), block(184, 400, 16, 420), block(340, 400, 16, 280), block(340, 740, 16, 80),
      block(356, 620, 184, 20), block(404, 804, 14, 16),
    ],
    mechanisms: [mover(202, 760, 136, [[0, 0], [0, -150]], { speed: 40, wait: 0.6, style: 'elevator' })],
    hazards: [{ type: 'hive', x: 476, y: 700, count: 14, bee: { speed: 3.9 } }],
    time: 10,
    solution: [[364, 652], [392, 811]],
  },
  {
    id: 12, name: '地板要塌了', tip: '新机关：裂开的玻璃地板！倒计时开始一会儿就会碎，提前在下面兜一根线',
    heroine: { x: 270, y: G },
    terrain: [block(0, G, 200, 140), block(340, G, 200, 140), block(200, 900, 24, 60), block(316, 900, 24, 60), spikes(224, 938, 92)],
    mechanisms: [glass(200, G, 140, 18, { breakAt: 2.5 })],
    time: 8,
    solution: [[212, 890], [328, 890]],
  },
  {
    id: 13, name: '楼梯滚石', tip: '石头顺着楼梯滚进门！把线靠在门框外面',
    heroine: { x: 152, y: G },
    terrain: [floor(), ...stairs(540, 636, 56, 36, 4, -1), block(0, 640, 240, 42), block(210, 682, 30, 60), block(226, 800, 14, 20)],
    hazards: [{ type: 'roller', x: 510, y: 596, vx: -6, times: [1, 3.5, 6], radius: 24 }, { type: 'hive', x: 70, y: 260, count: 10, delay: 4, route: [[340, 600], [290, 760]] }],
    time: 9,
    solution: [[248, 700], [248, 811], [290, 811]],
  },
  {
    id: 14, name: '移动工位', tip: '她的工位在屋顶下来回移动，屋顶有个洞——盖住它',
    heroine: { x: 160, y: 660 },
    terrain: [floor(), spikes(20, G, 500), block(0, 470, 20, 350), block(520, 470, 20, 350), block(20, 470, 220, 30), block(320, 470, 200, 30)],
    mechanisms: [mover(60, 660, 200, [[0, 0], [220, 0]], { speed: 50, wait: 0.5, style: 'wood', lips: 18 })],
    hazards: [
      { type: 'hive', x: 270, y: 250, count: 12, bee: { speed: 3.9 } },
      { type: 'rockfall', x: [285, 255], times: [3, 6.5], radius: 20 },
    ],
    time: 10,
    solution: [[214, 462], [346, 462]],
  },
  {
    id: 15, name: '禁止涂鸦', tip: '新机关：阴影区域不能画线！天窗上面画不了，就从屋里面挡',
    heroine: { x: 120, y: G },
    terrain: [floor(), block(0, 640, 330, 42), block(420, 640, 120, 42), block(520, 682, 20, 138), block(300, 700, 16, 16), block(444, 700, 16, 16)],
    mechanisms: [nodraw(306, 420, 138, 236)],
    hazards: [
      { type: 'hive', x: 120, y: 270, count: 12, route: [[375, 600]] },
      { type: 'hive', x: 460, y: 270, count: 12, delay: 1, route: [[375, 600]] },
    ],
    time: 10,
    solution: [[296, 692], [464, 692]],
  },
  {
    id: 16, name: '玻璃隔断', tip: '石头会砸碎玻璃，老板就冲过来了——在屋檐下卡住他',
    heroine: { x: 90, y: G },
    terrain: [floor(), block(0, 640, 340, 40)],
    mechanisms: [glass(400, 640, 18, 180)],
    hazards: [
      { type: 'boss', x: 490, y: G, walk: true, throwEvery: 2.4, throwDelay: 3, walkForce: 0.0016 },
      { type: 'rockfall', x: [415], times: [1.4], radius: 22 },
    ],
    time: 10,
    solution: [[278, 690], [278, 811], [334, 811]],
  },
  {
    id: 17, name: '午休相亲', tip: '两层屋顶之间有道斜缝，顺着台阶斜着封住它',
    heroine: { x: 150, y: G },
    terrain: [floor(), block(60, 600, 240, 40), block(350, 640, 130, 40), block(60, 640, 20, 180), block(460, 680, 20, 140)],
    mechanisms: [
      mover(0, 660, 56, [[0, 0], [0, -150]], { speed: 40, style: 'elevator' }),
      mover(484, 660, 56, [[0, 0], [0, -150]], { speed: 40, style: 'elevator', startAt: 1.5 }),
    ],
    hazards: [
      { type: 'auntie', x: 28, y: 660, throwEvery: 1.8 },
      { type: 'auntie', x: 512, y: 660, throwEvery: 1.8, throwDelay: 1.8 },
      { type: 'hive', x: 300, y: 250, count: 14, delay: 1, route: [[325, 600]] },
    ],
    time: 10,
    solution: [[262, 592], [306, 592], [350, 632], [394, 632]],
  },
  {
    id: 18, name: '撑住走廊', tip: '走廊入口很矮，用一根线把它堵住',
    clearance: 0, // 走廊入口就在她身边，不要求间距
    heroine: { x: 470, y: G },
    // 1.2：走廊入口上方垂下一截门楣，入口只剩约 38px 高 (蜜蜂直径 22px)——线画短一点 / 歪一点也能堵住 (以前要精确撑满 230px，手残玩家通过率只有 19%)
    terrain: [floor(), block(120, 560, 420, 30), block(280, 590, 160, 200)],
    hazards: [
      { type: 'roller', x: 30, y: 770, vx: 7, times: [1.5, 4.5], radius: 22 },
      { type: 'hive', x: 80, y: 300, count: 16, route: [[60, 700]] },
    ],
    time: 10,
    solution: [[290, 811], [404, 811]],
  },
  {
    id: 19, name: '会议室', tip: '屋顶上方不能画线，只有中间那道缝可以盖',
    heroine: { x: 170, y: G },
    terrain: [floor(), block(100, 640, 140, 42), block(300, 640, 140, 42), block(100, 682, 20, 138), block(420, 682, 20, 138)],
    mechanisms: [nodraw(60, 400, 190, 200), nodraw(290, 400, 190, 200)],
    hazards: [
      { type: 'boss', x: 40, y: G, walk: false, throwEvery: 2.0 },
      { type: 'hive', x: 460, y: 260, count: 14, route: [[270, 610]] },
      { type: 'rockfall', x: [272], times: [3], radius: 20 },
    ],
    time: 10,
    solution: [[214, 632], [326, 632]],
  },
  {
    id: 20, name: '加班风暴', tip: '第二章最终关！一笔同时封住玻璃天窗和门口',
    heroine: { x: 240, y: G },
    terrain: [floor(), block(80, 640, 280, 42), block(410, 640, 30, 42), block(80, 682, 24, 138), block(410, 682, 30, 30), block(426, 800, 14, 20)],
    mechanisms: [glass(360, 640, 50, 42)],
    hazards: [
      { type: 'boss', x: 530, y: G, walk: true, throwEvery: 2.4, throwDelay: 1.5 },
      { type: 'rockfall', x: [385, 380], times: [2, 5], radius: 20 },
      { type: 'hive', x: 470, y: 280, count: 14, delay: 1.5, route: [[490, 760]] },
      { type: 'hive', x: 300, y: 240, count: 10, delay: 3, route: [[385, 600]] },
    ],
    time: 11,
    solution: [[340, 632], [448, 632], [448, 811]],
  },

  // ================= 第三章 过年回家：弹簧 / 跷跷板 =================
  {
    id: 21, name: '弹簧初体验', tip: '新机关：弹簧！屋顶上的弹簧会把石头弹进天窗',
    heroine: { x: 120, y: G },
    terrain: [floor(), block(0, 640, 300, 42), block(370, 640, 170, 42), block(520, 682, 20, 138), slope(170, 820, 380, 756, 821), block(380, 756, 140, 64)],
    mechanisms: [spring(480, 640, { angle: -20, power: 7 })],
    hazards: [{ type: 'rockfall', x: [480, 480, 480], times: [1, 3.5, 6], radius: 20 }],
    time: 9,
    solution: [[284, 632], [386, 632]],
  },

  {
    id: 22, name: '双响炮', tip: '两个弹簧把石头弹向中间的天窗，还有蜜蜂',
    heroine: { x: 110, y: G },
    terrain: [floor(), block(0, 640, 240, 42), block(300, 640, 240, 42), block(520, 682, 20, 138)],
    mechanisms: [spring(40, 640, { angle: 20, power: 10 }), spring(500, 640, { angle: -20, power: 10 })],
    hazards: [
      { type: 'rockfall', x: [40, 500, 40, 500], times: [1.2, 2.8, 5, 6.6], radius: 18 },
      { type: 'hive', x: 420, y: 250, count: 12, delay: 2, route: [[270, 590]] },
    ],
    time: 10,
    solution: [[212, 630], [328, 630]],
  },

  {
    id: 23, name: '跷跷板', tip: '新机关：跷跷板！箱子飞过来会砸碎她脚下的玻璃——在石头砸的那头下面垫一根线',
    heroine: { x: 131, y: 600 },
    terrain: [floor(), spikes(30, G, 200)],
    mechanisms: [glass(36, 600, 190, 18), seesaw(330, 772, 260, { offset: -60, angle: 12, maxAngle: 30, baseY: G, density: 0.001 }), crate(492, 797, 40, { density: 0.0006 })],
    hazards: [{ type: 'rockfall', x: [270], times: [1.2], radius: 28, density: 0.014 }],
    time: 8,
    solution: [[282, 777], [282, 811], [256, 811]],
  },

  {
    id: 24, name: '鞭炮弹弹弹', tip: '弹簧把石头平着射进门！把线靠在门框外面',
    heroine: { x: 120, y: G },
    terrain: [floor(), block(0, 640, 300, 42), block(270, 682, 30, 60), block(286, 800, 14, 20)],
    mechanisms: [spring(470, G, { angle: -70, power: 12 })],
    hazards: [
      { type: 'rockfall', x: [470], times: [1, 3, 5, 7], radius: 18 },
      { type: 'hive', x: 440, y: 250, count: 12, delay: 1.5, route: [[340, 760]] },
    ],
    time: 10,
    solution: [[308, 700], [308, 811], [350, 811]],
  },

  {
    id: 25, name: '阿姨落地', tip: '阿姨从天而降，会把玻璃地板踩碎！提前在她脚下兜一根线',
    heroine: { x: 245, y: G },
    terrain: [
      block(0, G, 180, 140), block(420, G, 120, 140),
      block(180, 900, 20, 60), block(296, 900, 14, 60), block(310, 838, 20, 122),
      spikes(200, 938, 96), spikes(330, 938, 90),
    ],
    mechanisms: [glass(180, G, 240, 18)],
    hazards: [{ type: 'auntie', entry: 'drop', x: 372, y: G, enterAt: 1.2, throwEvery: 0 }],
    time: 8,
    solution: [[190, 890], [306, 890]],
  },

  {
    id: 26, name: '回家的路', tip: '车站的两层雨棚之间有道斜缝，弹簧会把石头弹进去',
    heroine: { x: 150, y: G },
    terrain: [floor(), block(60, 600, 240, 40), block(350, 640, 190, 40), block(60, 640, 20, 180), block(520, 680, 20, 140)],
    mechanisms: [spring(480, 640, { angle: -25, power: 8.3 })],
    hazards: [
      { type: 'rockfall', x: [480, 480], times: [1, 4], radius: 18 },
      { type: 'hive', x: 300, y: 250, count: 14, delay: 1.5, route: [[325, 600]], bee: { speed: 3.9 } },
    ],
    time: 10,
    solution: [[262, 592], [306, 592], [350, 632], [394, 632]],
  },

  {
    id: 27, name: '团圆饭桌', tip: '躲在饭桌下面，桌边只剩一个小门洞，从外面把它堵上',
    heroine: { x: 215, y: G },
    terrain: [floor(), block(120, 660, 300, 22), block(120, 682, 20, 50), block(120, 800, 14, 20), block(330, 682, 20, 138)],
    mechanisms: [spring(30, G, { angle: 45, power: 12 })],
    hazards: [
      { type: 'rockfall', x: [44], times: [1, 3.4, 5.8], radius: 18 },
      { type: 'auntie', x: 480, y: G, throwEvery: 2.0, flight: 1.4 },
      { type: 'hive', x: 470, y: 260, count: 14, delay: 1.5, route: [[60, 600], [40, 765]] },
    ],
    time: 10,
    solution: [[112, 700], [112, 811], [72, 811]],
  },

  {
    id: 28, name: '玻璃花房', tip: '石头会砸碎玻璃顶，上方还不能画线——在玻璃下面托一根线',
    heroine: { x: 200, y: G },
    terrain: [floor(), block(130, 556, 180, 18), block(130, 574, 20, 246), block(390, 556, 20, 264), block(150, 632, 174, 14), block(356, 632, 34, 14)],
    mechanisms: [glass(310, 556, 80, 18), nodraw(110, 360, 320, 196)],
    hazards: [
      { type: 'rockfall', x: [340, 365], times: [1.5, 4], radius: 20 },
      { type: 'hive', x: 470, y: 240, count: 12, delay: 3, route: [[350, 540]] },
    ],
    time: 10,
    solution: [[300, 612], [380, 612]],
  },

  {
    id: 29, name: '双跷跷板', tip: '屋顶左右各有一个天窗，箱子和蜜蜂都会掉进来——一根长线一起盖',
    heroine: { x: 270, y: G },
    terrain: [floor(), block(0, 640, 180, 42), block(220, 640, 100, 42), block(360, 640, 180, 42)],
    mechanisms: [
      seesaw(110, 600, 170, { offset: 40, angle: -20, maxAngle: 30, baseY: 640, density: 0.001 }), crate(10 + 17, 610, 34, { density: 0.0006 }),
      seesaw(430, 600, 170, { offset: -40, angle: 20, maxAngle: 30, baseY: 640, density: 0.001 }), crate(513, 610, 34, { density: 0.0006 }),
    ],
    hazards: [
      { type: 'rockfall', x: [140, 400], times: [1.2, 3.5], radius: 22, density: 0.012 },
      { type: 'hive', x: 100, y: 250, count: 10, delay: 1, route: [[200, 590]] },
      { type: 'hive', x: 440, y: 250, count: 10, delay: 2, route: [[340, 590]] },
    ],
    time: 9,
    solution: [[166, 632], [374, 632]],
  },

  {
    id: 30, name: '过年大团圆', tip: '第三章最终关！一笔封住玻璃天窗和门口',
    heroine: { x: 300, y: G },
    terrain: [floor(), block(100, 640, 60, 42), block(210, 640, 330, 42), block(100, 682, 30, 30), block(100, 800, 14, 20), block(520, 682, 20, 138)],
    mechanisms: [glass(160, 640, 50, 42), spring(30, G, { angle: 8, power: 15 })],
    hazards: [
      { type: 'rockfall', x: [30, 185], times: [1, 4], radius: 20 },
      { type: 'auntie', entry: 'drop', x: 470, y: 640, enterAt: 1.5, throwEvery: 2.0, flight: 1.5 },
      { type: 'hive', x: 60, y: 250, count: 12, delay: 2, route: [[40, 760]] },
    ],
    time: 11,
    solution: [[230, 632], [92, 632], [92, 811]],
  },

  // ================= 第四章 终极挑战：传送门 / 风车 =================
  {
    id: 31, name: '任意门', tip: '新机关：传送门！蜜蜂会从天窗正上方的门里飞出来',
    heroine: { x: 120, y: G },
    terrain: [floor(), block(0, 640, 370, 42), block(470, 640, 70, 42), block(0, 160, 230, 20), block(0, 340, 230, 20), block(210, 180, 20, 160)],
    mechanisms: [portal([40, 280, 0], [420, 500, 90], { color: '#ff6fa8' })],
    hazards: [{ type: 'hive', x: 120, y: 230, count: 16, route: [[100, 282], [40, 280]] }],
    time: 10,
    solution: [[350, 632], [490, 632]],
  },

  {
    id: 32, name: '风车转转', tip: '新机关：风车！屋顶上的盖子会被扫掉，从屋里面托住',
    heroine: { x: 120, y: G },
    terrain: [floor(), block(0, 640, 290, 42), block(370, 640, 170, 42), block(276, 700, 14, 14), block(370, 700, 14, 14)],
    mechanisms: [windmill(330, 552, 80, { speed: 2.2, poleTo: 640 })],
    hazards: [
      { type: 'hive', x: 470, y: 260, count: 20, route: [[330, 400]] },
      { type: 'rockfall', x: [330], times: [3], radius: 18 },
    ],
    time: 10,
    solution: [[268, 692], [392, 692]],
  },

  {
    id: 33, name: '传送落石', tip: '掉进传送门的石头会横着飞出来！把线靠在门框外面',
    heroine: { x: 84, y: G },
    terrain: [floor(), block(0, 640, 180, 42), block(150, 682, 30, 60), block(166, 800, 14, 20)],
    mechanisms: [portal([300, 330, -90], [524, 770, 180], { color: '#8fd3ff' })],
    hazards: [
      { type: 'rockfall', x: [300, 300, 300], times: [1, 3.5, 6], radius: 18 },
      { type: 'hive', x: 330, y: 200, count: 12, delay: 2, route: [[250, 760]] },
    ],
    time: 10,
    solution: [[188, 700], [188, 811], [230, 811]],
  },

  {
    id: 34, name: '加班传送门', tip: '老板把文件扔进传送门，出口就在屋里！挡在出口前面',
    heroine: { x: 160, y: G },
    terrain: [floor(), block(0, 640, 540, 42), block(260, 682, 20, 50), block(260, 800, 14, 20), block(400, 420, 140, 24)],
    mechanisms: [portal([290, 330, 0], [380, 740, -165], { color: '#ffb347' })],
    hazards: [
      { type: 'boss', x: 470, y: 420, walk: false, throwEvery: 1.3, throwDelay: 0.6, flight: 0.35, target: [292, 334] },
    ],
    time: 10,
    solution: [[287, 700], [287, 811], [324, 811]],
  },

  {
    id: 35, name: '移动的家', tip: '蜂巢关在盒子里，只有顶上一条缝——先把缝盖住！',
    heroine: { x: 140, y: 620 },
    terrain: [floor(), spikes(30, G, 480), block(300, 180, 30, 20), block(370, 180, 170, 20), block(300, 200, 20, 140), block(300, 340, 240, 20)],
    mechanisms: [mover(40, 620, 200, [[0, 0], [200, 0]], { speed: 50, wait: 0.6, style: 'cloud', lips: 18 })],
    hazards: [{ type: 'hive', x: 470, y: 280, count: 16, route: [[350, 260], [350, 140]], bee: { speed: 3.9 } }],
    time: 10,
    solution: [[306, 172], [394, 172]],
  },

  {
    id: 36, name: '弹射传送', tip: '石头被弹进传送门，从天窗正上方砸下来！上面画不了线',
    heroine: { x: 120, y: G },
    terrain: [floor(), block(0, 640, 290, 42), block(370, 640, 170, 42), block(270, 700, 14, 14), block(376, 700, 14, 14)],
    mechanisms: [
      spring(70, 640, { angle: 30, power: 18 }),
      portal([510, 432, 180], [330, 450, 90], { color: '#c3a6ff' }),
      nodraw(250, 380, 160, 250),
    ],
    hazards: [
      { type: 'rockfall', x: [70, 70, 70], times: [1, 3.5, 6], radius: 18 },
      { type: 'hive', x: 470, y: 240, count: 12, delay: 2, route: [[330, 560]] },
    ],
    time: 10,
    solution: [[262, 692], [398, 692]],
  },

  {
    id: 37, name: '风车阵', tip: '门口有风车在转，线只能贴着门框画',
    heroine: { x: 120, y: G },
    terrain: [floor(), block(0, 640, 300, 42), block(270, 682, 30, 60), block(286, 800, 14, 20)],
    mechanisms: [windmill(455, 700, 60, { speed: 2.4, poleTo: 820 })],
    hazards: [
      { type: 'hive', x: 470, y: 240, count: 14, route: [[370, 600], [370, 760]] },
      { type: 'hive', x: 200, y: 240, count: 12, delay: 1, route: [[370, 600], [370, 760]] },
    ],
    time: 10,
    solution: [[308, 700], [308, 811], [344, 811]],
  },

  {
    id: 38, name: '木箱快递', tip: '老板把木箱推进传送门，木箱会横着冲进门！',
    heroine: { x: 100, y: G },
    terrain: [floor(), block(0, 640, 200, 42), block(170, 682, 30, 60), block(186, 800, 14, 20), block(300, 300, 240, 20)],
    mechanisms: [
      crate(420, 300, 48, { density: 0.002 }), crate(470, 300, 48, { density: 0.002 }),
      portal([224, 600, -90], [520, 760, 180], { color: '#ff9cc8' }),
    ],
    hazards: [
      { type: 'boss', x: 520, y: 300, walk: true, throwEvery: 0, walkForce: 0.0016 },
      { type: 'hive', x: 400, y: 200, count: 12, delay: 3.5, route: [[260, 760]] },
    ],
    time: 10,
    solution: [[208, 700], [208, 811], [250, 811]],
  },

  {
    id: 39, name: '地下来客', tip: '蜜蜂会从岛下面的传送门钻出来——把出口的烟囱盖住',
    heroine: { x: 270, y: 560 },
    terrain: [
      floor(), island(214, 560, 112), block(202, 700, 24, 120), block(314, 700, 24, 120),
      block(0, 160, 230, 20), block(0, 340, 230, 20), block(210, 180, 20, 160),
    ],
    mechanisms: [portal([40, 280, 0], [270, 790, -90], { color: '#ffd23f', twoWay: false })],
    hazards: [{ type: 'hive', x: 120, y: 230, count: 18, route: [[100, 282], [40, 280]] }],
    time: 10,
    solution: [[196, 692], [344, 692]],
  },

  {
    id: 40, name: '最终守护', tip: '最终关！一笔封住天窗和门口，相信你画的线♡',
    heroine: { x: 240, y: G },
    terrain: [floor(), block(80, 640, 280, 42), block(410, 640, 30, 42), block(80, 682, 24, 138), block(410, 682, 30, 30), block(426, 800, 14, 20)],
    mechanisms: [
      glass(360, 640, 50, 42),
      windmill(270, 330, 62, { speed: 2.0 }),
      portal([60, 300, 0], [385, 470, 90], { color: '#ff6fa8' }),
    ],
    hazards: [
      { type: 'hive', x: 70, y: 210, count: 12, route: [[110, 300], [60, 300]] },
      { type: 'hive', x: 480, y: 230, count: 10, delay: 2, route: [[500, 760]] },
      { type: 'boss', x: 530, y: G, walk: true, throwEvery: 2.6, throwDelay: 2 },
      { type: 'rockfall', x: [385, 380], times: [2, 5.5], radius: 18 },
    ],
    time: 12,
    solution: [[340, 632], [448, 632], [448, 811]],
  },

];

/** 墨水宽裕度随关卡递减：前期很宽松，后期需要更精打细算 */
export function inkFactorFor(id) {
  const [a, b] = GameConfig.inkFactorRange;
  return a + (b - a) * ((id - 1) / Math.max(1, LEVELS.length - 1));
}

/** 补全默认值：解法转成点对象、墨水上限、星级阈值 */
export function resolveLevel(raw) {
  const solution = raw.solution.map(([x, y]) => ({ x, y }));
  let len = 0;
  for (let i = 1; i < solution.length; i++) len += Math.hypot(solution[i].x - solution[i - 1].x, solution[i].y - solution[i - 1].y);
  const ink = raw.ink || Math.round(len * (raw.inkFactor || inkFactorFor(raw.id)));
  // 星级阈值不超过墨水上限的 80% / 92%，保证后期墨水紧张的关卡也分得出 1~3 星
  const [k3, k2] = raw.starFactor || [GameConfig.stars.three, GameConfig.stars.two];
  const stars = raw.stars || [
    Math.round(Math.min(len * k3, ink * 0.8)),
    Math.round(Math.min(len * k2, ink * 0.92)),
  ];
  return { time: 10, hazards: [], mechanisms: [], ...raw, solution, solutionLength: Math.round(len), ink, stars };
}

export const LEVEL_COUNT = LEVELS.length;
export const getLevel = (id) => resolveLevel(LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))]);
