// 游戏主类：持有 Canvas、事件总线、全局系统与场景管理器，驱动主循环。
// (结构与姊妹项目《美少女合成》一致)
import { GameConfig } from '../config/GameConfig.js';
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
import { BootScene } from '../scenes/BootScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { GameScene } from '../scenes/GameScene.js';
import { ResultScene } from '../scenes/ResultScene.js';
import { LevelSelectScene } from '../scenes/LevelSelectScene.js';
import { platform } from '../platform/index.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = GameConfig.width;
    this.height = GameConfig.height;
    this.config = GameConfig;
    this.time = 0;
    this.pixelScale = 1;
    this.platform = platform;
    this.view = { pixelScale: 1, offsetX: 0, offsetY: 0, cssScale: 1, cssOffsetX: 0, cssOffsetY: 0 };
    this.cardSprites = [];   // [{normal, dark}] 由 BootScene 生成

    // 全局服务
    this.events = new EventBus();
    this.assets = new AssetLoader();
    this.save = new SaveSystem(GameConfig.storageKey);
    this.mixer = new MixerSystem(this.events, this.save);
    this.audio = new AudioSystem(this.events, this.mixer);
    this.music = new BgmSystem(this.events, this.mixer);
    this.voice = new VoiceSystem(this.events, this.mixer);
    this.ads = new AdService(this.events);
    this.input = new InputSystem(this);

    // 场景
    this.scenes = new SceneManager(this);
    this.scenes.register(new BootScene(this));
    this.scenes.register(new MenuScene(this));
    this.scenes.register(new GameScene(this));
    this.scenes.register(new ResultScene(this));
    this.scenes.register(new LevelSelectScene(this));
    // 场景 → BGM 曲目 (游戏场景在 enter 时按普通/地狱关自行选择)
    this.events.on('scene:changed', (name) => {
      if (name === 'menu' || name === 'levels' || name === 'result') this.music.play('menu');
    });

    this.resize = this.resize.bind(this);
    platform.onResize(this.resize);
    platform.onVisibility((visible) => this.events.emit(visible ? 'app:visible' : 'app:hidden'));
    this.resize();
  }

  /** 等比缩放到窗口 (保持 9:16)，并按设备像素比提高清晰度 */
  resize() {
    // 网页：CSS 缩放画布；抖音：整屏画布 + 内容居中 (避开刘海 / 胶囊)，两边留白用背景色填充
    this.view = platform.layout(this.canvas, this.width, this.height);
    this.pixelScale = this.view.pixelScale;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  start() {
    this.scenes.change('boot', {}, { transition: false });
    this.last = platform.now();
    const loop = (t) => {
      const now = typeof t === 'number' ? t : platform.now();
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.time += dt;
      this.scenes.update(dt);
      this.voice.update(dt);
      this.audio.update(dt);
      this.music.update(dt);
      const ctx = this.ctx;
      const v = this.view;
      if (v.offsetX || v.offsetY) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = this.config.colors.letterbox || '#f6d9ea';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, v.offsetX, v.offsetY);
      ctx.clearRect(0, 0, this.width, this.height);
      this.scenes.render(ctx);
      platform.raf(loop);
    };
    platform.raf(loop);
  }

  /** 截取当前画面 (用于结算场景背景) */
  snapshot() {
    try {
      const v = this.view;
      const sw = Math.min(this.canvas.width - v.offsetX, Math.round(this.width * this.pixelScale));
      const sh = Math.min(this.canvas.height - v.offsetY, Math.round(this.height * this.pixelScale));
      const c = platform.createCanvas(sw, sh);
      c.getContext('2d').drawImage(this.canvas, v.offsetX, v.offsetY, sw, sh, 0, 0, sw, sh);
      return c;
    } catch (err) {
      return null;   // 个别平台不支持把上屏画布当图片源：结算页退回背景图
    }
  }
}
