# 《美少女了个美》AnimeStack  v3.3

**出品：狸猫**

一款"羊了个羊"玩法的 **叠叠消（三消 + 卡槽）** 小游戏：牌桌上层层叠放着 14 位二次元美少女卡牌，点击没被压住的卡，它会飞进底部 7 格卡槽；**凑齐 3 张相同的美少女即可消除**，卡槽填满就失败。

**v3.3 新内容（微信小游戏版 + 语音重新选角）**
- **微信小游戏版**：`npm run build:wechat` → `build-wechat/`（交付时是 `美少女了个美/微信小游戏/`），可直接导入「微信开发者工具」。平台层 `src/platform/WechatPlatform.js`（wx.*）：画布 / 触摸 / 图片 / InnerAudioContext / 本地存档 / 分包 audio / `getWindowInfo` 安全区与胶囊避让 / 激励视频（与抖音版同样：广告位留空 = 每关免费「再试一次」）/ **转发**（右上角菜单 + 结算页「分享给好友」）/ **分享到朋友圈**（`showShareMenu` + `onShareTimeline`，1:1 卡片图）/ 切后台暂停。没有抖音专属的录屏分享与侧边栏。主包 1.15 MB / 4 MB，整包 4.05 MB / 30 MB，只用 mp3。AppID 与广告位只填 `wechat.config.js`。上架步骤、资质（版号 / 软著 / 自审自查报告 / 适龄提示 / 隐私保护指引 / 备案）与官方链接见 **`docs/微信上架说明.md`**；测试 `npm run test:wechat`（Node 无 DOM 沙箱 + Chromium wx 模拟层）
- **语音重新选角**：核对各语音模型的官方条款后，只保留允许**法人直接商用、无需事先联系**的 **リダ** 和 **黄金笑**（Tαkoe）两个声线，用风格 + 音高微调分给 14 位角色；25 句全部重新生成（每句 8 个版本 → 语音识别过滤 → 挑表现力最强的一条，~1.2× 语速，-20 LUFS）；制作人员 / licenses / README 同步更新

**v3.2 内容（抖音小游戏版 + 署名 / 许可）**
- **抖音小游戏版**：`npm run build:douyin` → `build-douyin/`（交付时就是 `美少女了个美/抖音小游戏/`），可直接导入「抖音开发者工具」。和网页版同一套源码，平台差异集中在 `src/platform/`（`WebPlatform.js` / `DouyinPlatform.js`）：`tt.createCanvas` + 触摸、刘海 / 胶囊避让、InnerAudioContext（音效预渲染为 mp3）、本地存档、语音和 BGM 放分包、激励视频（看完才复活）、分享、**开局自动录屏 + 结算页分享录屏**、**侧边栏复访礼包**、切后台暂停。主包 0.98 MB / 整包 3.86 MB。上线步骤、资质、隐私协议、商店素材见 **`docs/DOUYIN_RELEASE.md`**；AppID 和广告位 ID 只需填 `douyin.config.js` 一个文件；首发不带广告（广告位留空 = 免费「再试一次」），开通流量主后填 ID 自动切换为激励视频
- **出品：狸猫**：菜单页脚、制作人员、桌面版 exe 的文件属性（公司 / 版权 / 产品名）、package.json 作者
- **许可文本**：`docs/licenses/`（AivisSpeech Engine、各语音模型的许可页），桌面版 exe 旁边附带 `licenses/` 文件夹；制作人员面板里 リダ 注明"条款可能随时变更"

**v3.1 内容（逻辑审查 + 语音重做）**
- **AivisSpeech 角色语音**：改用 AivisSpeech（感情表现更丰富）。主声线是 **コハク**（主持人「元气同学」用 あまあま），另有 まお / らせつん / 凛音エル / リダ，共 5 个声线分给 14 位角色；每句台词带一个**情绪标签**（happy / smug / shy / panic / sulky / calm / sleepy），自动选对应的风格（あまあま、せつなめ、喜び、クール……）；语速 1.15~1.22×、停顿缩短到 0.6 倍、抑扬 1.25~1.5；台词改成更短更口语、带感叹词的 25 句；每句合成 8 个版本，语音识别过滤读错的版本后挑**表现力最强**的一条（v3.3 起声线改为 リダ + 黄金笑，见上）
- **逻辑漏洞修复**（详见「十、v3.1 审查记录」）：洗牌改为**保证仍然有解**（考虑卡槽里已有的卡，用求解器验证）；洗牌会打断撤回/移出的飞行动画导致卡牌卡死；发牌途中点牌；移出叠层后下层卡仍可点；每日挑战跨午夜记错日期；每日挑战的星星算进总星数；离开关卡时心跳声 / 语音不停……共 11 项，每项都有自动化测试
- **难度曲线**：第 5 关 BOSS 从「地狱」（贪心 3%）调整为「BOSS·困难」（≈13~20%）——难但不是墙；第 10、15 关保留地狱
- 文案：连消提示改为中文（顺！/ 好手感 / 停不下来 …），结算按钮「再来一把」

**v3 内容（声音重做 + 去"AI 味"）**
- 角色语音（v3 为 VOICEVOX 40 句，v3.1 已换成 AivisSpeech 25 句）
- **语音不再刷屏**：同一时间只说一句、两句之间至少 0.6 秒、按优先级打断；消除台词有频率限制（每关第一次消除和连消必说，其余至少隔 7 秒、35% 概率）
- **原创 BGM 3 首**（Python 程序化作曲 → ogg/mp3，无缝循环）：菜单《樱花便当》、普通关《午休三连》、地狱关《满槽警报》；角色说话时 BGM 平滑压低到 ×0.55
- **音效重做**：23 种 WebAudio 合成音效改为多层（钟声 + 噪声 + 包络 + 小混响），连消沿五声音阶升调，音高随机抖动，同一音效限频；每个音效都按目标响度校准
- **统一响度**：语音文件 -20 LUFS、BGM -22 LUFS，默认音量 语音 0.30 / 音效 0.12 / BGM 0.15，另有总音量滑块（见 `docs/audio-levels.md`）
- **制作人员面板**（设置 → 制作人员）：每位角色的 CV 与各声线的署名 / 规约
- **文案重写**：关卡名、提示、按钮、弹窗、字幕全部改成短句口语，去掉套话和表情符号堆砌
- **美术**：咖啡前辈的卡牌头像收紧到脸部，去掉 AI 画坏的手
- **Windows 桌面版**：Electron 打包的 `release/美少女了个美/美少女了个美.exe`（无控制台窗口，存档在 `%APPDATA%\AnimeStack`）

**v2 内容**：15 关难度曲线 + 每日挑战、图案库、选关地图与星级、发牌/飞牌/粒子动效、字幕条不遮挡卡牌、14 种可一眼区分的卡牌。

其他：
- 技术栈：纯 HTML5 Canvas + JavaScript (ES Modules)，无第三方运行时依赖；完全离线（音效实时合成，BGM 与语音为预生成 ogg/mp3）
- 道具：移出 / 撤回 / 洗牌（每关各 1 次）+ 看广告复活（每关 1 次，当前为**广告占位**，可一行接入抖音激励视频）
- 竖屏 9:16，自动适配窗口；支持鼠标、触屏和键盘

| 主菜单 | 选关地图 | 关卡信息 |
| --- | --- | --- |
| ![](anime-stack-v3-menu.png) | ![](anime-stack-v3-levels.png) | ![](anime-stack-v3-level-info.png) |

| 第 1 关 先叠个三角 | 第 2 关 告白信 | 第 4 关 甜甜圈 | 第 5 关 BOSS 花蝴蝶来了 |
| --- | --- | --- | --- |
| ![](anime-stack-v3-level1.png) | ![](anime-stack-v3-level2.png) | ![](anime-stack-v3-level4.png) | ![](anime-stack-v3-level5.png) |

