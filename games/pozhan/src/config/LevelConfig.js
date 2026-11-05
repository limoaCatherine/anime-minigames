// 关卡配置总表。所有关卡内容与难度都在这里 (以及 levels/ 下的分章文件)，系统代码里没有难度分支。
//
// 坐标约定：x 相对场景宽 (540)，y 相对场景高；圆形热区 r 相对场景宽。
//   单图关场景 540×700 (aspect 1.296)，找不同关每块 540×342 (aspect 0.633)。
// 关卡类型 type：
//   'find'   找不合理：spots 为 N 处破绽，tricky 为最后的刁钻点；egg 为彩蛋 (不计数)
//   'diff'   找不同：上下两图 (layers 里 only:'A'/'B' 区分)，spots 在两图都可点
//   'puzzle' 助她脱困 / 换装：zones + combines + rules + hints 的状态机，见 systems/PuzzleSystem.js
//   'word'   文字拼字：同 puzzle，另有 word 槽位展示
// sanity：理智值 (点错扣 1，归零失败，可看广告恢复)
// stars：通关星级按 GameConfig.stars (失误次数 / 广告提示次数)
import * as ch1 from './levels/ch1.js';
import * as ch2 from './levels/ch2.js';
import * as ch3 from './levels/ch3.js';

export const LEVELS = [ch1.L01, ch1.L02, ch1.L03, ch1.L04, ch1.L05, ch2.L06, ch2.L07, ch2.L08, ch2.L09, ch3.L10, ch3.L11, ch3.L12, ch3.L13].map((l, i) => ({ index: i, ...l }));

export const CHAPTERS = [
  { id: 1, title: '第一章 · 转角遇到面包', short: '校园番', color: '#ff8fb0', levels: ['L01', 'L02', 'L03', 'L04', 'L05'] },
  { id: 2, title: '第二章 · 转生成为工位', short: '异世界社畜', color: '#7c83ff', levels: ['L06', 'L07', 'L08', 'L09'] },
  { id: 3, title: '第三章 · 偶像大作战', short: '偶像 × 学生会', color: '#4f6bd8', levels: ['L10', 'L11', 'L12', 'L13'] },
];

export function levelById(id) { return LEVELS.find((l) => l.id === id) || null; }
