# 《星屑轮舞》开发说明（v1.3.2）

出品：狸猫

竖屏美少女割草小游戏（类吸血鬼幸存者）。玩家下载与游玩方式见仓库首页 README；本文件是开发 / 构建 / 测试说明。抖音 / 微信小游戏工程保留在源码里，目前不发布。噩梦从四面八方涌过来，撑过 5 分钟并打倒梦魇女王诺克丝才算天亮。5:00 时诺克丝还活着就进入「黎明前最后一搏」：刷怪变少、晨光给全队逐秒增伤并灼烧诺克丝，打倒她才胜利。

- 纯 HTML5 Canvas + ES Modules，esbuild 打包成一个脚本，`dist/index.html` 双击就能玩（file:// 没有跨域问题）
- 单指浮动摇杆 / 鼠标拖动 / WASD·方向键；自动攻击，捡经验宝石升级，三选一
- 6 位角色，每人一把专属初始武器 + 专属被动；9 把武器 (Lv1~5)、8 个被动、9 种进化（武器满级 + 指定被动，开宝箱触发）
- 普通怪 / 精英 (掉宝箱) / 2:30 中 Boss「数羊王」(75 秒没打完会打着哈欠溜走) / 4:00 最终 Boss「梦魇女王·诺克丝」
- Boss 控制抗性：不吃冻结 / 眩晕 / 击退，减速最多 30%（精英 50%）；被甩出 620px 会瞬移回屏幕边，屏幕外有方向箭头
- 局外：星屑币、7 项天赋、角色解锁、普通 / 噩梦难度，存档在 localStorage（桌面版在 `%APPDATA%\AnimeSurvivor`，抖音版用 `tt.setStorageSync`，微信版用 `wx.setStorageSync`）
- 激励视频 `AdService.showRewardedAd()`：复活、三选一换一批、结算星屑翻倍。抖音版填了广告位 ID（`src/config/PlatformConfig.js`）就走 `tt.createRewardedVideoAd`；没填（以及网页版 / exe）则隐藏所有看广告按钮，复活改为每局免费一次「再试一次」，不弹占位广告
- 网页版 / 桌面版 / 抖音小游戏 / 微信小游戏共用一套玩法代码，平台差异只在 `src/core/platform/`（见下文「抖音小游戏」）

## 运行

