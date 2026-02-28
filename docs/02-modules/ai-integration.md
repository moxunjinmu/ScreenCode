# AI 服务集成

> 最后更新: 2026-02-28
> 目录: `src/main/ai/`

## 统一接口

```typescript
interface AIService {
  extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  chat(request: ChatRequest): Promise<{ content: string }>;
  getModel(): string;
  getBaseUrl(): string;
}
```

## 服务路由

`isOpenAICompatible(baseUrl)` 根据 baseUrl 自动选择 SDK：

| 匹配规则 | SDK | 供应商 | 文件 |
|----------|-----|--------|------|
| 包含 `/api/anthropic` | Anthropic SDK | zhipu-anthropic | `claudeService.ts` |
| 包含 `bigmodel.cn` | OpenAI SDK | zhipu (标准端点) | `openAIService.ts` |
| 包含 `openrouter.ai` | OpenAI SDK | openrouter | `openAIService.ts` |
| 其他 | Anthropic SDK | anthropic (默认) | `claudeService.ts` |

注意: `/api/anthropic` 检查优先于 `bigmodel.cn`，避免 zhipu-anthropic 被错误路由到 OpenAI SDK。

## 供应商配置

支持 4 个 API 供应商（定义在 `src/shared/types.ts` 的 `DEFAULT_PROVIDERS`）：

| ID | 名称 | Base URL | SDK |
|----|------|----------|-----|
| `anthropic` | Anthropic 官方 | `https://api.anthropic.com` | Anthropic |
| `zhipu` | 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | OpenAI |
| `zhipu-anthropic` | 智谱 Anthropic | `https://open.bigmodel.cn/api/anthropic` | Anthropic |
| `openrouter` | OpenRouter | `https://openrouter.ai/api/v1` | OpenAI |

## 核心文件

| 文件 | 职责 |
|------|------|
| `index.ts` | 服务路由、IPC handler 注册、懒创建/复用服务实例 |
| `claudeService.ts` | Anthropic SDK 封装 |
| `openAIService.ts` | OpenAI SDK 封装 |
| `promptBuilder.ts` | 结构化多帧 Prompt 构建 |

## Prompt 工程

`promptBuilder.ts` 构建包含帧元数据的结构化 Prompt：

```
你将收到 {N} 张按时序排列的代码截图，来自同一文件的连续滚动操作。
相邻截图之间存在重叠行，请去重并输出完整连贯代码。

[帧1/8 | 类型:new_scene] <image>
[帧2/8 | 类型:continuation | 与上帧重叠约30%] <image>
...

输出格式：{"language":"...", "code":"...", "confidence":0.0-1.0}
```

## IPC Handler

| 通道 | 功能 |
|------|------|
| `AI_EXTRACT` | 代码提取，含空帧/无 Key 校验，结果通过 `AI_RESULT` 推送 |
| `AI_CHAT` | 聊天调用 |

配置变更时调用 `resetService()` 重建服务实例。

## 相关 ADR

- [ADR-0002: AI 供应商抽象层](../07-adrs/ADR-0002-ai-provider-abstraction.md)
