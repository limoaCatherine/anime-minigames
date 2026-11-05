// 角色语音 (AivisSpeech 预生成 mp3)。台词、情绪、声线、署名的唯一数据源：
//   tools/generate_voices.mjs 读取本文件合成语音，CreditsPanel / README 读取署名。
//
// 声线：2 个 AivisSpeech 模型 (リダ / 黄金笑)，按性格分给 14 位角色，用不同风格 + 音高微调区分角色。
// 每句台词标一个情绪 emotion (happy 开心 / smug 得意 / shy 害羞 / panic 慌张 / sulky 撒娇不甘 / calm 平静 / sleepy 困)，
// 生成时按「该模型的情绪→风格表」选择对应的风格 (例如 リダ: happy→元気，shy→キュート)。
//
// 字段：
//   id     文件名 assets/audio/voice/<id>.mp3     who  说话的卡牌序号 (0 起，对应 CardConfig)
//   group  播放场合 clear / start / startBoss / warn / win / winBoss / lose / revive
//   text   字幕日文     zh  字幕中文     tts  交给引擎的朗读文本 (假名，避免读错)
//   emotion 情绪 (决定风格)；style 可直接指定风格名；speed / intensity / tempo / pitch 覆盖角色默认值
//
// 授权 (只采用「企业/法人可直接商用、无需事先联系」的模型，2026-10-11 按官方页面核实)：
//   リダ / Lida  —— 作者自定规约：商用・非商用可，须注明「リダ」与频道 URL；禁止二次配布、用作学习素材、暴力・色情用途
//   黄金笑       —— Tαkoe プロジェクト利用規約：商用・法人利用可，须著作权表示「Tαkoe:AivisSpeech:黄金笑」；
//                   禁止赌博相关、宗教、损害角色形象、模型无改动再配布、未经生成者许可二次利用生成的语音
// 不再采用：コハク / まお (Trippy 二次創作ガイドライン 第4条2：法人・営利事業者须事先联系)、
//           凛音エル (電脳天使工業 规约：企业利用须先联系)、らせつん / みちのくあいり (こずかた学園：企业长期商用须先联系)。

const STYLES = {
  lida: { ノーマル: 1349521248, 落ち着き: 1349521249, クール: 1349521250, デフォルト: 1349521251, 元気: 1349521252, 落ち着き２: 1349521253, 元気２: 1349521254, 悲しみ: 1349521255, キュート: 1349521256, キュート2: 1349521257 },
  emi: { ノーマル: 1618811328, Negative: 1618811329, Positive: 1618811330 },
};

/** 声线 (AivisSpeech 模型) 与署名 */
export const VOICES = {
  lida: {
    name: 'リダ', model: 'リダ / Lida（感情表現モデル）', modelUuid: '446d2053-14ca-4b68-897c-380faf555b59', styles: STYLES.lida,
    emo: { happy: '元気', smug: 'クール', shy: 'キュート', panic: '元気２', sulky: '悲しみ', calm: '落ち着き', sleepy: '落ち着き２' },
    credit: 'リダ / Lida', detail: 'youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join', license: '作者规约 (商用可，须署名)', note: '作者注明：此条款可能随时变更，以模型页最新版本为准',
  },
  emi: {
    name: '黄金笑', model: '黄金笑_T2モデル', modelUuid: '734c12b6-eaf2-4dbd-8596-8663c72d2afa', styles: STYLES.emi,
    emo: { happy: 'Positive', smug: 'ノーマル', shy: 'ノーマル', panic: 'Positive', sulky: 'Negative', calm: 'ノーマル', sleepy: 'Negative' },
    credit: 'Tαkoe:AivisSpeech:黄金笑', detail: 'Tαkoeプロジェクト (TakoeProject)', license: 'Tαkoe 利用规约 (商用・法人可，须著作权表示)',
  },
};

