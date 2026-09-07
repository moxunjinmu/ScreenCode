import type { AppConfig, CaptureProfileConfig } from './types';

/** 采集页独占这些首选项的写入，通用设置不能回写过期的采集状态。 */
export const CAPTURE_PROFILE_KEYS = [
  'lastDeviceId',
  'lastNativeDeviceId',
  'captureBackend',
  'nativeCaptureSelection',
  'nativeCaptureProfiles',
] as const satisfies ReadonlyArray<keyof AppConfig>;

const captureKeySet = new Set<keyof AppConfig>(CAPTURE_PROFILE_KEYS);

export function isCaptureProfileKey(key: keyof AppConfig): boolean {
  return captureKeySet.has(key);
}

/** 同一字段白名单用于主进程存储分流和设置页过滤，避免双方定义漂移。 */
export function splitCaptureProfilePatch(config: Partial<AppConfig>): {
  appPatch: Partial<AppConfig>;
  capturePatch: Partial<CaptureProfileConfig>;
} {
  const appPatch: Partial<AppConfig> = {};
  const capturePatch: Partial<CaptureProfileConfig> = {};
  Object.entries(config).forEach(([rawKey, value]) => {
    const key = rawKey as keyof AppConfig;
    Object.assign(isCaptureProfileKey(key) ? capturePatch : appPatch, { [key]: value });
  });
  return { appPatch, capturePatch };
}
