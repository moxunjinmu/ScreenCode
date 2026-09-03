# 配置 Schema

> 最后更新: 2026-02-28
> 定义文件: `src/shared/types.ts`

## AppConfig

应用完整配置结构：

```typescript
interface AppConfig {
  // 供应商选择
  activeProvider: string;                              // 当前激活供应商 ID
  providerConfigs: { [providerId: string]: ProviderConfig }; // 各供应商独立配置
  apiProviders: ApiProvider[];                          // 供应商定义列表

  // 图像处理
  frameDiffThreshold: number;   // 帧差分阈值，默认 0.05 (5%)
  maxFrames: number;            // Ring Buffer 最大帧数，默认 8
  compressionWidth: number;     // 压缩目标宽度，默认 768
  compressionQuality: number;   // JPEG 质量，默认 85
  fullscreenToolbarAutoHide: boolean; // 全屏截图菜单是否在无活动 2.5 秒后自动隐藏，默认 false

  // 设备
  lastDeviceId: string | null;  // 上次选择的设备 ID

  // 向后兼容字段（迁移后删除）
  claudeApiKey?: string;
  claudeModel?: string;
  claudeBaseUrl?: string;
}
```

## ProviderConfig

单个供应商配置：

```typescript
interface ProviderConfig {
  apiKey: string;          // API 密钥
  baseUrl: string;         // API 端点
  model: string;           // 模型 ID
  customModel?: string;    // 自定义模型名（model='custom' 时使用）
  maxTokens?: number;      // 最大 token 数，默认 8192
  temperature?: number;    // 温度，默认 0.7
}
```

## ApiProvider

供应商定义：

```typescript
interface ApiProvider {
  id: string;              // 供应商 ID
  name: string;            // 显示名称
  baseUrl: string;         // 默认 API 端点
  models?: string[];       // 可选模型列表
}
```

## 默认供应商 (DEFAULT_PROVIDERS)

| ID | 名称 | Base URL | 可选模型 |
|----|------|----------|----------|
| `anthropic` | Anthropic | `https://api.anthropic.com` | claude-opus-4-6, claude-sonnet-4-6, claude-3-5-sonnet-20241022 |
| `zhipu` | 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | glm-5, glm-4-plus |
| `zhipu-anthropic` | 智谱 Anthropic | `https://open.bigmodel.cn/api/anthropic` | claude-sonnet-4-6, claude-3-5-sonnet-20241022 |
| `openrouter` | OpenRouter | `https://openrouter.ai/api/v1` | - |

## 默认配置 (DEFAULT_CONFIG)

```typescript
{
  activeProvider: 'zhipu',
  maxTokens: 8192,
  temperature: 0.7,
  frameDiffThreshold: 0.05,
  maxFrames: 8,
  compressionWidth: 768,
  compressionQuality: 85,
  fullscreenToolbarAutoHide: false,
  lastDeviceId: null
}
```

## 全局常量

定义在 `src/shared/constants.ts`：

| 常量组 | 字段 | 值 |
|--------|------|-----|
| `PERFORMANCE_TARGETS` | 热键响应 | 200ms |
| | 代码提取 | 20s |
| | 聊天 | 8s |
| `IMAGE_PROCESSING` | 目标宽度 | 768px |
| | 质量 | 85 |
| | 差分阈值 | 5% |
| `FRAME_QUEUE` | 最大帧数 | 8 |
