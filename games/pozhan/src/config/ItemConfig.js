// 道具表 (助她脱困 / 换装关)：名字 + 图标绘制函数 (src/art 里的函数名)。
// 关卡在 LevelConfig 里通过 inventory (开局持有) / give (获得) 引用这里的 id。
export const ITEMS = {
  // 第 3 关：衣柜
  ruler: { name: '三角尺', icon: 'iconRuler' },
  tape: { name: '胶带', icon: 'iconTape' },
  handle: { name: '临时把手', icon: 'iconHandle', desc: '三角尺 + 胶带' },
  roach: { name: '蟑螂玩具', icon: 'iconRoach' },
  // 第 4 关：修行
  filter: { name: '「燃」滤镜', icon: 'iconFilter' },
  speaker: { name: '燃曲音箱', icon: 'iconSpeaker' },
  // 第 7 关：史莱姆
  salt: { name: '盐', icon: 'iconSalt' },
  invoice: { name: '发票', icon: 'iconInvoice' },
  stamp: { name: '印章', icon: 'iconStamp' },
  tissue: { name: '纸巾', icon: 'iconTissue' },
  // 第 12 关：打歌服
  curtain: { name: '窗帘', icon: 'iconCurtain' },
  tie: { name: '领带', icon: 'iconTie' },
  flagL: { name: '应援旗 (左)', icon: 'iconFlag', flip: false },
  flagR: { name: '应援旗 (右)', icon: 'iconFlag', flip: true },
  leek: { name: '大葱', icon: 'iconLeek' },
  cape: { name: '窗帘披风', icon: 'iconCape', desc: '窗帘 + 别针' },
  pin: { name: '别针', icon: 'iconPin' },
};
