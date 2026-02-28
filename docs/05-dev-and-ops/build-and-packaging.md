# 构建与打包

> 最后更新: 2026-02-28

## 开发命令

```bash
# 启动开发服务器 (Electron Forge + Vite)
npm run dev

# 类型检查 (不生成文件)
npm run typecheck

# ESLint 检查
npm run lint

# 构建生产版本
npm run build

# 打包应用 (生成可分发的安装包)
npm run package
```

## 构建工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| Electron Forge | - | 应用打包与分发 |
| Vite | ^5.0 | 前端构建，热更新比 CRA 快 10 倍 |
| TypeScript | - | 类型检查 |
| ESLint | - | 代码规范检查 |

## 开发模式

- Renderer 进程: Vite 热更新，修改即时生效
- Main 进程: 修改后需重启应用
- Preload 脚本: 修改后需重启应用

## 打包输出

目标平台: Windows（目标用户 95% 为 Windows 企业环境）

打包工具: electron-builder

## Native 模块

- Sharp: 图像处理 Native 模块，需确保 `npm install` 时正确编译
- 打包时需包含对应平台的 Sharp 二进制文件

## Phase 2 规划

- electron-updater 支持内网离线包更新模式
