import { create } from 'zustand';
import { Device } from '@shared/types';
import { electronAPI } from '../lib/electronApi';

interface CaptureState {
  devices: Device[];
  selectedDeviceId: string | null;
  selectedDeviceType: 'videoinput' | 'screen' | 'window' | null;
  isCapturing: boolean;
  stream: MediaStream | null;
  currentFrame: string | null; // base64 encoded current frame
  
  // 操作
  setDevices: (devices: Device[]) => void;
  selectDevice: (deviceId: string, deviceType: 'videoinput' | 'screen' | 'window') => void;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
  loadDevices: () => Promise<void>;
  captureFrame: () => Promise<string | null>; // 返回 base64 编码的帧
  setStream: (stream: MediaStream | null) => void;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  devices: [],
  selectedDeviceId: null,
  selectedDeviceType: null,
  isCapturing: false,
  stream: null,
  currentFrame: null,
  
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
      
      if (selectedDeviceType === 'videoinput') {
        // 使用 getUserMedia 获取摄像头/采集卡视频流
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });
      } else if (selectedDeviceType === 'screen') {
        // 使用 desktopCapturer 获取屏幕（需要通过主进程）
        // 这里暂时抛出错误，后续实现
        throw new Error('屏幕录制功能开发中');
      } else {
        throw new Error('不支持的设备类型');
      }
      
      set({ stream: newStream, isCapturing: true });
      
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
    
    set({ stream: null, isCapturing: false, currentFrame: null });
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
  
  captureFrame: async () => {
    const { stream } = get();
    if (!stream) {
      return null;
    }
    
    try {
      // 创建视频元素获取当前帧
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // 等待视频准备好
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });
      
      // 创建 canvas 捕获帧
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return null;
      }
      
      ctx.drawImage(video, 0, 0);
      
      // 转换为 base64 (JPEG, 质量 85%)
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      
      // 清理
      video.pause();
      video.srcObject = null;
      
      set({ currentFrame: base64 });
      return base64;
    } catch (error) {
      console.error('Failed to capture frame:', error);
      return null;
    }
  },
  
  setStream: (stream) => set({ stream }),
}));
