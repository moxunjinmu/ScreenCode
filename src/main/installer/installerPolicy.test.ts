import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
) as {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: {
    artifactName?: string;
    win?: { target?: Array<{ target?: string; arch?: string[] }> };
    nsis?: Record<string, unknown>;
  };
};
const forgeConfig = fs.readFileSync(path.join(projectRoot, 'forge.config.ts'), 'utf8');

describe('Windows 安装器策略', () => {
  it('使用 NSIS 辅助安装模式，而不是 Squirrel 静默安装器', () => {
    expect(packageJson.scripts?.build).toBe('npm run build:installer');
    expect(packageJson.devDependencies?.['electron-builder']).toBeTruthy();
    expect(packageJson.devDependencies?.['@electron-forge/maker-squirrel']).toBeUndefined();
    expect(forgeConfig).not.toContain('MakerSquirrel');
    expect(packageJson.build?.win?.target).toContainEqual({
      target: 'nsis',
      arch: ['x64'],
    });
  });

  it('显示安装向导并允许选择安装目录', () => {
    expect(packageJson.build?.nsis).toMatchObject({
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: 'always',
      createStartMenuShortcut: true,
      shortcutName: 'ScreenCode',
      runAfterFinish: true,
    });
  });

  it('将带版本和日期的安装器复制到项目根目录', () => {
    expect(packageJson.scripts?.['build:installer']).toContain('scripts/build-installer.js');
    expect(packageJson.build?.artifactName).toBe(
      'ScreenCode-${version}-${env.BUILD_DATE}-Setup.${ext}',
    );
  });
});
