// 需要预加载的图片 (相对 index.html)。角色头像 / 半身卡由 tools/process_images.py 从立绘裁出。
import { CHARACTERS } from './CharacterConfig.js';

export const IMAGES = [
  { key: 'bg_menu', src: 'assets/images/bg_menu.jpg', color: '#2a1f5c', label: '' },
  { key: 'boss_nox', src: 'assets/images/boss_nox.png', color: '#7a3cff', label: 'N' },
  ...CHARACTERS.flatMap((c) => [
    { key: c.avatar, src: `assets/images/${c.avatar}.png`, color: c.color, label: c.name[0] },
    { key: c.card, src: `assets/images/${c.card}.png`, color: c.color, label: c.name[0] },
  ]),
];
