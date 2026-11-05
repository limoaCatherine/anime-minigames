// 角色表：名字、主色、立绘 (来自公司角色库，与《美少女合成》《美少女了个美》同一批原创角色) 与头像裁切。
// face: 头像在立绘中的位置 (相对图片宽高的比例) cx, cy, r(相对宽)。
// 团子社长是程序绘制的吉祥物 (src/art/chars.js 的 dango)，没有图片。
export const CHARACTERS = {
  nuonuo: {
    name: '糯糯', title: '看板娘 / 不合理制造者', color: '#ff6fa3', voice: '满别花丸',
    images: { idle: 'nuonuo_idle', smug: 'nuonuo_happy', panic: 'nuonuo_scared', broken: 'nuonuo_lose' },
    face: {
      idle: { cx: 0.5, cy: 0.27, r: 0.27 },
      smug: { cx: 0.47, cy: 0.27, r: 0.21 },
      panic: { cx: 0.47, cy: 0.27, r: 0.24 },
      broken: { cx: 0.5, cy: 0.26, r: 0.25 },
    },
  },
  zero7: {
    name: '零七', title: '剧情管理局导航系统娘', color: '#2fb7b0', voice: '冥鸣向日葵',
    images: { idle: 'girl_14' }, face: { idle: { cx: 0.47, cy: 0.38, r: 0.36 } }, hologram: true,
  },
  yeling: {
    name: '苏夜绫', title: '中二大小姐', color: '#8b5cf6', voice: '四国玫瑰',
    images: { idle: 'girl_12' }, face: { idle: { cx: 0.52, cy: 0.42, r: 0.3 } },
  },
  linqi: {
    name: '林栖', title: '学生会长 / 偶像', color: '#4f6bd8', voice: '九州空',
    images: { idle: 'girl_03' }, face: { idle: { cx: 0.47, cy: 0.42, r: 0.33 } },
  },
  shezhang: {
    name: '团子社长', title: '管理局经费负责人 (猫)', color: '#f0a23b', voice: 'あんこもん', drawn: 'dango',
  },
};

// 场景里出现的其他角色 (只用作配角，不说话)
export const EXTRAS = {
  transfer: 'girl_04', idolPink: 'girl_05', magical: 'girl_06', elf: 'girl_07', diva: 'girl_08',
  princess: 'girl_09', queen: 'girl_10', goddess: 'girl_11', hero: 'girl_02', shrine: 'girl_13', freshman: 'girl_01',
};

/** 需要预加载的全部图片 */
export const IMAGE_LIST = [
  'nuonuo_idle', 'nuonuo_happy', 'nuonuo_scared', 'nuonuo_lose',
  ...Array.from({ length: 14 }, (_, i) => `girl_${String(i + 1).padStart(2, '0')}`),
].map((key) => ({ key, src: `assets/images/${key}.png` }))
  .concat([{ key: 'bg_rooftop', src: 'assets/images/bg_rooftop.jpg' }, { key: 'bg_sunset', src: 'assets/images/bg_sunset.jpg' }]);
