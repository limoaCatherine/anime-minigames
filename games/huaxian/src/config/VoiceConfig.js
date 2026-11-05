// 主角语音台词表：按事件分组，每组 3 句随机播放 (不连续重复)。
// text: 字幕显示的日文  zh: 中文翻译  emo: 情绪标签 (甜 / 慌张 / 开心 / 委屈)
// tts: 交给语音合成的文本 (假名为主、、。控制停顿，去掉 ♡♪ 等符号)
// file: 预生成的语音文件 —— 由 tools/generate_voices.mjs 调用 AivisSpeech Engine 生成，
//       每句生成 8 个候选 (--takes 8)，再由 tools/pick_voice_takes.py 用 Whisper 筛掉读错的，挑音高起伏最大的一条
// 1.2 语音改版 (玩家反馈「太慢、太机械、没感情」)：
//   - 引擎从 VOICEVOX (中国うさぎ) 换成 AivisSpeech (Style-Bert-VITS2，自带自然的语气和气息)
//   - 台词改短 (1~2.5 秒)、口语化，句首带语气词 (えっ / もう～ / やったぁ / えへへっ)
//   - 语速 ×1.15 + 缓急 (tempo) ×1.2，听感约 1.2 倍速；句首加一口轻轻的吸气声；句中停顿压到 ≤0.08 秒
//   - 按情绪切换风格 (1.5 起 リダ)：甜 = キュート，开心 = 元気，慌张 = ノーマル (语速更快)，委屈 = 悲しみ
// 1.5 换声 (法人上架合规)：まお 的权利方 (株式会社Trippy) 的二次创作指南要求法人/营利事业者事先联系，
//   本作发行方是公司，因此改用作者明确允许「商用・非商用问わず」、只需署名、无需事先联系的 リダ / Lida。
// 说话人：リダ / Lida（感情表现模型）—— VTuber リダ 官方音声合成模型 (AivisHub 446d2053-14ca-4b68-897c-380faf555b59)
// 许可：作者自定许可 (AivisHub「カスタムライセンス」，原文见 docs/licenses/Lida-voice-model.txt)
//       使用条件：在话者处标注角色名「リダ」或「Lida」及 https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join
//       禁止：模型二次配布/转让、用作训练素材、暴力/性的利用、损害リダ角色形象或品牌、其他不适当用途 (本游戏均不涉及)
//       作者注明「このライセンスは都度、変更される場合があります」—— 发布 / 更新前请到 AivisHub 模型页复核最新条款。
export const VOICE_SPEAKER = {
  name: 'リダ',
  credit: 'AivisSpeech: リダ / Lida',
  detail: 'VTuber リダ 官方音声合成模型',
  url: 'https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join',
  urlShort: 'youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join',
  license: 'リダ 作者许可（商用可・需署名「リダ」+URL；许可可能变更）',
  licenseShort: '模型 リダ 作者许可 · 引擎 LGPL-3.0',
  engine: 'AivisSpeech Engine 1.2.0',
  modelUuid: '446d2053-14ca-4b68-897c-380faf555b59',
};

const LIDA = { engine: 'aivisspeech', model: 'リダ / Lida（感情表現モデル）', modelUuid: VOICE_SPEAKER.modelUuid };
const CUTE = { ...LIDA, style: 'キュート', styleId: 1349521256 };
const GENKI = { ...LIDA, style: '元気', styleId: 1349521252 };
const NORMAL = { ...LIDA, style: 'ノーマル', styleId: 1349521248 };
const SAD = { ...LIDA, style: '悲しみ', styleId: 1349521255 };
// speed=speedScale  intonation=风格(感情)强度  tempo=tempoDynamicsScale (语速缓急)  pitch=±0.03 内微调
// breath=句首吸气声音量 (相对峰值，false = 不加)  breathLen=吸气时长 (秒)
const EMO = {
  甜: (o) => ({ ...CUTE, speed: 1.15, intonation: 1.3, tempo: 1.2, breath: 0.05, ...o }),
  开心: (o) => ({ ...GENKI, speed: 1.18, intonation: 1.6, tempo: 1.25, breath: 0.05, ...o }),
  慌张: (o) => ({ ...NORMAL, speed: 1.22, intonation: 1.5, tempo: 1.3, breath: 0.08, breathLen: 0.13, ...o }),
  委屈: (o) => ({ ...SAD, speed: 1.1, intonation: 1.4, tempo: 1.15, breath: 0.06, breathLen: 0.2, ...o }),
};
const L = (file, emo, text, zh, tts, o) => ({ file: `assets/audio/voice/${file}.mp3`, emo, text, zh, tts, voice: EMO[emo](o) });

