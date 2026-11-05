// 角色语音台词池 (VOICEVOX 预生成 mp3，日语配音 + 简体中文字幕)。
// 这是台词、声线、调校参数和署名的唯一数据源：tools/generate_voices.mjs 读取本文件合成语音，CreditsPanel 读取署名。
//
// 字段：id = 文件名 assets/audio/voice/<id>.mp3   who = 角色 (CharacterConfig)   group = 触发事件
//       zh = 中文字幕 (游戏内只显示中文)   tts = 交给引擎的日语朗读文本 (假名标注易读错的词)
//       emo = 情绪 (EMOTIONS)，决定 VOICEVOX 风格 (VOICE_CAST.styles) 与语速/抑扬/音高；tune = 单句微调覆盖
//
// 授权：以下声线的利用规约均为「クレジットを記載すれば商用・非商用で利用可能」，署名格式「VOICEVOX:角色名」。
// 选用原则：只用「企业商用也只需署名、无须事先联系」的声线；需要事先确认或排除游戏用途的声线一律不用。
export const VOICE_CAST = {
  // styles: 情绪 → VOICEVOX 风格。同一角色只换风格不换声线，署名仍是「VOICEVOX:角色名」
  nuonuo:   { speaker: '満別花丸',   style: '元気',     styleId: 70, styles: { happy: 70, smug: 70, surprised: 70, panicked: 70, embarrassed: 72, sulky: 72, whisper: 71 }, pitch: 0.02 },
  zero7:    { speaker: '冥鳴ひまり', style: 'ノーマル', styleId: 14, styles: {}, pitch: -0.01 },
  yeling:   { speaker: '四国めたん', style: 'ツンツン', styleId: 6,  styles: { smug: 4, proud: 4, happy: 0, embarrassed: 6, panicked: 2, surprised: 2, sulky: 6 }, pitch: 0.0 },
  linqi:    { speaker: '九州そら',   style: 'ツンツン', styleId: 18, styles: { calm: 16, happy: 15, embarrassed: 15, surprised: 16, smug: 18, sulky: 18 }, pitch: 0.0 },
  // 团子社长 (v1.3)：あんこもん「抑えめで負けず嫌いな声」——端着架子的吉祥物社长。得意 / 开心用「つよつよ」，
  // 吃惊慌张露怯用「よわよわ」，冷淡拒绝用「ノーマル」，闹别扭用「けだるげ」。规约同四国めたん / 九州そら (SSS 合同会社)。
  shezhang: { speaker: 'あんこもん', style: 'つよつよ', styleId: 114, styles: { smug: 114, happy: 114, proud: 114, surprised: 115, panicked: 115, calm: 113, sulky: 116 }, pitch: 0.0 },
};

/**
 * 情绪 → 合成参数 (tools/generate_voices.mjs)。
 * speed = speedScale、into = intonationScale、pitch = pitchScale 的增量 (+0.06 ≈ +1 半音)、
 * contour = 句尾形状 up / question / down、rise = 句尾抬/降幅度、breath = 句首吸气音量 (0 = 不加)
 */
export const EMOTIONS = {
  happy:       { speed: 1.22, into: 1.45, pitch: 0.03, contour: 'up', rise: 0.1, breath: 0.05 },
  smug:        { speed: 1.18, into: 1.4, pitch: 0.01, contour: 'up', rise: 0.08, breath: 0.04 },
  surprised:   { speed: 1.26, into: 1.5, pitch: 0.05, contour: 'question', rise: 0.13, breath: 0.07 },
  panicked:    { speed: 1.3, into: 1.5, pitch: 0.06, contour: 'up', rise: 0.12, breath: 0.08 },
  embarrassed: { speed: 1.2, into: 1.35, pitch: 0.025, contour: 'down', rise: 0.07, breath: 0.06 },
  sulky:       { speed: 1.16, into: 1.3, pitch: 0.0, contour: 'down', rise: 0.07, breath: 0.05 },
  proud:       { speed: 1.17, into: 1.42, pitch: 0.0, contour: 'up', rise: 0.07, breath: 0.05 },
  calm:        { speed: 1.18, into: 1.3, pitch: 0.0, contour: 'down', rise: 0.05, breath: 0.03 },  // 零七 / 林栖的「冷」也不能平
  whisper:     { speed: 1.15, into: 1.3, pitch: 0.0, contour: 'down', rise: 0.05, breath: 0 },
};

