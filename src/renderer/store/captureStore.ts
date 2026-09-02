import { create } from 'zustand';
import type {
  AiImageQuality,
  CaptureBackend,
  Device,
  EncodedImage,
  NativeCaptureDevice,
  NativeCaptureSelection,
  NativeCaptureStatus,
} from '@shared/types';
import { IMAGE_PROCESSING } from '@shared/constants';
import {
  isNativeSelectionSupported,
  normalizeCaptureDeviceLabel,
  selectDefaultNativeMode,
} from '@shared/nativeCapture';
import { electronAPI } from '../lib/electronApi';
import { acquireHighestQualityStream } from '../capture/highQualityCapture';
import type { HighQualityCaptureOutcome } from '../capture/captureOrchestrator';

const CANVAS_JPEG_QUALITY = IMAGE_PROCESSING.QUALITY / 100;
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
  return { data, mimeType: 'image/jpeg', width: canvas.width, height: canvas.height };
}

function matchNativeDevice(
  browserDevice: Device | undefined,
  nativeDevices: NativeCaptureDevice[],
): NativeCaptureDevice | null {
  if (!browserDevice) return null;
  const label = normalizeCaptureDeviceLabel(browserDevice.name);
  return nativeDevices.find((device) => normalizeCaptureDeviceLabel(device.label) === label) ?? null;
}

function selectionForDevice(
  device: NativeCaptureDevice,
  configured?: NativeCaptureSelection,
): NativeCaptureSelection | null {
  if (configured && isNativeSelectionSupported(device, configured)) return configured;
  const mode = selectDefaultNativeMode(device);
  return mode ? { deviceId: device.id, formatId: 'YUY2', modeId: mode.id } : null;
}

interface CaptureState {
  devices: Device[];
  nativeDevices: NativeCaptureDevice[];
  selectedDeviceId: string | null;
  selectedDeviceType: 'videoinput' | 'screen' | 'window' | null;
  captureBackend: CaptureBackend;
  nativeSelection: NativeCaptureSelection | null;
  nativeStatus: NativeCaptureStatus;
  isCapturing: boolean;
  stream: MediaStream | null;
  captureSettings: MediaTrackSettings | null;
  isHighQualityCapturing: boolean;
  currentFrame: string | null;
  videoElement: HTMLVideoElement | null;
  setDevices: (devices: Device[]) => void;
  selectDevice: (deviceId: string, deviceType: 'videoinput' | 'screen' | 'window') => Promise<void>;
  setCaptureBackend: (backend: CaptureBackend) => Promise<void>;
  setNativeSelection: (formatId: string, modeId: string) => Promise<void>;
  setNativeStatus: (status: NativeCaptureStatus) => void;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
  loadDevices: () => Promise<void>;
  captureFrame: (options?: { quality?: AiImageQuality }) => Promise<HighQualityCaptureOutcome | null>;
  setStream: (stream: MediaStream | null) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  devices: [],
  nativeDevices: [],
  selectedDeviceId: null,
  selectedDeviceType: null,
  captureBackend: 'gstreamer-mf',
  nativeSelection: null,
  nativeStatus: { phase: 'idle', verified: false },
  isCapturing: false,
  stream: null,
  captureSettings: null,
  isHighQualityCapturing: false,
  currentFrame: null,
  videoElement: null,

  setDevices: (devices) => set({ devices }),

  selectDevice: async (deviceId, deviceType) => {
    const { isCapturing, stream, stopCapture, devices, nativeDevices, captureBackend } = get();
    if (isCapturing || stream) await stopCapture();
    const browserDevice = devices.find((device) => device.id === deviceId);
    const nativeDevice = deviceType === 'videoinput'
      ? matchNativeDevice(browserDevice, nativeDevices)
      : null;
    const config = await electronAPI.getConfig();
    const nativeSelection = nativeDevice
      ? selectionForDevice(nativeDevice, config.nativeCaptureSelection)
      : null;
    const nextBackend = captureBackend === 'gstreamer-mf' && nativeSelection
      ? 'gstreamer-mf'
      : 'browser-auto';
    set({
      selectedDeviceId: deviceId,
      selectedDeviceType: deviceType,
      nativeSelection,
      captureBackend: nextBackend,
    });
    await electronAPI.setConfig({
      lastDeviceId: deviceId,
      captureBackend: nextBackend,
      ...(nativeSelection ? { nativeCaptureSelection: nativeSelection } : {}),
    });
  },

  setCaptureBackend: async (backend) => {
    const { isCapturing, stream, stopCapture, nativeSelection } = get();
    if (isCapturing || stream) await stopCapture();
    if (backend === 'gstreamer-mf' && !nativeSelection) {
      throw new Error('当前设备没有可用的 Media Foundation 精确格式');
    }
    set({ captureBackend: backend });
    await electronAPI.setConfig({ captureBackend: backend });
  },

  setNativeSelection: async (formatId, modeId) => {
    const { nativeDevices, nativeSelection, isCapturing, stream, stopCapture } = get();
    const device = nativeDevices.find((item) => item.id === nativeSelection?.deviceId);
    if (!device) throw new Error('当前设备没有原生采集能力');
    const next: NativeCaptureSelection = { deviceId: device.id, formatId, modeId };
    if (!isNativeSelectionSupported(device, next)) throw new Error('所选模式不在设备 Caps 中');
    if (isCapturing || stream) await stopCapture();
    set({ nativeSelection: next, captureBackend: 'gstreamer-mf' });
    await electronAPI.setConfig({ captureBackend: 'gstreamer-mf', nativeCaptureSelection: next });
  },

