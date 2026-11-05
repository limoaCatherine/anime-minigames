// 游戏主类：Canvas、事件总线、全局系统 (存档 / 音量 / 音效 / 语音 / BGM / 广告 / 输入 / 录屏分享 / 分包) 与场景管理，驱动主循环。
// 不直接访问 window / document / tt：一律经过 core/platform (网页版与抖音小游戏共用这份代码)。
import { GameConfig } from '../config/GameConfig.js';
import { platform } from './platform/index.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { PackManager } from './PackManager.js';
import { InputSystem } from '../systems/InputSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { VoiceSystem } from '../systems/VoiceSystem.js';
import { BgmSystem } from '../systems/BgmSystem.js';
import { MixerSystem } from '../systems/MixerSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AdService } from '../systems/AdService.js';
import { ShareService } from '../systems/ShareService.js';
import { SidebarService } from '../systems/SidebarService.js';
import { SpriteFactory } from '../render/SpriteFactory.js';
import { BootScene } from '../scenes/BootScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { CharacterScene } from '../scenes/CharacterScene.js';
import { TalentScene } from '../scenes/TalentScene.js';
import { GameScene } from '../scenes/GameScene.js';
import { ResultScene } from '../scenes/ResultScene.js';
import { drawText } from '../ui/draw.js';

export class Game {
  constructor(canvas) {
    this.platform = platform;
    if (canvas && !platform.canvas) platform.canvas = canvas;
    this.canvas = canvas || platform.getMainCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.width = GameConfig.width;
    this.height = GameConfig.height;
    this.config = GameConfig;
    this.time = 0;
    this.pixelScale = 1;
    this.view = { scale: 1, offX: 0, offY: 0, canvasW: this.width, canvasH: this.height };
    this.timeScale = 1;                 // 调试 / 自动化测试用的加速
    this.debug = { fps: platform.query('fps') };
    this.notice = null;                 // 全局小提示 { text, t }

    this.events = new EventBus();
    this.assets = new AssetLoader();
    this.save = new SaveSystem(GameConfig.storageKey);
    this.mixer = new MixerSystem(this.events, this.save);
    this.audio = new AudioSystem(this.events, this.save, this.mixer);
    this.voice = new VoiceSystem(this.events, this.save, this.audio, this.mixer);
    this.bgm = new BgmSystem(this.events, this.save, this.audio, this.mixer);
    this.ads = new AdService(this.events);
    this.share = new ShareService(this);
    this.sidebar = new SidebarService(this);
    this.packs = new PackManager(this);
    this.sprites = new SpriteFactory(this.assets);
    this.input = new InputSystem(this);

    this.scenes = new SceneManager(this);
    [BootScene, MenuScene, CharacterScene, TalentScene, GameScene, ResultScene].forEach((S) => this.scenes.register(new S(this)));

    this.resize = this.resize.bind(this);
    platform.onResize(this.resize);
    platform.onHide(() => this.events.emit('app:hidden'));
    platform.onShow((res) => this.events.emit('app:visible', res));
    this.events.on('ad:error', (e) => this.showNotice(e.message, '#ffd0d0'));
    this.events.on('sidebar:claim', (e) => { this.showNotice(`侧边栏奖励 +${e.coins} 星屑币`, '#ffe08a'); this.audio.play('coin'); });
    this.resize();
  }

  resize() {
    this.view = platform.layout(this.width, this.height);
    this.pixelScale = this.view.scale;
    this.ctx.imageSmoothingEnabled = true;
    try { this.ctx.imageSmoothingQuality = 'high'; } catch (_) { /* ignore */ }
  }

  /** 逻辑坐标系下的小提示 (领奖 / 分享结果 / 广告失败)，抖音版同时用系统 toast */
  showNotice(text, color = '#ffffff') { this.notice = { text, color, t: 0 }; }

  frame(dt) {
    this.time += dt;
    this.scenes.update(dt);
    this.voice.update(dt);
    this.bgm.update(dt);
    this.packs.update(dt);
    const ctx = this.ctx; const v = this.view;
    if (v.offX || v.offY) {
      // 抖音版：画布铺满屏幕，逻辑画面以外 (刘海 / 胶囊 / 上下留边) 涂深色底
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1d1640';
      ctx.fillRect(0, 0, v.canvasW, v.canvasH);
    }
    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, v.offX || 0, v.offY || 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (v.offX || v.offY) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.width, this.height); ctx.clip(); }
    this.scenes.render(ctx, dt);
    if (this.notice) this.renderNotice(ctx, dt);
    if (v.offX || v.offY) ctx.restore();
  }

  renderNotice(ctx, dt) {
    const n = this.notice;
    n.t += dt;
    if (n.t > 2.4) { this.notice = null; return; }
    const a = Math.min(1, n.t * 6, (2.4 - n.t) * 3);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(40,24,80,0.85)';
    const w = Math.min(this.width - 40, 40 + n.text.length * 17);
    ctx.fillRect((this.width - w) / 2, this.height * 0.42 - 24, w, 48);
    drawText(ctx, n.text, this.width / 2, this.height * 0.42, { size: 17, color: n.color, weight: 'normal' });
    ctx.restore();
  }

  start() {
    this.scenes.change('boot', {}, { transition: false });
    this.last = platform.now();
    const loop = (now) => {
      const t = typeof now === 'number' ? now : platform.now();
      const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      try {
        this.frame(dt);
      } catch (err) {
        console.error(err);
      }
      platform.raf(loop);
    };
    platform.raf(loop);
  }
}
