import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { Device, Frame, ClaudeResponse, AppConfig, AppError } from '@shared/types';

// 调试日志
console.log('[Preload] Script loading...');
console.log('[Preload] IPC_CHANNELS:', IPC_CHANNELS);

// 暴露给渲染进程的 API
const electronAPI = {
  // 设备管理
  enumerateDevices: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_ENUM) as Promise<Device[]>,
  selectDevice: (deviceId: string) => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_SELECT, deviceId),
  
  // 捕获控制
  startCapture: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_START),
  stopCapture: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_STOP),
  
  // 帧管理
  addFrame: (frame: Frame) => ipcRenderer.invoke(IPC_CHANNELS.FRAME_ADD, frame),
  getFrames: () => ipcRenderer.invoke(IPC_CHANNELS.FRAME_UPDATE) as Promise<Frame[]>,
  clearFrames: () => ipcRenderer.invoke(IPC_CHANNELS.FRAME_CLEAR),
  
  // AI 服务
  extractCode: (frames: Frame[]) => ipcRenderer.invoke(IPC_CHANNELS.AI_EXTRACT, frames) as Promise<ClaudeResponse>,
  
  // 配置
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET) as Promise<AppConfig>,
  setConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, config),
  
  // 事件监听
  onFrameAdded: (callback: (frame: Frame) => void) => {
    const listener = (_event: unknown, frame: Frame) => callback(frame);
    ipcRenderer.on(IPC_CHANNELS.FRAME_ADD, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.FRAME_ADD, listener);
  },
  
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
};

console.log('[Preload] electronAPI created:', Object.keys(electronAPI));

// 暴露 API 到渲染进程
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('[Preload] electronAPI exposed successfully');
} catch (error) {
  console.error('[Preload] Failed to expose electronAPI:', error);
}

// 类型声明
export type ElectronAPI = typeof electronAPI;