// 14 位角色 → 声线 (按性格分配)。speed 1.15~1.25；intensity = 情绪强度 (AivisSpeech 的 intonationScale)；tempo = 语速缓急
export const VOICE_CAST = [
  { card: 0,  voice: 'emi',  speed: 1.18, intensity: 1.35, tempo: 1.2,  pitch: 0.02 },  // 见习学妹：怯生生
  { card: 1,  voice: 'lida', speed: 1.22, intensity: 1.5,  tempo: 1.3,  pitch: 0.01 },  // 元气同学 (主持)
  { card: 2,  voice: 'emi',  speed: 1.15, intensity: 1.25, tempo: 1.1,  pitch: 0 },     // 图书委员
  { card: 3,  voice: 'lida', speed: 1.22, intensity: 1.45, tempo: 1.25, pitch: -0.01 }, // 社团部长
  { card: 4,  voice: 'lida', speed: 1.22, intensity: 1.5,  tempo: 1.3,  pitch: 0.03 },  // 偶像练习生
  { card: 5,  voice: 'emi',  speed: 1.2,  intensity: 1.5,  tempo: 1.3,  pitch: 0.03 },  // 魔法少女
  { card: 6,  voice: 'emi',  speed: 1.15, intensity: 1.3,  tempo: 1.1,  pitch: -0.02 }, // 精灵巫女
  { card: 7,  voice: 'lida', speed: 1.2,  intensity: 1.45, tempo: 1.25, pitch: 0.02 },  // 星辉歌姬
  { card: 8,  voice: 'emi',  speed: 1.15, intensity: 1.3,  tempo: 1.1,  pitch: -0.01 }, // 月之公主 (困困的)
  { card: 9,  voice: 'lida', speed: 1.18, intensity: 1.4,  tempo: 1.15, pitch: -0.03 }, // 天空女王
  { card: 10, voice: 'emi',  speed: 1.15, intensity: 1.3,  tempo: 1.1,  pitch: -0.03, reverb: 0.16 }, // 星海女神
  { card: 11, voice: 'lida', speed: 1.22, intensity: 1.45, tempo: 1.25, pitch: 0.02 },  // 女仆店长
  { card: 12, voice: 'emi',  speed: 1.2,  intensity: 1.45, tempo: 1.25, pitch: 0.01 },  // 神社巫女
  { card: 13, voice: 'lida', speed: 1.15, intensity: 1.25, tempo: 1.1,  pitch: -0.04 }, // 咖啡前辈
];
export const HOST = 1;   // 元气同学

const C = (who, n, emotion, text, zh, tts, o = {}) => ({ id: `c${String(who + 1).padStart(2, '0')}_${n}`, who, group: 'clear', emotion, text, zh, tts: tts || text, ...o });
const H = (group, n, emotion, text, zh, tts, o = {}) => ({ id: `${group}_${n}`, who: HOST, group, emotion, text, zh, tts: tts || text, ...o });

