# ScreenCode 软件架构设计文档

## 一、架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron Application                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Main Process                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │  │
│  │  │ Capture     │  │ Frame        │  │ AI              │ │  │
│  │  │ Manager     │  │ Processor    │  │ Service         │ │  │
│  │  │             │  │              │  │                 │ │  │
│  │  │ - Device    │  │ - Ring       │  │ - Claude API    │ │  │
│  │  │   Enum      │  │   Buffer     │  │ - Prompt Build  │ │  │
│  │  │ - Stream    │  │ - Frame Diff │  │ - JSON Parse    │ │  │
│  │  │ - Preview   │  │ - Sharp      │  │                 │ │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │  │
│  │  │ Global      │  │ Tray         │  │ Config          │ │  │
│  │  │ Shortcut    │  │ Manager      │  │ Manager         │ │  │
│  │  │             │  │              │  │                 │ │  │
│  │  │ - Register  │  │ - Icon State │  │ - Store         │ │  │
│  │  │ - Handler   │  │ - Menu       │  │ - Migrations    │ │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ IPC (Main ↔ Renderer)           │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Renderer Process                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │  │
│  │  │ Preview     │  │ Code         │  │ Toast           │ │  │
│  │  │ Window      │  │ Display      │  │ Notification    │ │  │
│  │  │             │  │              │  │                 │ │  │
│  │  │ - Live      │  │ - Pre Tag    │  │ - Screenshot    │ │  │
│  │  │   Stream    │  │ - Copy Btn   │  │   Confirm       │ │  │
│  │  │ - Thumbnail │  │ - Syntax     │  │ - Error Alert   │ │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │                  Zustand Store                       │ │  │
│  │  │  - captureState  - frameQueue  - codeResult         │ │  │
│  │  │  - appStatus     - settings    - errors             │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈清单

| 层次 | 技术选型 | 版本 | 用途 |
|------|----------|------|------|
| 运行时 | Electron | ^28.0.0 | 跨平台桌面应用框架 |
| 构建 | Electron Forge + Vite | Latest | 快速开发与打包 |
| 状态管理 | Zustand | ^4.5.0 | 轻量级状态管理 |
| UI 框架 | React | ^18.2.0 | 渲染进程 UI |
| 样式 | Tailwind CSS | ^3.4.0 | 原子化 CSS |
| 视频采集 | getUserMedia / desktopCapturer | Native API | 采集卡枚举与预览 |
| 图像处理 | Sharp | ^0.33.0 | 高性能图像压缩 |
| API 调用 | @anthropic-ai/sdk, openai | Latest | Claude / GLM 双 SDK |
| 本地存储 | electron-store | ^8.1.0 | 配置持久化 |
| 打包 | electron-builder | ^24.0.0 | Windows 安装包 |

---

## 二、核心模块设计

### 2.1 目录结构

