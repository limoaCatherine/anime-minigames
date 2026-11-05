// 地形系统：把关卡里的 terrain 数据变成静态刚体，并负责绘制 (圆角糖果色平台 / 斜坡 / 尖刺)。
// 支持的类型：
//   { type:'rect', x, y, w, h, angle? }      左上角 + 宽高；angle(度) 时绕中心旋转
//   { type:'poly', points:[[x,y],...] }       凸多边形 (绝对坐标)，用于斜坡
//   { type:'spikes', x, y, w, h? }            尖刺：底边左端 (x,y)，宽 w；主角碰到即失败
// rect / poly 可选 style:'island' (浮空岛，底部画垂下的根须与小云)
// 配色来自章节主题 (ChapterConfig.theme)：ground / groundTop / groundEdge / props
import Matter from '../lib/matter.js';
import { CAT } from '../config/GameConfig.js';
import { GameConfig } from '../config/GameConfig.js';

const { Bodies, Vertices } = Matter;

export class TerrainSystem {
  constructor(physics, terrain) {
    this.physics = physics;
    this.items = [];
    this.bodies = [];
    const filter = { category: CAT.TERRAIN, mask: 0xffff };
    const opts = { isStatic: true, friction: 1, frictionStatic: 1.5, restitution: 0.05, collisionFilter: filter };
    for (const t of terrain) {
      let body;
      if (t.type === 'rect') {
        const angle = ((t.angle || 0) * Math.PI) / 180;
        body = Bodies.rectangle(t.x + t.w / 2, t.y + t.h / 2, t.w, t.h, { ...opts, label: 'terrain', angle, chamfer: { radius: Math.min(8, t.h / 3) } });
      } else if (t.type === 'poly') {
        const verts = t.points.map(([x, y]) => ({ x, y }));
        const c = Vertices.centre(verts);
        body = Bodies.fromVertices(c.x, c.y, [verts], { ...opts, label: 'terrain' });
      } else if (t.type === 'spikes') {
        const h = t.h || 22;
        body = Bodies.rectangle(t.x + t.w / 2, t.y - h * 0.35, t.w - 4, h * 0.7, { ...opts, label: 'spike' });
      } else {
        throw new Error(`[TerrainSystem] 未知地形类型: ${t.type}`);
      }
      physics.add(body);
      this.bodies.push(body);
      this.items.push({ def: t, body });
    }
    // 屏幕两侧的隐形墙 (很高，防止东西飞出屏幕)
    const W = GameConfig.width;
    for (const x of [-40, W + 40]) {
      const wall = Bodies.rectangle(x, 300, 80, 2400, { ...opts, label: 'wall' });
      physics.add(wall);
      this.walls = (this.walls || []).concat(wall);
    }
  }

  /** 参与画线检测的刚体 (不含隐形墙) */
  get solidBodies() { return this.bodies; }

  render(ctx, theme = {}) {
    const C = GameConfig.colors;
    const fill = theme.ground || C.ground; const topC = theme.groundTop || C.groundTop; const edge = theme.groundEdge || C.groundEdge;
    const deco = theme.props || 'spring';
    for (const { def: t, body } of this.items) {
      ctx.save();
      if (t.type === 'spikes') {
        drawSpikes(ctx, t);
        ctx.restore();
        continue;
      }
      // 根据刚体顶点绘制，保证与物理一致
      const v = body.vertices;
      ctx.beginPath();
      v.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      const minY = Math.min(...v.map((p) => p.y));
      const maxY = Math.max(...v.map((p) => p.y));
      const g = ctx.createLinearGradient(0, minY, 0, maxY);
      g.addColorStop(0, '#fff3f8');
      g.addColorStop(1, fill);
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(120,60,140,0.22)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 3;
      ctx.strokeStyle = edge;
      ctx.stroke();
      if (t.style === 'island') drawIslandBottom(ctx, v, topC, edge);
      // 顶面草地 (取朝上的边)
      ctx.lineCap = 'round';
      for (let i = 0; i < v.length; i++) {
        const a = v[i]; const b = v[(i + 1) % v.length];
        const dx = b.x - a.x; const dy = b.y - a.y;
        // 顺时针顶点：朝上的边 dx>0 且坡度不太陡
        if (dx > 6 && Math.abs(dy) < dx * 1.2) {
          ctx.strokeStyle = topC;
          ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(a.x + 3, a.y + 2); ctx.lineTo(b.x - 3, b.y + 2); ctx.stroke();
          // 顶面小装饰：春日小花 / 公司地毯纹 / 过年金币 / 夜晚星光
          const n = Math.floor(Math.hypot(dx, dy) / 70);
          for (let k = 1; k <= n; k++) {
            const fx = a.x + (dx * k) / (n + 1); const fy = a.y + (dy * k) / (n + 1);
            if (deco === 'office') { ctx.fillStyle = 'rgba(111,134,232,0.55)'; ctx.fillRect(fx - 6, fy + 8, 12, 3); continue; }
            if (deco === 'newyear') { ctx.fillStyle = k % 2 ? '#ff5a5a' : '#ffd23f'; ctx.beginPath(); ctx.arc(fx, fy + 1, 3.4, 0, Math.PI * 2); ctx.fill(); continue; }
            if (deco === 'night') { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(fx, fy + 1, 2.2, 0, Math.PI * 2); ctx.fill(); continue; }
            ctx.fillStyle = k % 2 ? '#ff9cc8' : '#ffffff';
            ctx.beginPath(); ctx.arc(fx, fy + 1, 3.2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.restore();
    }
  }
}

function drawSpikes(ctx, t) {
  const h = t.h || 22;
  const n = Math.max(1, Math.round(t.w / 18));
  const sw = t.w / n;
  ctx.fillStyle = '#c9c3d6';
  ctx.strokeStyle = '#6e6385';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const x0 = t.x + i * sw;
    ctx.beginPath();
    ctx.moveTo(x0, t.y);
    ctx.lineTo(x0 + sw / 2, t.y - h);
    ctx.lineTo(x0 + sw, t.y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.moveTo(x0 + sw / 2, t.y - h + 3); ctx.lineTo(x0 + sw * 0.38, t.y - 3); ctx.lineTo(x0 + sw * 0.48, t.y - 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9c3d6';
  }
}

/** 浮空岛底部：垂下的根须 + 小云朵 */
function drawIslandBottom(ctx, v, topC, edge) {
  const maxY = Math.max(...v.map((p) => p.y));
  const minX = Math.min(...v.map((p) => p.x)); const maxX = Math.max(...v.map((p) => p.x));
  const w = maxX - minX;
  ctx.save();
  ctx.strokeStyle = topC; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const n = Math.max(2, Math.round(w / 30));
  for (let i = 0; i < n; i++) {
    const x = minX + ((i + 0.5) * w) / n;
    const len = 8 + ((i * 7) % 3) * 6;
    ctx.beginPath(); ctx.moveTo(x, maxY - 2); ctx.quadraticCurveTo(x + 4, maxY + len / 2, x - 2, maxY + len); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(minX + 10, maxY + 2, 9, 0, Math.PI * 2); ctx.arc(minX + 22, maxY + 4, 7, 0, Math.PI * 2);
  ctx.arc(maxX - 12, maxY + 3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = edge; ctx.globalAlpha = 0.3; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
