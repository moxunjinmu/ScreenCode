import { describe, expect, it } from 'vitest';
import {
  isNativeSelectionSupported,
  normalizeNativeFormatLabel,
  selectDefaultNativeMode,
} from './nativeCapture';
import type { NativeCaptureDevice, NativeCaptureSelection } from './types';

const device: NativeCaptureDevice = {
  id: 'mf:usb3-video',
  label: 'USB3 Video',
  backend: 'gstreamer-mf',
  formats: [
    {
      id: 'YUY2',
      label: 'YUY2 4:2:2',
      mediaType: 'video/x-raw',
      modes: [
        {
          id: 'YUY2:3840x2160:30/1',
          width: 3840,
          height: 2160,
          frameRateNumerator: 30,
          frameRateDenominator: 1,
          advertised: true,
          verified: false,
        },
        {
          id: 'YUY2:2560x1440:50/1',
          width: 2560,
          height: 1440,
          frameRateNumerator: 50,
          frameRateDenominator: 1,
          advertised: true,
          verified: true,
        },
      ],
    },
    {
      id: 'NV12',
      label: 'NV12 4:2:0',
      mediaType: 'video/x-raw',
      modes: [
        {
          id: 'NV12:3840x2160:30/1',
          width: 3840,
          height: 2160,
          frameRateNumerator: 30,
          frameRateDenominator: 1,
          advertised: true,
          verified: true,
        },
      ],
    },
  ],
};

describe('原生采集能力选择', () => {
  it('默认选择已验证的最高有效 YUY2，而不是未验证的 4K 标称模式', () => {
    expect(selectDefaultNativeMode(device)?.id).toBe('YUY2:2560x1440:50/1');
  });

  it('没有 YUY2 时返回 null，让调用方保留浏览器自动模式', () => {
    expect(selectDefaultNativeMode({ ...device, formats: device.formats.slice(1) })).toBeNull();
  });

  it('只接受当前设备枚举出的模式 ID', () => {
    const supported: NativeCaptureSelection = {
      deviceId: device.id,
      formatId: 'YUY2',
      modeId: 'YUY2:2560x1440:50/1',
    };
    expect(isNativeSelectionSupported(device, supported)).toBe(true);
    expect(isNativeSelectionSupported(device, { ...supported, modeId: 'YUY2:7680x4320:240/1' })).toBe(false);
  });

  it('明确显示 Windows RGB24 的 BGR 内存布局', () => {
    expect(normalizeNativeFormatLabel('BGR')).toBe('RGB24 / BGR');
    expect(normalizeNativeFormatLabel('YUY2')).toBe('YUY2 4:2:2');
  });
});
