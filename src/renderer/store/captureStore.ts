import { create } from 'zustand';
import type { Device, EncodedImage } from '@shared/types';
import { IMAGE_PROCESSING } from '@shared/constants';
import { electronAPI } from '../lib/electronApi';
import { acquireHighestQualityStream } from '../capture/highQualityCapture';
import {
  captureWithYuy2AndRestore,
  type HighQualityCaptureOutcome,
} from '../capture/captureOrchestrator';

/** canvas.toDataURL 的质量参数取值域为 0-1，配置中的 QUALITY 为百分制 */
const CANVAS_JPEG_QUALITY = IMAGE_PROCESSING.QUALITY / 100;

/** HTMLMediaElement.readyState：当前帧数据已可用 */
const HAVE_CURRENT_DATA = 2;

function capturePreviewFrame(videoElement: HTMLVideoElement): EncodedImage | null {
  if (videoElement.readyState < HAVE_CURRENT_DATA) return null;
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(videoElement, 0, 0);
  const data = canvas.toDataURL('image/jpeg', CANVAS_JPEG_QUALITY).split(',')[1];
  return {
    data,
    mimeType: 'image/jpeg',
    width: canvas.width,
    height: canvas.height,
  };
}

interface CaptureState {
  devices: Device[];
  selectedDeviceId: string | null;
  selectedDeviceType: 'videoinput' | 'screen' | 'window' | null;
  isCapturing: boolean;
  stream: MediaStream | null;
  /** 当前视频轨道实际生效的采集参数，来自 MediaStreamTrack.getSettings() */
  captureSettings: MediaTrackSettings | null;
  isHighQualityCapturing: boolean;
  currentFrame: string | null; // base64 encoded current frame
  /** 预览区挂载的 video 元素，由 Preview 组件注册，截图时直接复用 */
  videoElement: HTMLVideoElement | null;

  // 操作
  setDevices: (devices: Device[]) => void;
  selectDevice: (deviceId: string, deviceType: 'videoinput' | 'screen' | 'window') => void;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
  loadDevices: () => Promise<void>;
  captureFrame: () => Promise<HighQualityCaptureOutcome | null>;
  setStream: (stream: MediaStream | null) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  devices: [],
  selectedDeviceId: null,
  selectedDeviceType: null,
  isCapturing: false,
  stream: null,
  captureSettings: null,
  isHighQualityCapturing: false,
  currentFrame: null,
  videoElement: null,

  setDevices: (devices) => set({ devices }),
  
  selectDevice: async (deviceId, deviceType) => {
    // 先停止当前的捕获
    const { stream, stopCapture } = get();
    if (stream) {
      await stopCapture();
    }
    
    set({ selectedDeviceId: deviceId, selectedDeviceType: deviceType });
    // 保存到配置
    await electronAPI.setConfig({ lastDeviceId: deviceId });
  },
  
  startCapture: async () => {
    const { selectedDeviceId, selectedDeviceType, stream } = get();
    
    // 如果已经有流，先停止
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (!selectedDeviceId) {
      throw new Error('请先选择设备');
    }
    
    try {
      let newStream: MediaStream;
      let captureSettings: MediaTrackSettings | null = null;
      
      if (selectedDeviceType === 'videoinput') {
        // 复用统一协商器，以分辨率优先、同分辨率帧率优先的顺序获取采集卡视频流
        const config = await electronAPI.getConfig();
        const result = await acquireHighestQualityStream(
          selectedDeviceId,
          navigator.mediaDevices,
          config.captureQualityStrategy,
        );
        newStream = result.stream;
        captureSettings = result.settings;
        console.log('[Capture] 实际采集参数:', {
          width: captureSettings.width,
          height: captureSettings.height,
          frameRate: captureSettings.frameRate,
          resizeMode: (captureSettings as MediaTrackSettings & { resizeMode?: string }).resizeMode,
          requestedMode: result.requestedMode,
          usedFallback: result.usedFallback,
        });
      } else if (selectedDeviceType === 'screen') {
        // 使用 desktopCapturer 获取屏幕（需要通过主进程）
        // 这里暂时抛出错误，后续实现
        throw new Error('屏幕录制功能开发中');
      } else {
        throw new Error('不支持的设备类型');
      }
      
      set({ stream: newStream, captureSettings, isCapturing: true });
      
      // 通知主进程
      await electronAPI.startCapture();
    } catch (error) {
      console.error('Failed to start capture:', error);
      throw error;
    }
  },
  
  stopCapture: async () => {
    const { stream } = get();
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    try {
      await electronAPI.stopCapture();
    } catch (error) {
      console.error('Failed to stop capture:', error);
    }
    
    set({ stream: null, captureSettings: null, isCapturing: false, currentFrame: null });
  },
  
  loadDevices: async () => {
    try {
      // 枚举本地视频输入设备
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices: Device[] = mediaDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          id: device.deviceId,
          name: device.label || `摄像头 ${device.deviceId.slice(0, 8)}`,
          type: 'videoinput' as const,
          isConnected: true
        }));
      
      // 添加屏幕录制选项
      videoDevices.push({
        id: 'screen:primary',
        name: '屏幕录制',
        type: 'screen',
        isConnected: true
      });
      
      set({ devices: videoDevices });
      
      // 加载上次选择的设备
      const config = await electronAPI.getConfig();
      if (config.lastDeviceId && videoDevices.find(d => d.id === config.lastDeviceId)) {
        const device = videoDevices.find(d => d.id === config.lastDeviceId);
        set({ 
          selectedDeviceId: config.lastDeviceId,
          selectedDeviceType: device?.type || null
        });
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  },
  
  /**
   * 从预览区已挂载的 video 元素直接截取当前帧。
   * 不再创建临时 video 等待 loadedmetadata —— 该事件在流已就绪时可能永不触发，
   * 会导致 Promise 永久挂起、截图静默卡死。
   */
  captureFrame: async () => {
    const {
      stream,
      videoElement,
      selectedDeviceId,
      selectedDeviceType,
      devices,
      stopCapture,
      startCapture,
    } = get();

    if (!stream || !videoElement) {
      console.warn('[Capture] 预览未启动，无法截图');
      return null;
    }

    const fallback = capturePreviewFrame(videoElement);
    if (!fallback) {
      console.warn('[Capture] 视频帧数据尚未就绪');
      return null;
    }

    if (selectedDeviceType !== 'videoinput' || !selectedDeviceId) {
      set({ currentFrame: fallback.data });
      return { image: fallback, source: 'preview' };
    }

    const selectedDevice = devices.find((device) => device.id === selectedDeviceId);
    if (!selectedDevice) return null;

    set({ isHighQualityCapturing: true });
    try {
      const config = await electronAPI.getConfig();
      const outcome = await captureWithYuy2AndRestore({
        captureFallback: async () => fallback,
        stopPreview: stopCapture,
        captureYuy2: () => electronAPI.captureHighQualityFrame({
          deviceName: selectedDevice.name,
          ffmpegPath: config.ffmpegPath,
        }),
        restorePreview: startCapture,
      });
      set({ currentFrame: outcome.image.data });
      return outcome;
    } catch (error) {
      console.error('Failed to capture frame:', error);
      return null;
    } finally {
      set({ isHighQualityCapturing: false });
    }
  },

  setStream: (stream) => set({ stream }),

  setVideoElement: (element) => set({ videoElement: element }),
}));
