# AI 服务契约

> 最后更新: 2026-02-28
> 定义文件: `src/main/ai/index.ts`, `src/shared/types.ts`

## 统一服务接口

```typescript
interface AIService {
  extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  chat(request: ChatRequest): Promise<{ content: string }>;
  getModel(): string;
  getBaseUrl(): string;
}
```

## 请求类型

### ChatRequest

```typescript
interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];      // base64 图片，最多 4 张
  timestamp: number;
}
```

### Frame（代码提取输入）

```typescript
interface Frame {
  id: string;
  timestamp: number;
  data: string;           // base64 JPEG
  type: FrameType;        // 'new_scene' | 'continuation'
  overlap?: number;       // 与上帧重叠率 0-1
}
```

## 响应类型

### ClaudeResponse

```typescript
interface ClaudeResponse {
  language: string;       // 编程语言
  code: string;           // 完整代码
  confidence: number;     // 置信度 0.0-1.0
  explanation?: string;   // 可选解释
}
```

## 模型定义

```typescript
type ClaudeModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-3-5-sonnet-20241022'
  | 'glm-5'
  | 'glm-4-plus'
  | 'custom';
```

模型显示名称映射: `CLAUDE_MODEL_NAMES`

## 错误类型

```typescript
enum ErrorCode {
  NO_DEVICE      // 无采集设备
  NO_SIGNAL      // 无信号
  FRAME_QUEUE_EMPTY  // 帧队列为空
  API_TIMEOUT    // API 超时 (25s)
  API_ERROR      // API 调用错误
  PARSE_ERROR    // JSON 解析错误
}

interface AppError {
  code: ErrorCode;
  message: string;
  timestamp: number;
}
```

## 调用约束

| 参数 | 值 |
|------|-----|
| API 超时 | 25 秒 |
| 最大 token | 8192（默认，可配置） |
| 温度 | 0.7（默认，可配置） |
| 聊天图片上限 | 4 张/消息 |
| 代码提取帧上限 | 8 帧 |
