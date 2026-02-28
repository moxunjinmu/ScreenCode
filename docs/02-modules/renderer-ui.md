# Renderer UI

> 最后更新: 2026-02-28
> 目录: `src/renderer/`

## 技术栈

- React 18 + TypeScript
- Zustand 状态管理
- TailwindCSS 原子化样式

## 组件结构

| 组件 | 目录 | 功能 |
|------|------|------|
| Preview | `components/Preview/` | 视频实时预览 |
| ChatPanel | `components/ChatPanel/` | 多轮对话面板（可拖拽宽度、多图 OCR） |
| Settings | `components/Settings/` | 供应商网格布局配置、JSON 双向同步 |
| CodeDisplay | `components/CodeDisplay/` | 代码只读展示 + 一键复制 |
| Toast | `components/Toast/` | 右下角通知（1.5s 自动消失） |
| ThumbnailQueue | `components/ThumbnailQueue/` | 帧缩略图队列 + 全屏预览 |
| RegionCaptureOverlay | `components/RegionCaptureOverlay/` | 区域截图覆盖层 |
| Layout | `components/Layout/` | 整体布局容器 |

## 状态管理

5 个独立 Zustand Store，详见 [状态模型](../04-data-and-state/state-stores.md)：

| Store | 文件 | 职责 |
|-------|------|------|
| captureStore | `store/captureStore.ts` | 设备列表、采集流、当前帧 |
| frameStore | `store/frameStore.ts` | 帧队列（最多 8 帧） |
| appStore | `store/appStore.ts` | 代码结果、处理状态、错误 |
| chatStore | `store/chatStore.ts` | 消息、会话管理、当前模型 |
| uiStore | `store/uiStore.ts` | 全屏预览、区域截图 |

## Preload API 调用

Renderer 通过 `window.electronAPI` 访问 Main 进程能力，接口定义见 [IPC 通道契约](../03-interfaces/ipc-channels.md)。

## 注意事项

- Renderer 进程代码支持 Vite 热更新
- 聊天图片上限: 4 张/消息
