// 小游戏构建 (抖音 / 微信)：Matter.js 直接从 npm 打包进 game.js (没有 window.Matter)。
// 只用到 Engine / World / Bodies / Body / Composite / Events / Query / Vector 等纯计算模块；
// 依赖 window/document 的 Render / Mouse / Runner 不会被调用 (tools/test-douyin.mjs / test-wechat.mjs 用访问陷阱验证)。
import Matter from 'matter-js';

export default Matter;
