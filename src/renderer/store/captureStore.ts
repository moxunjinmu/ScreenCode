import { create } from 'zustand';
import type {
  AiImageQuality,
  AppConfig,
  CaptureBackend,
  Device,
  EncodedImage,
  NativeCaptureDevice,
  NativeCaptureProfile,
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
  profiles: Record<string, NativeCaptureProfile> = {},
): NativeCaptureDevice | null {
  if (!browserDevice) return null;
  if (browserDevice.type !== 'videoinput') return null;
  const profile = cachedProfileForBrowserDevice(browserDevice, profiles);
  const byId = nativeDevices.find((device) => device.id === profile?.nativeDeviceId);
  if (byId) return byId;
  const label = normalizeCaptureDeviceLabel(browserDevice.name);
  const matches = nativeDevices.filter((device) => normalizeCaptureDeviceLabel(device.label) === label);
  return matches.length === 1 ? matches[0] : null;
}

function selectionForDevice(
  device: NativeCaptureDevice,
  configured?: NativeCaptureSelection,
  allowDeviceIdRemap = false,
): NativeCaptureSelection | null {
  if (configured) {
    const candidate = allowDeviceIdRemap
      ? { ...configured, deviceId: device.id }
      : configured;
    if (isNativeSelectionSupported(device, candidate)) return candidate;
    console.warn('[Capture] 缓存的精确模式已不在当前设备 Caps 中，改用当前原生默认模式');
  }
  const mode = selectDefaultNativeMode(device);
  if (mode) return { deviceId: device.id, formatId: 'YUY2', modeId: mode.id };
  // 只有 MJPEG/NV12 等格式的设备仍在原生路径选择，不再落入浏览器自动。
  const fallback = device.formats.flatMap((format) => format.modes.map((item) => ({ format, mode: item })))
    .sort((left, right) => Number(right.mode.verified) - Number(left.mode.verified)
      || right.mode.width * right.mode.height - left.mode.width * left.mode.height
      || right.mode.frameRateNumerator / right.mode.frameRateDenominator
        - left.mode.frameRateNumerator / left.mode.frameRateDenominator)[0];
  return fallback
    ? { deviceId: device.id, formatId: fallback.format.id, modeId: fallback.mode.id }
    : null;
}

function profileForDevice(
  device: NativeCaptureDevice,
  profiles: Record<string, NativeCaptureProfile>,
): NativeCaptureProfile | null {
  const exact = profiles[device.id];
  if (exact) return exact;
  const label = normalizeCaptureDeviceLabel(device.label);
  return Object.values(profiles).find(
    (profile) => normalizeCaptureDeviceLabel(profile.nativeDeviceLabel) === label,
  ) ?? null;
}

function nativeDeviceForProfile(
  nativeDevices: NativeCaptureDevice[],
  profile: NativeCaptureProfile | undefined,
): NativeCaptureDevice | null {
  if (!profile) return null;
  return nativeDevices.find((device) => device.id === profile.nativeDeviceId)
    ?? nativeDevices.find(
      (device) => normalizeCaptureDeviceLabel(device.label)
        === normalizeCaptureDeviceLabel(profile.nativeDeviceLabel),
    )
    ?? null;
}

function browserDeviceForNative(
  devices: Device[],
  nativeDevice: NativeCaptureDevice | null,
): Device | undefined {
  if (!nativeDevice) return undefined;
  const nativeLabel = normalizeCaptureDeviceLabel(nativeDevice.label);
  return devices.find(
    (device) => device.type === 'videoinput'
      && normalizeCaptureDeviceLabel(device.name) === nativeLabel,
  );
}

function cachedProfileForBrowserDevice(
  browserDevice: Device | undefined,
  profiles: Record<string, NativeCaptureProfile>,
  preferredNativeDeviceId?: string,
): NativeCaptureProfile | null {
  if (!browserDevice) return null;
  const preferred = preferredNativeDeviceId ? profiles[preferredNativeDeviceId] : undefined;
  if (preferred?.browserDeviceId === browserDevice.id) return preferred;
  const exactBrowserId = Object.values(profiles).find(
    (profile) => profile.browserDeviceId === browserDevice.id,
  );
  if (exactBrowserId) return exactBrowserId;
  const browserLabel = normalizeCaptureDeviceLabel(browserDevice.name);
  return Object.values(profiles).find(
    (profile) => normalizeCaptureDeviceLabel(profile.nativeDeviceLabel) === browserLabel,
  ) ?? null;
}

