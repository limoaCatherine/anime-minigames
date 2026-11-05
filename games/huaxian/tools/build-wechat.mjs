// 微信小游戏构建：src/ -> wechat/ (公共逻辑见 tools/lib/minigame-build.mjs)
//   与抖音版的区别：平台层 WeChatPlatform (wx.*，转发 / 分享到朋友圈，没有录屏和侧边栏)、game.json 用 "subpackages"、
//   体积上限 主包 4 MB / 总计 30 MB、project.config.json 为微信开发者工具格式。
// 用法：node tools/build-wechat.mjs   (先运行过 node tools/render-sfx.mjs 生成 assets/sfx)
import { buildMiniGame } from './lib/minigame-build.mjs';

const r = await buildMiniGame('wechat');
if (!r.ok) process.exit(1);