// 少而短：每句 1.5~3 秒，口语、带语气词
export const VOICE_LINES = [
  // —— 消除：被消掉的那位角色自己说 (每人一句) ——
  C(0, 1, 'shy', 'えっ、消えた…やったぁ', '诶，消掉了……好耶', 'えっ、きえた…やったぁ'),
  C(1, 1, 'happy', 'よしっ、三つそろった！', '好嘞，凑齐三个！', 'よしっ、みっつそろった！'),
  C(2, 1, 'calm', 'ふふ、いい読みですね', '嗯哼，看得很准嘛。', 'ふふ、いいよみですね'),
  C(3, 1, 'happy', 'よーし、その調子！', '好——就这样！', 'よーし、そのちょうし！'),
  C(4, 1, 'happy', 'やったー！今の見てた？', '耶！刚才那下看到没？', 'やったー！いまのみてた？'),
  C(5, 1, 'happy', 'えーいっ！消えちゃえ！', '嘿！消失吧！', 'えーいっ！きえちゃえ！'),
  C(6, 1, 'calm', 'まあ、お見事ですわ', '哎呀，漂亮。', 'まあ、おみごとですわ'),
  C(7, 1, 'happy', 'いいね、ノってきた！', '不错，来感觉了！', 'いいね、のってきた！'),
  C(8, 1, 'sleepy', 'ふわぁ…あ、消えてる', '呼啊……啊，已经消掉了', 'ふわぁ…あ、きえてる'),
  C(9, 1, 'smug', 'ふん、まあまあね', '哼，还行吧。', 'ふん、まあまあね'),
  C(10, 1, 'calm', 'うん、上手。見てたよ', '嗯，很棒。我看着呢。', 'うん、じょうず。みてたよ'),
  C(11, 1, 'happy', 'はーい、お片付け完了です！', '好——收拾完毕！', 'はーい、おかたづけかんりょうです！'),
  C(12, 1, 'happy', 'おっ、大吉かも！', '哦，说不定是大吉！', 'おっ、だいきち、かも！'),
  C(13, 1, 'calm', 'うん、いいペースだね', '嗯，节奏不错呢。', 'うん、いいペースだね'),
  // —— 元气同学 (主持) ——
  H('start', 1, 'happy', 'よーし、いくよっ！', '好——开始咯！', 'よーし、いくよっ！'),
  H('start', 2, 'smug', 'お、今日もやる？', '哦，今天也来？', 'お、きょうもやる？'),
  H('startBoss', 1, 'panic', 'うそっ、これ全部消すの！？', '不会吧，这些全要消掉？！', 'うそっ、これぜんぶけすの！？'),
  H('warn', 1, 'panic', 'ちょっと、もうパンパン！', '等下，快塞满了！', 'ちょっと、もう、ぱんぱん！'),
  H('warn', 2, 'panic', 'あと一枠だよ！', '只剩一格了！', 'あとひとわくだよ！'),
  H('win', 1, 'happy', 'やった！クリアだよ！', '好耶！过关啦！', 'やった！クリアだよ！'),
  H('win', 2, 'smug', 'えへへ、さすがだね', '嘿嘿，不愧是你。', 'えへへ、さすがだね'),
  H('winBoss', 1, 'happy', 'うそっ、ほんとに勝っちゃった！', '不会吧，真的赢了！', 'うそっ、ほんとにかっちゃった！'),
  H('lose', 1, 'sulky', 'もう～、惜しかったぁ…', '哎呀——就差一点……', 'もう、おしかったぁ…'),
  H('lose', 2, 'shy', 'ドンマイ、もう一回ね？', '没事，再来一次？', 'ドンマイ、もういっかいね？'),
  H('revive', 1, 'happy', 'よしっ、まだいける！', '好，还能打！', 'よしっ、まだいける！'),
];

export const VoiceConfig = {
  volume: 0.3,          // 语音的 100% 音量 (文件统一为 -20 LUFS)
  cooldown: 0.6,        // 两句语音的最短间隔 (秒)
  // 消除台词的频率限制：不是每次消除都说话
  clearGap: 7,          // 距离上一句语音至少 7 秒
  clearChance: 0.35,    // 满足间隔后，普通消除有 35% 概率说话 (每关第一次消除、连消 ×2 以上必说)
  subtitleTime: 2.2,    // 字幕显示时长
  // 优先级：高优先级可以打断正在播放的低优先级语音；同级/低级在播放中则丢弃
  priority: { clear: 1, warn: 2, start: 3, startBoss: 3, revive: 3, lose: 4, win: 5, winBoss: 6 },
  speechRate: 1.2,      // speechSynthesis 兜底时的语速/音高
  speechPitch: 1.45,
};

/** 某句台词实际使用的声线参数 (生成工具与调试用) */
export function lineVoice(line) {
  const cast = VOICE_CAST[line.who];
  const v = VOICES[cast.voice];
  const style = line.style || v.emo[line.emotion] || Object.keys(v.styles)[0];
  return {
    voice: cast.voice, model: v.model, modelUuid: v.modelUuid, style, styleId: v.styles[style],
    speed: line.speed ?? cast.speed, intensity: line.intensity ?? cast.intensity, tempo: line.tempo ?? cast.tempo,
    pitch: line.pitch ?? cast.pitch, reverb: cast.reverb || 0.06,
  };
}

/** 署名 (去重，按首次出现顺序) */
export const VOICE_CREDITS = [...new Set(VOICE_CAST.map((c) => c.voice))].map((k) => ({ key: k, ...VOICES[k] }));

export function voiceFile(line) {
  return `assets/audio/voice/${line.id}.mp3`;
}