```
ScreenCode/
├── src/
│   ├── main/                      # 主进程代码
│   │   ├── index.ts              # 主进程入口
│   │   ├── capture/              # 视频采集模块
│   │   │   ├── deviceEnumerator.ts    # 设备枚举
│   │   │   ├── streamManager.ts       # 流管理
│   │   │   └── previewServer.ts       # 预览服务
│   │   ├── processor/            # 帧处理模块
│   │   │   ├── ringBuffer.ts          # 环形缓冲区
│   │   │   ├── frameDiff.ts           # 帧差分算法
│   │   │   └── imageCompressor.ts     # Sharp 压缩
│   │   ├── ai/                   # AI 服务模块
│   │   │   ├── index.ts              # AI 服务调度层 (路由)
│   │   │   ├── claudeService.ts       # Anthropic SDK 封装
│   │   │   ├── openAIService.ts       # OpenAI SDK 封装
│   │   │   └── promptBuilder.ts       # Prompt 构建
│   │   ├── shortcuts/            # 全局热键模块
│   │   │   └── globalShortcut.ts      # 热键注册
│   │   ├── tray/                 # 系统托盘模块
│   │   │   └── trayManager.ts         # 托盘管理
│   │   ├── ipc/                  # IPC 通信模块
│   │   │   ├── channels.ts            # 通道定义
│   │   │   └── handlers.ts            # 处理器
│   │   └── config/               # 配置模块
│   │       └── store.ts               # electron-store
│   │
│   ├── renderer/                 # 渲染进程代码
│   │   ├── index.html            # HTML 入口
│   │   ├── main.tsx              # React 入口
│   │   ├── App.tsx               # 根组件
│   │   ├── components/           # UI 组件
│   │   │   ├── Preview/               # 实时预览 + 区域截图
│   │   │   ├── CodeDisplay/           # 代码展示
│   │   │   ├── Toast/                 # Toast 通知
│   │   │   ├── ThumbnailQueue/        # 缩略图队列
│   │   │   ├── ChatPanel/             # 聊天面板 + 会话管理
│   │   │   ├── Settings/              # 设置界面
│   │   │   └── Layout/                # 布局组件
│   │   ├── store/                # Zustand Store
│   │   │   ├── captureStore.ts        # 采集状态
│   │   │   ├── frameStore.ts          # 帧队列状态
│   │   │   ├── appStore.ts            # 应用状态
│   │   │   ├── chatStore.ts           # 聊天状态 + 会话管理
│   │   │   └── uiStore.ts            # UI 状态
│   │   ├── hooks/                # 自定义 Hooks
│   │   │   ├── useCapture.ts          # 采集 Hook
│   │   │   └── useIPC.ts              # IPC Hook
│   │   └── styles/               # 样式文件
│   │       └── globals.css
│   │
│   ├── preload/                  # Preload 脚本
│   │   └── index.ts              # 暴露安全 API
│   │
│   └── shared/                   # 共享代码
│       ├── types.ts              # TypeScript 类型
│       └── constants.ts          # 常量定义
│
├── forge.config.ts               # Electron Forge 配置
├── vite.main.config.ts           # 主进程 Vite 配置
├── vite.renderer.config.ts       # 渲染进程 Vite 配置
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

---

## 三、核心流程设计

### 3.1 截图入队流程

```
用户按下 Ctrl+Shift+S
         │
         ▼
┌─────────────────────────┐
│ GlobalShortcut Handler  │
│ (Main Process)          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Capture Current Frame   │
│ 从视频流捕获当前帧      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Frame Diff Check        │
│ 像素差分阈值 = 5%       │
└────────────┬────────────┘
             │
        ┌────┴────┐
        │ diff < 5%?│
        └────┬────┘
             │
      ┌──────┴──────┐
      │             │
      ▼ Yes         ▼ No
  ┌────────┐   ┌─────────────┐
  │ 丢弃   │   │ 压缩 768px  │
  │ (重复) │   │ (Sharp)     │
  └────────┘   └──────┬──────┘
                      │
                      ▼
              ┌───────────────┐
              │ Ring Buffer   │
              │ 最多 8 帧     │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ IPC → Renderer│
              │ 更新缩略图    │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Toast 通知    │
              │ 1.5s 自动消失 │
              └───────────────┘
```

### 3.2 代码提取流程

```
用户按下 Ctrl+Shift+E
         │
         ▼
┌─────────────────────────┐
│ GlobalShortcut Handler  │
│ 检查 Ring Buffer 状态   │
└────────────┬────────────┘
             │
        ┌────┴────┐
        │ 有帧?   │
        └────┬────┘
             │
      ┌──────┴──────┐
      │             │
      ▼ No          ▼ Yes
  ┌────────┐   ┌─────────────┐
  │ Toast  │   │ 构建 Prompt │
  │ 错误   │   │ 结构化多帧  │
  └────────┘   └──────┬──────┘
                      │
                      ▼
              ┌───────────────┐
              │ Claude API    │
              │ 3.5 Sonnet    │
              │ Timeout = 25s │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Parse JSON    │
              │ {language,    │
              │  code,        │
              │  confidence}  │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ IPC → Renderer│
              │ 更新 CodeDisplay│
              └───────────────┘
