// 资源加载器：预加载图片并汇报进度。加载失败时生成占位图并给出警告，保证游戏可继续。
// 使用 <img> 加载，file:// 双击运行也没有跨域问题 (不读取像素，不需要 CORS)。
import { platform } from '../platform/index.js';

export class AssetLoader {
  constructor() {
    this.images = new Map();
  }

  getImage(key) {
    return this.images.get(key);
  }

  /**
   * @param {{key:string, src:string, color?:string, label?:string}[]} list
   * @param {(progress:number)=>void} onProgress
   */
  loadImages(list, onProgress = () => {}) {
    let done = 0;
    const total = list.length;
    if (total === 0) { onProgress(1); return Promise.resolve(); }
    return Promise.all(list.map((item) => new Promise((resolve) => {
      const img = platform.createImage();
      img.onload = () => {
        this.images.set(item.key, img);
        onProgress(++done / total);
        resolve();
      };
      img.onerror = () => {
        console.warn(`[AssetLoader] 图片加载失败，使用占位图: ${item.src}`);
        this.images.set(item.key, AssetLoader.placeholder(item.color, item.label));
        onProgress(++done / total);
        resolve();
      };
      img.src = item.src;
    })));
  }

  /** 占位卡牌 (160x176，圆角方块 + 文字) */
  static placeholder(color = '#ccc', label = '?') {
    const c = platform.createCanvas(160, 176);
    const g = c.getContext('2d');
    g.fillStyle = '#d9b99b';
    g.fillRect(4, 20, 152, 154);
    g.fillStyle = color;
    g.fillRect(0, 0, 160, 160);
    g.fillStyle = '#fff';
    g.font = 'bold 56px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 80, 84);
    return c;
  }
}
