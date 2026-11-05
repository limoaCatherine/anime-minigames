// 机关 (地形机关) 类型表：每种类型的默认参数。关卡里的 mechanisms 条目会覆盖同名字段。
// 新增机关：在这里加默认参数 + 在 src/entities/mechanisms/ 写实体类 + 在 MechanismSystem 的 FACTORY 注册。
//
// 角度约定 (度)：0 = 朝右，90 = 朝下，-90 = 朝上 (与画布坐标一致)。
export const MECHANISM_TYPES = {
  // 移动平台 (运动学刚体)：沿路径点移动，主角/敌人/线都可以站在上面被带着走
  platform: {
    name: '移动平台',
    x: 0, y: 0, w: 140, h: 24,      // 初始位置 (左上角) 与尺寸
    path: [[0, 0], [160, 0]],       // 路径点：相对初始位置的偏移
    speed: 60,                      // 平均速度 (像素/秒)
    mode: 'pingpong',               // pingpong 来回 | loop 循环 | once 走到终点停下
    wait: 0.4,                      // 在每个路径点停留 (秒)
    startAt: 0,                     // 计时开始后多久开始移动 (秒)
    ease: true,                     // 两点之间缓入缓出 (起停更平稳)
    style: 'cloud',                 // cloud 云朵 | elevator 电梯 | wood 木板
    lips: 0,                        // 两端挡边高度 (0 = 没有)
  },
  // 跷跷板：绕支点转动的动态木板 (转动约束)，可被石头 / 线 / 敌人压翻
  seesaw: {
    name: '跷跷板',
    x: 270, y: 700,                 // 支点
    w: 240, h: 16,                  // 木板尺寸
    offset: 0,                      // 支点相对木板中心的偏移 (正 = 支点偏右)
    angle: 0,                       // 初始角度
    maxAngle: 26,                   // 最大倾角
    density: 0.002,
    baseY: null,                    // 支架底部 y (默认支点下方 60)
  },
  // 木箱：普通动态方块，可被推动、撞飞、穿过传送门
  crate: {
    name: '木箱',
    x: 270, y: 820,                 // 底边中心
    w: 56, h: 56,
    density: 0.0016,
    friction: 0.8,
    harmSpeed: 7,                   // 速度超过该值砸到主角算失败
  },
  // 传送门 (成对)：敌人、石头、投射物、木箱从一端进入，从另一端按出口朝向保持速度飞出；画的线不会被传送
  portal: {
    name: '传送门',
    a: [120, 400, 0],               // [x, y, 朝向角度] 入口 A
    b: [420, 400, 180],             // [x, y, 朝向角度] 出口 B
    r: 30,                          // 半径 (门的半高)
    color: '#ff6fa8',
    twoWay: true,                   // 是否双向
    minOut: 2.2,                    // 出门最小速度 (沿出口朝向)
  },
  // 弹簧 / 弹跳垫：把落在上面的石头、木箱、敌人、投射物弹飞
  spring: {
    name: '弹簧',
    x: 270, y: 820,                 // 底座中心 (底边)
    w: 64,
    angle: 0,                       // 弹射方向相对竖直向上的倾角 (正 = 偏右)
    power: 15,                      // 弹出速度 (像素/物理步)
    keep: 0.4,                      // 保留原切向速度比例
  },
  // 玻璃块：静态方块，被高速石头 / 木箱撞到会碎掉
  glass: {
    name: '玻璃',
    x: 0, y: 0, w: 120, h: 20,
    breakSpeed: 4.5,
    breakAt: null,                  // 1.3：倒计时开始后几秒自己碎掉 (裂开的玻璃地板)；null = 只会被撞碎
  },
  // 风车：运动学旋转叶片，会把蜜蜂 / 石头扫开
  windmill: {
    name: '风车',
    x: 270, y: 400, r: 70,
    blades: 4,
    bladeW: 14,
    speed: 2.1,                     // 角速度 (弧度/秒)，负数逆时针
    poleTo: null,                   // 支杆底部 y (仅绘制)
  },
  // 禁画区：阴影区域内不能画线
  nodraw: {
    name: '禁画区',
    x: 0, y: 0, w: 100, h: 100,
  },
};

export function mechanismDef(type, overrides = {}) {
  const base = MECHANISM_TYPES[type];
  if (!base) throw new Error(`[MechanismConfig] 未知的机关类型: ${type}`);
  return { type, ...base, ...overrides };
}
