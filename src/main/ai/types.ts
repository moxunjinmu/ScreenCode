import { ClaudeResponse, Frame, ChatRequest } from '@shared/types';

/** AI 服务统一接口 — Anthropic / OpenAI 两种 SDK 的共同契约 */
export interface AIService {
  extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  chat(request: ChatRequest): Promise<{ content: string }>;
  getModel(): string;
  getBaseUrl(): string;
}

/** AI 服务构造参数 — 全部来自当前激活供应商的配置 */
export interface AIServiceOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens?: number;
  temperature?: number;
  /** 请求超时（ms），不传则使用 AI_TIMEOUT */
  timeout?: number;
}
