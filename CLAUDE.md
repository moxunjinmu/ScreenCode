# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 语言

所有回复和文件使用中文。

## 工作流程

### 强制流程

1. **改代码前先读相关源码**，理解现有实现，禁止凭猜测修改
2. **改完代码后同步更新本文档**中受影响的部分（如 IPC 通道、模块职责、配置字段等）
3. **完成需求后提交 Git** — `git add` + `git commit` + `git push`，无需用户额外指示

### 文档维护原则

- **CLAUDE.md 是唯一的活文档**，包含 AI 开发所需的全部关键信息
- **docs/ 目录仅作参考索引**，历史归档用，日常不要求更新
- 代码才是真实来源，文档与代码冲突时以代码为准

## 项目概述

ScreenCode 是一个 Electron 桌面应用，用于隔离网络环境下的屏幕捕获和代码提取。通过采集卡捕获内网机器屏幕，使用多供应商 AI API（智谱 GLM-5、Claude Sonnet 等）进行代码识别和提取，支持多轮 AI 对话和会话管理。

## 开发命令

```bash
npm run dev          # 启动开发服务器 (Electron Forge + Vite)
npm run typecheck    # 类型检查 (不生成文件)
npm run lint         # ESLint 检查
npm run build        # 构建生产版本
npm run package      # 打包应用 (生成可分发的安装包)
```

## 核心架构

### 进程模型

```
┌─────────────────────────────────────────────────────┐
│  Main Process (src/main/)                            │
│  Capture │ Processor │ AI Service │ Shortcut │ Config │
├──────────────────── IPC ────────────────────────────┤
│  Preload (src/preload/) — contextBridge 安全桥接      │
├─────────────────────────────────────────────────────┤
│  Renderer Process (src/renderer/)                    │
│  React 18 + Zustand + TailwindCSS                    │
│  Store: capture | frame | app | chat | ui            │
└─────────────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── main/           # 主进程
│   ├── index.ts    # 入口，窗口创建、全局热键注册
│   ├── capture/    # 视频采集（设备枚举、流管理）
│   ├── processor/  # 帧处理（ringBuffer、frameDiff、imageCompressor）
│   ├── ai/         # AI 服务（index路由、claude、openai、promptBuilder）
│   ├── tray/       # 系统托盘
│   └── config/     # 配置管理（electron-store 持久化）
├── renderer/       # 渲染进程
│   ├── components/ # Preview、ChatPanel、Settings、CodeDisplay、Toast、ThumbnailQueue
│   └── store/      # captureStore、frameStore、appStore、chatStore、uiStore
├── preload/        # 安全桥接
└── shared/         # types.ts（类型定义）、constants.ts（IPC 通道、常量）
```

### 关键模块

**帧处理流水线** (`src/main/processor/`) — ⚠️ 当前整体未接入数据流:
- `ringBuffer.ts`: 泛型环形缓冲区，最多 8 帧
- `frameDiff.ts`: 帧差分（当前返回固定值 0.3，待实现像素级对比）
- `imageCompressor.ts`: Sharp 压缩（1080p → 768px, JPEG Q=85, lanczos3）
- **已知问题**：渲染进程从不调用 `FRAME_ADD`，帧队列实际只存在于 `frameStore`（渲染进程），
  `extractCode` 直接把渲染进程的原始帧送往 API。**Sharp 压缩尚未实际执行**，
  发送给模型的是 canvas 原始分辨率 JPEG。待第二批优化接入。

**AI 服务** (`src/main/ai/`):
- `index.ts`: 服务调度层，`isOpenAICompatible(baseUrl, sdkType)` 路由 SDK；
  按配置签名（apiKey/baseUrl/model/maxTokens/temperature/sdkType）缓存与重建服务实例
- `types.ts`: `AIService` 统一接口 + `AIServiceOptions` 构造参数
- `responseParser.ts`: 共享的提取结果解析（JSON 优先，失败降级为纯文本）
- `claudeService.ts`: Anthropic SDK 封装
- `openAIService.ts`: OpenAI SDK 封装
- `promptBuilder.ts`: 结构化多帧 Prompt，含帧元数据和时序关系

**配置管理** (`src/main/config/store.ts`):
- electron-store 持久化，支持 4 个供应商独立配置
- 配置变更时通过 `CONFIG_CHANGED` IPC 事件实时推送到渲染进程
- 自动迁移旧格式（单一 claudeApiKey → 多供应商 providerConfigs）

### IPC 通道

定义文件: `src/shared/constants.ts` → `IPC_CHANNELS`

| 通道 | 方向 | 模式 | 说明 |
|------|------|------|------|
| `CONFIG_GET` / `CONFIG_SET` | renderer → main | invoke | 配置读写 |
| `CONFIG_CHANGED` | main → renderer | event | 配置变更推送 |
| `AI_EXTRACT` | renderer → main | invoke | 代码提取 |
| `AI_EXTRACT_TRIGGER` | main → renderer | event | 全局热键触发提取（不可与 `AI_EXTRACT` 复用） |
| `AI_CHAT` | renderer → main | invoke | AI 聊天 |
| `AI_RESULT` / `AI_ERROR` | main → renderer | event | AI 结果/错误 |
| `CAPTURE_START` / `CAPTURE_STOP` | renderer → main | invoke | 视频采集控制 |
| `FRAME_ADD` / `FRAME_CLEAR` | renderer → main | invoke | 帧队列操作 |
| `CLIPBOARD_WRITE_IMAGE` | renderer → main | invoke | 写入剪贴板 |
| `DEVICE_ENUM` / `DEVICE_SELECT` | renderer → main | invoke | 设备管理 |

