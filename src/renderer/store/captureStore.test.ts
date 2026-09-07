import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeCaptureDevice } from '@shared/types';
import { DEFAULT_CONFIG } from '@shared/types';

const mocks = vi.hoisted(() => ({
  enumerateNativeCaptureDevices: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  startNativeCapture: vi.fn(),
  startCapture: vi.fn(),
  stopNativeCapture: vi.fn(),
  stopCapture: vi.fn(),
}));

vi.mock('../lib/electronApi', () => ({
  electronAPI: {
    enumerateNativeCaptureDevices: mocks.enumerateNativeCaptureDevices,
    getConfig: mocks.getConfig,
    setConfig: mocks.setConfig,
    startNativeCapture: mocks.startNativeCapture,
    startCapture: mocks.startCapture,
    stopNativeCapture: mocks.stopNativeCapture,
    stopCapture: mocks.stopCapture,
  },
}));

vi.mock('../capture/highQualityCapture', () => ({
  acquireHighestQualityStream: vi.fn(),
}));

import { useCaptureStore } from './captureStore';

const nativeDevice: NativeCaptureDevice = {
  id: 'mf:usb3-video',
  label: 'USB3 Video',
  backend: 'gstreamer-mf',
  formats: [{
    id: 'YUY2',
    label: 'YUY2 4:2:2',
    mediaType: 'video/x-raw',
    modes: [{
      id: 'YUY2:2560x1440:50/1',
      width: 2560,
      height: 1440,
      frameRateNumerator: 50,
      frameRateDenominator: 1,
      advertised: true,
      verified: true,
    }],
  }],
};

