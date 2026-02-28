# Electron Main 进程

> 最后更新: 2026-02-28
> 文件: `src/main/index.ts`

## 职责

Main 进程是应用的核心控制层，负责：

- 创建 BrowserWindow 和系统托盘
- 注册全局热键（Ctrl+Shift+S / E / M）
- 初始化各子模块（capture、processor、ai、config）
- 管理 IPC handler 注册

## 全局热键

| 热键 | 动作 | 定义 |
|------|------|------|
| `Ctrl+Shift+S` | 捕获当前帧入队 | `SHORTCUTS.CAPTURE` |
| `Ctrl+Shift+E` | 提取代码 | `SHORTCUTS.EXTRACT` |
| `Ctrl+Shift+M` | 打开主窗口 | `SHORTCUTS.SHOW_WINDOW` |

热键通过 Electron `globalShortcut` 注册，应用退出时自动注销。

## 子模块

| 模块 | 目录 | 文档 |
|------|------|------|
| 视频采集 | `src/main/capture/` | [capture-engine.md](capture-engine.md) |
| 帧处理 | `src/main/processor/` | [capture-engine.md](capture-engine.md) |
| AI 服务 | `src/main/ai/` | [ai-integration.md](ai-integration.md) |
| 配置管理 | `src/main/config/` | [config-system.md](config-system.md) |
| 系统托盘 | `src/main/tray/` | 本文件 |

## 系统托盘

文件: `src/main/tray/trayManager.ts`

- 常驻系统托盘，显示采集卡信号状态
- 右键菜单：显示主窗口 / 设置 / 退出
- 状态图标：绿=有信号 / 红=无信号 / 黄=处理中（Phase 2）

## 注意事项

- Main 进程代码修改需要重启应用才能生效
- 所有异步操作应有适当的错误处理和超时机制