```

---

## 四、详细模块设计

### 4.1 Ring Buffer（环形缓冲区）

**文件**: `src/main/processor/ringBuffer.ts`

```typescript
interface Frame {
  id: string;
  timestamp: number;
  buffer: Buffer;        // 压缩后的图像数据
  type: 'new_scene' | 'continuation';
  overlap?: number;      // 与上一帧的重叠比例
}

class RingBuffer {
  private buffer: Frame[];
  private capacity: number = 8;
  private head: number = 0;
  private tail: number = 0;

  push(frame: Frame): void;
  getAll(): Frame[];
  clear(): void;
  isFull(): boolean;
  isEmpty(): boolean;
}
```

### 4.2 Frame Diff（帧差分算法）

**文件**: `src/main/processor/frameDiff.ts`

```typescript
interface DiffResult {
  percentage: number;    // 差异百分比
  type: 'static' | 'continuation' | 'new_scene';
}

class FrameDiff {
  private threshold: number = 0.05;  // 5%

  // 对比两帧的像素差异
  async compare(
    currentFrame: Buffer,
    previousFrame?: Buffer
  ): Promise<DiffResult>;

  // 计算重叠区域（用于 Prompt 构建）
  calculateOverlap(
    currentFrame: Buffer,
    previousFrame: Buffer
  ): Promise<number>;
}
```

### 4.3 Image Compressor（图像压缩器）

**文件**: `src/main/processor/imageCompressor.ts`

```typescript
class ImageCompressor {
  private targetWidth: number = 768;
  private quality: number = 85;

  async compress(
    input: Buffer,
    options?: { width?: number; quality?: number }
  ): Promise<Buffer>;

  // 转换为 base64（用于 Claude API）
  toBase64(buffer: Buffer): string;
}
```

### 4.4 AI Service（AI 服务调度）

**文件**: `src/main/ai/index.ts`

```typescript
// 根据 baseUrl 自动路由到对应 SDK
function isOpenAICompatible(baseUrl: string): boolean;

// 统一服务接口
interface AIService {
  extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  chat(request: ChatRequest): Promise<{ content: string }>;
  getModel(): string;
  getBaseUrl(): string;
}
```

路由规则:
- `/api/anthropic` → ClaudeService (Anthropic SDK)
- `bigmodel.cn` / `openrouter.ai` → OpenAIService (OpenAI SDK)
- 其他 → ClaudeService (默认)

**文件**: `src/main/ai/claudeService.ts`

```typescript
class ClaudeService implements AIService {
  // Anthropic SDK 封装
  async extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  async chat(request: ChatRequest): Promise<{ content: string }>;
}
```

**文件**: `src/main/ai/openAIService.ts`

```typescript
class OpenAIService implements AIService {
  // OpenAI SDK 封装 (智谱标准端点 / OpenRouter)
  async extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  async chat(request: ChatRequest): Promise<{ content: string }>;
}
```

### 4.5 Prompt Builder（Prompt 构建器）

**文件**: `src/main/ai/promptBuilder.ts`

```typescript
class PromptBuilder {
  buildMultiFramePrompt(frames: Frame[]): {
    system: string;
    user: string;
    images: string[];  // base64 encoded
  };

  // 生成帧元数据注释
  private generateFrameMetadata(frame: Frame, index: number, total: number): string;
}
```

**Prompt 模板**:

```
System:
你是代码提取专家。你将收到 N 张按时序排列的代码截图，来自同一文件的连续滚动操作。
相邻截图之间存在重叠行，请去重并输出完整连贯代码。

User:
[帧1/3 | 类型:new_scene] <image>
[帧2/3 | 类型:continuation | 与上帧重叠约30%] <image>
[帧3/3 | 类型:continuation | 与上帧重叠约25%] <image>

