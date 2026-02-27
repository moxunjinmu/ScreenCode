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

// 配置
export interface AppConfig {
  claudeApiKey: string;
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
  lastDeviceId: null,
  toastDuration: 1500,
  frameDiffThreshold: 0.05,
  maxFrames: 8,
  compressionWidth: 768,
  compressionQuality: 85,
};
