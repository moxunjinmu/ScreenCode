import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeCaptureDevice } from '@shared/types';
import { DEFAULT_CONFIG } from '@shared/types';

const mocks = vi.hoisted(() => ({
  enumerateNativeCaptureDevices: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));

vi.mock('../lib/electronApi', () => ({
  electronAPI: {
    enumerateNativeCaptureDevices: mocks.enumerateNativeCaptureDevices,
    getConfig: mocks.getConfig,
    setConfig: mocks.setConfig,
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
});
