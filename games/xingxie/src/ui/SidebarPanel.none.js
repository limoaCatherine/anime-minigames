// 微信版构建用的侧边栏面板占位 (入口按钮在微信版不显示，这里只保证接口存在)。
export class SidebarPanel {
  constructor(game, { onClose } = {}) { this.buttons = []; if (onClose) Promise.resolve().then(onClose); }
  sync() {}
  render() {}
}