const L = (who, group, n, emo, zh, tts, tune = {}) => ({ id: `${who}_${group}_${n}`, who, group, emo, zh, tts, tune, file: `assets/audio/voice/${who}_${group}_${n}.mp3` });

export const VOICE_LINES = [
  // —— 糯糯：嘴硬 → 心虚 → 破防 ——
  L('nuonuo', 'intro', 1, 'smug', '这很合理吧？！', 'ねっ、これ、ごうりてきでしょ？'),
  L('nuonuo', 'intro', 2, 'happy', '今天的我也毫无破绽！', 'きょうのわたし、スキなしだよっ！'),
  L('nuonuo', 'intro', 3, 'smug', '看啥看，哪儿不对了嘛？', 'なーに？どこもへんじゃないもん！'),
  L('nuonuo', 'found', 1, 'embarrassed', '那、那是故意的！', 'そ、それはわざとだもん！'),
  L('nuonuo', 'found', 2, 'sulky', '这叫艺术加工好吗！', 'えんしゅつだってば、もう〜！'),
  L('nuonuo', 'found', 3, 'surprised', '欸？这都能看出来？', 'えっ？なんでバレたの？'),
  L('nuonuo', 'found', 4, 'panicked', '不算不算！这个不算！', 'ノーカン！いまのノーカン！'),
  L('nuonuo', 'found', 5, 'surprised', '哇，眼睛好尖……', 'うわっ、めざとい…'),
  L('nuonuo', 'broken', 1, 'embarrassed', '呜……别再找了啦！', 'うぅ…もうさがさないでよぉ！'),
  L('nuonuo', 'broken', 2, 'panicked', '人设要崩了啦！', 'キャラ、こわれちゃう〜！'),
  L('nuonuo', 'broken', 3, 'sulky', '好嘛好嘛，是我错了……', 'はいはい、わたしがわるかったですー'),
  L('nuonuo', 'gloat', 1, 'smug', '嘿嘿，那儿很正常哦～', 'えへへ、そこはふつうだよ〜'),
  L('nuonuo', 'gloat', 2, 'smug', '你看，我就说合理吧！', 'ほらね、ごうりてき！'),
  L('nuonuo', 'gloat', 3, 'happy', '点错啦～吐槽役失格！', 'ハズレ〜！ツッコミしっかく！'),
  L('nuonuo', 'idle', 1, 'whisper', '还没找到？我都要睡着了……', 'まだぁ？ねむくなっちゃう…'),
  L('nuonuo', 'idle', 2, 'smug', '放弃吧，这张图天衣无缝！', 'あきらめなよ、このえ、かんぺきだし！'),
  L('nuonuo', 'win', 1, 'sulky', '全被找到了……可恶！', 'ぜんぶバレた…くやしいっ！'),
  L('nuonuo', 'win', 2, 'embarrassed', '下、下次绝对藏好！', 'つ、つぎはぜったいバレないもん！'),
  L('nuonuo', 'lose', 1, 'happy', '嘿嘿，这局我赢啦！', 'えへへっ、わたしのかち〜！'),
  L('nuonuo', 'rescue', 1, 'happy', '谢啦！我果然最强！', 'ありがと！やっぱわたし、さいきょう！'),
  L('nuonuo', 'rescue', 2, 'embarrassed', '变强了！……虽然全靠后期。', 'つよくなった！…ほぼへんしゅうだけど。'),

  // —— 零七：毒舌社畜导航娘 (提示 / 驳回 / 失败)：语气冷，但不拖 ——
  L('zero7', 'hint', 1, 'calm', '划重点，看这块。', 'はい、ここ。ここみて。'),
  L('zero7', 'hint', 2, 'calm', '就提示一次，加班费另算。', 'ヒントいっかいね。ざんぎょうだいべつで。'),
  L('zero7', 'hint', 3, 'calm', '这儿。剩下的自己来。', 'ここ。あとはじぶんで。'),
  L('zero7', 'wrong', 1, 'calm', '驳回。', 'きゃっか。'),
  L('zero7', 'wrong', 2, 'sulky', '记下了，扣绩效。', 'はい、ひょうか、さげときまーす。'),
  L('zero7', 'wrong', 3, 'calm', '那儿没问题，擦擦眼睛。', 'そこ、もんだいなし。めぇこすって。'),
  L('zero7', 'lose', 1, 'calm', '理智清零，驳回。', 'しょうきど、ゼロ。きゃっか。'),
  L('zero7', 'lose', 2, 'sulky', '今天就到这，我先下班了。', 'きょうはここまで。おさきでーす。'),
  L('zero7', 'revive', 1, 'sulky', '行吧，再给你一次。', 'はぁ…もういっかいだけね。'),
  L('zero7', 'intro', 1, 'sulky', '又是加班的一天……', 'きょうも、ざんぎょうかぁ…'),
  L('zero7', 'quiz', 1, 'calm', '最后一题，答对就下班。', 'ラストもんだい。せいかいで、たいきんね。'),

  // —— 苏夜绫：中二大小姐 (助她脱困) ——
  L('yeling', 'intro', 1, 'proud', '吾之封印……又松动了！', 'わがふういんが…またゆるんだわ！'),
  L('yeling', 'step', 1, 'panicked', '才、才不是害怕！是黑暗在召唤吾！', 'こ、こわくないわよ！やみがよんでるだけ！'),
  L('yeling', 'step', 2, 'smug', '哼，干得不错嘛，眷属。', 'ふーん、やるじゃない、けんぞく。'),
  L('yeling', 'win', 1, 'embarrassed', '吾、吾是故意的！', 'わ、わざとよ！わざと！'),
  L('yeling', 'silly', 1, 'panicked', '呀啊啊！虫子！！', 'いやぁぁっ！むしぃ！！'),
  L('yeling', 'stuck', 1, 'panicked', '这黏糊糊的是什么啊！', 'ちょっと、このネバネバなによぉ！'),

  // —— 林栖：强迫症会长 (找不同 / 换装) ——
  L('linqi', 'sym', 1, 'sulky', '不对称，重来。', 'ひたいしょう。やりなおし。'),
  L('linqi', 'intro', 1, 'calm', '好，开始检查。一处都别漏。', 'はい、チェックかいし。みおとさないでね。'),
  L('linqi', 'found', 1, 'calm', '嗯，记下了。', 'うん、きろくした。'),
  L('linqi', 'found', 2, 'calm', '继续，还没完。', 'つぎ。まだあるでしょ。'),
  L('linqi', 'wrong', 1, 'smug', '那里没问题，看仔细。', 'そこはもんだいなし。よくみて。'),
  L('linqi', 'win', 1, 'embarrassed', '……完美。勉强及格。', '…かんぺき。ま、ギリごうかくね。'),
  L('linqi', 'silly', 1, 'surprised', '对称了……可为什么是大葱？', 'たいしょう…だけど、なんでネギ？'),

  // —— 团子社长：财迷猫 (经费 / 报销) ——
  L('shezhang', 'intro', 1, 'surprised', '经费在燃烧喵！', 'けいひがもえてるにゃっ！'),
  L('shezhang', 'refuse', 1, 'calm', '这笔不能报喵。', 'これは、おちないにゃ。'),
  L('shezhang', 'approve', 1, 'happy', '盖章！下不为例喵！', 'ポンッ！つぎはないにゃ！'),
  L('shezhang', 'ad', 1, 'smug', '看个广告，经费就回来了喵～', 'こうこくみたら、けいひもどるにゃ〜'),
];

export const VoiceConfig = {
  volume: 0.3,          // 语音的 100% 音量 (再乘设置面板的 语音 × 总音量 滑块)。文件统一 -20 LUFS
  cooldown: 0.6,        // 两句之间的最短间隔 (秒)；同一时间只播一句
  recentWindow: 5,      // 同一句在最近 5 次播放内不再出现
  idleGap: 20,          // 同一关内同一角色闲聊台词的最短间隔 (秒)
  idleAfter: 16,        // 玩家多久没操作后触发闲聊
  // 优先级：剧情台词 > 失败/通关 > 找对/点错/提示 > 闲聊。冲突时高优先级打断低优先级，低优先级在冷却/播放期间直接丢弃
  priority: { intro: 4, step: 4, stuck: 4, quiz: 4, silly: 3, win: 3, lose: 3, rescue: 3, revive: 3, approve: 3, refuse: 2, ad: 2, broken: 2, found: 2, gloat: 2, wrong: 2, hint: 2, idle: 1 },
  introOncePerLevel: true,  // 每个角色的 intro 每关只说一次 (重试也不重复)
  subtitleTime: 2.8,
  speechFallback: false,    // 不用浏览器 TTS 兜底 (避免机械音)；语音文件缺失时只显示字幕
};
