// 音频配置：合成音效、怪群环境声、背景音乐。语音参数在 VoiceConfig.js。
// 实际音量 = 声道 100% 音量 × 设置面板的声道滑块 × 总音量滑块 (MixerSystem)。
import { BGM_SOURCES } from './BgmSources.js';

export const AudioConfig = {
  sfxVolume: 0.12,          // 合成音效 100% 音量 (团队统一标准)

  // 割草类音效规则
  hit: {
    gap: 0.05,              // 同一类命中音效最短间隔 50ms
    maxVoices: 5,           // 命中类音效同时最多 5 个
    pitchJitter: 0.06,      // ±6% 随机音高
  },
  gem: {
    comboWindow: 0.35,      // 0.35 秒内连续捡宝石，音高沿五声音阶往上走
    maxStep: 11,
    gap: 0.03,
  },
  // 怪群环境声：不给单只怪发声，只有一层低沉的「沙沙」底噪，音量跟随玩家附近的怪物密度
  swarm: {
    maxGain: 0.07,
    radius: 260,
    fullCount: 45,          // 附近约 45 只怪时强度到 1
    base: 92,
    lowpass: 520,
    attack: 0.5,
    release: 0.9,
  },

  bgm: {
    volume: 0.15,           // BGM 100% 音量 (文件统一 -22 LUFS)
    duck: 0.55,             // 台词播放时压到 55%
    duckAttack: 0.12,
    duckRelease: 0.6,
    fadeIn: 0.8,
    crossfade: 1.2,         // 换曲交叉淡化 (秒)
    maxDuckTime: 8,
    tracks: {
      menu:   { title: '午夜的星屑', sources: BGM_SOURCES.menu },
      battle: { title: '星屑轮舞', sources: BGM_SOURCES.battle },
      boss:   { title: '梦魇进行曲', sources: BGM_SOURCES.boss },
    },
  },
};

export const MixerConfig = {
  channels: ['master', 'voice', 'sfx', 'bgm'],
  labels: { master: '总音量', voice: '角色语音', sfx: '音效', bgm: '背景音乐' },
  defaults: { master: 1, voice: 1, sfx: 1, bgm: 1 },
  max: { master: 1, voice: 2, sfx: 2, bgm: 2 },
  step: 0.05,
};
