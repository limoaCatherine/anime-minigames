// 音频配置：音效 / 蜜蜂群嗡嗡声 / 背景音乐的默认音量与参数。语音相关参数在 VoiceConfig.js。
// 实际音量 = 声道 100% 音量 × 设置面板的声道滑块 × 总音量滑块 (MixerSystem)。
// 修改默认音量后请同时提升 SaveSystem 的 SETTINGS_VERSION，这样旧存档里保存的音量不会覆盖新的默认值。
export const AudioConfig = {
  sfxVolume: 0.12,          // 合成音效的 100% 音量 (WebAudio)；0.5 → 0.25 → 0.12 (与《美少女合成》统一)

  // 蜜蜂群：整个蜂群只有一个很轻的、低通过的、缓慢起伏的嗡嗡声 (不是每只蜜蜂一个声音)
  swarm: {
    maxGain: 0.05,          // 强度为 1 时的增益 (再乘 sfxVolume)，上限很低
    radius: 300,            // 蜜蜂距主角多远开始计入 (像素)
    fullCount: 9,           // 约等于这么多只蜜蜂贴着主角时强度到 1
    farWeight: 0.12,        // 远处 (radius 之外) 的蜜蜂每只计入的权重
    base: 165,              // 嗡嗡声基频 (Hz)
    lowpass: 480,           // 低通截止频率 (Hz)，越低越柔和
    attack: 0.35,           // 淡入时间常数 (秒)
    release: 0.6,           // 淡出时间常数 (秒)
  },
  bounce: { gap: 0.12, volume: 0.035 },   // 蜜蜂撞线的小「啵」声：最短间隔 (秒) 与音量

  bgm: {
    // 按顺序选择浏览器能播放的格式：ogg 循环无缝；mp3 作为兜底
    sources: [
      { src: 'assets/audio/bgm/bgm_main.ogg', type: 'audio/ogg; codecs="vorbis"' },
      { src: 'assets/audio/bgm/bgm_main.mp3', type: 'audio/mpeg' },
    ],
    title: '棉花糖散步 (Marshmallow Stroll)',
    volume: 0.15,           // BGM 的 100% 音量 (文件已统一到 -22 LUFS)；0.25 → 0.15
    duck: 0.55,             // 台词播放时 BGM 降到 55% (约 -5 dB)
    duckAttack: 0.12,       // 闪避下降时间常数 (秒)
    duckRelease: 0.6,       // 台词结束后恢复的时间常数 (秒)
    fadeIn: 0.8,            // 开始/恢复播放时的淡入时间常数 (秒)
    maxDuckTime: 8,         // 安全上限：闪避最多持续的秒数
  },
};

// 音量设置 (设置面板的滑块)：实际音量 = 各声道 100% 音量 × 声道滑块 × 总音量滑块
export const MixerConfig = {
  channels: ['master', 'voice', 'sfx', 'bgm'],
  labels: { master: '总音量', voice: '角色语音', sfx: '音效', bgm: '背景音乐' },
  defaults: { master: 1, voice: 1, sfx: 1, bgm: 1 },
  max: { master: 1, voice: 2, sfx: 2, bgm: 2 },   // 声道最多可调到 200%
  step: 0.05,
};
