# 《星屑轮舞》v1.2 更新记录

出品：狸猫　｜　2026-10-11

## 出品署名
- 出品方统一为「狸猫」：标题（启动页 / 主菜单底部）、制作人员页、README、package.json `author`、Windows exe 文件属性（公司 / 版权 / 产品名）。
- 出品名只在 `src/config/GameConfig.js` 的 `publisher` 一处定义，界面统一读取。
- `docs/licenses/`：每个 VOICEVOX 角色的文件里都补上了音源利用规约全文（原文转录 + 来源链接 + 抓取日期），另加 VOICEVOX 软件利用规约全文。

## 抖音小游戏
- 新增平台层 `src/core/platform/`（web / tt），玩法代码网页版和抖音版共用；Game / 输入 / 存档 / 音效 / 语音 / BGM / 前后台 / 图片 / 离屏画布都改为经平台层访问。
- 抖音版接入：tt.createCanvas + 安全区适配、tt.onTouch*、tt.setStorageSync、tt.createInnerAudioContext、tt.onShow/onHide、tt.createRewardedVideoAd（isEnded / 失败兜底）、tt.getGameRecorderManager（自动录屏 / 高光打点 / 剪辑）、tt.shareAppMessage（录屏分享）、tt.checkScene / navigateToScene（侧边栏每日奖励）、tt.loadSubpackage（分包 + 进度）。
- 短音效预渲染为 wav（同一套合成代码离线渲染），保留同类 50ms 限频和命中类 5 并发上限。
- 语音 / BGM / 半身立绘放分包，图片用 pngquant 压缩（3.7MB → 1.1MB），主包 1.6MB。
- `PlatformConfig.js` 是 AppID 与广告位 ID 的唯一配置处；留空时用占位广告。
- 新增 `npm run build:douyin`、`npm run test:douyin`（tt 模拟冒烟测试 62 项）。
- 上架资料：上架说明、隐私政策草案、商店文案、5 张 1080×1920 截图。

## 其它
- 全局小提示（广告拉取失败、侧边栏领奖）。
- 选角页立绘未加载时用头像代替。
- 版本号 1.2.0。
