import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import {
  Frame,
  ClaudeResponse,
  AppConfig,
  AppError,
  ChatRequest,
  EncodedImage,
  ProcessCapturedImageRequest,
  ProcessedImage,
  NativeCaptureDevice,
  NativeCaptureSelection,
  NativeCaptureSnapshot,
  NativeCaptureStatus,
} from '@shared/types';

// 聊天响应类型
interface ChatResponse {
  content: string;
}

// 暴露给渲染进程的 API
const electronAPI = {
  // 捕获控制（设备枚举由渲染进程直接通过 navigator.mediaDevices 完成）
  startCapture: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_START),
  stopCapture: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_STOP),
  processCapturedImage: (request: ProcessCapturedImageRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_PROCESS_IMAGE, request) as Promise<ProcessedImage>,
  enumerateNativeCaptureDevices: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_NATIVE_ENUMERATE) as Promise<NativeCaptureDevice[]>,
  startNativeCapture: (selection: NativeCaptureSelection) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_NATIVE_START, selection) as Promise<void>,
  stopNativeCapture: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_NATIVE_STOP) as Promise<void>,
  captureNativeSnapshot: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_NATIVE_SNAPSHOT) as Promise<NativeCaptureSnapshot>,

  // AI 服务
  extractCode: (frames: Frame[]) => ipcRenderer.invoke(IPC_CHANNELS.AI_EXTRACT, frames) as Promise<ClaudeResponse>,
  chat: (request: ChatRequest) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT, request) as Promise<ChatResponse>,

  // 配置
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET) as Promise<AppConfig>,
  setConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, config),

  // 剪贴板
  writeImageToClipboard: (image: EncodedImage) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_IMAGE, image),

  // 事件监听
  onAIResult: (callback: (result: ClaudeResponse) => void) => {
    const listener = (_event: unknown, result: ClaudeResponse) => callback(result);
    ipcRenderer.on(IPC_CHANNELS.AI_RESULT, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_RESULT, listener);
  },

  onError: (callback: (error: AppError) => void) => {
    const listener = (_event: unknown, error: AppError) => callback(error);
    ipcRenderer.on(IPC_CHANNELS.AI_ERROR, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_ERROR, listener);
  },

  onCaptureFrame: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(IPC_CHANNELS.CAPTURE_FRAME, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CAPTURE_FRAME, listener);
  },

  onNativeCaptureStatus: (callback: (status: NativeCaptureStatus) => void) => {
    const listener = (_event: unknown, status: NativeCaptureStatus) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.CAPTURE_NATIVE_STATUS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CAPTURE_NATIVE_STATUS, listener);
  },

  onExtractCode: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(IPC_CHANNELS.AI_EXTRACT_TRIGGER, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_EXTRACT_TRIGGER, listener);
  },

  onConfigChanged: (callback: (config: AppConfig) => void) => {
    const listener = (_event: unknown, config: AppConfig) => callback(config);
    ipcRenderer.on(IPC_CHANNELS.CONFIG_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_CHANGED, listener);
  },
};

// 暴露 API 到渲染进程
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (error) {
  console.error('[Preload] Failed to expose electronAPI:', error);
}

// 类型声明
export type ElectronAPI = typeof electronAPI;
