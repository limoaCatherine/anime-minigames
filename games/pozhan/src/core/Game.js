// 游戏主类：持有 Canvas、事件总线、全局系统与场景管理器，驱动主循环。
// (结构与姊妹项目《美少女合成》《美少女了个美》一致)
import { GameConfig } from '../config/GameConfig.js';
import { Platform } from '../platform/Platform.js';
import { IMAGE_LIST } from '../config/CharacterConfig.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { InputSystem } from '../systems/InputSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { BgmSystem } from '../systems/BgmSystem.js';
import { MixerSystem } from '../systems/MixerSystem.js';
import { VoiceSystem } from '../systems/VoiceSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AdService } from '../systems/AdService.js';
import { Subtitle } from '../ui/Subtitle.js';
import { BootScene } from '../scenes/BootScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { LevelSelectScene } from '../scenes/LevelSelectScene.js';
import { GameScene } from '../scenes/GameScene.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = GameConfig.width;
    this.height = GameConfig.height;
    this.config = GameConfig;
    this.time = 0;
    this.pixelScale = 1;
    this.errors = [];

    this.events = new EventBus();
    this.assets = new AssetLoader();
    this.imageList = IMAGE_LIST;
    this.save = new SaveSystem(GameConfig.storageKey);
    this.mixer = new MixerSystem(this.events, this.save);
    this.audio = new AudioSystem(this.events, this.mixer);
    this.music = new BgmSystem(this.events, this.mixer);
    this.voice = new VoiceSystem(this.events, this.mixer);
    this.ads = new AdService(this.events);
    this.subtitle = new Subtitle(this);
    this.input = new InputSystem(this);

    this.scenes = new SceneManager(this);
    this.scenes.register(new BootScene(this));
    this.scenes.register(new MenuScene(this));
    this.scenes.register(new LevelSelectScene(this));
    this.scenes.register(new GameScene(this));
    this.events.on('scene:changed', (name) => {
      if (name === 'menu' || name === 'levels') this.music.play('menu');
      if (name === 'game') this.music.play('game');
    });

    this.resize = this.resize.bind(this);
    Platform.onResize(this.resize);
    Platform.onHide(() => this.events.emit('app:hidden'));
    Platform.onShow((res) => this.events.emit('app:visible', res));
    this.resize();
  }

  /** 等比缩放 (保持 9:16)。网页版：CSS 居中；抖音版：画布铺满屏幕，内容避开刘海 / 胶囊按钮并居中，两侧留边 */
  resize() {
    const L = Platform.layoutCanvas(this.canvas, this.width, this.height);
    this.layout = L;
    this.pixelScale = L.scale;
    this.ctx.imageSmoothingEnabled = true;
    try { this.ctx.imageSmoothingQuality = 'high'; } catch (_) { /* 小游戏可能不支持 */ }
  }

  start() {
    this.scenes.change('boot', {}, { transition: false });
    this.last = Platform.now();
    const loop = () => {
      const now = Platform.now();
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.step(dt);
      Platform.raf(loop);
    };
    Platform.raf(loop);
  }

  step(dt) {
    this.time += dt;
    try {
      this.scenes.update(dt);
      this.voice.update(dt);
      this.music.update(dt);
      this.ads.update(dt);
      const ctx = this.ctx; const L = this.layout;
      if (L.letterbox) {
        // 抖音全屏画布：先铺满背景色 (两侧 / 上下留边)，再把 540×960 内容画进安全区并裁剪
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const g = ctx.createLinearGradient(0, 0, 0, L.fullH);
        g.addColorStop(0, GameConfig.colors.bgTop); g.addColorStop(1, GameConfig.colors.bgBottom);
        ctx.fillStyle = g; ctx.fillRect(0, 0, L.fullW, L.fullH);
        ctx.save();
        ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, L.ox, L.oy);
        ctx.beginPath(); ctx.rect(0, 0, this.width, this.height); ctx.clip();
        this.scenes.render(ctx);
        ctx.restore();
      } else {
        ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);
        this.scenes.render(ctx);
      }
    } catch (err) {
      if (this.errors.length < 20) { this.errors.push(String(err && err.stack || err)); console.error(err); }
    }
  }
}