| 方式 | 说明 |
| --- | --- |
| Windows 桌面版 | `release/星屑轮舞/星屑轮舞.exe`，整个文件夹一起拷贝；无控制台、单实例、存档在 `%APPDATA%\AnimeSurvivor` |
| 双击网页 | `dist/index.html` |
| `start.bat` | 有 Python / Node 就起本地服务器 (http://localhost:8767/dist/index.html)，否则直接打开网页 |
| 抖音小游戏 | 用抖音开发者工具导入 `抖音小游戏/` 目录，上架步骤见 `抖音小游戏/上架资料/上架说明.md` |
| 微信小游戏 | 用微信开发者工具导入 `微信小游戏/` 目录，上架步骤见 `docs/微信上架说明.md`（工程内 `微信小游戏/上架资料/` 有副本） |

调试：网址后加 `?fps` 显示帧率和怪物数；控制台里 `__ANIME_SURVIVOR__` 是游戏实例。

## 发布包（GitHub Release）

```bash
npm run release   # = npm run package:win + node tools/make_release.mjs
```

生成 `release-out/`（不入库）：

| 文件 | 内容 |
|---|---|
| `xingxie-lunwu-windows.zip` | `星屑轮舞/星屑轮舞.exe` 及 Electron 运行文件 + `怎么玩.txt` |
| `xingxie-lunwu-web.zip` | `index.html` + `game.js` + `assets/` … + `怎么玩.txt`（file:// 双击即玩，无任何外部网络请求） |

`怎么玩.txt` 的源文件是 `tools/release/怎么玩.txt`（UTF-8 BOM、CRLF，记事本打开不乱码）。exe 版本号和「公司名：狸猫」来自 `package.json` 与 `tools/package.mjs`。


## 开发

```
npm install
npm run build         # -> dist/
npm run build:douyin  # -> 抖音小游戏/ (并打印主包 / 分包大小，超限会报错)
npm run test:douyin   # 抖音版冒烟测试 (Node vm + tt 模拟，没有 window / document)
npm run build:wechat  # -> 微信小游戏/ (主包 ≤4MB、总包 ≤30MB、上传白名单，超限报错)
npm run test:wechat   # 微信版冒烟测试 (Node vm + wx 模拟)
npm run douyin:assets # 重新预渲染抖音版音效 + 压缩图片 (需要 playwright chromium / ffmpeg / pngquant，生成物已入库)
npm run sim           # 数值模拟 (node tools/sim_balance.mjs [局数] [角色|all] [难度] [normal|lazy|idle] [none|max 天赋])
node tools/test_logic.mjs   # 逻辑自检 (升级排队 / 卡池 / 宝箱 / 受伤 / Boss / 最后一搏 / 存档 …)
python3 tools/voice_metrics.py <目录>   # 语音客观指标 (时长 / 音高方差 / 响度)
python3 tools/voice_quality.py <目录>   # 语音音质指标 (响度 / true peak / 削波 / 谐噪比 / 4-10kHz 噪声)，见 docs/语音音质_v1.3.2.md
node tools/shots.mjs  # Playwright 截图 + 报错 / 帧率检查
npm run package:win   # Electron 打包 -> release/星屑轮舞/
npm run voices        # 需要本地 VOICEVOX 引擎 (127.0.0.1:50021)
npm run bgm           # 重新作曲 BGM (numpy) -> assets/audio/bgm
```

### 目录

```
src/
  config/   全部数值：角色 / 武器 / 被动 / 敌人 / 刷怪时间轴 / 难度 / 经验曲线 / 天赋 / 音频 / 语音台词
  core/     主循环、场景管理、对象池、空间网格、随机数、分包管理
  core/platform/  平台层：web.js (DOM / Pointer / localStorage / HTMLAudio) · tt.js (抖音) · wx.js (微信) · index.js 按 __PLATFORM__ 选择
  systems/  BattleWorld (纯数据，Node 里也能跑) + 各战斗子系统；存档、音效、语音、BGM、广告、录屏分享、侧边栏
  render/   战斗渲染、程序化怪物精灵、特效 (伤害数字池 / 粒子池 / 震屏)
  scenes/   启动 / 菜单 / 选角 / 天赋 / 战斗 / 结算
  ui/       按钮、HUD、摇杆、三选一 / 宝箱 / 复活面板、暂停、设置、制作人员
```

难度只是 `DifficultyConfig` 里的系数，系统代码里没有「如果是噩梦」这种分支。

### 性能

300 只怪同屏：对象池（怪 / 子弹 / 宝石 / 伤害数字 / 粒子全部复用）、64px 空间网格做碰撞和索敌、地上宝石超过 300 颗时把远处的合并成红宝石、怪多于 200 只时只显示暴击数字、屏幕外不画。无头 Chromium 实测 300 只怪约 59 fps。

### 音频

- 语音 VOICEVOX 预生成 mp3（160kbps / 44.1kHz，-20 LUFS，true peak ≤ -1 dBTP）。每句标情绪 (兴奋 / 喝声 / 得意 / 慌张 / 害羞 / 生气 / 悄悄话 / 难过 / 累 / 平静)，按情绪选同一声优的干净声线（v1.3：桃濑萌改用 あんこもん、月见雪乃改用 中国うさぎ）。v1.3.2 去沙哑：不再用 ささやき / ヒソヒソ / へろへろ / よわよわ / こわがり / 絶望と敗北 / 怒り / 元気 等气声 / 沙哑类声线，语速统一 1.13~1.22，抑扬 ≤1.25，去掉逐音拍随机抖动、气声噪声层、句首吸气 / 句尾叹气、高频提升和房间混响，换气只留在长台词句间且很轻（对比数据见 `docs/语音音质_v1.3.2.md`）；每组 2~3 条变体随机播放；BGM 三首成品文件（ogg + mp3，-22 LUFS）；音效 WebAudio 实时合成
- 默认音量：语音 0.3 / 音效 0.12 / BGM 0.15，设置里有总音量和分声道滑块
- 角色说话时 BGM 压到 ×0.55；同时只放一句，0.6 s 冷却，按优先级抢占，升级 / 受伤台词有单独冷却
- 命中音效同类 50 ms 内只响一次、最多 5 个并发、随机音高；连续吃宝石按五声音阶往上走；怪群底噪随周围怪物密度变化

## 抖音小游戏

`npm run build:douyin` 生成 `抖音小游戏/`（竖屏 `game.json`、`project.config.json`、主包 + 3 个分包、上架资料）。

| 能力 | 接法 |
| --- | --- |
| 画布 / 适配 | `tt.createCanvas()` 上屏画布铺满屏幕；540×960 逻辑画面等比放进 `getSystemInfoSync().safeArea` 与胶囊按钮 (`getMenuButtonBoundingClientRect`) 下方的区域，其余涂深色 |
| 输入 | `tt.onTouchStart / Move / End / Cancel`，只认第一根手指 |
| 存档 | `tt.getStorageSync / setStorageSync`（同一份 SaveSystem，含侧边栏领奖日期） |
| 音频 | `tt.createInnerAudioContext`，只用 mp3 / wav（iOS 不支持 ogg，工程里没有任何 ogg）。BGM 用 `TTLoopAudio` 双实例在循环点做 0.15s 等功率交叉淡化，避开 mp3 编码器头尾静音造成的循环空白（`tools/make_tt_bgm.py` 生成「循环 + 1s」文件，`tools/bgm_loop_check.py` 做波形检查）；语音共用 1 个；短音效由网页版同一套 WebAudio 合成代码离线渲染成 82 个 wav（`tools/render_sfx.mjs`），命中类 5 个实例、其它 3 个，50ms 限频 / 5 并发规则不变 |
| 前后台 | `tt.onShow / onHide` → 战斗暂停、BGM / 语音停、录屏暂停 |
| 激励视频 | 广告位 ID 留空：看广告按钮全部隐藏、复活免费一次；填上后 `tt.createRewardedVideoAd`，全局一个实例、开局预加载；`onClose` 的 `isEnded` 才发奖励；拉取失败提示并返回 false，不扣次数 |
| 录屏 | `tt.getGameRecorderManager`：开战自动 `start({duration:300})`，Boss 击破 / 武器进化 / 3 秒内割倒 ≥45 只 `recordClip([4,3])`，结束后 `clipVideo` 剪集锦；结算页「分享精彩录屏」只在拿到有效 videoPath 后出现 |
| 分享 | `tt.shareAppMessage({ channel: 'video', extra: { videoPath, videoTopics: ['星屑轮舞', '割草游戏'] } })` |
| 侧边栏 | 启动时同步监听 `tt.onShow`；`tt.checkScene({scene:'sidebar'})` 支持才显示「侧边栏有礼」；从侧边栏 (`launch_from=homepage`、`location=sidebar_card`) 回来可领 30 星屑币 / 天，否则 `tt.navigateToScene` 引导 |
| 分包 | `sub_art` 立绘、`sub_bgm` 音乐、`sub_voice` 语音；进菜单后依次 `tt.loadSubpackage` 并显示进度，没下完也能开玩（立绘先用头像、语音只出字幕）；失败隔 6 秒重试一次；旧客户端无 `loadSubpackage` 视为整包 |

AppID 和激励视频广告位 ID **只在 `src/config/PlatformConfig.js` 填写**，构建时写进 `project.config.json` 和 `game.js`。流量主开通后填上 ID 重新构建即恢复广告。

「狸猫」只是出品名；隐私协议、软著请填开发者账号的真实主体（见 `docs/douyin/上架说明.md`）。

## 微信小游戏

`npm run build:wechat` 生成 `微信小游戏/`（竖屏 `game.json` + `subpackages`、`project.config.json`（compileType game，appid 未填时为 `touristappid`）、主包 + 3 个分包、上架资料）。

- 平台层 `src/core/platform/wx.js`：wx.createCanvas / getWindowInfo 安全区 + 胶囊避让 / onTouch* / setStorageSync / createInnerAudioContext（BGM 双实例交叉淡化）/ onShow·onHide / loadSubpackage / createRewardedVideoAd / showShareMenu + onShareAppMessage + onShareTimeline / shareAppMessage。
- 抖音专有的录屏、侧边栏在微信构建中替换为空实现（`*.none.js`、`ShareService.wechat.js`），微信包里不含相关代码和文案。
- AppID、激励视频广告位 ID 在 `src/config/PlatformConfig.js` 的 `wechat` 字段；广告位留空 = 隐藏看广告按钮、复活每局免费一次。
- 上架流程、版号核实结论（IAA 无需版号，走资质审核情况二 + 小游戏备案）见 `docs/微信上架说明.md`。

## 玩法参考

| 操作 | |
|---|---|
| 移动 | 鼠标按住拖动 / 触屏手指拖动 / WASD / 方向键 |
| 攻击 | 自动 |
| 暂停 | Esc 或 P |
| 升级 | 点选三张卡中的一张 |

| 角色 | 身份 | 初始武器 | 被动 |
|---|---|---|---|
| 星野 光 | 新人魔法少女 | 星光魔杖 | 越战越勇：升级越多伤害越高 |
| 星川 歌音 | 梦里开演唱会的偶像 | 电音连锁 | 返场：冷却更短，升级后短暂加速 |
| 稻荷 铃音 | 稻荷神社的巫女 | 护符环 | 狐火护身：定期获得护盾 |
| 桃濑 萌 | 偶像练习生 | 爱心回旋镖 | 粉丝福利：拾取范围大，星屑币更多 |
| 月见 雪乃 | 月宫的小公主 | 冰晶棱镜 | 寒月：打冻住、减速的敌人更痛 |
| 蕾吉娜 | 天空女王 | 流星召唤 | 女王威仪：攻击范围更大，护甲 +1 |

## 署名

- 角色语音：VOICEVOX:満別花丸 / VOICEVOX:九州そら / VOICEVOX:中部つるぎ / VOICEVOX:あんこもん / VOICEVOX:中国うさぎ / VOICEVOX:四国めたん / VOICEVOX:波音リツ / VOICEVOX:ずんだもん（各角色利用规约见 `docs/licenses/`）
- BGM《午夜的星屑》《星屑轮舞》《梦魇进行曲》：原创，程序化作曲
- 出品：狸猫
