import type {
  NativeCaptureDevice,
  NativeCaptureMode,
  NativeCaptureSelection,
} from './types';

const FORMAT_LABELS: Record<string, string> = {
  YUY2: 'YUY2 4:2:2',
  NV12: 'NV12 4:2:0',
  BGR: 'RGB24 / BGR',
  BGRX: 'RGB32 / BGRx',
  BGRA: 'RGB32 / BGRA',
  I420: 'I420 4:2:0',
  YV12: 'YV12 4:2:0',
  P010_10LE: 'P010 10-bit',
  P016_LE: 'P016 16-bit',
  V210: 'v210 10-bit 4:2:2',
  V216: 'v216 16-bit 4:2:2',
};

/** 将 GStreamer Caps 标识转换为不会误导用户的格式名称。 */
export function normalizeNativeFormatLabel(formatId: string): string {
  const normalized = formatId.trim().toUpperCase();
  return FORMAT_LABELS[normalized] ?? normalized;
}

/** 去除 Chromium 追加的 USB VID:PID，供浏览器设备与 Media Foundation 设备稳定匹配。 */
export function normalizeCaptureDeviceLabel(label: string): string {
  return label
    .trim()
    .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '')
    .toLocaleLowerCase();
}

function modeScore(mode: NativeCaptureMode): [number, number, number] {
  return [
    mode.verified ? 1 : 0,
    mode.width * mode.height,
    mode.frameRateNumerator / mode.frameRateDenominator,
  ];
}

/** 默认只考虑 YUY2；已验证模式永远优先于更高但尚未验证的标称模式。 */
export function selectDefaultNativeMode(device: NativeCaptureDevice): NativeCaptureMode | null {
  const yuy2 = device.formats.find((format) => format.id.toUpperCase() === 'YUY2');
  if (!yuy2) return null;

  return [...yuy2.modes].sort((left, right) => {
    const leftScore = modeScore(left);
    const rightScore = modeScore(right);
    for (let index = 0; index < leftScore.length; index += 1) {
      const difference = rightScore[index] - leftScore[index];
      if (difference !== 0) return difference;
    }
    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

/** 选择值必须来自同一次设备能力枚举，禁止把任意 Caps 或管线字符串送入主进程。 */
export function isNativeSelectionSupported(
  device: NativeCaptureDevice,
  selection: NativeCaptureSelection,
): boolean {
  if (selection.deviceId !== device.id) return false;
  const format = device.formats.find((item) => item.id === selection.formatId);
  return Boolean(format?.modes.some((mode) => mode.id === selection.modeId));
}
