// 将 electron-forge package 输出的目录重命名为带版本号和打包日期的形式
// 例如 out/ScreenCode-win32-x64 -> out/ScreenCode-1.1.0-20260804-win32-x64
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

const now = new Date();
const buildDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

const outDir = path.join(root, 'out');
const entries = fs.readdirSync(outDir, { withFileTypes: true });

let renamed = 0;
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  // 匹配 electron-forge 默认输出目录名：ScreenCode-<platform>-<arch>
  const match = entry.name.match(/^ScreenCode-(win32|darwin|linux)-(.+)$/);
  if (!match) continue;

  const newName = `ScreenCode-${pkg.version}-${buildDate}-${match[1]}-${match[2]}`;
  const src = path.join(outDir, entry.name);
  const dest = path.join(outDir, newName);

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.renameSync(src, dest);
  console.log(`[rename-package] ${entry.name} -> ${newName}`);
  renamed++;
}

if (renamed === 0) {
  console.log('[rename-package] No package output directory found to rename.');
}
