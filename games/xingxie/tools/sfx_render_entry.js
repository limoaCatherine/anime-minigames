// 浏览器内运行 (tools/render_sfx.mjs 用 Playwright 打开)：用 OfflineAudioContext 跑 AudioSystem.synth()，
// 输出与网页版完全相同的合成音效 PCM。
import { AudioSystem } from '../src/systems/AudioSystem.js';
import { AudioConfig } from '../src/config/AudioConfig.js';
import { EventBus } from '../src/core/EventBus.js';

const save = { get: (k, d) => d, set() {} };
const sys = new AudioSystem(new EventBus(), save, null);
sys.muted = false;

async function render(fn, seconds, sr) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sr), sr);
  sys.ctx = ctx;
  AudioSystem.buildGraph(sys, ctx, AudioConfig.sfxVolume);
  sys.swarm = null;
  fn(sys);
  const buf = await ctx.startRendering();
  return Array.from(buf.getChannelData(0));
}

window.renderSfx = (name, opts, seconds, sr) => render((s) => s.synth(name, opts || {}), seconds, sr);
window.renderSwarm = (seconds, sr) => render((s) => { s.setSwarm(1); }, seconds, sr);