| 第 7 关 猫在看你 | 第 9 关 一闪一闪 | 第 11 关 半个月亮 | 第 12 关 楼梯别踩空 |
| --- | --- | --- | --- |
| ![](anime-stack-v3-level7.png) | ![](anime-stack-v3-level9.png) | ![](anime-stack-v3-level11.png) | ![](anime-stack-v3-level12.png) |

| 第 13 关 打个叉 | 第 14 关 叠罗汉 | 第 15 关 BOSS 樱花暴风雪 | 三消 + 连消 |
| --- | --- | --- | --- |
| ![](anime-stack-v3-level13.png) | ![](anime-stack-v3-level14.png) | ![](anime-stack-v3-level15.png) | ![](anime-stack-v3-clear.png) |

| 设置面板 | 制作人员 | 暂停 | 通关 | 地狱关通关 | 失败 | 复活 | 桌面版 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ![](anime-stack-v3-settings.png) | ![](anime-stack-v3-credits.png) | ![](anime-stack-v3-pause.png) | ![](anime-stack-v3-win.png) | ![](anime-stack-v3-hell-win.png) | ![](anime-stack-v3-fail.png) | ![](anime-stack-v3-revive.png) | ![](anime-stack-v3-desktop.png) |

---

## 一、如何运行

### 方式 0：Windows 桌面版（不需要浏览器）
双击 `release/美少女了个美/美少女了个美.exe`。整个 `美少女了个美` 文件夹要一起拷贝（exe 旁边的 dll / pak / resources 都是运行需要的）。
- 竖屏 9:16 窗口、无菜单栏、无控制台黑框；重复双击只会激活已打开的窗口
- 存档位置 `%APPDATA%\AnimeStack`（卸载 = 删文件夹 + 删这个目录）
- 重新打包：`npm install && npm run package:win`（在 Linux / Windows 上都可以，图标与版本信息用纯 JS 的 resedit 写入，不需要 wine）

### 方式 1：双击直接玩（最简单）
打开 `dist/index.html` 即可（已打包成单个经典脚本，`file://` 下不会有跨域问题，图片 / 语音都能正常加载）。

### 方式 2：双击 `start.bat`（推荐）
- 检测到 **Python** → 用 `python -m http.server` 启动本地服务器并自动打开浏览器
- 否则检测到 **Node.js** → 用 `node tools/serve.js` 启动服务器
- 都没有 → 直接用浏览器打开 `dist/index.html`

服务器地址：<http://localhost:8766/dist/index.html>（端口与《美少女合成》的 8765 错开，两个游戏可同时运行），关闭弹出的 "AnimeStack Server" 窗口即可停止服务。

### 方式 3：开发模式（修改源码时）
需要 Node.js 18+：
```bash
npm install          # 安装 esbuild / playwright (仅开发需要)
npm run build        # 打包 src/ -> dist/
npm run serve        # 启动本地服务器 http://localhost:8766/
```
- `http://localhost:8766/index.html`：**开发版**，直接加载 `src/` 下的 ES 模块源码（改完刷新即可，必须通过服务器访问）
- `http://localhost:8766/dist/index.html`：**发布版**，修改源码后需重新 `npm run build`

### 自动化测试
```bash
npx playwright install chromium   # 首次需要
npm run build && npm test         # 浏览器端测试 (90 项)
npm run test:logic                # 纯 Node 逻辑测试 (32 项：可解洗牌、无死局、存档边界、三种模拟玩家的难度阈值)
npm run check-levels              # 纯 Node：每关随机生成 300 次，打印难度曲线并校验可解性
npm run shots                     # 重新截取 docs/anime-stack-v3-*.png
npm run measure-audio             # 测量全部语音 / BGM / 音效响度 -> docs/audio-levels.md (加 -- --calibrate 自动校准音效)
npm run package:linux && xvfb-run -a npm run test:desktop   # 桌面版 (Electron) 测试 18 项
npm run build:douyin && npm run test:douyin                 # 抖音小游戏版：构建 + 包体 / 无 ogg / BGM 接缝检查 + 67 项测试 (无需真机)
npm run build:wechat && npm run test:wechat                 # 微信小游戏版：构建 + 包体 (主包 4 MB / 总 30 MB) / 无 ogg 检查 + 62 项测试 (无需真机)
```
微信版测试 `tools/test-wechat.mjs`（62 项）：0. 工程文件（game.json 分包、project.config.json appid 与配置一致、广告位留空、包体上限、只有 mp3、分享图 5:4 + 1:1）；A. **无 DOM** 的 Node 沙箱 + 桩 `wx`：启动、选中 WechatPlatform、分包、`getWindowInfo`、`showShareMenu` 含朋友圈、转发 / 朋友圈参数、触摸点牌、通关、存档、音效 mp3、没有调用录屏 / 侧边栏 API、切后台；B. Chromium + `tools/wechat-mock/wx-mock.js`：刘海 / 胶囊避让、菜单无侧边栏、不录屏、切后台暂停静音、激励视频三种结果与 adUnitId、结算页「分享给好友」→ `wx.shareAppMessage`、真实广告复活、BGM 接缝、音频实例数、重启后存档、未填广告位时免费「再试一次」且全程无广告。
抖音版测试 `tools/test-douyin.mjs`（67 项）：A. 在**没有 DOM**（无 window / document）的 Node 沙箱里用桩 `tt` 跑打包后的 `js/main.js`：启动、分包、触摸点牌、第 1 关通关、存档、录屏、音效文件、切后台；B. Chromium + `tools/douyin-mock/tt-mock.js` 模拟刘海屏：胶囊避让、侧边栏复访完整流程、侧边栏奖励只生效一局、自动录屏 → 分享录屏参数、录屏过短提示、激励视频看完 / 中途关闭 / 出错、真实广告复活、切后台暂停静音、音频实例数、重启后存档、未填广告位时免费「再试一次」且全程无广告、BGM 接缝两路交叉淡化。抖音包音频全部为 mp3（iOS 不支持 ogg），BGM 用 `tools/douyin_bgm.py` 生成无缝循环版并校验接缝静音 < 5 ms。
浏览器测试（无头 Chromium，14 组共 90 项）：`file://` 加载无控制台报错、25 句语音全部加载；默认音量、首次点击后音频解锁、BGM 文件播放并无缝循环、台词时 BGM 压低再恢复；设置面板各开关与音量滑块（含总音量）生效并写入存档、制作人员面板；第 1 关消除台词频率限制；选关地图的锁 / 星级 / 解锁动画；第 1 关**真实鼠标点击**通关并获得 3 星、解锁第 2 关；多个关卡图案（张数为 3 的倍数、层数、图案名）；被压住的卡点击无效；移出 / 撤回 / 洗牌各一次；卡槽 ≥5 张的心跳声、字幕条不遮挡卡牌；卡槽填满 → 看占位广告复活 → 再次失败结算；每日挑战同日布局一致、地狱关按参考解全部合法点击后通关；开发版源码可运行；**[13] 逻辑漏洞 / 边界情况 25 项**（发牌中点牌、撤回途中洗牌、双击、暂停/广告时点牌、暂停计时、第 7 张凑三不判负、撤回规则、移出 1 张、移出+复活叠层、重开道具恢复、暂存区收尾通关、洗牌后按新路线通关、每日跨午夜、心跳/语音随暂停离开停止、飞行中缩放窗口、触屏单击、localStorage 抛异常）。

逻辑测试 `tools/test-logic.mjs`（Node，32 项）：每关多个中盘局面洗牌后仍有解且花色数不变；卡槽有对子时洗牌后第三张可拿到；1458 个局面没有死局；存档边界（每日挑战不解锁、不计入总星数、重玩不倒退、localStorage 抛异常）；随机 / 贪心 / 贪心+全部道具三种模拟玩家都打不穿困难以上的关卡、第 5 关不是墙、前 4 关贪心可过。

