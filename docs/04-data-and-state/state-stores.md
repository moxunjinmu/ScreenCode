# 状态模型

> 最后更新: 2026-02-28
> 目录: `src/renderer/store/`

使用 Zustand 管理应用状态，按职责拆分为 5 个独立 Store。

## captureStore — 采集状态

文件: `src/renderer/store/captureStore.ts`

| 状态 | 类型 | 说明 |
|------|------|------|
| `devices` | `Device[]` | 设备列表 |
| `selectedDeviceId` | `string \| null` | 当前选中设备 |
| `selectedDeviceType` | `string \| null` | 设备类型 |
| `isCapturing` | `boolean` | 是否正在采集 |
| `stream` | `MediaStream \| null` | 视频流 |
| `currentFrame` | `string \| null` | 当前帧 base64 |

| 方法 | 说明 |
|------|------|
| `loadDevices()` | 枚举设备 + 恢复上次选择 |
| `selectDevice(id, type)` | 选择设备，先停止当前流 |
| `startCapture()` | 获取 MediaStream |
| `stopCapture()` | 停止所有 track |
| `captureFrame()` | video → canvas → base64 |

## frameStore — 帧队列状态

文件: `src/renderer/store/frameStore.ts`

| 状态 | 类型 | 说明 |
|------|------|------|
| `frames` | `Frame[]` | 帧队列 |
| `maxFrames` | `number` | 最大帧数（默认 8） |

| 方法 | 说明 |
|------|------|
| `addFrame(frame)` | 添加帧，超限移除最早帧 |
| `removeFrame(frameId)` | 按 ID 移除 |
| `clearFrames()` | 清空（同步 IPC 清空主进程） |
| `isFull()` / `isEmpty()` | 状态查询 |

## appStore — 应用全局状态

文件: `src/renderer/store/appStore.ts`

| 状态 | 类型 | 说明 |
|------|------|------|
| `codeResult` | `ClaudeResponse \| null` | 代码提取结果 |
| `isProcessing` | `boolean` | 是否处理中 |
| `error` | `AppError \| null` | 当前错误 |
| `status` | `AppStatus` | `idle \| capturing \| processing \| error` |

| 方法 | 说明 |
|------|------|
| `setCodeResult(result)` | 设置代码结果 |
| `setProcessing(status)` | 设置处理状态（联动 status） |
| `setError(error)` | 设置错误（联动 status='error'） |
| `clearError()` | 清除错误，恢复 idle |

## chatStore — 聊天状态

文件: `src/renderer/store/chatStore.ts`

| 状态 | 类型 | 说明 |
|------|------|------|
| `messages` | `ChatMessage[]` | 当前会话消息 |
| `isLoading` | `boolean` | AI 响应中 |
| `selectedImages` | `string[]` | 已选图片 base64 |
| `inputText` | `string` | 输入框文本 |
| `currentModel` | `string` | 当前模型名 |
| `sessions` | `ChatSession[]` | 所有会话 |
| `activeSessionId` | `string \| null` | 当前会话 ID |

| 方法 | 说明 |
|------|------|
| `addMessage(msg)` | 添加消息，自动更新会话标题（首条用户消息前 20 字符） |
| `createSession()` | 新建会话并切换 |
| `switchSession(id)` | 保存当前 → 恢复目标 |
| `deleteSession(id)` | 删除，自动切换或新建 |

## uiStore — UI 状态

文件: `src/renderer/store/uiStore.ts`

| 状态 | 类型 | 说明 |
|------|------|------|
| `isFullscreenPreview` | `boolean` | 全屏预览开关 |
| `isRegionCapture` | `boolean` | 区域截图模式 |
| `selectionRect` | `SelectionRect \| null` | 选区矩形 |
| `isSelecting` | `boolean` | 正在选择中 |
| `selectionStart` | `{x, y} \| null` | 选区起点 |
| `isChatPanelOpen` | `boolean` | 聊天面板开关（默认 true） |

| 方法 | 说明 |
|------|------|
| `toggleFullscreenPreview()` | 切换全屏预览 |
| `setRegionCapture(value)` | 开关区域截图（重置选区） |
| `startSelection(x, y)` | 开始选区 |
| `updateSelection(x, y)` | 更新选区 |
| `endSelection()` | 结束选区 |
| `toggleChatPanel()` | 切换聊天面板开关 |
| `setChatPanelOpen(value)` | 设置聊天面板开关 |

## 设计原则

- 各 Store 职责单一，互不依赖
- 会话数据存于内存，不持久化（Phase 2 计划持久化）
- 配置变更通过 IPC 事件驱动 Store 更新