输出格式（JSON）：
{
  "language": "编程语言",
  "code": "完整连贯的代码",
  "confidence": 0.0-1.0
}
```

### 4.6 Global Shortcut（全局热键）

**文件**: `src/main/shortcuts/globalShortcut.ts`

```typescript
interface ShortcutConfig {
  key: string;
  action: () => void;
}

class GlobalShortcutManager {
  private shortcuts: Map<string, ShortcutConfig>;

  register(): void;
  unregister(): void;

  private onScreenshot(): void;    // Ctrl+Shift+S
  private onExtract(): void;       // Ctrl+Shift+E
  private onMainWindow(): void;    // Ctrl+Shift+M
}
```

### 4.7 Tray Manager（托盘管理）

**文件**: `src/main/tray/trayManager.ts`

```typescript
class TrayManager {
  private tray: Tray;

  // 更新托盘图标状态
  updateIcon(status: 'connected' | 'disconnected' | 'processing'): void;

  // 显示右键菜单
  showMenu(): void;

  // 显示 Toast 通知
  showToast(message: string, duration?: number): void;
}
```

---

## 五、IPC 通信设计

### 5.1 通道定义

**文件**: `src/shared/constants.ts`

```typescript
export const IPC_CHANNELS = {
  // 捕获相关
  CAPTURE_START: 'capture:start',
  CAPTURE_STOP: 'capture:stop',
  CAPTURE_FRAME: 'capture:frame',
  CAPTURE_ERROR: 'capture:error',

  // 帧队列相关
  FRAME_ADD: 'frame:add',
  FRAME_CLEAR: 'frame:clear',
  FRAME_UPDATE: 'frame:update',

  // AI 相关
  AI_EXTRACT: 'ai:extract',
  AI_RESULT: 'ai:result',
  AI_ERROR: 'ai:error',
  AI_CHAT: 'ai:chat',

  // 设备相关
  DEVICE_ENUM: 'device:enum',
  DEVICE_SELECT: 'device:select',
  DEVICE_STATUS: 'device:status',

  // 托盘相关
  TRAY_SHOW_WINDOW: 'tray:show-window',
  TRAY_UPDATE: 'tray:update',

  // 配置相关
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_CHANGED: 'config:changed',
} as const;
```

### 5.2 Preload 暴露 API

**文件**: `src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 捕获
  startCapture: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_START),
  stopCapture: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_STOP),

  // 帧管理
  clearFrames: () => ipcRenderer.invoke(IPC_CHANNELS.FRAME_CLEAR),

  // AI
  extractCode: () => ipcRenderer.invoke(IPC_CHANNELS.AI_EXTRACT),

  // 设备
  enumDevices: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_ENUM),
  selectDevice: (deviceId: string) => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_SELECT),

  // 监听器
  onFrameAdd: (callback: (frame: Frame) => void) => {
    ipcRenderer.on(IPC_CHANNELS.FRAME_ADD, (_, frame) => callback(frame));
  },
  onAIResult: (callback: (result: ClaudeResponse) => void) => {
    ipcRenderer.on(IPC_CHANNELS.AI_RESULT, (_, result) => callback(result));
  },
  onError: (callback: (error: Error) => void) => {
    ipcRenderer.on(IPC_CHANNELS.AI_ERROR, (_, error) => callback(error));
  },
});
```

---

## 六、状态管理设计（Zustand）

### 6.1 Capture Store

**文件**: `src/renderer/store/captureStore.ts`

```typescript
interface CaptureState {
  // 状态
  isCapturing: boolean;
  selectedDeviceId: string | null;
  devices: MediaDeviceInfo[];
  stream: MediaStream | null;

  // 操作
  setDevices: (devices: MediaDeviceInfo[]) => void;
  selectDevice: (deviceId: string) => void;
  startCapture: () => void;
  stopCapture: () => void;
}
```

### 6.2 Frame Store

**文件**: `src/renderer/store/frameStore.ts`

```typescript
interface FrameState {
  // 状态
  frames: Frame[];
  maxFrames: number;  // 8

  // 操作
  addFrame: (frame: Frame) => void;
  clearFrames: () => void;