export const VOICE_LINES = {
  // 关卡开始 (每关第一次挑战时一定说，之后重试只有一半概率)
  start: [
    L('start_1', '甜', 'ねぇねぇ、守ってくれる？', '呐呐，你会保护我吧？', 'ねぇねぇ、まもってくれる？'),
    L('start_2', '甜', 'えへへっ、頼りにしてるね♡', '嘿嘿，我可全靠你啦♡', 'えへへっ、たよりにしてるね！'),
    L('start_3', '开心', 'よーし、おねがいね！', '好——拜托你啦！', 'よーし、おねがいね！'),
  ],
  // 危险靠近 (每次挑战最多一次)
  scared: [
    L('scared_1', '慌张', 'えっ、やだやだ、来ないでぇ！', '诶？不要不要，别过来！', 'えっ、やだやだ、こないでー！'),
    L('scared_2', '慌张', 'ひゃっ！こわいよぉ！', '呀！好可怕！', 'ひゃっ！こわいよー！'),
    L('scared_3', '慌张', 'わわっ、たすけてぇ！', '哇哇，救命呀！', 'わわっ、たすけてー！'),
  ],
  // 过关
  win: [
    L('win_1', '开心', 'やったぁ！ありがとっ♡', '太好啦！谢谢你♡', 'やったー！ありがとっ！'),
    L('win_2', '开心', 'えへへっ、助かったぁ♪', '嘿嘿，得救啦♪', 'えへへっ、たすかったー！'),
    L('win_3', '甜', 'わーい！だいすきっ♡', '哇——最喜欢你了♡', 'わーい！だいすきっ！'),
  ],
  // 三星过关
  stars3: [
    L('stars3_1', '开心', 'すごーい！天才じゃん！', '好厉害！你是天才吧！', 'すごーい！てんさいじゃん！'),
    L('stars3_2', '开心', 'えぇっ、カンペキ！？', '诶诶？完美！？', 'えぇっ、かんぺき！？'),
    L('stars3_3', '开心', 'きゃー！かっこいいっ♡', '呀——好帅♡', 'きゃー！かっこいいっ！'),
  ],
  // 失败
  lose: [
    L('lose_1', '委屈', 'もう～、いたいよぉ…', '真是的～好痛哦……', 'もー、いたいよー。'),
    L('lose_2', '委屈', 'うぅ…もう一回、ね？', '呜……再来一次，好不好？', 'うう、もういっかい、ね？'),
    L('lose_3', '委屈', 'ふえぇ…負けちゃったぁ', '呜哇……输掉了啦', 'ふえー、まけちゃったー。'),
  ],
};

export const VoiceConfig = {
  volume: 0.3,          // 语音的 100% 音量 (再乘设置面板的 语音 × 总音量 滑块)；0.9 → 0.5 → 0.3。文件已统一到 -20 LUFS
  cooldown: 0.6,        // 两句语音的最短间隔 (秒)；同一时间只播一句
  groupCooldown: {},    // 同一组语音的最短间隔 (秒)
  startChance: 0.5,     // 同一关重试时说开场白的概率 (每关第一次挑战一定会说)
  scaredPerAttempt: 1,  // 每次挑战最多说几次「害怕」台词
  priority: { start: 1, scared: 2, lose: 3, win: 3, stars3: 4 }, // 高优先级可打断低优先级
  subtitleTime: 2.6,    // 字幕显示时长
  speechRate: 1.25,     // speechSynthesis 兜底时的语速/音高
  speechPitch: 1.45,
};

/** 所有台词按顺序展开 (预加载 / 生成语音用) */
export const ALL_VOICE_LINES = Object.entries(VOICE_LINES).flatMap(([group, list]) => list.map((line, i) => ({ group, index: i, ...line })));
