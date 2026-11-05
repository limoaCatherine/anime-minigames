// 抖音侧边栏复访 (仅抖音小游戏)。按官方接入指南：
// 1) 启动时 tt.onShow 同步监听 (platform/tt.js 已做)，记录 launch_from / location
// 2) tt.checkScene({ scene: 'sidebar' }) 返回 isExist 才在菜单显示入口
// 3) 点入口：如果本次是从侧边栏进来的 (launch_from=homepage 且 location=sidebar_card) 且今天没领 → 发奖励；
//    否则引导并调用 tt.navigateToScene({ scene: 'sidebar' }) 跳到侧边栏
// 奖励每天一次，领取日期写进存档 (sidebarDay)。
import { DouyinConfig } from '../config/PlatformConfig.js';
import { platform } from '../core/platform/index.js';

export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class SidebarService {
  constructor(game) {
    this.game = game;
    this.supported = false;       // checkScene 结果
    this.reward = DouyinConfig.sidebarReward;
    if (platform.isTT) platform.checkSidebar().then((ok) => { this.supported = ok; game.events.emit('sidebar:check', ok); });
  }

  get claimedToday() { return this.game.save.get('sidebarDay', '') === today(); }
  get fromSidebar() { return platform.launchedFromSidebar; }
  get canClaim() { return this.supported && this.fromSidebar && !this.claimedToday; }

  claim() {
    if (!this.canClaim) return false;
    this.game.save.addCoins(this.reward);
    this.game.save.set('sidebarDay', today());
    this.game.events.emit('sidebar:claim', { coins: this.reward });
    return true;
  }

  go() { return platform.navigateToSidebar(); }
}
