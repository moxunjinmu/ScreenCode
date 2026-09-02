# IPC 通道契约

> 最后更新: 2026-09-02
> 定义文件: `src/shared/constants.ts` → `IPC_CHANNELS`

## 通道总览

### 捕获相关

| 通道 | 方向 | 模式 | Payload | 返回值 |
|------|------|------|---------|--------|
| `CAPTURE_START` | renderer → main | invoke | - | `void` |
| `CAPTURE_STOP` | renderer → main | invoke | - | `void` |
| `CAPTURE_FRAME` | main → renderer | event | `Frame` | - |
| `CAPTURE_ERROR` | main → renderer | event | `AppError` | - |
| `CAPTURE_NATIVE_ENUMERATE` | renderer → main | invoke | - | `NativeCaptureDevice[]` |
| `CAPTURE_NATIVE_START` | renderer → main | invoke | `NativeCaptureSelection` | `void` |
| `CAPTURE_NATIVE_STOP` | renderer → main | invoke | - | `void` |
| `CAPTURE_NATIVE_SNAPSHOT` | renderer → main | invoke | - | `NativeCaptureSnapshot` |
| `CAPTURE_NATIVE_STATUS` | main → renderer | event | `NativeCaptureStatus` | - |

### 帧队列

| 通道 | 方向 | 模式 | Payload | 返回值 |
|------|------|------|---------|--------|
| `FRAME_ADD` | renderer → main / main → renderer | invoke + event | `Frame` | `void` |
| `FRAME_CLEAR` | renderer → main | invoke | - | `void` |
| `FRAME_UPDATE` | main → renderer | event | `Frame[]` | - |

### AI 服务

| 通道 | 方向 | 模式 | Payload | 返回值 |
|------|------|------|---------|--------|
| `AI_EXTRACT` | renderer → main | invoke | `Frame[]` | `ClaudeResponse` |
| `AI_CHAT` | renderer → main | invoke | `ChatRequest` | `{ content: string }` |
| `AI_CHAT_STREAM` | main → renderer | event | `string` (chunk) | - |
| `AI_CHAT_RESPONSE` | main → renderer | event | `{ content: string }` | - |
| `AI_RESULT` | main → renderer | event | `ClaudeResponse` | - |
| `AI_ERROR` | main → renderer | event | `AppError` | - |

### 设备管理

| 通道 | 方向 | 模式 | Payload | 返回值 |
|------|------|------|---------|--------|
| `DEVICE_ENUM` | renderer → main | invoke | - | `Device[]` |
| `DEVICE_SELECT` | renderer → main | invoke | `string` (deviceId) | `void` |
| `DEVICE_STATUS` | main → renderer | event | `{ connected: boolean }` | - |

### 配置管理

| 通道 | 方向 | 模式 | Payload | 返回值 |
|------|------|------|---------|--------|
| `CONFIG_GET` | renderer → main | invoke | - | `AppConfig` |
| `CONFIG_SET` | renderer → main | invoke | `Partial<AppConfig>` | `void` |
| `CONFIG_CHANGED` | main → renderer | event (push) | `AppConfig` | - |

### 剪贴板

| 通道 | 方向 | 模式 | Payload | 返回值 |
|------|------|------|---------|--------|
| `CLIPBOARD_WRITE_IMAGE` | renderer → main | invoke | `string` (base64) | `void` |

### 托盘

| 通道 | 方向 | 模式 | Payload | 返回值 |
|------|------|------|---------|--------|
| `TRAY_SHOW_WINDOW` | main → main | internal | - | - |
| `TRAY_UPDATE` | main → main | internal | `string` (status) | - |

## Preload 暴露接口

通过 `contextBridge.exposeInMainWorld('electronAPI', ...)` 暴露：

```typescript
interface ElectronAPI {
  // 设备
  enumerateDevices(): Promise<Device[]>;
  selectDevice(deviceId: string): Promise<void>;

  // 捕获
  startCapture(): Promise<void>;
  stopCapture(): Promise<void>;
  enumerateNativeCaptureDevices(): Promise<NativeCaptureDevice[]>;
  startNativeCapture(selection: NativeCaptureSelection): Promise<void>;
  stopNativeCapture(): Promise<void>;
  captureNativeSnapshot(): Promise<NativeCaptureSnapshot>;

  // 帧
  addFrame(frame: Frame): Promise<void>;
  getFrames(): Promise<Frame[]>;
  clearFrames(): Promise<void>;

  // AI
  extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  chat(request: ChatRequest): Promise<{ content: string }>;

  // 配置
  getConfig(): Promise<AppConfig>;
  setConfig(config: Partial<AppConfig>): Promise<void>;

  // 剪贴板
  writeImageToClipboard(base64Data: string): Promise<void>;

  // 事件监听 (返回取消订阅函数)
  onFrameAdded(callback: (frame: Frame) => void): () => void;
  onAIResult(callback: (result: ClaudeResponse) => void): () => void;
  onError(callback: (error: AppError) => void): () => void;
  onCaptureFrame(callback: (frame: Frame) => void): () => void;
  onNativeCaptureStatus(callback: (status: NativeCaptureStatus) => void): () => void;
  onConfigChanged(callback: (config: AppConfig) => void): () => void;
}
```

## 约定

- IPC 通道名称必须与 `src/shared/constants.ts` 中 `IPC_CHANNELS` 定义保持一致
- invoke 模式为 request-response，event 模式为单向推送
- 所有 invoke 调用应有错误处理
- 原生采集选择值必须来自最近一次枚举结果；Renderer 不能传入任意管线参数
- `CAPTURE_NATIVE_STATUS` 同时报告请求模式、实际协商 Caps、实测 FPS、预览编码和验证状态
- 连续视频只能走本机 WebRTC，禁止通过 IPC 连续传输原始帧；按需 PNG 响应不得超过 20 MiB
