// 游戏主类：持有 Canvas、事件总线、全局系统与场景管理器，驱动主循环。
import { GameConfig } from '../config/GameConfig.js';
import { LEVEL_COUNT } from '../config/LevelConfig.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { InputSystem } from '../systems/InputSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { VoiceSystem } from '../systems/VoiceSystem.js';
import { BgmSystem } from '../systems/BgmSystem.js';
import { MixerSystem } from '../systems/MixerSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AdService } from '../systems/AdService.js';
import { HintSystem } from '../systems/HintSystem.js';
import { BootScene } from '../scenes/BootScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { LevelSelectScene } from '../scenes/LevelSelectScene.js';
import { GameScene } from '../scenes/GameScene.js';
import { platform as defaultPlatform } from '../platform/current.js';

export class Game {
  /**
   * @param {object} [plat] 平台 (src/platform)；缺省为当前构建的平台
   * @param {object} [canvas] 主画布；缺省由平台创建 (网页：#game，抖音：tt.createCanvas())
   */
  constructor(plat = defaultPlatform, canvas = null) {
    this.platform = plat;
    this.canvas = canvas || plat.createMainCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.width = GameConfig.width;
    this.height = GameConfig.height;
    this.config = GameConfig;
    this.time = 0;
    this.timeScale = 1;   // 关卡模拟速度 (调试/测试可调)
    this.pixelScale = 1;
    this.view = { scale: 1, ox: 0, oy: 0, cssW: this.width, cssH: this.height, dpr: 1, fullscreen: false };

    // 全局服务
    this.events = new EventBus();
    this.assets = new AssetLoader(plat);
    this.save = new SaveSystem(GameConfig.storageKey, { legacyKeys: GameConfig.legacyStorageKeys, maxLevel: LEVEL_COUNT, storage: plat.storage });
    this.mixer = new MixerSystem(this.events, this.save);          // 总音量 + 各声道音量
    this.audio = new AudioSystem(this.events, this.save, this.mixer, plat);
    this.voice = new VoiceSystem(this.events, this.save, this.audio, this.mixer, plat);
    this.bgm = new BgmSystem(this.events, this.save, this.audio, this.mixer, plat);   // 跨场景连续播放
    this.ads = new AdService(this.events, { platform: plat });
    this.hints = new HintSystem(this.events, this.save, this.ads);
    this.input = new InputSystem(this);

    // 场景
    this.scenes = new SceneManager(this);
    this.scenes.register(new BootScene(this));
    this.scenes.register(new MenuScene(this));
    this.scenes.register(new LevelSelectScene(this));
    this.scenes.register(new GameScene(this));

    this.resize = this.resize.bind(this);
    plat.onResize(this.resize);
    // 切后台 (网页 visibilitychange / 抖音 tt.onHide)：GameScene 暂停并作废当前一笔，音频系统暂停
    plat.onVisibility((hidden) => this.events.emit(hidden ? 'app:hidden' : 'app:visible'));
    this.resize();
    plat.init(this);
  }

  /**
   * 等比缩放 (保持 9:16)，并按设备像素比提高清晰度。
   * 网页：画布本身缩放到 cssW×cssH，由页面居中。
   * 抖音：画布铺满屏幕，540×960 的逻辑画面放进安全区内居中，四周留边 (letterbox)。
   */
  resize() {
    const vp = this.platform.viewport();
    const dpr = vp.dpr || 1;
    const sa = vp.safeArea || { left: 0, top: 0, right: vp.width, bottom: vp.height };
    if (vp.fullscreen) {
      const aw = Math.max(1, sa.right - sa.left); const ah = Math.max(1, sa.bottom - sa.top);
      const scale = Math.min(aw / this.width, ah / this.height);
      const cssW = this.width * scale; const cssH = this.height * scale;
      this.canvas.width = Math.max(1, Math.round(vp.width * dpr));
      this.canvas.height = Math.max(1, Math.round(vp.height * dpr));
      this.view = { scale, ox: sa.left + (aw - cssW) / 2, oy: sa.top + (ah - cssH) / 2, cssW, cssH, dpr, fullscreen: true, screenW: vp.width, screenH: vp.height };
      this.pixelScale = scale * dpr;
    } else {
      const vw = vp.width || this.width;
      const vh = vp.height || this.height;
      const scale = Math.min(vw / this.width, vh / this.height);
      const cssW = Math.floor(this.width * scale);
      const cssH = Math.floor(this.height * scale);
      this.canvas.width = Math.max(1, Math.round(cssW * dpr));
      this.canvas.height = Math.max(1, Math.round(cssH * dpr));
      this.view = { scale, ox: 0, oy: 0, cssW, cssH, dpr, fullscreen: false };
      this.pixelScale = this.canvas.width / this.width;
      this.platform.layout(this.canvas, this.view);
    }
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  /** 屏幕坐标 (clientX/clientY) -> 540×960 逻辑坐标 */
  toLogical(clientX, clientY) {
    const r = this.platform.canvasRect(this.canvas, this.view);
    return {
      x: ((clientX - r.left) / (r.width || 1)) * this.width,
      y: ((clientY - r.top) / (r.height || 1)) * this.height,
    };
  }

  start() {
    this.scenes.change('boot', {}, { transition: false });
    const plat = this.platform;
    this.last = plat.now();
    const loop = (now) => {
      if (typeof now !== 'number') now = plat.now();
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.time += dt;
      this.scenes.update(dt);
      this.voice.update(dt);
      this.bgm.update(dt);
      this.audio.update(dt);
      this.renderFrame(dt);
      plat.raf(loop);
    };
    plat.raf(loop);
  }

  renderFrame(dt) {
    const ctx = this.ctx;
    const v = this.view;
    if (v.fullscreen) {
      // 留边：先用纯色/渐变铺满整屏，再把逻辑画面裁剪到安全区内的 9:16 区域
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      g.addColorStop(0, '#ffd9ec'); g.addColorStop(1, '#e8dcff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const d = v.dpr;
      ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, v.ox * d, v.oy * d);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.width, this.height);
      ctx.clip();
      this.scenes.render(ctx, dt);
      ctx.restore();
    } else {
      ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      this.scenes.render(ctx, dt);
    }
  }
}