  // 计算属性
  isFull: () => boolean;
  isEmpty: () => boolean;
}
```

### 6.3 App Store

**文件**: `src/renderer/store/appStore.ts`

```typescript
interface AppState {
  // 状态
  codeResult: ClaudeResponse | null;
  isProcessing: boolean;
  error: Error | null;

  // 操作
  setCodeResult: (result: ClaudeResponse) => void;
  setProcessing: (status: boolean) => void;
  setError: (error: Error | null) => void;
}
```

### 6.4 Chat Store

**文件**: `src/renderer/store/chatStore.ts`

```typescript
interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedImages: string[];
  inputText: string;
  currentModel: string;

  // 会话管理
  sessions: ChatSession[];
  activeSessionId: string;

  // 操作
  addMessage: (message: ChatMessage) => void;
  createSession: () => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  setCurrentModel: (model: string) => void;
}
```

### 6.5 UI Store

**文件**: `src/renderer/store/uiStore.ts`

```typescript
interface UIState {
  isFullscreenPreview: boolean;
  isRegionCapture: boolean;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
}
```

---

## 七、UI 组件设计

### 7.1 主窗口布局

```
┌────────────────────────────────────────────┐
│  ScreenCode                    [─] [□] [×] │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │                                      │ │
│  │         实时预览区域                 │ │
│  │      (Video Element)                │ │
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐         │
│  │ 帧x │ │ 帧2 │ │ 帧3 │ │ 帧4 │ ...     │
│  │     │ │     │ │     │ │     │         │
│  └─────┘ └─────┘ └─────┘ └─────┘         │
│  缩略图队列（最多 8 张）                  │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ 提取的代码：                         │ │
│  │                                      │ │
│  │ <pre>                                │ │
│  │   function example() {               │ │
│  │     // ...                           │ │
│  │   }                                  │ │
│  │ </pre>                               │ │
│  │                                      │ │
│  │ 置信度: 0.92                         │ │
│  │ [一键复制]                           │ │
│  └──────────────────────────────────────┘ │
│                                            │
└────────────────────────────────────────────┘
```

### 7.2 组件树

```
App
├── Layout
│   ├── Header
│   │   └── DeviceSelector
│   ├── Preview
│   │   ├── VideoPlayer
│   │   └── RegionCaptureOverlay
│   ├── ThumbnailQueue
│   │   └── ThumbnailItem[]
│   ├── CodeDisplay
│   │   ├── CodeBlock (<pre>)
│   │   └── CopyButton
│   └── ChatPanel
│       ├── SessionList (下拉)
│       ├── MessageList
│       ├── ImageSelector
│       └── InputArea
├── Settings (Modal)
└── Toast
```

---

## 八、配置管理

### 8.1 electron-store 配置

**文件**: `src/main/config/store.ts`

```typescript
interface AppConfig {
  // 多供应商配置
  activeProvider: string;  // 当前激活供应商 ID
  providerConfigs: {
    [providerId: string]: ProviderConfig;
  };
  apiProviders: ApiProvider[];

  // 设备配置
  lastDeviceId: string | null;

  // 界面配置
  toastDuration: number;  // 默认 1500ms

  // 帧处理配置
  frameDiffThreshold: number;  // 默认 0.05
  maxFrames: number;  // 默认 8
  compressionWidth: number;  // 默认 768
  compressionQuality: number;  // 默认 85
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  customModel?: string;
  maxTokens?: number;
  temperature?: number;
}

const defaultConfig: AppConfig = {
  activeProvider: 'zhipu',
  providerConfigs: {
    'zhipu': {
      apiKey: '',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-5',
      maxTokens: 8192,
      temperature: 0.7,
    },
    // anthropic, zhipu-anthropic, openrouter...
  },
  lastDeviceId: null,
  toastDuration: 1500,
  frameDiffThreshold: 0.05,
  maxFrames: 8,
  compressionWidth: 768,
  compressionQuality: 85,
};
```

---

## 九、错误处理策略

### 9.1 错误类型

```typescript
enum ErrorCode {
  NO_DEVICE = 'NO_DEVICE',
  NO_SIGNAL = 'NO_SIGNAL',
  FRAME_QUEUE_EMPTY = 'FRAME_QUEUE_EMPTY',
  API_TIMEOUT = 'API_TIMEOUT',
  API_ERROR = 'API_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
}
```

### 9.2 错误处理流程

```
错误发生
    │
    ▼
