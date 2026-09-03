const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = process.cwd();
const packageMetadata = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
);
const packagedAppPath = path.join(projectRoot, 'out', 'ScreenCode-win32-x64');
const builderExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);

/** 使用本地时区生成安装器产物日期，保持文件名稳定且容易辨认。 */
function buildDate(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
}

/** 计算最终安装器校验值，便于交付时确认文件完整性。 */
function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

if (!fs.existsSync(packagedAppPath)) {
  throw new Error(`找不到 Forge 打包目录：${packagedAppPath}`);
}
if (!fs.existsSync(builderExecutable)) {
  throw new Error(`找不到 electron-builder：${builderExecutable}`);
}

const date = buildDate();
const artifactName = `ScreenCode-${packageMetadata.version}-${date}-Setup.exe`;
const builderResult = spawnSync(
  builderExecutable,
  [
    '--win',
    'nsis',
    '--x64',
    '--prepackaged',
    packagedAppPath,
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, BUILD_DATE: date },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (builderResult.error) throw builderResult.error;
if (builderResult.status !== 0) {
  throw new Error(`electron-builder 构建失败，退出码：${builderResult.status}`);
}

const builtInstaller = path.join(projectRoot, 'out', 'make', 'nsis', artifactName);
if (!fs.existsSync(builtInstaller)) {
  throw new Error(`构建完成但未找到安装器：${builtInstaller}`);
}

const projectInstaller = path.join(projectRoot, artifactName);
fs.copyFileSync(builtInstaller, projectInstaller);
console.log(`[installer] ${projectInstaller}`);
console.log(`[installer] sha256=${sha256(projectInstaller)}`);
