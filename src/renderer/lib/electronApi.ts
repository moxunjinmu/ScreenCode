import {
  DEFAULT_CONFIG,
  type AppConfig,
  type AppError,
  type ChatRequest,
  type ClaudeResponse,
  type EncodedImage,
  type Frame,
  type HighQualityCaptureRequest,
  type HighQualityCaptureResult,
} from '@shared/types';

export interface RendererElectronAPI {
  startCapture: () => Promise<unknown>;
  stopCapture: () => Promise<unknown>;
  captureHighQualityFrame: (request: HighQualityCaptureRequest) => Promise<HighQualityCaptureResult>;
  extractCode: (frames: Frame[]) => Promise<ClaudeResponse>;
  chat: (request: ChatRequest) => Promise<{ content: string }>;
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: Partial<AppConfig>) => Promise<unknown>;
  writeImageToClipboard: (image: EncodedImage) => Promise<unknown>;
  onAIResult: (callback: (result: ClaudeResponse) => void) => () => void;
  onError: (callback: (error: AppError) => void) => () => void;
  onCaptureFrame: (callback: () => void) => () => void;
  onExtractCode: (callback: () => void) => () => void;
  onConfigChanged: (callback: (config: AppConfig) => void) => () => void;
}

const cloneDefaultConfig = (): AppConfig => JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;

let browserPreviewConfig = cloneDefaultConfig();
const configListeners = new Set<(config: AppConfig) => void>();

const noopUnsubscribe = () => undefined;

const browserPreviewAPI: RendererElectronAPI = {
  startCapture: async () => undefined,
  stopCapture: async () => undefined,
  captureHighQualityFrame: async (_request: HighQualityCaptureRequest) => {
    throw new Error('浏览器预览模式不支持 YUY2 高保真截图');
  },
  extractCode: async (frames: Frame[]) => ({
    language: 'typescript',
    code: frames.length > 0
      ? '// 浏览器预览模式下未连接主进程\nconst extracted = true;'
      : '// 当前处于浏览器预览模式\nconst example = true;',
    confidence: frames.length > 0 ? 0.76 : 0.5,
    explanation: '当前为浏览器预览模式，结果来自渲染层降级 API，而非真实 Electron 主进程。',
  }) as ClaudeResponse,
  chat: async (_request: ChatRequest) => ({
    content: '当前为浏览器预览模式，未连接 Electron 主进程。',
  }),
  getConfig: async () => browserPreviewConfig,
  setConfig: async (config: Partial<AppConfig>) => {
    browserPreviewConfig = {
      ...browserPreviewConfig,
      ...config,
      providerConfigs: {
        ...browserPreviewConfig.providerConfigs,
        ...config.providerConfigs,
      },
      apiProviders: config.apiProviders ?? browserPreviewConfig.apiProviders,
    };
    configListeners.forEach((listener) => listener(browserPreviewConfig));
  },
  writeImageToClipboard: async (_image: EncodedImage) => undefined,
  onAIResult: (_callback: (result: ClaudeResponse) => void) => noopUnsubscribe,
  onError: (_callback: (error: AppError) => void) => noopUnsubscribe,
  onCaptureFrame: (_callback: () => void) => noopUnsubscribe,
  onExtractCode: (_callback: () => void) => noopUnsubscribe,
  onConfigChanged: (callback: (config: AppConfig) => void) => {
    configListeners.add(callback);
    return () => {
      configListeners.delete(callback);
    };
  },
};

export const hasElectronAPI = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

export const electronAPI: RendererElectronAPI = hasElectronAPI
  ? (window.electronAPI as RendererElectronAPI)
  : browserPreviewAPI;
