// 场景渲染：按关卡配置 (LevelConfig) 的图层列表依次绘制。
// 图层坐标为归一化坐标 (x 相对场景宽, y 相对场景高)，s 为缩放 (1 = 设计尺寸，按 540 逻辑宽设计)。
// 图层可选条件：only:'A'|'B' (找不同的左右图)、when:[flags] / unless:[flags] (脱困关的状态)、
//               found:'热区id' (找到后才显示) / hideFound:'热区id' (找到后隐藏)
import { ART } from './index.js';

export function layerVisible(L, S) {
  if (L.only && L.only !== S.variant) return false;
  if (L.when && !L.when.every((f) => S.flags.has(f))) return false;
  if (L.unless && L.unless.some((f) => S.flags.has(f))) return false;
  if (L.found && !(S.found && S.found.has(L.found))) return false;
  if (L.hideFound && S.found && S.found.has(L.hideFound)) return false;
  return true;
}

export function drawLayer(ctx, L, S) {
  const fn = ART[L.a];
  if (!fn) { if (!S.warned) { S.warned = true; console.warn('[SceneRenderer] 未知图层:', L.a); } return; }
  const unit = S.w / 540;
  ctx.save();
  if (L.bg) {
    ctx.scale(unit, unit);
    fn(ctx, L, { ...S, W: 540, H: S.h / unit });
  } else {
    ctx.translate((L.x || 0) * S.w, (L.y || 0) * S.h);
    if (L.rot) ctx.rotate(L.rot);
    const k = (L.s ?? 1) * unit;
    ctx.scale(L.flip ? -k : k, k);
    if (L.alpha != null && L.a !== 'img') ctx.globalAlpha *= L.alpha;
    fn(ctx, L, S);
  }
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx 已平移到场景左上角
 * @param {object[]} layers
 * @param {{w:number,h:number,t:number,img:(k:string)=>any,flags:Set<string>,found?:Set<string>,variant?:string}} S
 */
export function renderScene(ctx, layers, S) {
  for (const L of layers) if (layerVisible(L, S)) drawLayer(ctx, L, S);
}
