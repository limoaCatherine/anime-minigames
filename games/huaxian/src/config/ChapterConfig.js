// 章节配置：每章 10 关，有自己的名字、主题色调与背景装饰 (程序绘制)。
// theme 字段：
//   tint        叠加在关卡背景图上的色调 (rgba)
//   wash        白色柔化遮罩强度
//   props       背景装饰：spring 春日天台 | office 公司 | newyear 过年 | night 星空
//   ground / groundTop / groundEdge  地形配色；accent 机关支架颜色；platform 云朵平台颜色
//   tab         选关页签颜色
export const CHAPTERS = [
  {
    id: 1, name: '春日天台', en: 'Spring Rooftop', first: 1, last: 10,
    intro: '蜜蜂、加班老板、催婚亲戚登场 · 新机关：木箱',
    theme: {
      key: 'spring', tint: 'rgba(255,214,235,0.10)', wash: 0.38, props: 'spring',
      ground: '#f7d6e6', groundTop: '#9be08f', groundEdge: '#c99ab6', accent: '#b9a6ff', platform: '#ffffff', tab: '#ff6fa8',
    },
  },
  {
    id: 2, name: '公司加班', en: 'Overtime Office', first: 11, last: 20,
    intro: '新机关：电梯平台、玻璃隔断、禁画区',
    theme: {
      key: 'office', tint: 'rgba(92,110,200,0.30)', wash: 0.30, props: 'office',
      ground: '#e3e8ff', groundTop: '#9fb4ff', groundEdge: '#8d97c9', accent: '#9fb4ff', platform: '#f4f6ff', tab: '#6f86e8',
    },
  },
  {
    id: 3, name: '过年回家', en: 'New Year Homecoming', first: 21, last: 30,
    intro: '新机关：弹簧、跷跷板',
    theme: {
      key: 'newyear', tint: 'rgba(255,110,80,0.24)', wash: 0.30, props: 'newyear',
      ground: '#ffe0d2', groundTop: '#ffcf6b', groundEdge: '#d48b7c', accent: '#ffb38a', platform: '#fff4e8', tab: '#ff7a59',
    },
  },
  {
    id: 4, name: '终极挑战', en: 'Final Challenge', first: 31, last: 40,
    intro: '新机关：传送门、风车 · 全机关大集合',
    theme: {
      key: 'night', tint: 'rgba(70,40,140,0.46)', wash: 0.16, props: 'night',
      ground: '#efe2ff', groundTop: '#c49bff', groundEdge: '#9b7cd6', accent: '#c49bff', platform: '#f3ecff', tab: '#8f7cff',
    },
  },
];

export const chapterOf = (levelId) => CHAPTERS.find((c) => levelId >= c.first && levelId <= c.last) || CHAPTERS[CHAPTERS.length - 1];
