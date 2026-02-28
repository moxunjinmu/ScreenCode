# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 工作流程（必读）

在回答任何问题或执行任何任务之前，**必须先查阅 `docs/` 中的相关文档**：

1. **执行前查阅文档**：根据任务涉及的领域，先读取对应文档：
   - 架构/设计问题 → `docs/01-architecture/`
   - 具体模块问题 → `docs/02-modules/` 中对应文件
   - IPC/接口问题 → `docs/03-interfaces/`
   - 状态管理问题 → `docs/04-data-and-state/`
   - 构建/测试/环境问题 → `docs/05-dev-and-ops/`
   - 开发规范问题 → `docs/06-process-and-guides/`
   - 历史决策问题 → `docs/07-adrs/`
2. **确认约束后再动手**：确认文档中的设计约束和现有实现后，再读取相关源码，基于文档 + 源码的完整上下文给出回答或执行修改
3. **修改代码后同步更新文档**：任何代码变更完成后，必须同步更新受影响的文档：
   - 新增/修改模块 → 更新 `docs/02-modules/` 对应文件
   - 新增/修改 IPC 通道或接口 → 更新 `docs/03-interfaces/` 对应文件
   - 新增/修改 Store 或持久化 → 更新 `docs/04-data-and-state/` 对应文件
   - 新增/修改配置字段 → 更新 `docs/03-interfaces/config-schema.md`
   - 架构级变更 → 更新 `docs/01-architecture/` + 新增 ADR
   - 完成功能 → 更新 `docs/05-dev-and-ops/backlog.md` + `docs/08-history/changelog.md`

这样做的目的是避免与现有设计冲突，确保文档与代码始终保持一致。

4. **完成需求后默认提交 Git**：每次完成一个完整需求后，默认执行 `git add` + `git commit` + `git push`，无需用户额外指示。

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

```
docs/
├── 00-intro/           # 项目概览、路线图、PRD
│   ├── overview.md
│   ├── roadmap.md
│   └── prd.md
├── 01-architecture/    # 架构设计、时序、Tauri 备选
│   ├── overview.md
│   ├── runtime-views.md
│   └── tauri-alternative.md
├── 02-modules/         # 模块文档
│   ├── electron-main.md
│   ├── renderer-ui.md
│   ├── capture-engine.md
│   ├── ai-integration.md
│   └── config-system.md
├── 03-interfaces/      # 接口契约
│   ├── ipc-channels.md
│   ├── config-schema.md
│   └── ai-service-contracts.md
├── 04-data-and-state/  # 状态与持久化
│   ├── state-stores.md
│   └── persistence.md
├── 05-dev-and-ops/     # 开发运维
│   ├── build-and-packaging.md
│   ├── testing-strategy.md
│   ├── backlog.md
│   └── environment.md
├── 06-process-and-guides/ # 流程指南
│   ├── contribution-guide.md
│   └── coding-standards.md
├── 07-adrs/            # 架构决策记录
│   ├── ADR-template.md
│   ├── ADR-0001-initial-electron-architecture.md
│   ├── ADR-0002-ai-provider-abstraction.md
│   └── ADR-0003-config-store-and-migration.md
└── 08-history/         # 历史归档（日常无需读取）
    ├── changelog.md
    ├── completed-tasks.md
    └── resolved-issues.md
```

更新规则:
- 完成功能后: 更新 `05-dev-and-ops/backlog.md` (标记完成移到 `08-history/completed-tasks.md`) + `08-history/changelog.md` (追加记录)
- 架构变更时: 额外更新 `01-architecture/` 相关文件
- 接口变更时: 更新 `03-interfaces/` 对应文件
- 设计决策时: 在 `07-adrs/` 新增 ADR
- `08-history/` 目录下的文件日常不读取，仅归档用途