## 二、玩法

| 操作 | 鼠标 / 触屏 | 键盘 |
| --- | --- | --- |
| 拿牌 | 点击亮着的卡牌 | — |
| 道具：移出 / 撤回 / 洗牌 | 底部三个按钮 | 1 / 2 (或 Ctrl+Z) / 3 |
| 暂停 | 右上角 ⏸ | P / Esc |
| 开始游戏（菜单） | 「开始游戏」 | Enter / 空格 |

- 卡牌按关卡图案分多层叠放（半张 / 1/4 / 斜向 / 砖墙错位、高塔、随机散落）。**只要被上层任意一张卡压住一角，就会变暗、不能点击**
- 部分关卡底部左右有**侧边牌堆**，只能拿最上面一张
- 点击的卡飞入 7 格卡槽，并自动**插到同款卡旁边**；同款凑满 3 张 → 消除（闪光粒子 + 音效 + 语音 + 字幕）；短时间内连续消除显示「连消 xN」
- 卡槽 5 张时托盘泛琥珀色光并响起心跳声，6 张时变红、心跳加快并播放警告语音；**填满 7 格且无法消除 → 失败**
- 场上与卡槽全部清空 → 通关。星级：**3 星** = 不用道具且不复活，**2 星** = 不复活，**1 星** = 通关；通关后解锁下一关

### 道具（每关各 1 次）
每关 3 个道具 + 1 次复活、重开即恢复——与原版同量级：新手关不用道具也能过，BOSS 关需要合理使用；用道具最高 2 星，复活最高 1 星。
| 道具 | 效果 |
| --- | --- |
| 移出 | 把卡槽最左边最多 3 张（不足 3 张就移出全部）已落槽的卡移到「暂存区」，暂存区的卡可以再次点击；若暂存区还有卡，新的一批叠在最高一层上面并压住下层；移出后不能再撤回 |
| 撤回 | 把上一张放入卡槽的卡放回原位（如果那一步刚好凑成三张已经消除，则不能撤回） |
| 洗牌 | 重新分配场上剩余卡牌的花色，位置不变；**保证洗完仍有解**：结合卡槽里已有的卡重新排一条合法取牌路线，用求解器验证（最多 300 次 / 250 ms，失败才退回纯随机并提示「这局有点悬了…」） |
| 复活 | 卡槽填满时弹出，**观看激励视频广告**后自动移出 3 张卡继续游戏；每关 1 次。提前关闭广告不发奖励 |

### 存档
`localStorage`（键名 `animeStack.save.v2`）保存：已解锁关卡、各关最高星级 / 通关次数 / 最佳清除进度、每日挑战通关日期、设置（总音量、背景音乐、音效、语音的开关与音量，设置版本 3）。所有读写都有 `try/catch`，不可用时自动退化为内存存档。

---

## 三、关卡设计与难度曲线

配置文件：`src/config/LevelConfig.js`（参数说明见文件头注释）。`npm run check-levels` 的输出（每关随机生成 200 次）：

| 关 | 名称 | 档位 | 图案 / 错位 | 张数（牌桌+牌堆） | 层数 | 种类 | 参考解可清空 | 随机乱点 | 贪心 | 贪心+全部道具 (其中未复活) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 先叠个三角 | 简单 | 金字塔 / 半张 | 27 (27+0) | 2 | 3 | 200/200 | 100.0% | 100.0% | 100.0% (100.0%) |
| 2 | 告白信 | 简单 | 爱心 / 半张 | 36 (36+0) | 3 | 4 | 200/200 | 17.5% | 95.5% | 100.0% (100.0%) |
| 3 | 菱形饼干 | 简单 | 菱形 / 1/4 | 45 (45+0) | 3 | 5 | 200/200 | 0.0% | 82.0% | 100.0% (99.0%) |
| 4 | 甜甜圈 | 普通 | 甜甜圈 / 斜向 | 63 (63+0) | 3 | 6 | 200/200 | 0.0% | 71.5% | 98.5% (96.5%) |
| **5** | **花蝴蝶来了** | **BOSS·困难** | 蝴蝶 / 半张 | 96 (84+12) | 6 | 8 | 200/200 | 0.0% | **13.0%（v3：105 张 10 种，3%）** | 76.5% (58.5%) |
| 6 | 十字路口 | 普通 | 十字 / 砖墙 | 66 (66+0) | 5 | 6 | 200/200 | 0.0% | 57.5% | 98.0% (90.5%) |
| 7 | 猫在看你 | 普通 | 猫猫脸 / 半张 | 72 (60+12) | 5 | 7 | 200/200 | 0.0% | 47.0% | 95.0% (85.5%) |
| 8 | 兔耳朵 | 困难 | 兔耳朵 / 砖墙 | 96 (84+12) | 6 | 8 | 200/200 | 0.0% | 29.5% | 77.5% (65.5%) |
| 9 | 一闪一闪 | 困难 | 星星 / 半张 | 84 (84+0) | 5 | 7 | 200/200 | 0.0% | 22.0% | 76.0% (53.5%) |
| **10** | **女王驾到** | **BOSS·地狱** | 皇冠 / 半张 | 150 (126+24) | 7 | 12 | 200/200 | 0.0% | **0.0%** | 4.0% (1.5%) |
| 11 | 半个月亮 | 困难 | 月牙 / 1/4 | 123 (123+0) | 7 | 7 | 200/200 | 0.0% | 15.5% | 59.0% (41.0%) |
| 12 | 楼梯别踩空 | 噩梦 | 阶梯 / 斜向 | 102 (102+0) | 6 | 8 | 200/200 | 0.0% | 14.5% | 51.5% (33.0%) |
| 13 | 打个叉 | 噩梦 | X 字 / 半张 | 111 (95+16) | 6 | 9 | 200/200 | 0.0% | 10.5% | 56.5% (40.0%) |
| 14 | 叠罗汉 | 噩梦 | 高塔 / 高塔叠放 | 135 (117+18) | 6 | 14 | 200/200 | 0.0% | 6.5% | 64.0% (48.5%) |
| **15** | **樱花暴风雪** | **BOSS·地狱** | 散落花瓣 / 随机散落 | 168 (144+24) | 8 | 14 | 200/200 | 0.0% | **0.0%** | 9.5% (1.5%) |
| 每日 | 今日份 | 困难 | 按星期轮换 / 半张 | 84 (72+12) | 5 | 8 | 200/200 | 0.0% | 32.5% | 85.5% (70.5%) |

三种模拟玩家（`tools/players.mjs`）用作难度的量化参考：**随机乱点** = 每步随便点一张；**贪心** = 每步优先拿能凑成三张 / 已在槽里的花色，不用道具；**贪心+全部道具** = 同样的贪心，但卡槽危险时依次用撤回、移出、洗牌，满了再看广告复活（括号里是没用到复活、还能拿 2 星的比例）。结论：随机乱点只能过前两关；困难以上任何一种笨策略都打不穿（贪心 ≤ 33%；用光道具 52~86%，其中不靠复活的只有 33~71%，而用了道具最多 2 星、复活只有 1 星，3 星必须自己规划）；地狱关用光道具也只有 4~10%。噩梦档 12~14 关用道具后的通过率在 51~64% 之间（叠罗汉 14 种花色 + 洗牌保证有解，道具收益偏大），属于同档内的正常波动。`npm run test:logic` 会自动检查这些阈值。

普通关平滑下降。第 5 关是第一个 BOSS：比前后关明显难（贪心 13%，用上道具 + 复活约 77%），但不再是"墙"；第 10、15 关才是 0% 的地狱关（只存在"参考解"，需要规划 + 道具 + 复活），地狱 BGM 留给 BOSS 关。第 1 关是教学关（27 张 3 种），故意不设难度。

