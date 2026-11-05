// 音频配置 (与《美少女合成》新标准一致)：
//   文件响度：语音 -20 LUFS、BGM -22 LUFS (由 tools/generate_voices.mjs / tools/compose_bgm.py 统一)
//   默认音量：语音 0.3、音效 0.12、BGM 0.15；语音播放时 BGM 平滑压到 ×0.55
//   实际音量 = 声道 100% 音量 × 声道滑块 (0~200%) × 总音量滑块
// 修改默认音量后请提升 SaveSystem 的 SETTINGS_VERSION，旧存档里的音量才不会覆盖新默认值。
export const AudioConfig = {
  sfxVolume: 0.12,          // 合成音效 (WebAudio) 的 100% 音量
  reverb: { seconds: 1.1, send: 0.16 },   // 音效的小房间混响
  bgm: {
    volume: 0.15,           // BGM 的 100% 音量
    duck: 0.55,             // 台词播放时 BGM ×0.55 (约 -5 dB)
    duckAttack: 0.12,       // 压低的时间常数 (秒)
    duckRelease: 0.6,       // 台词结束后恢复的时间常数 (秒)
    fadeIn: 0.8,            // 开始 / 换曲时的淡入时间常数
    fadeOut: 0.35,          // 换曲时旧曲淡出的时间常数
    maxDuckTime: 8,         // 安全上限：压低最多持续的秒数
    stingDuck: 0.4,         // 通关 / 失败音效响起时 BGM 短暂压到 ×0.4
    stingTime: 2.6,
    // 原创曲目 (tools/compose_bgm.py 程序化作曲)：ogg 无缝循环，mp3 兜底
    tracks: {
      menu: { title: '樱花便当', file: 'assets/audio/bgm/bgm_menu' },
      game: { title: '午休三连', file: 'assets/audio/bgm/bgm_game' },
      hell: { title: '满槽警报', file: 'assets/audio/bgm/bgm_hell' },
    },
  },
};

export const MixerConfig = {
  channels: ['master', 'voice', 'sfx', 'bgm'],
  labels: { master: '总音量', voice: '角色语音', sfx: '音效', bgm: '背景音乐' },
  defaults: { master: 1, voice: 1, sfx: 1, bgm: 1 },
  max: { master: 1, voice: 2, sfx: 2, bgm: 2 },   // 声道最多 200%
  step: 0.05,
};
