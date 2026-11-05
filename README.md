# 狸猫小游戏

二次元小游戏合集。每个游戏都是独立目录，下载对应的 Release 压缩包解压就能玩。

| 游戏 | 目录 | 玩法 | 下载 |
| --- | --- | --- | --- |
| 美少女合成 | [`games/merge`](games/merge) | 两个相同等级的角色碰到一起，合成下一级 | [Windows](https://github.com/limoaCatherine/anime-merge/releases/latest/download/meishaonv-hecheng-windows.zip) · [网页](https://github.com/limoaCatherine/anime-merge/releases/latest/download/meishaonv-hecheng-web.zip) |
| 拆封绘卷 | [`games/screw`](games/screw) | 拧掉画框上的螺丝，揭开被钉住的插画 | [Windows](https://github.com/limoaCatherine/anime-screw/releases/latest/download/chaifeng-huijuan-windows.zip) · [网页](https://github.com/limoaCatherine/anime-screw/releases/latest/download/chaifeng-huijuan-web.zip) |

Windows 弹出「Windows 已保护你的电脑」时，点「更多信息」→「仍要运行」。

## 本地运行

在对应游戏目录里安装依赖再启动。两个游戏不要装在同一个 `node_modules` 里。

```bash
cd games/merge
npm install
npm start
```

拆封绘卷把目录换成 `games/screw`，端口是 8766。

美少女合成的抖音、微信工程由 `npm run build:douyin` 和 `npm run build:wechat` 生成，不提交。上架文案和截图在 `games/merge/docs/`。

出品：狸猫