  setNativeStatus: (nativeStatus) => set({ nativeStatus }),

  startCapture: async () => {
    const {
      selectedDeviceId,
      selectedDeviceType,
      stream,
      captureBackend,
      nativeSelection,
    } = get();
    stream?.getTracks().forEach((track) => track.stop());
    if (!selectedDeviceId) throw new Error('请先选择设备');

    try {
      if (selectedDeviceType === 'videoinput' && captureBackend === 'gstreamer-mf') {
        if (!nativeSelection) throw new Error('未选择原生采集格式');
        await electronAPI.startNativeCapture(nativeSelection);
        set({ stream: null, captureSettings: null, isCapturing: true });
        await electronAPI.startCapture();
        return;
      }
      if (selectedDeviceType !== 'videoinput') {
        throw new Error(selectedDeviceType === 'screen' ? '屏幕录制功能开发中' : '不支持的设备类型');
      }
      const config = await electronAPI.getConfig();
      const result = await acquireHighestQualityStream(
        selectedDeviceId,
        navigator.mediaDevices,
        config.captureQualityStrategy,
      );
      set({ stream: result.stream, captureSettings: result.settings, isCapturing: true });
      await electronAPI.startCapture();
    } catch (error) {
      console.error('Failed to start capture:', error);
      throw error;
    }
  },

  stopCapture: async () => {
    const { stream, captureBackend } = get();
    stream?.getTracks().forEach((track) => track.stop());
    try {
      if (captureBackend === 'gstreamer-mf') await electronAPI.stopNativeCapture();
      await electronAPI.stopCapture();
    } catch (error) {
      console.error('Failed to stop capture:', error);
    }
    set({
      stream: null,
      captureSettings: null,
      isCapturing: false,
      currentFrame: null,
      nativeStatus: { phase: 'idle', verified: false },
    });
  },

  loadDevices: async () => {
    try {
      const nativeDevicesPromise = electronAPI.enumerateNativeCaptureDevices().catch((error) => {
        console.warn('[Capture] GStreamer 设备枚举不可用:', error);
        return [] as NativeCaptureDevice[];
      });
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices: Device[] = mediaDevices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          id: device.deviceId,
          name: device.label || `摄像头 ${device.deviceId.slice(0, 8)}`,
          type: 'videoinput' as const,
          isConnected: true,
        }));
      videoDevices.push({
        id: 'screen:primary',
        name: '屏幕录制',
        type: 'screen',
        isConnected: true,
      });

      // Media Foundation 的逐档帧率验证可能持续数秒，不能阻塞基础设备下拉框。
      set({ devices: videoDevices });

      const config = await electronAPI.getConfig();
      const nativeDevices = await nativeDevicesPromise;
      const currentState = get();
      const selectedDeviceId = currentState.selectedDeviceId ?? config.lastDeviceId;
      const selectedDevice = videoDevices.find((device) => device.id === selectedDeviceId);
      const nativeDevice = matchNativeDevice(selectedDevice, nativeDevices);
      const nativeSelection = nativeDevice
        ? selectionForDevice(
            nativeDevice,
            currentState.nativeSelection ?? config.nativeCaptureSelection,
          )
        : null;
      const requestedBackend = currentState.selectedDeviceId
        ? currentState.captureBackend
        : config.captureBackend;
      const captureBackend = requestedBackend === 'gstreamer-mf' && nativeSelection
        ? 'gstreamer-mf'
        : 'browser-auto';
      set({
        devices: videoDevices,
        nativeDevices,
        selectedDeviceId: selectedDevice?.id ?? null,
        selectedDeviceType: selectedDevice?.type ?? null,
        nativeSelection,
        captureBackend,
      });
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  },

  captureFrame: async (options) => {
    const { captureBackend, isCapturing, stream, videoElement } = get();
    if (!isCapturing) return null;
    const config = await electronAPI.getConfig();
    const outputQuality = options?.quality ?? config.aiImageQuality;
    const applyOutputQuality = async (
      outcome: HighQualityCaptureOutcome,
    ): Promise<HighQualityCaptureOutcome> => {
      try {
        const image = await electronAPI.processCapturedImage({ image: outcome.image, quality: outputQuality });
        return { ...outcome, image };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ...outcome,
          warning: [outcome.warning, `画质处理失败，已保留采集原图：${message}`]
            .filter(Boolean)
            .join('；'),
        };
      }
    };

    if (captureBackend === 'gstreamer-mf') {
      set({ isHighQualityCapturing: true });
      try {
        const snapshot = await electronAPI.captureNativeSnapshot();
        const outcome = await applyOutputQuality({
          image: snapshot,
          source: 'native',
          sourceFormat: snapshot.sourceFormat,
        });
        set({ currentFrame: outcome.image.data });
        return outcome;
      } catch (error) {
        const fallback = videoElement ? capturePreviewFrame(videoElement) : null;
        if (!fallback) throw error;
        const outcome = await applyOutputQuality({
          image: fallback,
          source: 'preview',
          warning: `原始帧截图失败，已明确回退到预览帧：${error instanceof Error ? error.message : String(error)}`,
        });
        set({ currentFrame: outcome.image.data });
        return outcome;
      } finally {
        set({ isHighQualityCapturing: false });
      }
    }

    if (!stream || !videoElement) return null;
    const fallback = capturePreviewFrame(videoElement);
    if (!fallback) return null;
    const outcome = await applyOutputQuality({ image: fallback, source: 'preview' });
    set({ currentFrame: outcome.image.data });
    return outcome;
  },

  setStream: (stream) => set({ stream }),
  setVideoElement: (videoElement) => set({ videoElement }),
}));
