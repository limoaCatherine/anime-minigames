# 狸猫小游戏

二次元小游戏合集。每个游戏都是独立目录，到 Release 下载对应压缩包，解压就能玩。

| 游戏 | 目录 | 玩法 | 下载 |
| --- | --- | --- | --- |
| 美少女合成 | [`games/merge`](games/merge) | 两个相同等级碰到一起，合成下一级 | [Windows](https://github.com/limoaCatherine/anime-minigames/releases/download/merge-v1.8.0/meishaonv-hecheng-windows.zip) · [网页](https://github.com/limoaCatherine/anime-minigames/releases/download/merge-v1.8.0/meishaonv-hecheng-web.zip) |
| 拆封绘卷 | [`games/screw`](games/screw) | 拧掉画框上的螺丝，揭开被钉住的插画 | [Windows](https://github.com/limoaCatherine/anime-minigames/releases/download/screw-v1.2.0/chaifeng-huijuan-windows.zip) · [网页](https://github.com/limoaCatherine/anime-minigames/releases/download/screw-v1.2.0/chaifeng-huijuan-web.zip) |
| 美少女了个美 | [`games/lege`](games/lege) | 凑齐三张一样的卡就消掉 | [Windows](https://github.com/limoaCatherine/anime-minigames/releases/download/lege-v3.3.0/meishaonv-windows.zip) · [网页](https://github.com/limoaCatherine/anime-minigames/releases/download/lege-v3.3.0/meishaonv-web.zip) |
| 画线守护美少女 | [`games/huaxian`](games/huaxian) | 每关只画一笔线，挡住蜜蜂、老板和催婚亲戚 | [Windows](https://github.com/limoaCatherine/anime-minigames/releases/download/huaxian-v1.5.0/huaxian-shouhu-windows.zip) · [网页](https://github.com/limoaCatherine/anime-minigames/releases/download/huaxian-v1.5.0/huaxian-shouhu-web.zip) |
| 次元破绽 | [`games/pozhan`](games/pozhan) | 在梗图里找出不合理的地方 | [Windows](https://github.com/limoaCatherine/anime-minigames/releases/download/pozhan-v1.3/ciyuan-pozhan-windows.zip) · [网页](https://github.com/limoaCatherine/anime-minigames/releases/download/pozhan-v1.3/ciyuan-pozhan-web.zip) |
| 星屑轮舞 | [`games/xingxie`](games/xingxie) | 竖屏割草，守五分钟打倒梦魇女王 | [Windows](https://github.com/limoaCatherine/anime-minigames/releases/download/xingxie-v1.3.2/xingxie-lunwu-windows.zip) · [网页](https://github.com/limoaCatherine/anime-minigames/releases/download/xingxie-v1.3.2/xingxie-lunwu-web.zip) |

Windows 弹出「Windows 已保护你的电脑」时，点「更多信息」→「仍要运行」。

## 本地运行

进入对应游戏目录再安装依赖。每个游戏用自己的 `node_modules`。

```bash
cd games/merge
npm install
npm start
```

美少女合成和画线守护的抖音、微信包体由构建脚本生成，不提交。上架文案留在各游戏的 `docs/` 或平台目录里。

出品：狸猫
