import type { AppConfig, CaptureProfileConfig, NativeCaptureProfile, NativeCaptureSelection } from '@shared/types';

export const CAPTURE_PROFILE_DIRECTORY = 'D:\\ProgramData\\ScreenCode';
export const CAPTURE_PROFILE_NAME = 'capture-profile';

export const DEFAULT_CAPTURE_PROFILE_CONFIG: CaptureProfileConfig = {
  version: 1,
  migrationComplete: false,
  lastDeviceId: null,
  captureBackend: 'gstreamer-mf',
  nativeCaptureProfiles: {},
};

const CAPTURE_PROFILE_KEYS = [
  'lastDeviceId',
  'lastNativeDeviceId',
  'captureBackend',
  'nativeCaptureSelection',
  'nativeCaptureProfiles',
] as const satisfies ReadonlyArray<keyof AppConfig>;

const CAPTURE_PROFILE_KEY_SET = new Set<keyof AppConfig>(CAPTURE_PROFILE_KEYS);

export interface ConfigStoreLike {
  get(key: string, defaultValue?: unknown): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeSelection(value: unknown): NativeCaptureSelection | undefined {
  if (!isRecord(value)) return undefined;
  const deviceId = normalizeOptionalString(value.deviceId);
  const formatId = normalizeOptionalString(value.formatId);
  const modeId = normalizeOptionalString(value.modeId);
  return deviceId && formatId && modeId ? { deviceId, formatId, modeId } : undefined;
}

function normalizeProfiles(value: unknown): Record<string, NativeCaptureProfile> {
  if (!isRecord(value)) return {};
  const profiles: Record<string, NativeCaptureProfile> = {};
  Object.entries(value).forEach(([key, candidate]) => {
    if (!isRecord(candidate)) return;
    const nativeDeviceId = normalizeOptionalString(candidate.nativeDeviceId);
    const nativeDeviceLabel = normalizeOptionalString(candidate.nativeDeviceLabel);
    const browserDeviceId = normalizeOptionalString(candidate.browserDeviceId);
    const captureBackend = candidate.captureBackend;
    if (
      !nativeDeviceId
      || !nativeDeviceLabel
      || !browserDeviceId
      || (captureBackend !== 'browser-auto' && captureBackend !== 'gstreamer-mf')
    ) return;
    const selection = normalizeSelection(candidate.selection);
    profiles[key] = {
      nativeDeviceId,
      nativeDeviceLabel,
      browserDeviceId,
      captureBackend,
      ...(selection ? { selection } : {}),
    };
  });
  return profiles;
}

/** 判断 AppConfig 字段是否必须分流到 D 盘采集缓存。 */
export function isCaptureProfileKey(key: keyof AppConfig): boolean {
  return CAPTURE_PROFILE_KEY_SET.has(key);
}

/** 将配置补丁拆分，避免供应商密钥进入采集缓存。 */
export function splitCaptureProfilePatch(config: Partial<AppConfig>): {
  appPatch: Partial<AppConfig>;
  capturePatch: Partial<CaptureProfileConfig>;
} {
  const appPatch: Partial<AppConfig> = {};
  const capturePatch: Partial<CaptureProfileConfig> = {};
  Object.entries(config).forEach(([rawKey, value]) => {
    const key = rawKey as keyof AppConfig;
    if (isCaptureProfileKey(key)) {
      Object.assign(capturePatch, { [key]: value });
    } else {
      Object.assign(appPatch, { [key]: value });
    }
  });
  return { appPatch, capturePatch };
}

/** 从独立存储读取并校验缓存，损坏字段不会进入采集管线。 */
export function readCaptureProfileConfig(store: ConfigStoreLike): CaptureProfileConfig {
  if (store.get('version', 1) !== 1) return { ...DEFAULT_CAPTURE_PROFILE_CONFIG };
  const lastDeviceIdValue = store.get('lastDeviceId', null);
  const captureBackendValue = store.get('captureBackend', 'gstreamer-mf');
  const nativeCaptureSelection = normalizeSelection(store.get('nativeCaptureSelection'));
  const lastNativeDeviceId = normalizeOptionalString(store.get('lastNativeDeviceId'));
  return {
    version: 1,
    migrationComplete: store.get('migrationComplete', false) === true,
    lastDeviceId: typeof lastDeviceIdValue === 'string' || lastDeviceIdValue === null
      ? lastDeviceIdValue
      : null,
    captureBackend: captureBackendValue === 'browser-auto' ? 'browser-auto' : 'gstreamer-mf',
    nativeCaptureProfiles: normalizeProfiles(store.get('nativeCaptureProfiles', {})),
    ...(lastNativeDeviceId ? { lastNativeDeviceId } : {}),
    ...(nativeCaptureSelection ? { nativeCaptureSelection } : {}),
  };
}

/** 只写入白名单字段，调用方传入完整 AppConfig 也不会泄露密钥。 */
export function writeCaptureProfilePatch(
  store: ConfigStoreLike,
  patch: Partial<CaptureProfileConfig>,
): void {
  const allowedKeys: ReadonlyArray<keyof CaptureProfileConfig> = [
    'version',
    'migrationComplete',
    ...CAPTURE_PROFILE_KEYS,
  ];
  allowedKeys.forEach((key) => {
    const value = patch[key];
    if (value !== undefined) store.set(key, value);
  });
}

/** 将旧 C 盘配置迁移一次；成功后删除旧采集字段，其他应用设置保持不变。 */
export function migrateLegacyCaptureProfile(
  legacyStore: ConfigStoreLike,
  captureStore: ConfigStoreLike,
): boolean {
  if (captureStore.get('migrationComplete', false) === true) return false;
  const legacyConfig = Object.fromEntries(
    CAPTURE_PROFILE_KEYS.map((key) => [key, legacyStore.get(key)]),
  ) as Partial<AppConfig>;
  const { capturePatch } = splitCaptureProfilePatch(legacyConfig);
  writeCaptureProfilePatch(captureStore, {
    ...DEFAULT_CAPTURE_PROFILE_CONFIG,
    ...capturePatch,
    migrationComplete: true,
  });
  CAPTURE_PROFILE_KEYS.forEach((key) => legacyStore.delete(key));
  return true;
}