### 图案库（`src/config/PatternLibrary.js`）
每个图案是牌桌归一化坐标 `u, v ∈ [-1, 1]` 上的形状遮罩，两种写法：
```js
heart2: { name: '爱心2', inside: (u, v) => (u*u + v*v - 0.6) ** 3 - u*u * v*v*v < 0 },   // 数学函数
cat2:   { name: '猫猫2', ascii: ['#..#', '####', '#.##', '####'] },                       // ASCII 图，自动拉伸
```
关卡里写 `pattern: 'heart2'` 即可使用。生成规则：
- `mode` 错位方式：`half` 半张 / `quarter` 1/4 / `diagonal` 斜向 / `brick` 砖墙 / `tower` 高塔叠放 / `scatter` 随机散落（`OFFSET_MODES` 里可新增）
- `shrink` 每往上一层形状收缩的比例（金字塔式收顶）；`fill` 卡牌 4 个采样点至少几个在形状内（默认 3）
- **自动适配**：写了 `maxCards` 而没写 `shrink` / `scale` 时，生成器自动搜索收缩比例（底层保持完整轮廓），必要时再搜索缩放比例，让张数刚好够用；多余的卡优先去掉**被完全盖住**的卡，再去掉最外圈顶层卡，保证图案轮廓清晰
- 仍兼容 v1 的手绘层写法 `layers: [{ ox, oy, rows: ['XX.X', ...] }]`

### 生成算法（保证理论可解）
`src/systems/LayoutGenerator.js`，"反向放置"思路：
1. 由图案算出全部卡位 `(x, y, layer)`
2. 模拟清空桌面：每次从当前**未被压住**的卡位中随机取一个 → 得到一条合法的取牌顺序
3. 沿该顺序分配花色，同时模拟虚拟卡槽：以概率 `pNew` 开启新花色，否则补齐槽内已有花色；**槽内滞留始终 ≤ maxHold ≤ 6**，所以按这个顺序拿牌永远不会填满；花色以 3 张一组分配
4. 这条顺序就是**参考解**；新手关（`verify: 'greedy'`）还要求贪心玩家能通关，否则换种子重生成

### 调参建议
- **更简单**：减少 `types` / 层数 / `maxCards`、`maxHold` 调到 2~3、`pNew` 调低
- **更难**：增加 `types`（最多 14）、层数、`maxHold` 5~6、`pNew` 0.7+、加侧边牌堆
- 注意 `pNew` 对难度的影响并非单调，改完一定跑 `npm run check-levels` 看曲线
- 增加关卡：在 `LEVELS` 里追加一项即可，选关地图自动延伸

---

## 四、音频

做法与姊妹作《美少女合成》一致：语音和 BGM 是离线生成的文件，音效用 WebAudio 实时合成。浏览器要求首次点击后才能发声（桌面版不受限制）。

### 混音与响度（`src/config/AudioConfig.js`、`src/systems/MixerSystem.js`）
- 通道：总音量 → 背景音乐 / 音效 / 角色语音；每个通道有开关和 0~200% 的滑条（100% = 默认值），总音量 0~100%
- 默认值：语音 **0.30**、音效 **0.12**、BGM **0.15**；旧版本存档里的音量设置会被丢弃（`SETTINGS_VERSION = 3`）
- 文件响度：语音 **-20 LUFS**（真峰值 ≤ -3 dB）、BGM **-22 LUFS**；音效按 `tools/measure_audio.mjs` 里的目标逐个校准（`src/config/SfxTrim.js`）
- 角色说话时 BGM 用 0.12 s 压下去到 ×0.55，说完 0.6 s 慢慢回来；通关/失败时 BGM 也会让一下
- 音效总线最后有一个安全压缩器，防止多个音效叠加时爆音

| 类别 | 数量 | 文件/引擎响度 | 最高峰值 | 默认音量 | 游戏内响度 |
| --- | --- | --- | --- | --- | --- |
| 语音 (积分 LUFS) | 25 | -21.2 ~ -20.3 (平均 -20.8) | -3.2 dBFS | 0.30 | ≈ -31.2 LUFS |
| BGM (积分 LUFS) | 3 | -22.0 ~ -22.0 | -7.7 dBFS | 0.15 | ≈ -38.5 LUFS (台词时 ×0.55 → -43.7) |
| 音效 (瞬时最大 LUFS) | 23 | -28.0 ~ -13.0 | 1.1 dBFS | 0.12 | -46.4 ~ -31.4 LUFS |

完整数据见 `docs/audio-levels.md`（每个文件的积分 / 瞬时最大响度与峰值）。

### BGM（`tools/compose_bgm.py` 程序化作曲，ogg 优先、mp3 兜底）
| 文件 | 曲名 | 场合 | 调式 / 速度 | 长度 |
| --- | --- | --- | --- | --- |
| `bgm_menu` | 樱花便当 | 菜单 / 选关 / 结算 | F 大调 84 BPM 摇摆，八音盒 + 电钢琴 + 柔和贝斯 + lo-fi 鼓（极轻黑胶底噪） | 24 小节 68.6 s |
| `bgm_game` | 午休三连 | 普通关 | C 大调 112 BPM，马林巴主旋律 + 反拍拨弦 + 跳跃贝斯 + 拍手鼓组 + 钟琴 | 32 小节 68.6 s |
| `bgm_hell` | 满槽警报 | BOSS·地狱关 | D 小调 138 BPM，16 分琶音 + 方波主旋律 + 弦乐铺底 + 四踩底鼓 | 24 小节 41.7 s |

混响尾巴会叠回曲子开头，所以循环点听不出接缝；切换场景时交叉淡入淡出。重新作曲：`python tools/compose_bgm.py [menu game hell] [--preview]`（需要 numpy 和 ffmpeg）。

### 音效（23 种，`src/systems/SfxEngine.js`）
click（按钮：软"啵"一声 + 一点木质点击）、hover（悬停：很轻的高音"叮"）、toggle（开关：两音拨片 (开上行、关下行)）、pick（拿牌："嗒"的木片声，音高跟花色走，带随机抖动）、land（落槽：卡片拍进木托盘的闷响）、deny（点到被压住的卡：两下闷闷的"嘟"）、deal（发牌：纸牌擦过桌面的"唰"）、clear（三消：三音钟声 + 气泡 + 闪光，连消时整体升调）、combo（连消 ×2 起：快速上行的钟琴音阶）、warn（卡槽剩 1 格：柔和的双音提示）、heartbeat（卡槽 5 张起：低频心跳 (6 张更快)）、moveOut（移出：向上扫的风声 + 上滑音）、undo（撤回：倒带式下滑音）、shuffle（洗牌：一串纸牌拨动声）、revive（复活：铺底和弦慢慢涨起来 + 上行钟声）、tick（倒计时 / 滑条：木鱼"嗒"）、start（开局：三个上行小钟）、victory（通关：钟声琶音 + 和弦）、bigVictory（BOSS 通关：两段琶音 + 闪光长尾）、gameover（失败：下行的柔和三角波，带低通"泄气"）、unlock（解锁关卡：钟琴快速上行）、star（得星：单颗钟声，一颗比一颗高）、whoosh（切换页面：很轻的风声）。

每个音效由 2~4 层组成（振荡器 / 噪声 / 钟声 + 包络 + 共用的小房间混响），每次播放音高有 ±几音分的随机抖动；连消时三消音沿 C 大调五声音阶逐级升高；同一个音效在很短时间内重复触发会被限频。

