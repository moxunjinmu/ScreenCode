import type {
  AppConfig,
  CaptureProfileConfig,
  NativeCaptureDevice,
  NativeCaptureFormat,
  NativeCaptureMode,
  NativeCaptureProfile,
  NativeCaptureSelection,
} from '@shared/types';
import { CAPTURE_PROFILE_KEYS, splitCaptureProfilePatch } from '@shared/captureConfig';
export { isCaptureProfileKey, splitCaptureProfilePatch } from '@shared/captureConfig';

export const CAPTURE_PROFILE_DIRECTORY = 'D:\\ProgramData\\ScreenCode';
export const CAPTURE_PROFILE_NAME = 'capture-profile';

export const DEFAULT_CAPTURE_PROFILE_CONFIG: CaptureProfileConfig = {
  version: 1,
  migrationComplete: false,
  lastDeviceId: null,
  captureBackend: 'gstreamer-mf',
  nativeCaptureProfiles: {},
};

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

function normalizePositiveInteger(value: unknown, maximum: number): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= maximum
    ? Number(value)
    : undefined;
}

/** 校验磁盘中的 Caps 快照，缓存永远不能成为任意 sidecar 参数入口。 */
function normalizeCapabilities(
  value: unknown,
  expectedDeviceId: string,
): NativeCaptureDevice | undefined {
  if (!isRecord(value)) return undefined;
  const id = normalizeOptionalString(value.id);
  const label = normalizeOptionalString(value.label);
  if (id !== expectedDeviceId || !label || value.backend !== 'gstreamer-mf') return undefined;
  if (!Array.isArray(value.formats)) return undefined;

  const formats: NativeCaptureFormat[] = value.formats.slice(0, 32).flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const formatId = normalizeOptionalString(candidate.id);
    const formatLabel = normalizeOptionalString(candidate.label);
    const mediaType = candidate.mediaType;
    if (
      !formatId
      || !formatLabel
      || (mediaType !== 'video/x-raw' && mediaType !== 'image/jpeg')
      || !Array.isArray(candidate.modes)
    ) return [];

    const modes: NativeCaptureMode[] = candidate.modes.slice(0, 512).flatMap((mode) => {
      if (!isRecord(mode)) return [];
      const modeId = normalizeOptionalString(mode.id);
      const width = normalizePositiveInteger(mode.width, 16_384);
      const height = normalizePositiveInteger(mode.height, 16_384);
      const frameRateNumerator = normalizePositiveInteger(mode.frameRateNumerator, 1_000_000);
      const frameRateDenominator = normalizePositiveInteger(mode.frameRateDenominator, 1_000_000);
      if (
        !modeId
        || !width
        || !height
        || !frameRateNumerator
        || !frameRateDenominator
        || typeof mode.advertised !== 'boolean'
        || typeof mode.verified !== 'boolean'
      ) return [];
      return [{
        id: modeId,
        width,
        height,
        frameRateNumerator,
        frameRateDenominator,
        advertised: mode.advertised,
        verified: mode.verified,
      }];
    });
    if (modes.length === 0) return [];
    return [{ id: formatId, label: formatLabel, mediaType, modes }];
  });
  if (formats.length === 0) return undefined;
  return { id, label, backend: 'gstreamer-mf', formats };
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
    const capabilities = normalizeCapabilities(candidate.capabilities, nativeDeviceId);
    profiles[key] = {
      nativeDeviceId,
      nativeDeviceLabel,
      browserDeviceId,
      captureBackend,
      ...(selection ? { selection } : {}),
      ...(capabilities ? { capabilities } : {}),
    };
  });
  return profiles;
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
