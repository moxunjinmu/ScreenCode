import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import fs from 'fs';
import path from 'path';

// 版本号（取自 package.json）与打包日期（YYYYMMDD），用于产物文件名
const appVersion = (JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { version: string }).version;
const now = new Date();
const buildDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

// 获取模块的所有依赖（递归）
function getAllDependencies(moduleName: string, deps = new Set<string>()): Set<string> {
  if (deps.has(moduleName)) return deps;
  deps.add(moduleName);

  const pkgPath = path.join(process.cwd(), 'node_modules', moduleName, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const dep of Object.keys(allDeps || {})) {
      getAllDependencies(dep, deps);
    }
  }
  return deps;
}

// afterCopy 钩子：在复制文件到构建目录后、prune 之前执行
const afterCopy = [
  (buildPath: string, _electronVersion: string, _platform: string, _arch: string, callback: Function) => {
    const sourceDir = path.join(process.cwd(), 'node_modules');
    const targetDir = path.join(buildPath, 'node_modules');

    // 获取 sharp 及其所有依赖
    const allDeps = getAllDependencies('sharp');
    console.log(`[afterCopy] Copying ${allDeps.size} dependencies...`);

    for (const dep of allDeps) {
      const src = path.join(sourceDir, dep);
      const dest = path.join(targetDir, dep);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest, { recursive: true, force: true });
      }
    }
    console.log('[afterCopy] All dependencies copied');

    // 将 sharp 的 DLL 文件复制到 .node 文件所在目录，确保能被加载
    const dllSourceDir = path.join(sourceDir, '@img', 'sharp-win32-x64', 'lib');
    const dllTargetDir = path.join(targetDir, '@img', 'sharp-win32-x64', 'lib');
    
    if (fs.existsSync(dllSourceDir) && fs.existsSync(dllTargetDir)) {
      const dllFiles = fs.readdirSync(dllSourceDir).filter(f => f.endsWith('.dll'));
      for (const dllFile of dllFiles) {
        const src = path.join(dllSourceDir, dllFile);
        const dest = path.join(dllTargetDir, dllFile);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          console.log(`[afterCopy] Copied ${dllFile} to ${dest}`);
        }
      }
    }

    // 同时复制到应用根目录
    if (fs.existsSync(dllSourceDir)) {
      const dllFiles = fs.readdirSync(dllSourceDir).filter(f => f.endsWith('.dll'));
      for (const dllFile of dllFiles) {
        const src = path.join(dllSourceDir, dllFile);
        const dest = path.join(buildPath, dllFile);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          console.log(`[afterCopy] Copied ${dllFile} to app root`);
        }
      }
    }

    callback();
  },
];

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'ScreenCode',
    appBundleId: 'com.screencode.app',
    win32metadata: {
      CompanyName: 'ScreenCode Team',
      FileDescription: 'Screen capture and code extraction tool',
      OriginalFilename: 'ScreenCode.exe',
      ProductName: 'ScreenCode',
    },
    afterCopy,
  },
  rebuildConfig: {
    onlyModules: [], // 跳过 rebuild，避免网络请求
  },
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      // 将 DLL 文件复制到最终输出目录
      const outputPath = packageResult.outputPaths[0];
      const dllSourceDir = path.join(process.cwd(), 'node_modules', '@img', 'sharp-win32-x64', 'lib');
      
      if (fs.existsSync(dllSourceDir) && fs.existsSync(outputPath)) {
        const dllFiles = fs.readdirSync(dllSourceDir).filter(f => f.endsWith('.dll'));
        for (const dllFile of dllFiles) {
          const src = path.join(dllSourceDir, dllFile);
          const dest = path.join(outputPath, dllFile);
          fs.copyFileSync(src, dest);
          console.log(`[postPackage] Copied ${dllFile} to ${outputPath}`);
        }
      }
    },
    postMake: async (_forgeConfig, makeResults) => {
      // 对于 Squirrel 安装包，需要将 DLL 文件复制到 staging 目录
      // Squirrel 安装后会将应用放在 %LocalAppData%\ScreenCode\app-1.0.0\
      // 我们需要确保 DLL 文件被包含在安装包中
      console.log('[postMake] Make completed:', makeResults);
    },
  },
  makers: [
    new MakerSquirrel({
      name: 'ScreenCode',
      authors: 'ScreenCode Team',
      description: 'Screen capture and code extraction tool',
      // 安装包文件名带版本号和打包日期，如 ScreenCode-1.1.0-20260804 Setup.exe
      setupExe: `ScreenCode-${appVersion}-${buildDate} Setup.exe`,
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({
      force: true,
    }),
    new VitePlugin({
      build: [
        {
          // Main process
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          // Preload scripts
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