### 角色语音（AivisSpeech）
| # | 角色 | 声线 (AivisSpeech 模型) | 主要风格 | 语速 | 抑扬 | 音高 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 见习学妹 | 黄金笑 | ノーマル | 1.18× | 1.35 | +0.02 |
| 2 | 元气同学 (主持) | リダ | 元気 | 1.22× | 1.5 | +0.01 |
| 3 | 图书委员 | 黄金笑 | ノーマル | 1.15× | 1.25 | 0 |
| 4 | 社团部长 | リダ | 元気 | 1.22× | 1.45 | -0.01 |
| 5 | 偶像练习生 | リダ | 元気 | 1.22× | 1.5 | +0.03 |
| 6 | 魔法少女 | 黄金笑 | Positive | 1.2× | 1.5 | +0.03 |
| 7 | 精灵巫女 | 黄金笑 | ノーマル | 1.15× | 1.3 | -0.02 |
| 8 | 星辉歌姬 | リダ | 元気 | 1.2× | 1.45 | +0.02 |
| 9 | 月之公主 | 黄金笑 | Negative | 1.15× | 1.3 | -0.01 |
| 10 | 天空女王 | リダ | クール | 1.18× | 1.4 | -0.03 |
| 11 | 星海女神 | 黄金笑 | ノーマル | 1.15× | 1.3 | -0.03 |
| 12 | 女仆店长 | リダ | 元気 | 1.22× | 1.45 | +0.02 |
| 13 | 神社巫女 | 黄金笑 | Positive | 1.2× | 1.45 | +0.01 |
| 14 | 咖啡前辈 | リダ | 落ち着き | 1.15× | 1.25 | -0.04 |

生成流程（`npm run voices`，需要本机运行 AivisSpeech Engine，默认 `http://127.0.0.1:10101`，可用 `--engine` 指定；`--resume` 跳过已生成的版本；缺少的模型会自动安装，已安装的不会重复下载）：
1. `tools/generate_voices.mjs`：按台词的情绪标签选风格 → `audio_query`（语速 1.15~1.22×、`pauseLengthScale` 0.6、句首/句尾留白 0.04/0.06 s、音高 ±0.03 抖动）→ `synthesis`；每句 8 个版本（抑扬强度 / 节奏起伏 / 语速各不相同）
2. `tools/voice_post.py`：去首尾静音 → 90 Hz 高通 → 小房间混响（星海女神稍多）→ 4 kHz 轻微衰减 + 齿音抑制 → 测量后精确增益到 -20 LUFS（限幅 -3 dBFS）→ mp3 96 kbps 单声道（不再加气声）
3. `tools/pick_voice_takes.py build/voice-aivis [--model small]`：用 faster-whisper 识别每个版本，只保留字符错误率 ≤ min(0.3, 最好+0.05) 的版本，再按"表现力"（音高起伏 + 响度动态，时长不在 1.2~3.3 s 的扣分）挑一条，写入 `assets/audio/voice/`，选择结果记录在 `build/voice-picked.json`

授权（2026-10-11 逐个核对模型页 / 作者规约；本作由公司主体出品，只用**允许法人商用、无需事先联系**的模型，详见 `docs/licenses/README.md`）：

| 声线 | 署名 | 规约 |
| --- | --- | --- |
| リダ | リダ / Lida (youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join) | 作者规约：商用・非商用可，须署名；禁止二次配布、学习素材、暴力・色情用途；作者注明条款可能随时变更 |
| 黄金笑 | Tαkoe:AivisSpeech:黄金笑 | Tαkoeプロジェクト利用規約：商用・法人利用可，须著作权表示；禁止赌博相关、宗教、损害角色形象、模型无改动再配布 |

- v3.3 起**不再使用** コハク / まお（Trippy 二次創作ガイドライン第4条2：法人・营利事业者须事先联系）、凛音エル（電脳天使工業规约：企业利用须联系）、らせつん / みちのくあいり（こずかた学園ガイドライン：企业长期商用须咨询）；对应语音已全部重新生成
- **未使用** リアボVC 系列模型；也不再使用 VOICEVOX
- 以上署名已放进游戏「设置 → 制作人员」、本文档和 `assets/audio/README.txt`

---

## 五、卡牌一览（14 种）

| # | 名称 | 角标宝石 | 主题色 |
| --- | --- | --- | --- |
| 1 | 见习学妹 | 爱心 | `#ff5c8a` |
| 2 | 元气同学 | 星星 | `#ff9f1c` |
| 3 | 图书委员 | 菱形 | `#3a86ff` |
| 4 | 社团部长 | 四叶草 | `#2ec27e` |
| 5 | 偶像练习生 | 圆珠 | `#ff70c8` |
| 6 | 魔法少女 | 月牙 | `#9b5de5` |
| 7 | 精灵巫女 | 三角 | `#e63946` |
| 8 | 星辉歌姬 | 水滴 | `#00b4d8` |
| 9 | 月之公主 | 六边形 | `#8e7dff` |
| 10 | 天空女王 | 皇冠 | `#ffc300` |
| 11 | 星海女神 | 四芒星 | `#7b2cbf` |
| 12 | 女仆店长 | 方块 | `#6d4c41` |
| 13 | 神社巫女 | 蝴蝶结 | `#d00000` |
| 14 | 咖啡前辈 | 叶子 | `#14a098` |

每张卡右上角都有**不同形状 + 不同颜色**的宝石角标，缩小到 62px 也能一眼区分。

### 角色语音台词（25 句）
配置：`src/config/VoiceConfig.js`；语音文件：`assets/audio/voice/<id>.mp3`。消除时由被消掉的那位角色自己说；开局 / 危险 / 胜利 / 失败 / 复活由「元气同学」（リダ）负责。

| id | 场合 | 角色 | 情绪 | 风格 | 台词 | 字幕中文 |
| --- | --- | --- | --- | --- | --- | --- |
| `c01_1` | clear | 见习学妹 | shy | 黄金笑·ノーマル | えっ、消えた…やったぁ | 诶，消掉了……好耶 |
| `c02_1` | clear | 元气同学 | happy | リダ·元気 | よしっ、三つそろった！ | 好嘞，凑齐三个！ |
| `c03_1` | clear | 图书委员 | calm | 黄金笑·ノーマル | ふふ、いい読みですね | 嗯哼，看得很准嘛。 |
| `c04_1` | clear | 社团部长 | happy | リダ·元気 | よーし、その調子！ | 好——就这样！ |
| `c05_1` | clear | 偶像练习生 | happy | リダ·元気 | やったー！今の見てた？ | 耶！刚才那下看到没？ |
| `c06_1` | clear | 魔法少女 | happy | 黄金笑·Positive | えーいっ！消えちゃえ！ | 嘿！消失吧！ |
| `c07_1` | clear | 精灵巫女 | calm | 黄金笑·ノーマル | まあ、お見事ですわ | 哎呀，漂亮。 |
| `c08_1` | clear | 星辉歌姬 | happy | リダ·元気 | いいね、ノってきた！ | 不错，来感觉了！ |
| `c09_1` | clear | 月之公主 | sleepy | 黄金笑·Negative | ふわぁ…あ、消えてる | 呼啊……啊，已经消掉了 |
| `c10_1` | clear | 天空女王 | smug | リダ·クール | ふん、まあまあね | 哼，还行吧。 |
| `c11_1` | clear | 星海女神 | calm | 黄金笑·ノーマル | うん、上手。見てたよ | 嗯，很棒。我看着呢。 |
| `c12_1` | clear | 女仆店长 | happy | リダ·元気 | はーい、お片付け完了です！ | 好——收拾完毕！ |
| `c13_1` | clear | 神社巫女 | happy | 黄金笑·Positive | おっ、大吉かも！ | 哦，说不定是大吉！ |
| `c14_1` | clear | 咖啡前辈 | calm | リダ·落ち着き | うん、いいペースだね | 嗯，节奏不错呢。 |
| `start_1` | start | 元气同学 | happy | リダ·元気 | よーし、いくよっ！ | 好——开始咯！ |
| `start_2` | start | 元气同学 | smug | リダ·クール | お、今日もやる？ | 哦，今天也来？ |
| `startBoss_1` | startBoss | 元气同学 | panic | リダ·元気２ | うそっ、これ全部消すの！？ | 不会吧，这些全要消掉？！ |
| `warn_1` | warn | 元气同学 | panic | リダ·元気２ | ちょっと、もうパンパン！ | 等下，快塞满了！ |
| `warn_2` | warn | 元气同学 | panic | リダ·元気２ | あと一枠だよ！ | 只剩一格了！ |
| `win_1` | win | 元气同学 | happy | リダ·元気 | やった！クリアだよ！ | 好耶！过关啦！ |
| `win_2` | win | 元气同学 | smug | リダ·クール | えへへ、さすがだね | 嘿嘿，不愧是你。 |
| `winBoss_1` | winBoss | 元气同学 | happy | リダ·元気 | うそっ、ほんとに勝っちゃった！ | 不会吧，真的赢了！ |
| `lose_1` | lose | 元气同学 | sulky | リダ·悲しみ | もう～、惜しかったぁ… | 哎呀——就差一点…… |
| `lose_2` | lose | 元气同学 | shy | リダ·キュート | ドンマイ、もう一回ね？ | 没事，再来一次？ |
| `revive_1` | revive | 元气同学 | happy | リダ·元気 | よしっ、まだいける！ | 好，还能打！ |

