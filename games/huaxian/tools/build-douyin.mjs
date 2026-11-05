// 抖音小游戏构建：src/ -> douyin/ (公共逻辑见 tools/lib/minigame-build.mjs；输出说明见那里的文件头)
// 用法：node tools/build-douyin.mjs   (先运行过 node tools/render-sfx.mjs 生成 assets/sfx)
import { buildMiniGame } from './lib/minigame-build.mjs';

const r = await buildMiniGame('douyin');
if (!r.ok) process.exit(1);
