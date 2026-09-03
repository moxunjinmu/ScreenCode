// 帧类型
export type FrameType = 'new_scene' | 'continuation';

export type ImageMimeType = 'image/jpeg' | 'image/png';

export interface EncodedImage {
  data: string;
  mimeType: ImageMimeType;
  width?: number;
  height?: number;
  /** 已应用的输出画质；用于避免 AI 路径对同一档位重复编码。 */
  qualityProfile?: AiImageQuality;
}

// 帧数据结构
export interface Frame extends EncodedImage {
  id: string;
  timestamp: number;
  type: FrameType;
  overlap?: number;  // 与上一帧的重叠比例
}

export type AiImageQuality = 'economy' | 'balanced' | 'high' | 'original';

export interface AiImageQualityProfile {
  id: AiImageQuality;
  label: string;
  maxWidth?: number;
  jpegQuality?: number;
  preserveOriginal: boolean;
}

export type CaptureQualityStrategy = 'quality' | 'smooth';

/** 视频采集后端；精确格式模式目前仅在 Windows x64 开放。 */
export type CaptureBackend = 'browser-auto' | 'gstreamer-mf';

export interface NativeCaptureMode {
  id: string;
  width: number;
  height: number;
  frameRateNumerator: number;
  frameRateDenominator: number;
  advertised: boolean;
  verified: boolean;
}

export interface NativeCaptureFormat {
  id: string;
  label: string;
  mediaType: 'video/x-raw' | 'image/jpeg';
  modes: NativeCaptureMode[];
}

export interface NativeCaptureDevice {
  id: string;
  label: string;
  backend: 'gstreamer-mf';
  formats: NativeCaptureFormat[];
}

export interface NativeCaptureSelection {
  deviceId: string;
  formatId: string;
  modeId: string;
}

/** 单张采集卡上次使用的浏览器设备映射与精确协议。 */
export interface NativeCaptureProfile {
  nativeDeviceId: string;
  nativeDeviceLabel: string;
  browserDeviceId: string;
  captureBackend: CaptureBackend;
  selection?: NativeCaptureSelection;
}

/** 仅包含采集相关字段的独立缓存文件结构。 */
export interface CaptureProfileConfig {
  version: 1;
  migrationComplete: boolean;
  lastDeviceId: string | null;
  lastNativeDeviceId?: string;
  captureBackend: CaptureBackend;
  nativeCaptureSelection?: NativeCaptureSelection;
  nativeCaptureProfiles: Record<string, NativeCaptureProfile>;
}

export interface NativeNegotiatedMode {
  formatId: string;
  width: number;
  height: number;
  frameRateNumerator: number;
  frameRateDenominator: number;
}

export type NativeCapturePhase =
  | 'unavailable'
  | 'idle'
  | 'starting'
  | 'validating'
  | 'streaming'
  | 'stopping'
  | 'error';

export interface NativeCaptureStatus {
  phase: NativeCapturePhase;
  requestedModeId?: string;
  negotiated?: NativeNegotiatedMode;
  measuredFps?: number;
  previewCodec?: 'H264' | 'VP8';
  verified: boolean;
  signallingUrl?: string;
  producerId?: string;
  error?: string;
}

export interface NativeCaptureSnapshot extends EncodedImage {
  mimeType: 'image/png';
  width: number;
  height: number;
  sourceFormat: string;
}

export interface HighQualityCaptureRequest {
  deviceName: string;
  ffmpegPath?: string;
}

export interface HighQualityCaptureResult extends EncodedImage {
  width: number;
  height: number;
}

export interface SourceCropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ProcessCapturedImageRequest {
  image: EncodedImage;
  crop?: SourceCropRect;
  quality: AiImageQuality;
}

export interface ProcessedImage extends EncodedImage {
  width: number;
  height: number;
  qualityProfile: AiImageQuality;
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
  models?: string[];  // 该供应商支持的模型列表
}

// 单个供应商的配置
export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: ClaudeModel | string;
  customModel?: string;
  maxTokens?: number;
  temperature?: number;
  sdkType?: 'anthropic' | 'openai';  // 显式指定使用的 SDK 类型
}