语音系统规则（`src/systems/VoiceSystem.js`）：`HTMLAudioElement` 播放（`file://` 也能出声）；同时只说一句，两句之间至少 0.6 秒；优先级 BOSS 通关 > 通关 > 失败 > 开局/复活 > 危险 > 消除，高优先级打断低优先级；消除台词限频（每关第一次和连消必说，其余至少间隔 7 秒且 35% 概率）；开始/结束时发出 `voice:start` / `voice:end`，BGM 据此压低；mp3 加载失败自动改用 `speechSynthesis`（ja-JP）。字幕条（日文 + 中文 + 说话角色的小头像）显示在顶部 HUD 下方约 2.2 秒（不遮挡卡牌），静音时照常显示。

---

## 六、项目结构

```
AnimeStack/
├─ index.html              开发版入口 (ES Module，需本地服务器)
├─ start.bat               Windows 一键启动
├─ package.json            npm 脚本: build / serve / test / check-levels / shots / process-images / voices
├─ dist/                   ★ 发布版 (双击 dist/index.html 即可玩)
│  ├─ index.html  game.js (esbuild 打包)  style.css
│  └─ assets/  images/card_XX.png, bg.jpg   audio/voice/*.mp3
├─ douyin/                ★ 抖音小游戏工程模板：douyin.config.js (AppID / 广告位)、game.js、game.json (分包)、entry.js (打包入口)
├─ build-douyin/           npm run build:douyin 的输出 = 交付的「抖音小游戏」文件夹 (直接导入抖音开发者工具)
├─ wechat/                ★ 微信小游戏工程模板：wechat.config.js (AppID / 广告位 / 分享)、game.js、game.json (分包)、project.config.json、entry.js
├─ build-wechat/           npm run build:wechat 的输出 = 交付的「微信小游戏」文件夹 (直接导入微信开发者工具)
├─ src/
│  ├─ main.js              入口：创建 Game 并启动
│  ├─ platform/            平台抽象层：index.js (按 __DOUYIN__ / __WECHAT__ 选择)、WebPlatform.js、DouyinPlatform.js (tt.*)、WechatPlatform.js (wx.*，继承抖音实现、覆盖分享 / 屏幕 / 无录屏侧边栏)、DyAudio.js、LoopAudio.js (小游戏 BGM 两路交叉淡化无缝循环)
│  ├─ debug.js             调试 / 自动化测试钩子 window.__ANIME_STACK__.debug
│  ├─ config/
│  │  ├─ GameConfig.js     画面 / 卡牌尺寸 / 各区域布局 / 节奏 / 配色 / 广告位
│  │  ├─ CardConfig.js     14 种卡牌 (图片、名称、主题色、宝石)
│  │  ├─ LevelConfig.js    15 关 + 每日挑战 的图案与难度参数、难度档位 TIERS
│  │  ├─ PatternLibrary.js 图案库 (形状遮罩 / ASCII) + 错位方式
│  │  └─ VoiceConfig.js    台词 (日文/中文/TTS 文本)、优先级
│  ├─ core/
│  │  ├─ Game.js           主循环、画布缩放、全局服务装配
│  │  ├─ EventBus.js       事件总线 (发布/订阅)
│  │  ├─ StateMachine.js   有限状态机
│  │  ├─ Scene.js / SceneManager.js  场景基类 / 切换 + 淡入淡出 + 输入分发
│  │  ├─ AssetLoader.js    图片预加载 (失败时生成占位卡)
│  │  ├─ Tween.js          补间动画 (飞行弧线、让位、消除、翻面)
│  │  └─ Random.js         可设种子随机数 (每日挑战)
│  ├─ scenes/
│  │  ├─ BootScene.js      加载进度 + 生成"被压住"的暗色贴图
│  │  ├─ MenuScene.js      主菜单 (Logo、继续/开始、选关、每日挑战、设置、玩法说明)
│  │  ├─ LevelSelectScene.js 选关地图 (锁、星级、BOSS 关、解锁动画、关卡信息)
│  │  ├─ GameScene.js      组合各系统 (playing / paused / failed / ad / won)
│  │  └─ ResultScene.js    胜利 (地狱关大庆祝) / 失败结算
│  ├─ systems/
│  │  ├─ LayoutGenerator.js 图案 → 自动适配 → 卡位 → 合法取牌顺序 → 花色分配 (保证可解)
│  │  ├─ CoverSystem.js    遮挡判定：更高层 + 矩形相交 = 被压住
│  │  ├─ Solver.js         参考解校验 / 贪心求解器 / 提示
│  │  ├─ BoardSystem.js    牌桌：发牌动画、点击拾取、洗牌、绘制
│  │  ├─ SlotSystem.js     7 格卡槽：同款插队、让位、飞行落地
│  │  ├─ MatchSystem.js    三张消除、连消
│  │  ├─ PropSystem.js     移出 / 撤回 / 洗牌 / 复活
│  │  ├─ AdService.js      ★ 激励视频广告 (占位 / 抖音 / 自定义 provider)
│  │  ├─ InputSystem.js    Pointer Events + 键盘 → 540×960 逻辑坐标
│  │  ├─ MixerSystem.js    混音器：总音量 / BGM / 音效 / 语音 的开关与音量 (存档)
│  │  ├─ AudioSystem.js    音效总线 + 安全压缩器 + 限频 + 心跳
│  │  ├─ SfxEngine.js      23 种分层合成音效 (五声音阶、音高抖动、混响)
│  │  ├─ BgmSystem.js      BGM 文件播放、交叉淡入淡出、语音时压低
│  │  ├─ VoiceSystem.js    AivisSpeech 角色语音 (单句、冷却、优先级、限频)
│  │  ├─ SubtitleSystem.js 字幕条 (顶部)
│  │  ├─ EffectSystem.js   粒子、光环、飘字、闪光、震屏、彩带
│  │  └─ SaveSystem.js     localStorage 存档 v2 (星级、解锁、设置)
│  ├─ entities/Card.js     卡牌实体 (位置/层/区域/状态 + 绘制)
│  └─ ui/
│     ├─ HUD.js            顶部关卡/剩余/进度 + 底部道具按钮
│     ├─ SlotBar.js        木质卡槽托盘 + 暂存区占位
│     ├─ Dialog.js         通用弹窗 (暂停、复活、玩法说明)
│     ├─ SettingsPanel.js  设置面板 (4 路开关 + 音量滑块)
│     ├─ CreditsPanel.js   制作人员 (CV / 声线署名与规约)
│     ├─ Logo.js           标题 Logo
│     ├─ AdOverlay.js      「广告占位」画面 (5 秒倒计时)
│     ├─ Button.js         画布按钮 + 图标
│     └─ draw.js           绘制工具 (圆角、描边文字、樱花背景)
├─ assets/
│  ├─ images/card_01..14.png   卡牌贴图 (160×176：奶油色边框 + 头像 + 厚度 + 宝石角标)
│  ├─ images/bg.jpg            竖屏背景 (樱花天空 + 木桌)
│  ├─ images/source/           原始立绘 girl_XX_raw.jpg (1280×720) 与 bg_raw.jpg
│  ├─ images/cutout/           去背景后的立绘 (卡牌与图标的中间文件)
│  ├─ icons/                   app.ico / app.png / favicon.png
│  ├─ audio/voice/*.mp3        角色语音 25 句 (AivisSpeech)
│  └─ audio/bgm/*.ogg|mp3      BGM 3 首
├─ tools/
│  ├─ build.mjs            esbuild 打包脚本
│  ├─ serve.js             零依赖本地静态服务器
│  ├─ process_images.py    原图 → 卡牌贴图 / 背景 (Pillow)
│  ├─ generate_voices.mjs  台词 → AivisSpeech 多版本合成 (情绪 → 风格)
│  ├─ voice_post.py        语音后期 (混响、EQ、-20 LUFS)
│  ├─ pick_voice_takes.py  用语音识别挑最好的版本
│  ├─ compose_bgm.py       程序化作曲 → ogg / mp3 (-22 LUFS, 无缝循环)
│  ├─ measure_audio.mjs    响度测量 / 音效校准 → docs/audio-levels.md
│  ├─ make_icons.py        应用图标 (cutout 立绘缺失时自动改用 card_11.png)
│  ├─ package.mjs          Electron 打包 (win / linux)
│  ├─ win-resources.mjs    写入 exe 图标与版本信息 (resedit)
│  ├─ test-desktop.mjs     桌面版自动化测试
│  ├─ build-douyin.mjs     抖音小游戏构建 (esbuild __DOUYIN__=true + 资源 + 分包 + 包体检查)
│  ├─ render_douyin_assets.mjs  预渲染抖音用的音效 mp3 / 暗色卡牌 / 分享图 (缓存 build/douyin-assets/)
│  ├─ compress_images.py   抖音包图片压缩 (png 调色板 / jpg q82)
│  ├─ douyin_bgm.py        抖音 BGM 无缝循环版 (循环体 + 0.5 s 延续，gapless mp3，接缝静音校验)
│  ├─ test-douyin.mjs      抖音版测试 (Node 无 DOM + Chromium tt 模拟)，--store 生成商店截图
│  ├─ douyin-mock/         tt.* 浏览器模拟层 (仅测试用)
│  ├─ make_douyin_store.py 商店图标 / 推荐卡片 / 搜索图 / 加载图
│  ├─ check_levels.mjs     难度曲线 + 可解性批量检查 (Node)
│  ├─ shots.mjs            截图工具 (Playwright)
│  └─ test.mjs             Playwright 自动化测试
│  ├─ test-logic.mjs       纯 Node 逻辑测试 (可解洗牌 / 无死局 / 存档)
├─ desktop/main.js        Electron 主进程 (窗口、单实例、存档目录)
├─ release/美少女了个美/  Windows 桌面版 (exe + 运行库)
└─ docs/                  本文档、截图、audio-levels.md
```

