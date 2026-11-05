// 音频配置 (合成类新标准)：
//   文件响度：语音 -20 LUFS、BGM -22 LUFS (由 tools/generate_voices.mjs / tools/compose_bgm.py 统一)
//   默认音量：语音 0.3、音效 0.12、BGM 0.15；语音播放时 BGM 平滑压到 ×0.55 (150ms 压下、约 300ms 恢复)
//   实际音量 = 声道 100% 音量 × 声道滑块 (0~200%) × 总音量滑块
// 修改默认音量后请提升 MixerSystem 的 SETTINGS_VERSION，旧存档里的音量才不会覆盖新默认值。
export const AudioConfig = {
  sfxVolume: 0.12,          // 合成音效 (WebAudio) 的 100% 音量
  reverb: { seconds: 0.9, send: 0.14 },
  pitchJitter: 0.025,       // 每次播放的随机音高偏移 (±2.5%)，避免"复读机"
  sfxPool: 5,               // 抖音版：预渲染音效的播放器池大小 (InnerAudioContext 实例数有限，轮流复用)
  bgm: {
    volume: 0.15,           // BGM 的 100% 音量
    duck: 0.55,             // 台词播放时 BGM ×0.55
    duckAttack: 0.05,       // 压低的时间常数 (秒) ≈ 150ms 内到位
    duckRelease: 0.1,       // 恢复的时间常数 ≈ 300ms 内恢复
    fadeIn: 0.8,
    fadeOut: 0.35,
    maxDuckTime: 8,
    stingDuck: 0.4,         // 通关 / 失败音效响起时 BGM 短暂压到 ×0.4
    stingTime: 2.4,
    // 原创曲目 (tools/compose_bgm.py 程序化作曲)。v1.3 起全平台只用 mp3 (iOS 不支持 ogg)。
    // mp3 首尾有编码填充，直接 loop 会有空隙 → 文件 = 一整轮 (loopEnd 秒) + 开头 0.5 秒，
    // BgmSystem 用两个播放器在 loopEnd 处交叉淡化 crossfade 秒 (那一段两边内容相同，听不出接缝)。
    crossfade: 0.15,
    tracks: {
      menu: { title: '吐槽役的早晨', file: 'assets/audio/bgm/bgm_menu.mp3', loopEnd: 57.6 },
      game: { title: '破绽在哪喵', file: 'assets/audio/bgm/bgm_game.mp3', loopEnd: 66.206893 },
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