describe('采集设备加载', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCaptureStore.setState({
      devices: [],
      nativeDevices: [],
      selectedDeviceId: null,
      selectedDeviceType: null,
      captureBackend: 'browser-auto',
      nativeSelection: null,
      nativeDiscoveryPhase: 'idle',
      isCapturing: false,
      stream: null,
    });
  });

  it('原生 Caps 探测未完成时也立即显示浏览器设备，完成后再补全精确协议', async () => {
    let resolveNative!: (devices: NativeCaptureDevice[]) => void;
    mocks.enumerateNativeCaptureDevices.mockReturnValue(new Promise((resolve) => {
      resolveNative = resolve;
    }));
    mocks.getConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      lastDeviceId: 'browser-usb3',
      captureBackend: 'gstreamer-mf',
    });
    const enumerateDevices = vi.fn().mockResolvedValue([{
      deviceId: 'browser-usb3',
      groupId: 'group-usb3',
      kind: 'videoinput',
      label: 'USB3 Video (345f:2133)',
      toJSON: () => ({}),
    }]);
    vi.stubGlobal('navigator', { mediaDevices: { enumerateDevices } });

    const loading = useCaptureStore.getState().loadDevices();
    await vi.waitFor(() => {
      expect(useCaptureStore.getState().devices.map((device) => device.name))
        .toContain('USB3 Video (345f:2133)');
    }, { timeout: 250 });

    resolveNative([nativeDevice]);
    await loading;
    expect(useCaptureStore.getState()).toMatchObject({
      captureBackend: 'gstreamer-mf',
      nativeSelection: {
        deviceId: nativeDevice.id,
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
    });
  });

  it('原生探测期间点击已缓存设备不会把精确协议覆盖为浏览器自动', async () => {
    let resolveNative!: (devices: NativeCaptureDevice[]) => void;
    mocks.enumerateNativeCaptureDevices.mockReturnValue(new Promise((resolve) => {
      resolveNative = resolve;
    }));
    const cachedConfig = {
      ...DEFAULT_CONFIG,
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: nativeDevice.id,
      captureBackend: 'gstreamer-mf' as const,
      nativeCaptureSelection: {
        deviceId: nativeDevice.id,
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
      nativeCaptureProfiles: {
        [nativeDevice.id]: {
          nativeDeviceId: nativeDevice.id,
          nativeDeviceLabel: nativeDevice.label,
          browserDeviceId: 'browser-usb3',
          captureBackend: 'gstreamer-mf' as const,
          selection: {
            deviceId: nativeDevice.id,
            formatId: 'YUY2',
            modeId: 'YUY2:2560x1440:50/1',
          },
        },
      },
    };
    mocks.getConfig.mockResolvedValue(cachedConfig);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{
          deviceId: 'browser-usb3',
          groupId: 'group-usb3',
          kind: 'videoinput',
          label: 'USB3 Video (345f:2133)',
          toJSON: () => ({}),
        }]),
      },
    });

    const loading = useCaptureStore.getState().loadDevices();
    await vi.waitFor(() => expect(useCaptureStore.getState().devices).toHaveLength(2));
    await useCaptureStore.getState().selectDevice('browser-usb3', 'videoinput');

    expect(mocks.setConfig).toHaveBeenLastCalledWith({ lastDeviceId: 'browser-usb3' });

    resolveNative([nativeDevice]);
    await loading;
    expect(useCaptureStore.getState()).toMatchObject({
      selectedDeviceId: 'browser-usb3',
      captureBackend: 'gstreamer-mf',
      nativeSelection: cachedConfig.nativeCaptureSelection,
    });
    expect(mocks.setConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: cachedConfig.nativeCaptureSelection,
    }));
  });

  it('原生 Caps 尚未返回时先从 D 盘档案展示缓存的格式分辨率和帧率', async () => {
    let resolveNative!: (devices: NativeCaptureDevice[]) => void;
    mocks.enumerateNativeCaptureDevices.mockReturnValue(new Promise((resolve) => {
      resolveNative = resolve;
    }));
    mocks.getConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: nativeDevice.id,
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: {
        deviceId: nativeDevice.id,
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
      nativeCaptureProfiles: {
        [nativeDevice.id]: {
          nativeDeviceId: nativeDevice.id,
          nativeDeviceLabel: nativeDevice.label,
          browserDeviceId: 'browser-usb3',
          captureBackend: 'gstreamer-mf',
          selection: {
            deviceId: nativeDevice.id,
            formatId: 'YUY2',
            modeId: 'YUY2:2560x1440:50/1',
          },
          capabilities: nativeDevice,
        },
      },
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{
          deviceId: 'browser-usb3',
          groupId: 'group-usb3',
          kind: 'videoinput',
          label: 'USB3 Video (345f:2133)',
          toJSON: () => ({}),
        }]),
      },
    });

    const loading = useCaptureStore.getState().loadDevices();
    await vi.waitFor(() => expect(useCaptureStore.getState().devices).toHaveLength(2));

    expect(useCaptureStore.getState()).toMatchObject({
      nativeDiscoveryPhase: 'loading',
      selectedDeviceId: 'browser-usb3',
      captureBackend: 'gstreamer-mf',
      nativeDevices: [nativeDevice],
    });

    resolveNative([nativeDevice]);
    await loading;
  });

  it('原生枚举临时失败时保留浏览器设备和精确协议首选配置', async () => {
    mocks.enumerateNativeCaptureDevices.mockRejectedValue(new Error('sidecar unavailable'));
    mocks.getConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      lastDeviceId: 'browser-usb3',
      captureBackend: 'gstreamer-mf',
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{
          deviceId: 'browser-usb3',
          groupId: 'group-usb3',
          kind: 'videoinput',
          label: 'USB3 Video (345f:2133)',
          toJSON: () => ({}),
        }]),
      },
    });

    await useCaptureStore.getState().loadDevices();

    expect(useCaptureStore.getState()).toMatchObject({
      selectedDeviceId: 'browser-usb3',
      selectedDeviceType: 'videoinput',
      nativeDiscoveryPhase: 'failed',
    });
    expect(mocks.setConfig).not.toHaveBeenCalledWith(expect.objectContaining({
      captureBackend: 'browser-auto',
    }));
  });

  it('浏览器设备 ID 变化后按原生设备名恢复 D 盘缓存的精确模式', async () => {
    const currentNativeDevice: NativeCaptureDevice = {
      ...nativeDevice,
      id: 'mf:usb3-video-current',
    };
    mocks.enumerateNativeCaptureDevices.mockResolvedValue([currentNativeDevice]);
    mocks.getConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      lastDeviceId: 'browser-usb3-old',
      lastNativeDeviceId: 'mf:usb3-video-old',
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: {
        deviceId: 'mf:usb3-video-old',
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
      nativeCaptureProfiles: {
        'mf:usb3-video-old': {
          nativeDeviceId: 'mf:usb3-video-old',
          nativeDeviceLabel: 'USB3 Video',
          browserDeviceId: 'browser-usb3-old',
          captureBackend: 'gstreamer-mf',
          selection: {
            deviceId: 'mf:usb3-video-old',
            formatId: 'YUY2',
            modeId: 'YUY2:2560x1440:50/1',
          },
        },
      },
    });
    const enumerateDevices = vi.fn().mockResolvedValue([{
      deviceId: 'browser-usb3-current',
      groupId: 'group-usb3-current',
      kind: 'videoinput',
      label: 'USB3 Video (345f:2133)',
      toJSON: () => ({}),
    }]);
    vi.stubGlobal('navigator', { mediaDevices: { enumerateDevices } });

    await useCaptureStore.getState().loadDevices();

    expect(useCaptureStore.getState()).toMatchObject({
      selectedDeviceId: 'browser-usb3-current',
      selectedDeviceType: 'videoinput',
      captureBackend: 'gstreamer-mf',
      nativeSelection: {
        deviceId: 'mf:usb3-video-current',
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
    });
  });

  it('修复旧缓存中被竞态写成浏览器自动但仍保留精确模式的档案', async () => {
    mocks.enumerateNativeCaptureDevices.mockResolvedValue([nativeDevice]);
    mocks.getConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: nativeDevice.id,
      captureBackend: 'browser-auto',
      nativeCaptureSelection: {
        deviceId: nativeDevice.id,
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
      nativeCaptureProfiles: {
        [nativeDevice.id]: {
          nativeDeviceId: nativeDevice.id,
          nativeDeviceLabel: nativeDevice.label,
          browserDeviceId: 'browser-usb3',
          captureBackend: 'browser-auto',
          selection: {
            deviceId: nativeDevice.id,
            formatId: 'YUY2',
            modeId: 'YUY2:2560x1440:50/1',
          },
        },
      },
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{
          deviceId: 'browser-usb3',
          groupId: 'group-usb3',
          kind: 'videoinput',
          label: 'USB3 Video (345f:2133)',
          toJSON: () => ({}),
        }]),
      },
    });

    await useCaptureStore.getState().loadDevices();

    expect(useCaptureStore.getState()).toMatchObject({
      captureBackend: 'gstreamer-mf',
      nativeSelection: {
        deviceId: nativeDevice.id,
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
    });
    expect(mocks.setConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      captureBackend: 'gstreamer-mf',
      nativeCaptureProfiles: {
        [nativeDevice.id]: expect.objectContaining({
          captureBackend: 'gstreamer-mf',
        }),
      },
    }));
  });

  it('历史浏览器自动配置在采集卡恢复时统一使用精确协议', async () => {
    mocks.enumerateNativeCaptureDevices.mockResolvedValue([nativeDevice]);
    mocks.getConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: nativeDevice.id,
      captureBackend: 'browser-auto',
      nativeCaptureProfiles: {
        [nativeDevice.id]: {
          nativeDeviceId: nativeDevice.id,
          nativeDeviceLabel: nativeDevice.label,
          browserDeviceId: 'browser-usb3',
          captureBackend: 'browser-auto',
          selection: {
            deviceId: nativeDevice.id,
            formatId: 'YUY2',
            modeId: 'YUY2:2560x1440:50/1',
          },
        },
      },
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{
          deviceId: 'browser-usb3',
          groupId: 'group-usb3',
          kind: 'videoinput',
          label: 'USB3 Video (345f:2133)',
          toJSON: () => ({}),
        }]),
      },
    });

    await useCaptureStore.getState().loadDevices();

    expect(useCaptureStore.getState().captureBackend).toBe('gstreamer-mf');
  });

  it('切换精确模式时按当前采集卡写入独立设备档案', async () => {
    mocks.getConfig.mockResolvedValue(DEFAULT_CONFIG);
    useCaptureStore.setState({
      nativeDiscoveryPhase: 'ready',
      nativeDevices: [nativeDevice],
      selectedDeviceId: 'browser-usb3',
      selectedDeviceType: 'videoinput',
      nativeSelection: {
        deviceId: nativeDevice.id,
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
      captureBackend: 'gstreamer-mf',
      isCapturing: false,
      stream: null,
    });

    await useCaptureStore.getState().setNativeSelection(
      'YUY2',
      'YUY2:2560x1440:50/1',
    );

    expect(mocks.setConfig).toHaveBeenCalledWith(expect.objectContaining({
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: nativeDevice.id,
      captureBackend: 'gstreamer-mf',
      nativeCaptureProfiles: {
        [nativeDevice.id]: {
          nativeDeviceId: nativeDevice.id,
          nativeDeviceLabel: nativeDevice.label,
          browserDeviceId: 'browser-usb3',
          captureBackend: 'gstreamer-mf',
          capabilities: nativeDevice,
          selection: {
            deviceId: nativeDevice.id,
            formatId: 'YUY2',
            modeId: 'YUY2:2560x1440:50/1',
          },
        },
      },
    }));
  });

  it('切换采集卡后只保存当前设备的一套精确模式', async () => {
    mocks.getConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      nativeCaptureProfiles: {
        old: {
          nativeDeviceId: 'old', nativeDeviceLabel: 'Other card',
          browserDeviceId: 'other-browser', captureBackend: 'gstreamer-mf',
        },
      },
    });
    useCaptureStore.setState({
      nativeDiscoveryPhase: 'ready', nativeDevices: [nativeDevice],
      selectedDeviceId: 'browser-usb3', selectedDeviceType: 'videoinput',
      nativeSelection: {
        deviceId: nativeDevice.id, formatId: 'YUY2', modeId: 'YUY2:2560x1440:50/1',
      },
    });
    await useCaptureStore.getState().setNativeSelection('YUY2', 'YUY2:2560x1440:50/1');
    const patch = mocks.setConfig.mock.calls.at(-1)?.[0];
    expect(Object.keys(patch.nativeCaptureProfiles)).toEqual([nativeDevice.id]);
  });

  it('缓存 Caps 展示阶段不能直接启动原生采集', async () => {
    useCaptureStore.setState({
      nativeDiscoveryPhase: 'loading', captureBackend: 'gstreamer-mf',
      selectedDeviceId: 'browser-usb3', selectedDeviceType: 'videoinput',
      nativeSelection: {
        deviceId: nativeDevice.id, formatId: 'YUY2', modeId: 'YUY2:2560x1440:50/1',
      },
    });
    await expect(useCaptureStore.getState().startCapture()).rejects.toThrow('探测');
    expect(mocks.startNativeCapture).not.toHaveBeenCalled();
  });
});
