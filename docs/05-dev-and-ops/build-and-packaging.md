# 构建与打包

> 最后更新: 2026-04-09

## 开发命令

```bash
# 启动开发服务器 (Electron Forge + Vite)
npm run dev

# 类型检查 (不生成文件)
npm run typecheck

# ESLint 检查
npm run lint

# 打包应用 (生成可运行的应用目录，不含安装器)
npm run package

# 构建安装包 (生成可分发的安装器)
npm run build
```

## 构建工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| Electron Forge | ^7.11 | 应用打包与分发 |
| Vite | ^5.0 | 前端构建，热更新比 CRA 快 10 倍 |
| TypeScript | ^5.3 | 类型检查 |
| ESLint | ^8 | 代码规范检查 |
| Maker Squirrel | ^7.2 | Windows 安装包生成 |
| Maker ZIP | ^7.2 | macOS 分发包 |
| Maker Deb/Rpm | ^7.2 | Linux 分发包 |

## 打包配置

配置文件: `forge.config.ts`

### 核心配置项

- **打包器**: `electron-packager` (通过 Forge 集成)
- **ASAR**: 启用，将源码打包为 asar 归档
- **应用名**: `ScreenCode`
- **Native 模块**: `AutoUnpackNativesPlugin` 自动解包 Sharp 等原生模块
- **Rebuild**: 跳过 (`rebuildConfig.onlyModules: []`)，避免下载 Electron headers

### Sharp Native 模块处理

Sharp 是核心图像处理模块，包含平台特定的二进制文件 (DLL)。打包流程通过 3 个钩子确保 DLL 正确包含：

1. **`afterCopy` 钩子** — 递归复制 Sharp 及其 28 个依赖到构建目录
   - 将 `@img/sharp-win32-x64/lib/*.dll` 复制到 `.node` 文件所在目录
   - 同时将 DLL 复制到应用根目录作为备用加载路径

2. **`postPackage` 钩子** — 将 DLL 复制到最终输出目录根级
   - 确保 `libvips-42.dll` 和 `libvips-cpp.dll` 在 exe 同级目录

3. **`postMake` 钩子** — 预留用于 Squirrel 安装包的额外处理

### 构建产物

```
out/
├── ScreenCode-win32-x64/          # 打包产物
│   ├── ScreenCode.exe             # 主程序
│   ├── libvips-42.dll             # Sharp 依赖
│   ├── libvips-cpp.dll            # Sharp 依赖
│   ├── resources/
│   │   └── app.asar               # 应用代码 (ASAR 归档)
│   ├── *.dll                      # Electron/Chromium 运行时
│   └── locales/                   # 语言包
└── make/                          # 安装包产物 (npm run build)
    └── squirrel.windows/          # Windows Squirrel 安装器
```

**打包体积**: ~312MB (含 Electron 运行时 + Sharp 原生库)

## 开发模式

- Renderer 进程: Vite 热更新，修改即时生效
- Main 进程: 修改后需重启应用
- Preload 脚本: 修改后需重启应用

## 网络问题与镜像配置

### 常见问题: 打包超时

打包时 Electron Forge 需要下载 Electron 二进制文件。在无法访问 GitHub (`github.com`) 的网络环境下会超时失败：

```
✖ Copying files [FAILED: connect ETIMEDOUT 20.205.243.166:443]
```

### 解决方案: 使用国内镜像

设置 `ELECTRON_MIRROR` 环境变量指向 npmmirror：

```bash
# Linux/macOS
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" npm run package

# Windows (PowerShell)
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; npm run package

# Windows (CMD)
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ && npm run package
```

### 持久化镜像配置

在项目根目录 `.npmrc` 中添加（如需永久生效）：

```
electron_mirror=https://npmmirror.com/mirrors/electron/
```

### 本地缓存

Electron 二进制文件缓存位置：
- **Windows**: `%LOCALAPPDATA%/electron/Cache/`
- **macOS**: `~/Library/Caches/electron/`
- **Linux**: `~/.cache/electron/`

首次成功打包后会自动缓存 Electron ZIP，后续离线也可使用。

## 目标平台

| 平台 | 支持状态 | 打包 Maker |
|------|----------|------------|
| Windows (x64) | 主要目标 | Squirrel (exe 安装器) |
| macOS | 开发环境 | ZIP |
| Linux | 未测试 | Deb / RPM |

> 目标用户 95% 为 Windows 企业环境

## Phase 2 规划

- electron-updater 支持内网离线包更新模式
- 代码签名 (Windows Authenticode)
- 体积优化 (按需精简 Electron 模块)