### 架构图

```
                    ┌──────────────────────────────── Game ─────────────────────────────────┐
  window / canvas → │  InputSystem ──emit──►  EventBus  ◄──on── Audio/Bgm/VoiceSystem        │
                    │                           ▲   │                                        │
                    │  SaveSystem  AdService    │   │ input:* 转发                            │
                    │  AssetLoader              │   ▼                                        │
                    │                     SceneManager (淡入淡出)                            │
                    │       ┌──────────┬─────────┴──┬──────────────┐                         │
                    │   BootScene  Menu/LevelSelect GameScene ResultScene                  │
                    └──────────────────────────────┼────────────────────────────────────────┘
                                                   │ LevelConfig → LayoutGenerator → 卡位 + 花色 + 参考解
                                                   │ StateMachine: playing / paused / failed / ad / won
     ┌──────────────┬──────────────┬───────────────┼──────────────┬───────────────┬────────────┐
 BoardSystem    CoverSystem     SlotSystem     MatchSystem     PropSystem      TweenManager   HUD/Dialog
 (Card 实体)    (遮挡判定)      (7 格卡槽)      (三张消除)      (道具/复活)──►AdService.showRewardedAd()
     │ 点击 → tryPick(card) ──► slot.add → match.check ──► emit('match' / 'card:pick' / 'slot:warn' …)
     │                                                       │ (EventBus)
     │                         ┌─────────────────────────────┼─────────────────┬──────────────┐
     │                   EffectSystem                  AudioSystem       VoiceSystem ──voice:line──► SubtitleSystem
```

数据流：`InputSystem` 把鼠标/触屏转换为 540×960 逻辑坐标 → `SceneManager` 转发给 `GameScene` → `BoardSystem.topAt()` 找到最上层的卡 → `tryPick()` 检查 `CoverSystem` 的 free 标记 → `SlotSystem.add()` 插到同款旁边并开始飞行补间 → `MatchSystem.check()` 凑满 3 张立即移出卡槽并在落地后播放消除 → 发出 `match` 事件，特效 / 音效 / 语音 / 字幕各自响应。系统之间通过事件总线解耦；关卡难度差异全部体现在 `LevelConfig` 数据中。

主要事件：`level:start`、`card:pick`、`card:land`、`card:deny`、`match`、`match:done`、`slot:warn`、`prop:moveOut / undo / shuffle / denied`、`revive`、`ad:open / tick / closed`、`level:fail`、`level:win`、`voice:line`、`voice:start`、`voice:end`、`mixer:change`。

---

## 七、如何换皮 (Reskin)

1. **替换卡牌图片**
   - 最简单：用自己的 **160×176 PNG**（正面 160×160 + 底部 16px 厚度）覆盖 `assets/images/card_01.png` ~ `card_14.png`
   - 或者：把原图（横图，脸部水平居中）放到 `assets/images/source/girl_XX_raw.jpg`，运行 `python tools/process_images.py`（需要 `pip install pillow`），自动裁成方形头像并加奶油色边框、厚度和宝石角标
     - 裁切范围：脚本里的 `CROP`（正方形边长占原图高度的比例、顶部偏移），头部较高的角色可单独调大
     - 宝石颜色 / 形状：脚本里的 `GEMS`（支持 heart / star / diamond / clover / circle / moon / triangle / drop / hexagon / crown / star4 / square / ribbon / leaf）
2. **替换背景**：覆盖 `assets/images/source/bg_raw.jpg` 后重新运行脚本（自动竖屏 cover 裁切），或直接覆盖 `assets/images/bg.jpg`（建议 720×1280）
3. **修改卡牌名称 / 主题色 / 数量**：编辑 `src/config/CardConfig.js`。增加卡牌种类后，关卡的 `types` 才能调得更大
4. **修改标题、配色、版面**：`src/config/GameConfig.js`（`title`、`colors`、`card.size`、`board`、`slot`、`pileRowY`、`propsY` 等）
5. **修改关卡**：`src/config/LevelConfig.js`（见第三节；新图案见 `PatternLibrary.js`）
6. **修改台词 / 重新生成语音**：编辑 `src/config/VoiceConfig.js`（台词、字幕、朗读文本、语调参数、声线），然后启动 AivisSpeech Engine 并运行：
   ```bash
   node tools/generate_voices.mjs --takes 8 --out build/voice-aivis [--only c01_1,win_1]   # 合成多个版本
   python tools/pick_voice_takes.py build/voice-aivis                                      # 挑最好的版本到 assets/audio/voice
   npm run measure-audio                                           # 确认响度
   ```
   换声线时请先确认该模型的利用规约，并更新 `VOICES` 里的署名（会自动出现在制作人员面板）；也可以直接用自己录制的 mp3 覆盖（请先归一到 -20 LUFS：`python tools/voice_post.py --fix 文件.mp3`）
