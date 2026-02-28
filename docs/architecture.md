# ScreenCode 架构设计

> 最后更新: 2026-02-28
> 仅记录设计决策和模块接口，不重复 CLAUDE.md 中的内容

---

## 一、系统架构

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

## 二、关键设计决策

### 2.1 AI 服务路由

`src/main/ai/index.ts` 中 `isOpenAICompatible()` 根据 baseUrl 自动选择 SDK：

| 匹配规则 | SDK | 供应商 |
|----------|-----|--------|
| `/api/anthropic` | Anthropic SDK | zhipu-anthropic |
| `bigmodel.cn` | OpenAI SDK | zhipu (标准端点) |
| `openrouter.ai` | OpenAI SDK | openrouter |
| 其他 | Anthropic SDK | anthropic (默认) |

注意：`/api/anthropic` 检查优先于 `bigmodel.cn`，避免 zhipu-anthropic 被错误路由。

### 2.2 配置实时推送

```
Settings 保存 → CONFIG_SET (invoke)
  → main: setConfig() + event.sender.send(CONFIG_CHANGED, fullConfig)
    → renderer: onConfigChanged 回调 → 更新 UI
```

### 2.3 会话管理

- 数据存于 Zustand 内存，不持久化
- 会话标题自动取首条用户消息前 20 字符
- 删除当前会话时自动切换到最后一个会话

### 2.4 帧处理流水线

```
视频流 → 帧差分(5%阈值) → Sharp压缩(768px) → RingBuffer(8帧) → AI API
```

## 三、模块接口

### 3.1 AI Service 接口

```typescript
interface AIService {
  extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  chat(request: ChatRequest): Promise<{ content: string }>;
}
```

### 3.2 配置结构

```typescript
interface AppConfig {
  activeProvider: string;
  providerConfigs: { [providerId: string]: ProviderConfig };
  apiProviders: ApiProvider[];
  lastDeviceId: string | null;
  frameDiffThreshold: number;  // 0.05
  maxFrames: number;           // 8
  compressionWidth: number;    // 768
  compressionQuality: number;  // 85
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  customModel?: string;
  maxTokens?: number;
  temperature?: number;
}
```

### 3.3 IPC 通道

定义在 `src/shared/constants.ts`，完整列表见代码。关键通道：

| 通道 | 方向 | 模式 |
|------|------|------|
| `config:get/set` | renderer → main | invoke (request-response) |
| `config:changed` | main → renderer | event (push) |
| `ai:chat/extract` | renderer → main | invoke |
| `ai:result/error` | main → renderer | event |
| `capture:frame` | main → renderer | event |

## 四、技术栈

| 层次 | 技术 | 用途 |
|------|------|------|
| 运行时 | Electron ^28 | 桌面应用框架 |
| 构建 | Electron Forge + Vite | 开发与打包 |
| 前端 | React 18 + TypeScript | UI |
| 状态 | Zustand | 状态管理 |
| 样式 | TailwindCSS | 原子化 CSS |
| 图像 | Sharp | 高性能压缩 |
| AI | @anthropic-ai/sdk + openai | 双 SDK |
| 存储 | electron-store | 配置持久化 |

## 五、目录结构

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

## 六、Phase 2 规划

1. Obsidian 归档
2. 本地 VLM (GLM-4V / Qwen-VL via Ollama)
3. Mini 悬浮窗 (320px 半透明置顶)
4. 脱敏层 (NER + 正则掩码)
5. 合规路由
6. 审计日志 (better-sqlite3)
