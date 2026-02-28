# 架构概览

> 最后更新: 2026-02-28

## 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                   Electron Application                    │
├─────────────────────────────────────────────────────────┤
│  Main Process                                             │
│  ┌───────────┐ ┌────────────┐ ┌───────────────────────┐ │
│  │ Capture   │ │ Processor  │ │ AI Service            │ │
│  │ - Device  │ │ - RingBuf  │ │ - Route (index.ts)    │ │
│  │ - Stream  │ │ - FrameDiff│ │ - ClaudeService       │ │
│  │           │ │ - Sharp    │ │ - OpenAIService       │ │
│  └───────────┘ └────────────┘ └───────────────────────┘ │
│  ┌───────────┐ ┌────────────┐ ┌───────────────────────┐ │
│  │ Shortcut  │ │ Tray       │ │ Config (electron-store)│ │
│  └───────────┘ └────────────┘ └───────────────────────┘ │
├─────────────────── IPC ─────────────────────────────────┤
│  Renderer Process (React + Zustand + TailwindCSS)        │
│  ┌───────────┐ ┌────────────┐ ┌───────────────────────┐ │
│  │ Preview   │ │ ChatPanel  │ │ Settings              │ │
│  │ Thumbnail │ │ CodeDisplay│ │ Toast                 │ │
│  └───────────┘ └────────────┘ └───────────────────────┘ │
│  Store: capture | frame | app | chat | ui                │
└─────────────────────────────────────────────────────────┘
```

## 进程模型

项目采用 Electron 多进程架构：

| 进程 | 目录 | 职责 |
|------|------|------|
| Main Process | `src/main/` | 系统级操作、全局热键、视频采集、图像处理、AI 服务调用、配置管理 |
| Renderer Process | `src/renderer/` | React UI，用户交互和状态展示 |
| Preload | `src/preload/` | 安全桥接层，通过 `contextBridge` 暴露受限 API |

## 目录结构

```
src/
├── main/           # 主进程
│   ├── index.ts    # 入口，窗口/热键
│   ├── capture/    # 视频采集
│   ├── processor/  # 帧处理 (ringBuffer, frameDiff, imageCompressor)
│   ├── ai/         # AI 服务 (index路由, claude, openai, prompt)
│   ├── tray/       # 系统托盘
│   └── config/     # 配置管理
├── renderer/       # 渲染进程
│   ├── components/ # Preview, ChatPanel, Settings, CodeDisplay, Toast, ThumbnailQueue, Layout
│   └── store/      # captureStore, frameStore, appStore, chatStore, uiStore
├── preload/        # 安全桥接
└── shared/         # types.ts, constants.ts
```

## 技术栈

| 层次 | 技术 | 用途 |
|------|------|------|
| 运行时 | Electron ^28 | 桌面应用框架 |
| 构建 | Electron Forge + Vite | 开发与打包 |
| 前端 | React 18 + TypeScript | UI |
| 状态 | Zustand | 状态管理 |
| 样式 | TailwindCSS | 原子化 CSS |
| 图像 | Sharp | 高性能压缩 |
| AI | @anthropic-ai/sdk + openai | 双 SDK 自动路由 |
| 存储 | electron-store | 配置持久化 |

## 关键设计决策

详见 ADR 文档：
- [ADR-0001: 初始 Electron 架构](../07-adrs/ADR-0001-initial-electron-architecture.md)
- [ADR-0002: AI 供应商抽象层](../07-adrs/ADR-0002-ai-provider-abstraction.md)
- [ADR-0003: 配置存储与迁移](../07-adrs/ADR-0003-config-store-and-migration.md)

## 相关文档

- [运行时序](runtime-views.md)
- [Tauri 备选架构](tauri-alternative.md)
- [模块文档](../02-modules/)
- [接口契约](../03-interfaces/)