function cachedNativeDevices(profiles: Record<string, NativeCaptureProfile>): NativeCaptureDevice[] {
  return Object.values(profiles).flatMap((profile) => (
    profile.capabilities ? [profile.capabilities] : []
  ));
}

/** 保存最后使用的一套精确配置；沿用旧字典结构读取兼容，写入时只保留当前设备。 */
function captureProfilePatch(
  browserDeviceId: string,
  nativeDevice: NativeCaptureDevice,
  selection: NativeCaptureSelection,
): Partial<AppConfig> {
  const profile: NativeCaptureProfile = {
    nativeDeviceId: nativeDevice.id,
    nativeDeviceLabel: nativeDevice.label,
    browserDeviceId,
    captureBackend: 'gstreamer-mf',
    selection,
    capabilities: nativeDevice,
  };
  return {
    lastDeviceId: browserDeviceId,
    lastNativeDeviceId: nativeDevice.id,
    captureBackend: 'gstreamer-mf',
    nativeCaptureSelection: selection,
    nativeCaptureProfiles: { [nativeDevice.id]: profile },
  };
}

type NativeDiscoveryPhase = 'idle' | 'loading' | 'ready' | 'failed';

let activeDeviceLoad: Promise<void> | null = null;

interface CaptureState {
  devices: Device[];
  nativeDevices: NativeCaptureDevice[];
  selectedDeviceId: string | null;
  selectedDeviceType: 'videoinput' | 'screen' | 'window' | null;
  captureBackend: CaptureBackend;
  nativeSelection: NativeCaptureSelection | null;
  nativeDiscoveryPhase: NativeDiscoveryPhase;
  nativeStatus: NativeCaptureStatus;
  isCapturing: boolean;
  stream: MediaStream | null;
  captureSettings: MediaTrackSettings | null;
  isHighQualityCapturing: boolean;
  currentFrame: string | null;
  videoElement: HTMLVideoElement | null;
  setDevices: (devices: Device[]) => void;
  selectDevice: (deviceId: string, deviceType: 'videoinput' | 'screen' | 'window') => Promise<void>;
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
  nativeDiscoveryPhase: 'idle',
  nativeStatus: { phase: 'idle', verified: false },
  isCapturing: false,
  stream: null,
  captureSettings: null,
  isHighQualityCapturing: false,
  currentFrame: null,
  videoElement: null,

  setDevices: (devices) => set({ devices }),

  selectDevice: async (deviceId, deviceType) => {
    const {
      isCapturing,
      stream,
      stopCapture,
      devices,
    } = get();
    if (isCapturing || stream) await stopCapture();
    const browserDevice = devices.find((device) => device.id === deviceId);
    if (!browserDevice || browserDevice.type !== deviceType) throw new Error('所选设备不在当前设备列表中');
    const config = await electronAPI.getConfig();
    // await 期间原生枚举可能已完成，必须使用此刻的能力和阶段，避免回写旧快照。
    const { nativeDevices, nativeDiscoveryPhase } = get();
    const configuredProfiles = config.nativeCaptureProfiles ?? {};
    if (deviceType === 'videoinput' && nativeDiscoveryPhase !== 'ready') {
      const cachedProfile = cachedProfileForBrowserDevice(
        browserDevice,
        configuredProfiles,
        config.lastNativeDeviceId,
      );
      const cachedDevice = cachedProfile?.capabilities;
      const nativeSelection = cachedDevice
        ? selectionForDevice(
            cachedDevice,
            cachedProfile.selection ?? config.nativeCaptureSelection,
            true,
          )
        : null;
      set({
        selectedDeviceId: deviceId,
        selectedDeviceType: deviceType,
        nativeSelection,
        captureBackend: 'gstreamer-mf',
      });
      // 探测完成前只保存设备意图，不能用临时运行状态覆盖精确协议首选项。
      await electronAPI.setConfig({ lastDeviceId: deviceId });
      return;
    }

    const nativeDevice = deviceType === 'videoinput'
      ? matchNativeDevice(browserDevice, nativeDevices, configuredProfiles)
      : null;
    const profile = nativeDevice
      ? profileForDevice(nativeDevice, configuredProfiles)
      : null;
    const nativeSelection = nativeDevice
      ? selectionForDevice(
          nativeDevice,
          profile?.selection ?? config.nativeCaptureSelection,
          Boolean(profile),
        )
      : null;
    // 先持久化再触发预览，保证新连接失败或立即退出时仍保留本次明确选择。
    await electronAPI.setConfig(nativeDevice && nativeSelection
      ? captureProfilePatch(deviceId, nativeDevice, nativeSelection)
      : { lastDeviceId: deviceId });
    set({
      selectedDeviceId: deviceId,
      selectedDeviceType: deviceType,
      nativeSelection,
      captureBackend: 'gstreamer-mf',
    });
  },