7. **重新打包**：`npm run build`，然后打开 `dist/index.html`；桌面版 `npm run package:win`；图标 `npm run icons`

---

## 八、抖音小游戏版 / 激励视频广告

完整上线流程（注册、AppID、流量主、导入开发者工具、真机预览、上传、软著 / 备案 / 隐私协议 / 适龄提示 / AI 内容标识、商店素材）见 **[`docs/DOUYIN_RELEASE.md`](DOUYIN_RELEASE.md)**。

广告调用仍集中在 **`src/systems/AdService.js`**：

```js
game.ads.showRewardedAd('revive')   // -> Promise<boolean>，true = 完整看完，发放奖励
```

| 环境 | 行为 |
| --- | --- |
| 浏览器 / `file://` / 桌面版 | 「**广告占位**」画面 + 5 秒倒计时，倒计时结束才能「领取奖励」；**不含任何真实广告 SDK** |
| 抖音小游戏，`douyin.config.js` 填了广告位 ID | `DouyinPlatform.showRewardedAd()` → `tt.createRewardedVideoAd`：`onClose` 里 `isEnded === true` 才发奖励；中途关闭 / `onError` 不发（`rewardOnAdError` 可改）；播放时暂停所有声音 |
| 抖音小游戏，`rewardedAdUnitId` 留空（首发默认，流量主上线后才能开通） | **没有任何广告**：塞满时「再试一次」，每关免费一次（`platform.adMode === 'free'`） |
| 微信小游戏，`wechat.config.js` | 与抖音版相同：填了广告位 → `wx.createRewardedVideoAd`（看完才复活）；留空 → 每关免费「再试一次」，没有任何广告 |
| 其他平台 | `game.ads.setProvider(fn)` 注入自定义实现，`fn(placement)` 返回 `Promise<boolean>` |

平台抽象层 `src/platform/index.js` 在构建时按 `__DOUYIN__` / `__WECHAT__` 选择 `WebPlatform`、`DouyinPlatform` 或 `WechatPlatform`（各包只带自己的平台代码）。要移植到别的小游戏平台，照着 `WechatPlatform.js` 继承 `DouyinPlatform` 覆盖差异即可。

> 广告平台要求激励视频由用户主动点击触发、如实告知奖励——当前流程（塞满 → 用户点「看广告复活」→ 看完 → 复活）符合要求。

---

## 九、说明

- 卡牌立绘均为原创二次元风格形象，不涉及已有版权角色；玩法致敬《羊了个羊》，美术 / 代码均为原创
- 浏览器策略要求用户首次点击后才能播放声音，所以网页版在第一次点击之前没有声音（桌面版启动即有 BGM）
- 语音：AivisSpeech（リダ https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join 、Tαkoe:AivisSpeech:黄金笑）；合成语音，与 VTuber 本人及原作无关
- BGM 与音效均为本项目原创（程序生成），无第三方素材
- 许可文本：`docs/licenses/`（桌面版在 exe 旁的 `licenses/`）—— AivisSpeech Engine (LGPL-3.0 + 利用規約)、リダ 的自定条款（作者注明此条款可能随时变更）、Tαkoeプロジェクト利用規約（黄金笑）
- 出品：狸猫
- 部分浏览器在 `file://` 下可能限制 `localStorage`，若进度没有保存，请用 `start.bat` 以服务器方式运行
- BOSS·地狱关的"理论可解"指生成器保证存在一条参考解；v3.1 起"洗牌"也会保证洗完仍有解（与原版的纯随机不同）

---

## 十、v3.1 审查记录（逻辑漏洞 / 设计）

| # | 严重度 | 问题 | 修复 | 对应测试 |
| --- | --- | --- | --- | --- |
| 1 | 高 | 洗牌是纯随机，洗完可能无解（尤其卡槽里已有对子/单张时） | `Solver.solvableShuffle`：结合卡槽现有花色重新分配，求解器复核，失败重试（≤300 次 / 250 ms）；确实无解才退回随机并提示 | logic L1/L2；浏览器 [13] 洗牌后按新路线通关 |
| 2 | 高 | 洗牌的翻面动画会杀掉同一张卡上正在进行的撤回/移出飞行补间 → 卡永远 `flying`，点不了也不消失（死局） | 翻面补间 `keep: true`，不再覆盖其他补间 | [13] 撤回途中洗牌 |
| 3 | 高 | 移出叠放到暂存区时，遮挡按"飞行中的坐标"计算，新的一层落地前下层卡仍可点（可以从下面抽牌） | `CoverSystem` 对飞行中的卡按落点 (`home`) 计算 | [13] 移出 + 复活叠层 |
| 4 | 中 | 发牌动画途中就能点牌，卡以半透明/缩小状态进槽 | `GameScene.dealing` 期间屏蔽点击与悬停；`SlotSystem.add` 补齐 `appear/scaleX` | [13] 发牌中点牌 |
| 5 | 中 | 每日挑战开局后跨过午夜，通关记到第二天 | 进入关卡时记下 `dailyKey / dailySeed` | [13] 午夜跨日 |
| 6 | 中 | 每日挑战的星星被算进 x/45 总星数 | `totalStars` 只统计数字关卡 | logic L4 |
| 7 | 中 | 中途离开关卡时心跳声不停、角色台词继续播 | `exit()` 里 `setTension(0)`，非胜负离开时停止语音 | [13] 心跳 / 语音 |
| 8 | 低 | 移出 + 复活多次叠层用计数器，撤回后层号可能重复 | 层号 = 现有最高层 + 1 | [13] 叠层 |
| 9 | 低 | 卡槽里只有飞行中的卡时用"移出"提示"槽里是空的" | 改为「等卡落进槽里再用」 | [13] 移出 1 张 |
| 10 | 低 | 连消提示是英文 Nice! 等 | 改为 顺！/ 好手感 / 停不下来 / 手要冒烟了 / 神了 / 传说级 | 截图 |
| 11 | 低 | 结算按钮「再玩一次」 | 「再来一把」 | 截图 |
| 12 | 低 | `make_icons.py` 依赖 `images/cutout/`（不在发布包里） | 缺失时自动改用 `card_11.png` 去边框裁切，已写进脚本说明 | 手动运行 |

已确认没有问题（有测试覆盖）：第 7 张刚好凑成三张不会判负（三张立即离槽）；暂存区 / 牌堆的卡最后取完也能通关；撤回不能撤销已消除的三张、移出后不能撤回；道具与复活次数每关、重开都会恢复；暂停时计时停止、点牌无效；看广告时点牌无效；双击同一张卡只进槽一次；只用 Pointer Events，触屏不会重复触发；飞行途中改变窗口大小不影响点击；`localStorage` 抛异常时退化为内存存档；桌面版单实例、存档在 `%APPDATA%\AnimeStack`；暂存区与侧边牌堆不重叠；1458 个随机局面没有"无卡可点又没输"的死局。

设计调整：第 5 关 BOSS 从「地狱」改为「BOSS·困难」（96 张 8 种，贪心 3% → 13%，用上道具约 77%）；地狱 BGM 与 0% 的难度留给第 10、15 关。道具保持每关 3 个 + 1 次复活（与原版同量级），被压住的卡 = 去饱和 35% + 46% 紫灰遮罩 + 更淡的阴影，可点的卡悬停会抬起，截图中两者对比清楚。
