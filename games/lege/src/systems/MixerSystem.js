// 音量混合 (沿用《美少女合成》MixerSystem)：总音量 + 语音 / 音效 / 背景音乐 三个声道，外加各自的开关与全局静音。
// 实际音量 gain(ch) = 声道 100% 音量 × 声道滑块 × 总音量；开关关闭或静音时为 0。
// AudioSystem / VoiceSystem / BgmSystem 通过 gain(channel) 读取，并监听 mixer:change 实时更新。
import { AudioConfig, MixerConfig } from '../config/AudioConfig.js';
import { VoiceConfig } from '../config/VoiceConfig.js';

const BASE = { voice: VoiceConfig.volume, sfx: AudioConfig.sfxVolume, bgm: AudioConfig.bgm.volume };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const SETTINGS_VERSION = 3;

export class MixerSystem {
  constructor(events, save) {
    this.events = events;
    this.save = save;
    // 旧版本 (v2 及以前) 存档里的音量按旧标准保存，直接丢弃，改用新的默认值
    if (save.get('settingsVersion', 0) !== SETTINGS_VERSION) {
      save.set('volumes', null);
      save.set('settingsVersion', SETTINGS_VERSION);
    }
    const saved = save.get('volumes', null) || {};
    this.levels = {};
    for (const ch of MixerConfig.channels) {
      const v = Number(saved[ch]);
      this.levels[ch] = Number.isFinite(v) ? clamp(v, 0, MixerConfig.max[ch]) : MixerConfig.defaults[ch];
    }
    this.on = { sfx: save.get('sfxOn', true), bgm: save.get('bgmOn', true), voice: save.get('voiceOn', true) };
    this.muted = !!save.get('muted', false);
  }

  /** 声道实际音量 (0..1)，已计入开关与静音 */
  gain(channel) {
    if (this.muted || (channel !== 'master' && !this.on[channel])) return 0;
    if (channel === 'master') return this.levels.master;
    return clamp(BASE[channel] * this.levels[channel] * this.levels.master, 0, 1);
  }

  get(channel) { return this.levels[channel]; }
  isOn(channel) { return channel === 'master' ? !this.muted : !!this.on[channel]; }

  set(channel, value, persist = true) {
    const v = clamp(Math.round(value / MixerConfig.step) * MixerConfig.step, 0, MixerConfig.max[channel]);
    if (Math.abs(v - this.levels[channel]) < 1e-9) return v;
    this.levels[channel] = v;
    if (persist) this.save.set('volumes', { ...this.levels });
    this.emit(channel);
    return v;
  }

  setOn(channel, on) {
    if (channel === 'master') return this.setMuted(!on);
    this.on[channel] = !!on;
    this.save.set(`${channel}On`, !!on);
    this.emit(channel);
    return this.on[channel];
  }

  setMuted(m) {
    this.muted = !!m;
    this.save.set('muted', this.muted);
    this.emit('master');
    this.events.emit('audio:mute', this.muted);
    return this.muted;
  }

  emit(channel) { this.events.emit('mixer:change', { channel, levels: { ...this.levels } }); }

  reset() {
    for (const ch of MixerConfig.channels) this.levels[ch] = MixerConfig.defaults[ch];
    this.save.set('volumes', { ...this.levels });
    this.emit('all');
  }
}
