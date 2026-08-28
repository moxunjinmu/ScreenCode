/** 采集卡候选输出模式。排序规则为分辨率优先，同分辨率下帧率优先。 */
export interface CaptureMode {
  width: number;
  height: number;
  frameRate: number;
}

/** 便于测试替换浏览器媒体设备实现的最小接口。 */
export type MediaDevicesLike = Pick<MediaDevices, 'getUserMedia' | 'getSupportedConstraints'>;

export interface CaptureStreamResult {
  stream: MediaStream;
  settings: MediaTrackSettings;
  requestedMode: CaptureMode | null;
  usedFallback: boolean;
}

const STANDARD_RESOLUTIONS = [
  { width: 7680, height: 4320 },
  { width: 5120, height: 2880 },
  { width: 4096, height: 2160 },
  { width: 3840, height: 2160 },
  { width: 2560, height: 1440 },
  { width: 2048, height: 1080 },
  { width: 1920, height: 1200 },
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1280, height: 720 },
  { width: 720, height: 576 },
  { width: 720, height: 480 },
  { width: 640, height: 480 },
] as const;

const STANDARD_FRAME_RATES = [
  240,
  144,
  120,
  100,
  60,
  59.94,
  50,
  30,
  29.97,
  25,
  24,
  23.976,
  15,
] as const;
const SAFE_FALLBACK_FRAME_RATES = [60, 30, 24, 15] as const;
const QUALITY_FRAME_RATE_PRIORITY = [30, 29.97, 25, 24, 23.976, 15, 50, 59.94, 60, 100, 120, 144, 240];

function isWithinRange(value: number, range?: MediaSettingsRange): boolean {
  return (
    !range ||
    ((range.min === undefined || value >= range.min) &&
      (range.max === undefined || value <= range.max))
  );
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))];
}

/**
 * 将设备能力范围转换为可逐档探测的模式列表。
 * 浏览器不公开 UVC 离散模式，因此先尝试能力上限，再尝试常见标准档位。
 */
export function buildCaptureCandidates(
  capabilities: MediaTrackCapabilities,
  strategy: CaptureQualityStrategy = 'quality',
): CaptureMode[] {
  const resolutions = [
    ...(capabilities.width?.max && capabilities.height?.max
      ? [{ width: capabilities.width.max, height: capabilities.height.max }]
      : []),
    ...STANDARD_RESOLUTIONS,
  ].filter(
    (resolution) =>
      isWithinRange(resolution.width, capabilities.width) &&
      isWithinRange(resolution.height, capabilities.height),
  );

  const uniqueResolutions = [
    ...new Map(
      resolutions.map((resolution) => [`${resolution.width}x${resolution.height}`, resolution]),
    ).values(),
  ];
  const frameRates = uniqueNumbers([
    ...(capabilities.frameRate?.max ? [capabilities.frameRate.max] : []),
    ...(capabilities.frameRate ? STANDARD_FRAME_RATES : SAFE_FALLBACK_FRAME_RATES),
  ]).filter((frameRate) => isWithinRange(frameRate, capabilities.frameRate));

  return uniqueResolutions
    .flatMap((resolution) =>
      frameRates.map((frameRate) => ({ ...resolution, frameRate })),
    )
    .sort((left, right) => {
      const pixelDifference = right.width * right.height - left.width * left.height;
      if (pixelDifference !== 0) return pixelDifference;
      if (right.width !== left.width) return right.width - left.width;
      if (strategy === 'smooth') return right.frameRate - left.frameRate;

      const leftPriority = QUALITY_FRAME_RATE_PRIORITY.indexOf(left.frameRate);
      const rightPriority = QUALITY_FRAME_RATE_PRIORITY.indexOf(right.frameRate);
      const normalizedLeft = leftPriority === -1 ? QUALITY_FRAME_RATE_PRIORITY.length : leftPriority;
      const normalizedRight = rightPriority === -1 ? QUALITY_FRAME_RATE_PRIORITY.length : rightPriority;
      if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
      return Math.abs(left.frameRate - 30) - Math.abs(right.frameRate - 30);
    });
}

/** 为候选模式创建不可静默降分辨率的严格约束。 */
export function buildExactVideoConstraints(
  deviceId: string,
  mode: CaptureMode,
  supportsResizeMode: boolean,
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints & {
    resizeMode?: { exact: string };
  } = {
    deviceId: { exact: deviceId },
    width: { exact: mode.width },
    height: { exact: mode.height },
    frameRate: { exact: mode.frameRate },
    ...(supportsResizeMode ? { resizeMode: { exact: 'none' } } : {}),
  };

  return constraints;
}

function getVideoTrack(stream: MediaStream): MediaStreamTrack {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((item) => item.stop());
    throw new Error('采集设备未返回视频轨道');
  }
  return track;
}

function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function isOverconstrainedError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'OverconstrainedError';
}

/**
 * 获取指定采集卡的最高质量视频流。
 * 严格模式只在约束不受支持时逐级回退；权限、设备占用等错误会直接交给调用方处理。
 */
export async function acquireHighestQualityStream(
  deviceId: string,
  mediaDevices: MediaDevicesLike = navigator.mediaDevices,
  strategy: CaptureQualityStrategy = 'quality',
): Promise<CaptureStreamResult> {
  if (!deviceId.trim()) {
    throw new Error('采集设备 ID 不能为空');
  }

  const stream = await mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false,
  });
  const track = getVideoTrack(stream);
  const capabilities = track.getCapabilities();

  const supportedConstraints = mediaDevices.getSupportedConstraints() as
    MediaTrackSupportedConstraints & { resizeMode?: boolean };
  const supportsResizeMode = Boolean(supportedConstraints.resizeMode);
  const candidates = buildCaptureCandidates(capabilities, strategy);

  for (const mode of candidates) {
    try {
      await track.applyConstraints(
        buildExactVideoConstraints(deviceId, mode, supportsResizeMode),
      );
      const settings = track.getSettings();
      return { stream, settings, requestedMode: mode, usedFallback: false };
    } catch (error) {
      if (!isOverconstrainedError(error)) {
        stopStream(stream);
        throw error;
      }
    }
  }

  try {
    await track.applyConstraints({
      deviceId: { exact: deviceId },
      width: { ideal: capabilities.width?.max ?? 3840 },
      height: { ideal: capabilities.height?.max ?? 2160 },
      frameRate: { ideal: capabilities.frameRate?.max ?? 60 },
      ...(supportsResizeMode ? { resizeMode: { ideal: 'none' } } : {}),
    } as MediaTrackConstraints);
  } catch (error) {
    // 理想值回退失败时保留浏览器已经打开的默认流，避免画面完全不可用。
    if (!isOverconstrainedError(error)) {
      stopStream(stream);
      throw error;
    }
  }

  return {
    stream,
    settings: track.getSettings(),
    requestedMode: null,
    usedFallback: true,
  };
}
import type { CaptureQualityStrategy } from '@shared/types';
