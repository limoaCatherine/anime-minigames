// 14 种卡牌 (美少女) 的定义。换皮时替换图片并修改这里即可。
// image: 卡牌贴图 (160x176 PNG，由 tools/process_images.py 生成)
// color: 主题色 = 卡面底色 (特效/字幕描边)；gem: 右上角大徽章的符号 (已烘焙在贴图里，这里仅作说明/图鉴展示)
// 每种卡的底色、底纹、徽章符号都不同 (见 tools/process_images.py 的 STYLE 表)，相似发色的角色刻意用反差最大的配色
export const CARDS = [
  { id: 0,  key: 'card_01', image: 'assets/images/card_01.png', name: '见习学妹',   color: '#4dabf7', gem: '爱心' },
  { id: 1,  key: 'card_02', image: 'assets/images/card_02.png', name: '元气同学',   color: '#20c997', gem: '星星' },
  { id: 2,  key: 'card_03', image: 'assets/images/card_03.png', name: '图书委员',   color: '#f5b700', gem: '菱形' },
  { id: 3,  key: 'card_04', image: 'assets/images/card_04.png', name: '社团部长',   color: '#e64980', gem: '四叶草' },
  { id: 4,  key: 'card_05', image: 'assets/images/card_05.png', name: '偶像练习生', color: '#74b816', gem: '圆珠' },
  { id: 5,  key: 'card_06', image: 'assets/images/card_06.png', name: '魔法少女',   color: '#ff922b', gem: '月牙' },
  { id: 6,  key: 'card_07', image: 'assets/images/card_07.png', name: '精灵巫女',   color: '#2f9e44', gem: '三角' },
  { id: 7,  key: 'card_08', image: 'assets/images/card_08.png', name: '星辉歌姬',   color: '#7048e8', gem: '水滴' },
  { id: 8,  key: 'card_09', image: 'assets/images/card_09.png', name: '月之公主',   color: '#0b7285', gem: '六边形' },
  { id: 9,  key: 'card_10', image: 'assets/images/card_10.png', name: '天空女王',   color: '#364fc7', gem: '皇冠' },
  { id: 10, key: 'card_11', image: 'assets/images/card_11.png', name: '星海女神',   color: '#5f3dc4', gem: '四芒星' },
  { id: 11, key: 'card_12', image: 'assets/images/card_12.png', name: '女仆店长',   color: '#868e96', gem: '方块' },
  { id: 12, key: 'card_13', image: 'assets/images/card_13.png', name: '神社巫女',   color: '#e03131', gem: '蝴蝶结' },
  { id: 13, key: 'card_14', image: 'assets/images/card_14.png', name: '咖啡前辈',   color: '#9c6644', gem: '叶子' },
];

export const CARD_TYPE_COUNT = CARDS.length;

export function getCard(type) {
  return CARDS[type] || CARDS[0];
}