Preload 通过 `contextBridge.exposeInMainWorld('electronAPI', ...)` 暴露受限 API。

### AI 服务路由

`isOpenAICompatible(baseUrl)` 匹配规则（按优先级）:

| 匹配 | SDK | 供应商 |
|------|-----|--------|
| 包含 `/api/anthropic` | Anthropic | zhipu-anthropic |
| 包含 `bigmodel.cn` | OpenAI | zhipu（标准端点） |
| 包含 `openrouter.ai` | OpenAI | openrouter |
| 其他 | Anthropic | anthropic（默认） |

### 多供应商配置

| ID | 名称 | Base URL | SDK |
|----|------|----------|-----|
| `anthropic` | Anthropic 官方 | `https://api.anthropic.com` | Anthropic |
| `zhipu` | 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | OpenAI |
| `zhipu-anthropic` | 智谱 Anthropic 兼容 | `https://open.bigmodel.cn/api/anthropic` | Anthropic |
| `openrouter` | OpenRouter | `https://openrouter.ai/api/v1` | OpenAI |

### 配置 Schema

```typescript
// src/shared/types.ts
interface AppConfig {
  activeProvider: string;                                // 当前激活供应商 ID
  providerConfigs: { [providerId: string]: ProviderConfig };
  apiProviders: ApiProvider[];
  frameDiffThreshold: number;    // 帧差分阈值，默认 0.05 (5%)
  maxFrames: number;             // Ring Buffer 最大帧数，默认 8
  compressionWidth: number;      // 压缩目标宽度，默认 768
  compressionQuality: number;    // JPEG 质量，默认 85
  lastDeviceId: string | null;
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  customModel?: string;
  maxTokens?: number;      // 默认 8192
  temperature?: number;    // 默认 0.7
}
```

## 核心工作流程

**截图入队**: Ctrl+Shift+S → 捕获帧 → 帧差分(<5%丢弃) → Sharp压缩 → RingBuffer → Toast通知

**代码提取**: Ctrl+Shift+E → 主进程发 `AI_EXTRACT_TRIGGER` → 渲染进程 `appStore.extractCode()`
（热键与「提取代码」按钮共用此入口）→ 取 frameStore 所有帧 → 构建结构化Prompt → AI API
→ 解析JSON `{language, code, confidence}` → 经 `AI_RESULT` 事件回流

**会话管理**: 多会话(新建/切换/删除)，标题取首条消息前20字符，数据存于内存(Zustand)

**区域截图**: 点击按钮/Ctrl+Shift+R → 拖拽选区 → 编辑模式(红色边框+8方向手柄，可拖拽移动/resize) → ✓确认保存 / ✕取消

## 技术栈

| 层次 | 技术 |
|------|------|
| 运行时 | Electron ^28 |
| 构建 | Electron Forge + Vite |
| 前端 | React 18 + TypeScript + TailwindCSS |
| 状态 | Zustand (5个Store) |
| 图像 | Sharp Native（⚠️ 已集成但未接入流水线，压缩尚未实际生效） |
| AI | @anthropic-ai/sdk + openai (双SDK自动路由) |
| 存储 | electron-store |

## 重要约束

| 约束 | 值 | 来源 |
|------|-----|------|
| Ring Buffer 最大容量 | 8 帧 | `FRAME_QUEUE.MAX_FRAMES` |
| 帧差分阈值 | 5% | `frameDiffThreshold`（⚠️ 当前未生效，`frameDiff` 返回固定值） |
| 图像压缩目标宽度 | 768px | `compressionWidth`（⚠️ 当前未生效，压缩未接入） |
| JPEG 质量 | 85 | `compressionQuality`（⚠️ 同上；截图实际由 canvas 以 0.85 编码） |
| AI API 超时 | 25 秒 | `AI_TIMEOUT`，构造 SDK 时传入 |
| Toast 通知时长 | 成功 1.5s / 失败 2.5s | `TOAST_DURATION.SUCCESS` / `.ERROR` |
| 聊天图片上限 | 4 张/消息 | `MAX_CHAT_IMAGES` |

所有常量定义于 `src/shared/constants.ts`，禁止在组件内硬编码。

## 开发注意事项

- Main 进程代码修改需重启应用，Renderer 支持热更新
- IPC 通道名称必须与 `src/shared/constants.ts` 定义一致
- Sharp Native 模块需确保依赖正确安装
- 智谱 GLM-5 需使用标准端点 `/api/paas/v4`
- 所有异步操作应有错误处理和超时机制

## 参考文档索引

> 以下文档仅作历史参考，不要求日常维护。代码为准。

```
docs/
├── 01-architecture/    # 架构设计图、时序图
├── 02-modules/         # 模块详细文档（AI集成、采集引擎、配置系统、渲染UI）
├── 03-interfaces/      # IPC通道契约、配置Schema、AI服务接口
├── 07-adrs/            # 架构决策记录（3个ADR）
└── 08-history/         # 变更日志、已完成任务（git log更可靠）
```
