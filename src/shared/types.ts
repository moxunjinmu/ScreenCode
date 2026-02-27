// 帧类型
export type FrameType = 'new_scene' | 'continuation';

// 帧数据结构
export interface Frame {
  id: string;
  timestamp: number;
  data: string;  // base64 encoded
  type: FrameType;
  overlap?: number;  // 与上一帧的重叠比例
}

// 设备信息
export interface Device {
  id: string;
  name: string;
  type: 'videoinput' | 'screen' | 'window';
  isConnected: boolean;
}

// Claude API 响应
export interface ClaudeResponse {
  language: string;
  code: string;
  confidence: number;
  explanation?: string;  // 可选的识别说明
}

// 应用状态
export type AppStatus = 'idle' | 'capturing' | 'processing' | 'error';

// 错误类型
export enum ErrorCode {
  NO_DEVICE = 'NO_DEVICE',
  NO_SIGNAL = 'NO_SIGNAL',
  FRAME_QUEUE_EMPTY = 'FRAME_QUEUE_EMPTY',
  API_TIMEOUT = 'API_TIMEOUT',
  API_ERROR = 'API_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
}

// 应用错误
export interface AppError {
  code: ErrorCode;
  message: string;
  timestamp: number;
}

// Claude 模型类型
export type ClaudeModel = 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-3-5-sonnet-20241022' | 'custom';

// 模型显示名称
export const CLAUDE_MODEL_NAMES: Record<ClaudeModel, string> = {
  'claude-opus-4-6': 'Claude Opus 4.6 (最强)',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6 (推荐)',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet (稳定)',
  'custom': '自定义模型',
};

// 默认 API Base URL
export const DEFAULT_API_BASE_URL = 'https://api.anthropic.com';

// API 供应商
export interface ApiProvider {
  id: string;
  name: string;
  baseUrl: string;
}

// 默认供应商列表
export const DEFAULT_PROVIDERS: ApiProvider[] = [
  { id: 'anthropic', name: 'Anthropic 官方', baseUrl: 'https://api.anthropic.com' },
  { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/anthropic' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
];

// 配置
export interface AppConfig {
  claudeApiKey: string;
  claudeApiBaseUrl: string;  // 支持第三方中转
  claudeModel: ClaudeModel;
  claudeCustomModel?: string;  // 自定义模型名称
  apiProviders?: ApiProvider[];  // 自定义供应商列表
  lastDeviceId: string | null;
  toastDuration: number;
  frameDiffThreshold: number;
  maxFrames: number;
  compressionWidth: number;
  compressionQuality: number;
}

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  claudeApiKey: '',
  claudeApiBaseUrl: DEFAULT_API_BASE_URL,
  claudeModel: 'claude-sonnet-4-6',
  claudeCustomModel: '',
  apiProviders: DEFAULT_PROVIDERS,
  lastDeviceId: null,
  toastDuration: 1500,
  frameDiffThreshold: 0.05,
  maxFrames: 8,
  compressionWidth: 768,
  compressionQuality: 85,
};

// 聊天消息类型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];  // base64 图片数组
  timestamp: number;
}

// 聊天请求
export interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string; images?: string[] }[];
  systemPrompt?: string;
}
