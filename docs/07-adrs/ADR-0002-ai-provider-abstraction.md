# ADR-0002: AI 供应商抽象层

- Status: Accepted
- Date: 2026-02-27
- Authors: ScreenCode Team
- Impacted Areas:
  - Modules: ai-integration, config-system
  - Interfaces: IPC channels (AI_EXTRACT, AI_CHAT), config schema
  - Users: 所有用户

## 1. 背景与问题

ScreenCode 需要同时支持多家 AI 供应商：
- Anthropic 官方（Claude Sonnet）
- 智谱 AI 标准端点（GLM-5，OpenAI 兼容格式）
- 智谱 Anthropic 兼容端点（Claude via 智谱代理）
- OpenRouter（多模型聚合）

不同供应商使用不同的 SDK（Anthropic SDK vs OpenAI SDK），API 格式不同，需要统一抽象。

## 2. 目标

- 统一 `AIService` 接口，上层代码无需关心具体供应商
- 根据 `baseUrl` 自动路由到正确的 SDK
- 每个供应商独立配置（API Key、Base URL、Model）
- 配置变更时自动重建服务实例
- 非目标：流式输出（Phase 2）、本地 VLM（Phase 2）

## 3. 备选方案

### 3.1 方案 A：baseUrl 自动路由 + 双 SDK

- 描述：`isOpenAICompatible(baseUrl)` 根据 URL 特征自动选择 Anthropic SDK 或 OpenAI SDK
- 优点：
  - 用户只需配置 baseUrl，无需手动选择 SDK
  - 新增供应商只需添加路由规则
  - 两个 SDK 覆盖主流 AI API 格式
- 缺点：
  - 路由规则需要维护优先级（如 `/api/anthropic` 优先于 `bigmodel.cn`）

### 3.2 方案 B：每个供应商硬编码独立 Service

- 描述：为每个供应商写独立的 Service 类
- 优点：完全控制每个供应商的行为
- 缺点：代码重复，新增供应商成本高

### 3.3 方案 C：用户手动选择 SDK 类型

- 描述：配置中增加 `sdkType: 'anthropic' | 'openai'` 字段
- 优点：无歧义
- 缺点：增加用户配置负担

## 4. 决策

我们选择：**方案 A：baseUrl 自动路由 + 双 SDK**。

- 核心原因：
  - 用户体验最优，零配置自动路由
  - 代码复用度高，两个 Service 类覆盖所有供应商
- 关键取舍：
  - 路由规则需要精确维护优先级
- 路由规则（优先级从高到低）：
  1. `/api/anthropic` → Anthropic SDK（zhipu-anthropic）
  2. `bigmodel.cn` → OpenAI SDK（zhipu 标准）
  3. `openrouter.ai` → OpenAI SDK（openrouter）
  4. 其他 → Anthropic SDK（默认）

## 5. 详细设计概要

- 模块：`src/main/ai/`
  - `index.ts`：路由逻辑、IPC handler、服务实例管理
  - `claudeService.ts`：Anthropic SDK 封装
  - `openAIService.ts`：OpenAI SDK 封装
  - `promptBuilder.ts`：结构化多帧 Prompt
- 接口：统一 `AIService { extractCode, chat, getModel, getBaseUrl }`
- 配置变更时调用 `resetService()` 重建实例

详见 [AI 服务集成](../02-modules/ai-integration.md)。

## 6. 影响与迁移

- 旧配置（单一 `claudeApiKey`）自动迁移到多供应商格式
- 用户需在设置页面配置至少一个供应商的 API Key
- 新增 `AI_CHAT` IPC 通道支持聊天

## 7. 风险与后续工作

- 风险：第三方供应商 API 行为不完全兼容（如智谱 Coding Plan 端点不支持 glm-5）
- 已解决：zhipu 改用标准端点 `/api/paas/v4`
- 后续工作：
  - 流式输出（SSE）
  - 本地 VLM 路由（Ollama）
  - 合规模式（敏感内容强制本地模型）
