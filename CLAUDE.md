# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

ScreenCode 是一个 Electron 桌面应用,用于隔离网络环境下的屏幕捕获和代码提取。通过采集卡捕获内网机器屏幕,使用多供应商 AI API（智谱 GLM-5、Claude Sonnet 等）进行代码识别和提取,支持多轮 AI 对话和会话管理。

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

## 核心架构

### 进程模型

项目采用 Electron 多进程架构:

- **Main Process** (`src/main/`): 负责系统级操作、全局热键、视频采集、图像处理、AI 服务调用、配置管理
- **Renderer Process** (`src/renderer/`): React UI,负责用户交互和状态展示
- **Preload** (`src/preload/`): 安全桥接层,通过 `contextBridge` 暴露受限 API

### 关键模块

**帧处理流水线** (`src/main/processor/`):
- `ringBuffer.ts`: 环形缓冲区,最多存储 8 帧截图
- `frameDiff.ts`: 帧差分算法,阈值 5%,自动去除重复帧
- `imageCompressor.ts`: Sharp 图像压缩 (1080p → 768px, JPEG Q=85)

**AI 服务** (`src/main/ai/`):
- `index.ts`: AI 服务调度层,根据 baseUrl 自动路由到 OpenAI 或 Anthropic 服务
- `claudeService.ts`: Anthropic SDK 封装,用于 Anthropic 官方和智谱 Anthropic 兼容端点
- `openAIService.ts`: OpenAI SDK 封装,用于智谱标准端点和 OpenRouter
- `promptBuilder.ts`: 结构化多帧 Prompt 构建,包含帧元数据和时序关系

**状态管理** (`src/renderer/store/`):
- 使用 Zustand 管理应用状态
- `captureStore.ts`: 采集状态 (设备、流)
- `frameStore.ts`: 帧队列状态
- `appStore.ts`: 应用全局状态 (代码结果、处理状态、错误)
- `chatStore.ts`: 聊天状态 (消息、会话管理、当前模型)
- `uiStore.ts`: UI 状态 (全屏预览、区域截图)

**配置管理** (`src/main/config/`):
- `store.ts`: electron-store 持久化,支持多供应商独立配置,配置变更时通过 `CONFIG_CHANGED` IPC 事件实时推送到渲染进程

### IPC 通信

Main 和 Renderer 进程通过 IPC 通道通信,通道定义在 `src/shared/constants.ts` 的 `IPC_CHANNELS` 中。Preload 脚本通过 `contextBridge.exposeInMainWorld` 暴露安全 API。

关键 IPC 通道:
- `config:get` / `config:set`: 配置读写 (request-response)
- `config:changed`: 配置变更推送 (main → renderer 事件)
- `ai:chat` / `ai:extract`: AI 服务调用
- `ai:result` / `ai:error`: AI 结果/错误推送

### AI 服务路由

`src/main/ai/index.ts` 中的 `isOpenAICompatible()` 函数根据 baseUrl 自动选择 SDK:
- 包含 `/api/anthropic` → ClaudeService (Anthropic SDK)
- 包含 `bigmodel.cn` 或 `openrouter.ai` → OpenAIService (OpenAI SDK)
- 其他 → ClaudeService (默认)

### 多供应商配置

支持 4 个 API 供应商:
- `anthropic`: Anthropic 官方 (Anthropic SDK)
- `zhipu`: 智谱 AI 标准端点 `/api/paas/v4` (OpenAI SDK),支持 glm-5
- `zhipu-anthropic`: 智谱 Anthropic 兼容端点 `/api/anthropic` (Anthropic SDK)
- `openrouter`: OpenRouter (OpenAI SDK)

## 核心工作流程

### 截图入队流程

1. 用户按下 `Ctrl+Shift+S` 全局热键
2. Main 进程从视频流捕获当前帧
3. 帧差分检查:差异 < 5% 则丢弃,否则压缩后存入 Ring Buffer
4. 通过 IPC 通知 Renderer 更新缩略图
5. 显示 Toast 通知 (1.5s 自动消失)

### 代码提取流程

1. 用户按下 `Ctrl+Shift+E` 全局热键
2. Main 进程检查 Ring Buffer 是否有帧
3. 构建结构化多帧 Prompt (包含帧元数据、时序关系、重叠信息)
4. 调用 AI API (根据当前供应商自动路由)
5. 解析 JSON 响应 `{language, code, confidence}`
6. 通过 IPC 发送结果到 Renderer 展示

### 会话管理

- 支持多会话:新建、切换、删除
- 会话标题自动取首条用户消息前 20 字符
- 会话数据存于内存 (Zustand store)
- 模型名称实时响应配置变更

## 技术栈特性

- **构建工具**: Electron Forge + Vite (快速热更新)
- **图像处理**: Sharp Native 模块 (高性能压缩,降低 API token 成本 65%)
- **状态管理**: Zustand (轻量级,天然适配 Electron IPC 异步状态)
- **配置持久化**: electron-store
- **AI SDK**: @anthropic-ai/sdk + openai (双 SDK 自动路由)

## 重要约束

- Ring Buffer 最大容量: 8 帧
- 帧差分阈值: 5% (可在 `src/main/config/store.ts` 配置)
- 图像压缩目标宽度: 768px
- AI API 超时: 25 秒
- Toast 通知持续时间: 1.5 秒
- 聊天图片上限: 4 张/消息

## 开发注意事项

- Main 进程代码修改需要重启应用才能生效
- Renderer 进程代码支持热更新
- 图像处理使用 Sharp Native 模块,确保依赖正确安装
- IPC 通道名称必须与 `src/shared/constants.ts` 中定义保持一致
- 所有异步操作应有适当的错误处理和超时机制
- 智谱 GLM-5 需使用标准端点 `/api/paas/v4`,Coding Plan 端点不支持 glm-5

## 项目文档

- `docs/architecture.md`: 架构设计 (设计决策、模块接口)
- `docs/backlog.md`: 活跃待办 (仅未完成任务)
- `docs/changelog.md`: 变更日志 (按日期追加)
- `docs/archive/`: 归档目录 (已完成任务、已解决问题，日常无需读取)
- `PRD.md`: 产品需求文档

更新规则:
- 完成功能后: 更新 backlog.md (标记完成移到 archive/completed-tasks.md) + changelog.md (追加记录)
- 架构变更时: 额外更新 architecture.md
- archive/ 目录下的文件日常不读取，仅归档用途
