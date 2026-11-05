// 生成 GitHub Release 用的两个包 (先 npm run package:win，它会顺带构建 dist/)：
//   release-out/xingxie-lunwu-windows.zip  —— 星屑轮舞/星屑轮舞.exe … + 怎么玩.txt
//   release-out/xingxie-lunwu-web.zip      —— index.html + game.js + assets … + 怎么玩.txt (file:// 双击即玩)
// 用 python3 zipfile 打包 (文件名 UTF-8 标记，Windows 资源管理器解压中文名正常)。
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'release-out');
const howtoSrc = path.join(root, 'tools/release/怎么玩.txt');
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
// 怎么玩.txt 标题里的版本号跟 package.json 走，免得每次发版手改
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const howto = path.join(out, '.howto.txt');
await fs.writeFile(howto, (await fs.readFile(howtoSrc, 'utf8')).replace(/v\d+\.\d+\.\d+/, `v${version}`));
for (const p of ['release/星屑轮舞/星屑轮舞.exe', 'dist/index.html']) await fs.access(path.join(root, p));

const py = `
import zipfile, os, sys
def pack(zip_path, entries):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for src, arc in entries:
            if os.path.isdir(src):
                for dp, dn, fn in os.walk(src):
                    dn.sort()
                    for f in sorted(fn):
                        p = os.path.join(dp, f)
                        z.write(p, os.path.join(arc, os.path.relpath(p, src)).replace(os.sep, '/'))
            else:
                z.write(src, arc)
root, out, howto = sys.argv[1:4]
pack(os.path.join(out, 'xingxie-lunwu-windows.zip'), [(os.path.join(root, 'release', '星屑轮舞'), '星屑轮舞'), (howto, '怎么玩.txt')])
pack(os.path.join(out, 'xingxie-lunwu-web.zip'), [(os.path.join(root, 'dist'), ''), (howto, '怎么玩.txt')])
`;
execFileSync('python3', ['-c', py, root, out, howto], { stdio: 'inherit' });
await fs.rm(howto);
for (const f of await fs.readdir(out)) console.log(f, ((await fs.stat(path.join(out, f))).size / 1024 / 1024).toFixed(1) + ' MB');