// 默认供应商列表
export const DEFAULT_PROVIDERS: ApiProvider[] = [
  { 
    id: 'anthropic', 
    name: 'Anthropic Official', 
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-3-5-sonnet-20241022']
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI (Standard)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5', 'glm-4.7', 'glm-4.6', 'glm-4.6v', 'glm-4.5', 'glm-4.5v']
  },
  { 
    id: 'zhipu-anthropic', 
    name: 'Zhipu AI (Anthropic Compatible)', 
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    models: ['glm-5', 'glm-4.7', 'glm-4.6']
  },
  { 
    id: 'openrouter', 
    name: 'OpenRouter', 
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['auto', 'anthropic/claude-opus-4.6', 'anthropic/claude-sonnet-4.6']
  },
  {
    id: 'aliyun',
    name: 'Aliyun DashScope (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-coder-plus', 'qwen-max', 'qwen-plus', 'qwen-turbo']
  },
];

// 显示分辨率配置
export interface DisplayResolution {
  width: number;
  height: number;
  scale?: number;  // 缩放百分比，1.0 = 100%
}

// 预设分辨率选项
export const PRESET_RESOLUTIONS: DisplayResolution[] = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 1024, height: 576 },
  { width: 854, height: 480 },
];

// 预设缩放比例
export const PRESET_SCALES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// 配置
export interface AppConfig {
  activeProvider: string;  // 当前激活的供应商 ID
  providerConfigs: {
    [providerId: string]: ProviderConfig;
  };
  apiProviders?: ApiProvider[];  // 供应商列表
  lastDeviceId: string | null;
  toastDuration: number;
  frameDiffThreshold: number;
  maxFrames: number;
  compressionWidth: number;
  compressionQuality: number;
  aiImageQuality: AiImageQuality;
  captureQualityStrategy: CaptureQualityStrategy;
  fullscreenToolbarAutoHide: boolean;
  captureBackend: CaptureBackend;
  nativeCaptureSelection?: NativeCaptureSelection;
  lastNativeDeviceId?: string;
  nativeCaptureProfiles: Record<string, NativeCaptureProfile>;
  ffmpegPath?: string;

  // 显示分辨率配置
  displayResolution?: DisplayResolution;  // 用户选择的显示分辨率

  // 向后兼容旧配置
  claudeApiKey?: string;
  claudeApiBaseUrl?: string;
  claudeModel?: ClaudeModel;
  claudeCustomModel?: string;
}

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  activeProvider: 'zhipu',  // 默认使用智谱 AI
  providerConfigs: {
    'anthropic': {
      apiKey: '',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-6',
      maxTokens: 8192,
      temperature: 0.7,
    },
    'zhipu': {
      apiKey: '',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-5',
      maxTokens: 8192,
      temperature: 0.7,
    },
    'zhipu-anthropic': {
      apiKey: '',
      baseUrl: 'https://open.bigmodel.cn/api/anthropic',
      model: 'glm-4.7',
      maxTokens: 8192,
      temperature: 0.7,
    },
    'openrouter': {
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'anthropic/claude-sonnet-4.6',
      maxTokens: 8192,
      temperature: 0.7,
    },
    'aliyun': {
      apiKey: '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-coder-plus',
      maxTokens: 8192,
      temperature: 0.7,
      sdkType: 'openai',  // 阿里云使用 OpenAI SDK 格式
    },
    // 自定义供应商示例（如 claw.cjcook.site 等第三方中转）
    'custom': {
      apiKey: '',
      baseUrl: '',
      model: '',
      maxTokens: 8192,
      temperature: 0.7,
      sdkType: 'openai',  // 如果是 OpenAI 兼容端点设为 'openai'，否则设为 'anthropic'
    },
  },
  apiProviders: DEFAULT_PROVIDERS,
  lastDeviceId: null,
  toastDuration: 1500,
  frameDiffThreshold: 0.05,
  maxFrames: 8,
  compressionWidth: 1920,
  compressionQuality: 95,
  aiImageQuality: 'original',
  captureQualityStrategy: 'quality',
  fullscreenToolbarAutoHide: false,
  captureBackend: 'gstreamer-mf',
  nativeCaptureProfiles: {},
  ffmpegPath: '',
};

// 聊天会话
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

// 聊天消息类型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: EncodedImage[];
  timestamp: number;
}

// 聊天请求
export interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string; images?: EncodedImage[] }[];
  systemPrompt?: string;
}
