import { describe, expect, it } from 'vitest';
import type { AppConfig, CaptureProfileConfig } from '@shared/types';
import {
  CAPTURE_PROFILE_DIRECTORY,
  DEFAULT_CAPTURE_PROFILE_CONFIG,
  migrateLegacyCaptureProfile,
  readCaptureProfileConfig,
  splitCaptureProfilePatch,
  writeCaptureProfilePatch,
} from './captureProfile';

class MemoryStore {
  private readonly values = new Map<string, unknown>();

  constructor(initial: Record<string, unknown> = {}) {
    Object.entries(initial).forEach(([key, value]) => this.values.set(key, value));
  }

  get(key: string, defaultValue?: unknown): unknown {
    return this.values.has(key) ? this.values.get(key) : defaultValue;
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }
}

const selection = {
  deviceId: 'mf:usb3-video',
  formatId: 'YUY2',
  modeId: 'YUY2:2560x1440:50/1',
};

describe('采集卡精确协议独立缓存', () => {
  it('固定写入 D 盘 ProgramData 目录', () => {
    expect(CAPTURE_PROFILE_DIRECTORY).toBe('D:\\ProgramData\\ScreenCode');
  });

  it('只把采集配置分流到独立缓存，不复制供应商密钥', () => {
    const patch: Partial<AppConfig> = {
      activeProvider: 'zhipu',
      providerConfigs: {
        zhipu: {
          apiKey: 'secret-must-not-enter-capture-cache',
          baseUrl: 'https://example.invalid',
          model: 'glm-test',
        },
      },
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: selection.deviceId,
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: selection,
      nativeCaptureProfiles: {},
    };

    const result = splitCaptureProfilePatch(patch);

    expect(result.capturePatch).toMatchObject({
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: selection.deviceId,
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: selection,
    });
    expect(result.capturePatch).not.toHaveProperty('providerConfigs');
    expect(result.appPatch).toMatchObject({ activeProvider: 'zhipu' });
    expect(result.appPatch).not.toHaveProperty('lastDeviceId');
  });

  it('首次启动迁移旧配置后以 D 盘缓存为准', () => {
    const legacy = new MemoryStore({
      lastDeviceId: 'browser-usb3',
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: selection,
    });
    const capture = new MemoryStore();

    expect(migrateLegacyCaptureProfile(legacy, capture)).toBe(true);
    expect(readCaptureProfileConfig(capture)).toMatchObject({
      version: 1,
      migrationComplete: true,
      lastDeviceId: 'browser-usb3',
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: selection,
    });
    expect(legacy.has('lastDeviceId')).toBe(false);
    expect(legacy.has('nativeCaptureSelection')).toBe(false);
    expect(migrateLegacyCaptureProfile(legacy, capture)).toBe(false);
  });

  it('损坏字段回到安全默认值，合法设备档案保持不变', () => {
    const store = new MemoryStore({
      version: 999,
      migrationComplete: 'yes',
      lastDeviceId: 42,
      captureBackend: 'unknown',
      nativeCaptureProfiles: [],
    });

    expect(readCaptureProfileConfig(store)).toEqual(DEFAULT_CAPTURE_PROFILE_CONFIG);

    const valid: CaptureProfileConfig = {
      ...DEFAULT_CAPTURE_PROFILE_CONFIG,
      migrationComplete: true,
      lastDeviceId: 'browser-usb3',
      lastNativeDeviceId: selection.deviceId,
      captureBackend: 'gstreamer-mf',
      nativeCaptureSelection: selection,
      nativeCaptureProfiles: {
        [selection.deviceId]: {
          nativeDeviceId: selection.deviceId,
          nativeDeviceLabel: 'USB3 Video',
          browserDeviceId: 'browser-usb3',
          captureBackend: 'gstreamer-mf',
          selection,
        },
      },
    };
    writeCaptureProfilePatch(store, valid);
    expect(readCaptureProfileConfig(store)).toEqual(valid);
  });
});