记录到日志
    │
    ▼
更新托盘图标状态
    │
    ▼
显示 Toast 通知
    │
    ▼
IPC → Renderer 更新 UI
```

---

## 十、性能优化策略

### 10.1 目标指标

| 操作 | 目标延迟 |
|------|----------|
| 热键触发 → Toast 消失 | < 200ms |
| 代码提取（8 帧） | < 20s (P90) |
| 托盘图标状态更新 | < 100ms |

### 10.2 优化策略

1. **帧压缩**: Sharp Native 模块，1080p → 768px
2. **异步处理**: 所有 I/O 操作异步化
3. **Ring Buffer**: 内存预分配，避免频繁 GC
4. **IPC 优化**: 使用 `Buffer` 传输二进制数据
5. **UI 渲染**: React.memo + 虚拟列表（缩略图）

---

## 十一、打包与分发

### 11.1 electron-builder 配置

**文件**: `electron-builder.yml`

```yaml
appId: com.screencode.app
productName: ScreenCode

win:
  target:
    - nsis
    - portable
  icon: build/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true

portable:
  artifactName: ${productName}-${version}-Portable.exe

publish:
  provider: generic
  url: https://releases.screencode.app/
```

### 11.2 自动更新（MVP 后）

使用 `electron-updater` 支持内网离线包模式。

---

## 十二、开发路线图

### Week 1: 基础链路打通

| Day | 任务 | 文件 |
|-----|------|------|
| 1-2 | Electron Forge + Vite 初始化，设备枚举 | `src/main/capture/deviceEnumerator.ts` |
| 3-4 | 全局热键，Ring Buffer，系统托盘 | `src/main/shortcuts/globalShortcut.ts` |
| 5 | Sharp 图像压缩，帧差分算法 | `src/main/processor/frameDiff.ts` |

### Week 2: AI 集成 + 发布

| Day | 任务 | 文件 |
|-----|------|------|
| 6-7 | Claude API 集成，Prompt 构建 | `src/main/ai/claudeService.ts` |
| 8 | 代码展示 UI + Toast | `src/renderer/components/CodeDisplay/` |
| 9 | 错误处理，Windows 打包 | `electron-builder.yml` |
| 10 | 内部测试，灰度发布 | - |

---

## 十三、Phase 2 规划（MVP 后）

1. **Obsidian 归档**: Markdown 写入 + 元数据管理
2. ~~**多轮 AI 对话**: 对话历史管理~~ ✅ 已完成
3. **本地 VLM**: GLM-4V / Qwen-VL via Ollama
4. **Mini 悬浮窗**: 320px 半透明置顶窗口
5. **脱敏层**: NER + 正则掩码
6. **合规路由**: 敏感度检测 → 本地/云端路由
7. **审计日志**: better-sqlite3 append-only 表

---

## 十四、技术债务与风险

### 14.1 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Claude API 超时 | 用户体验差 | 25s 超时 + 重试机制 |
| 采集卡兼容性 | 设备枚举失败 | 提供手动选择 + fallback desktopCapturer |
| 帧差分误判 | 重复帧入队 | 可调节阈值 + 用户反馈 |
| VLM 识别错误 | 代码提取不准确 | 显示置信度 + 手动编辑（Phase 2） |

### 14.2 技术债务

1. **MVP 不做**: 代码高亮（Monaco Editor）
2. **MVP 不做**: 拖拽排序、删除功能
3. **MVP 不做**: 历史会话管理

---

*架构设计文档 v1.0 - 基于 PRD.md 重构*
