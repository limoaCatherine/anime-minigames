// 图层绘制函数注册表：LevelConfig 里的 a:'名字' 对应这里导出的函数。
import * as backdrops from './backdrops.js';
import * as chars from './chars.js';
import * as school from './props_school.js';
import * as isekai from './props_isekai.js';
import * as idol from './props_idol.js';
import * as common from './props_common.js';
import * as ch1b from './props_ch1b.js';

export const ART = { ...backdrops, ...chars, ...school, ...isekai, ...idol, ...common, ...ch1b };
