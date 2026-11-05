// 微信版构建用的侧边栏占位 (tools/build.mjs --target wechat 用它替换 SidebarService.js)：
// 侧边栏复访是抖音专有能力，微信包里不带相关代码和文案；菜单的「侧边栏有礼」按钮始终隐藏。
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class SidebarService {
  constructor(game) { this.game = game; this.supported = false; this.reward = 0; }
  get claimedToday() { return false; }
  get fromSidebar() { return false; }
  get canClaim() { return false; }
  claim() { return false; }
  go() { return Promise.resolve(false); }
}
