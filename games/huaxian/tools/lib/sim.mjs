// 无头模拟工具：把 src/ 下的关卡模拟代码用 esbuild 打包成一个 Node 可导入的模块 (verify_levels / test_physics / sloppy_bot 共用)。
import { build } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

export async function loadSim() {
  globalThis.window = globalThis.window || { Matter: require(path.join(root, 'vendor/matter.min.js')) };
  const entry = path.join(os.tmpdir(), `adl-entry-${process.pid}-${Date.now()}.js`);
  const out = entry.replace('entry', 'sim').replace(/\.js$/, '.mjs');
  const src = (p) => JSON.stringify(path.join(root, p));
  fs.writeFileSync(entry, `
export { LevelWorld } from ${src('src/core/LevelWorld.js')};
export { EventBus } from ${src('src/core/EventBus.js')};
export { LEVELS, getLevel, resolveLevel } from ${src('src/config/LevelConfig.js')};
export { GameConfig } from ${src('src/config/GameConfig.js')};
export { hazardDef } from ${src('src/config/HazardConfig.js')};
export { Rock } from ${src('src/entities/Rock.js')};
export { Bee } from ${src('src/entities/Bee.js')};
export { Projectile } from ${src('src/entities/Projectile.js')};
export { Crate } from ${src('src/entities/mechanisms/Crate.js')};
export { mechanismDef } from ${src('src/config/MechanismConfig.js')};
export { SaveSystem, migrateSave } from ${src('src/systems/SaveSystem.js')};
export { simplify } from ${src('src/core/geometry.js')};
export { default as Matter } from ${src('src/lib/matter.js')};
`);
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'error' });
  const mod = await import(pathToFileURL(out).href);
  fs.rmSync(entry); fs.rmSync(out);
  return mod;
}

/** 确定性随机数 (测试用) */
export function rng(seed) {
  let s = (seed * 16807) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