  setNativeSelection: async (formatId, modeId) => {
    const {
      nativeDevices,
      nativeSelection,
      isCapturing,
      stream,
      stopCapture,
      selectedDeviceId,
      nativeDiscoveryPhase,
    } = get();
    if (nativeDiscoveryPhase !== 'ready') throw new Error('正在探测采集卡，请等待探测完成后调整参数');
    const device = nativeDevices.find((item) => item.id === nativeSelection?.deviceId);
    if (!device) throw new Error('当前设备没有原生采集能力');
    const next: NativeCaptureSelection = { deviceId: device.id, formatId, modeId };
    if (!isNativeSelectionSupported(device, next)) throw new Error('所选模式不在设备 Caps 中');
    if (isCapturing || stream) await stopCapture();
    await electronAPI.setConfig(selectedDeviceId
      ? captureProfilePatch(selectedDeviceId, device, next)
      : { captureBackend: 'gstreamer-mf', nativeCaptureSelection: next });
    set({ nativeSelection: next, captureBackend: 'gstreamer-mf' });
  },

  setNativeStatus: (nativeStatus) => set({ nativeStatus }),

  startCapture: async () => {
    const {
      selectedDeviceId,
      selectedDeviceType,
      stream,
      nativeSelection,
      nativeDiscoveryPhase,
      nativeDevices,
    } = get();
    stream?.getTracks().forEach((track) => track.stop());
    if (!selectedDeviceId) throw new Error('请先选择设备');

    try {
      if (selectedDeviceType === 'videoinput') {
        if (nativeDiscoveryPhase !== 'ready') throw new Error('采集卡探测尚未完成，请稍后重试');
        if (!nativeSelection) throw new Error('未选择原生采集格式');
        const device = nativeDevices.find((item) => item.id === nativeSelection.deviceId);
        if (!device || !isNativeSelectionSupported(device, nativeSelection)) {
          throw new Error('所选精确模式不在本次设备探测结果中，请重新选择');
        }
        await electronAPI.startNativeCapture(nativeSelection);
        set({ stream: null, captureSettings: null, isCapturing: true });
        await electronAPI.startCapture();
        return;
      }
      throw new Error(selectedDeviceType === 'screen' ? '屏幕录制功能开发中' : '不支持的设备类型');
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
    if (activeDeviceLoad) {
      await activeDeviceLoad;
      return;
    }

    const loadTask = (async () => {
      set({ nativeDiscoveryPhase: 'loading', nativeStatus: { phase: 'idle', verified: false } });
      const nativeDevicesPromise = electronAPI.enumerateNativeCaptureDevices()
        .then((devices) => ({ devices, error: null as unknown }))
        .catch((error: unknown) => {
          console.warn('[Capture] GStreamer 设备枚举不可用:', error);
          return { devices: [] as NativeCaptureDevice[], error };
        });

      const [mediaDevices, initialConfig] = await Promise.all([
        navigator.mediaDevices.enumerateDevices(),
        electronAPI.getConfig(),
      ]);
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

      const initialProfiles = initialConfig.nativeCaptureProfiles ?? {};
      const currentSelectedId = get().selectedDeviceId ?? initialConfig.lastDeviceId;
      let initialSelectedDevice = videoDevices.find((device) => device.id === currentSelectedId);
      if (!initialSelectedDevice && initialConfig.lastNativeDeviceId) {
        const preferredProfile = initialProfiles[initialConfig.lastNativeDeviceId];
        initialSelectedDevice = videoDevices.find(
          (device) => device.id === preferredProfile?.browserDeviceId,
        ) ?? videoDevices.find(
          (device) => preferredProfile
            && normalizeCaptureDeviceLabel(device.name)
              === normalizeCaptureDeviceLabel(preferredProfile.nativeDeviceLabel),
        );
      }
      const initialProfile = cachedProfileForBrowserDevice(
        initialSelectedDevice,
        initialProfiles,
        initialConfig.lastNativeDeviceId,
      );
      const cachedDevice = initialProfile?.capabilities;
      const cachedSelection = cachedDevice
        ? selectionForDevice(
            cachedDevice,
            initialProfile.selection ?? initialConfig.nativeCaptureSelection,
            true,
          )
        : null;

      // 先用 D 盘快照恢复界面；真正启动精确管线仍要等待本次 Caps 枚举完成。
      set({
        devices: videoDevices,
        nativeDevices: cachedNativeDevices(initialProfiles),
        selectedDeviceId: initialSelectedDevice?.id ?? null,
        selectedDeviceType: initialSelectedDevice?.type ?? null,
        nativeSelection: cachedSelection,
        captureBackend: 'gstreamer-mf',
        nativeDiscoveryPhase: 'loading',
      });

      const nativeResult = await nativeDevicesPromise;
      if (nativeResult.error) {
        set({
          nativeDiscoveryPhase: 'failed',
          nativeStatus: {
            phase: 'error', verified: false,
            error: `采集卡探测失败：${nativeResult.error instanceof Error ? nativeResult.error.message : String(nativeResult.error)}`,
          },
        });
        return;
      }

      // 探测期间用户可能修改了设备或采集方式，完成时重新读取磁盘首选配置。
      const config = await electronAPI.getConfig();
      const configuredProfiles = config.nativeCaptureProfiles ?? {};
      const currentState = get();
      const selectedDeviceId = currentState.selectedDeviceId ?? config.lastDeviceId;
      let selectedDevice = videoDevices.find((device) => device.id === selectedDeviceId);
      let nativeDevice = matchNativeDevice(selectedDevice, nativeResult.devices, configuredProfiles);
      if (!nativeDevice && !selectedDevice) {
        const preferredProfile = config.lastNativeDeviceId
          ? configuredProfiles[config.lastNativeDeviceId]
          : undefined;
        const profileDevice = nativeDeviceForProfile(nativeResult.devices, preferredProfile)
          ?? nativeResult.devices.find(
            (device) => device.id === config.nativeCaptureSelection?.deviceId,
          )
          ?? null;
        if (profileDevice) {
          nativeDevice = profileDevice;
          selectedDevice = browserDeviceForNative(videoDevices, nativeDevice) ?? selectedDevice;
        }
      }
      const profile = nativeDevice
        ? profileForDevice(nativeDevice, configuredProfiles)
        : null;
      const currentSelection = nativeDevice
        && currentState.nativeSelection?.deviceId === nativeDevice.id
        && isNativeSelectionSupported(nativeDevice, currentState.nativeSelection)
        ? currentState.nativeSelection
        : undefined;
      const nativeSelection = nativeDevice
        ? selectionForDevice(
            nativeDevice,
            currentSelection ?? profile?.selection ?? config.nativeCaptureSelection,
            !currentSelection && Boolean(profile),
          )
        : null;
      set({
        devices: videoDevices,
        nativeDevices: nativeResult.devices,
        selectedDeviceId: selectedDevice?.id ?? null,
        selectedDeviceType: selectedDevice?.type ?? null,
        nativeSelection,
        captureBackend: 'gstreamer-mf',
        nativeDiscoveryPhase: 'ready',
      });
      if (selectedDevice && nativeDevice && nativeSelection) {
        await electronAPI.setConfig(captureProfilePatch(
          selectedDevice.id,
          nativeDevice,
          nativeSelection,
        ));
      }
    })().catch((error) => {
      console.error('Failed to load devices:', error);
      set({
        nativeDiscoveryPhase: 'failed',
        nativeStatus: {
          phase: 'error', verified: false,
          error: `采集配置恢复失败：${error instanceof Error ? error.message : String(error)}`,
        },
      });
    });

    activeDeviceLoad = loadTask;
    try {
      await loadTask;
    } finally {
      if (activeDeviceLoad === loadTask) activeDeviceLoad = null;
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
