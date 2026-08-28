import { describe, expect, it, vi } from 'vitest';
import {
  acquireHighestQualityStream,
  buildCaptureCandidates,
  buildExactVideoConstraints,
  type CaptureMode,
  type MediaDevicesLike,
} from './highQualityCapture';

function createStream(
  capabilities: MediaTrackCapabilities,
  settings: MediaTrackSettings,
) {
  const stop = vi.fn();
  const track = {
    getCapabilities: () => capabilities,
    getSettings: () => settings,
    stop,
  } as unknown as MediaStreamTrack;
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  return { stream, stop };
}

describe('buildCaptureCandidates', () => {
  it('按分辨率优先、同分辨率按帧率优先排序', () => {
    const candidates = buildCaptureCandidates({
      width: { min: 640, max: 3840 },
      height: { min: 480, max: 2160 },
      frameRate: { min: 15, max: 60 },
    });

    expect(candidates.slice(0, 3)).toEqual([
      { width: 3840, height: 2160, frameRate: 60 },
      { width: 3840, height: 2160, frameRate: 30 },
      { width: 3840, height: 2160, frameRate: 24 },
    ]);

    const fullHd60Index = candidates.findIndex(
      (mode) => mode.width === 1920 && mode.height === 1080 && mode.frameRate === 60,
    );
    const ultraHd30Index = candidates.findIndex(
      (mode) => mode.width === 3840 && mode.height === 2160 && mode.frameRate === 30,
    );
    expect(ultraHd30Index).toBeLessThan(fullHd60Index);
  });

  it('保留设备报告的非整数最高帧率并过滤能力范围之外的模式', () => {
    const candidates = buildCaptureCandidates({
      width: { min: 1280, max: 1920 },
      height: { min: 720, max: 1080 },
      frameRate: { min: 25, max: 59.94 },
    });

    expect(candidates[0]).toEqual({ width: 1920, height: 1080, frameRate: 59.94 });
    expect(candidates).toContainEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(candidates).not.toContainEqual({ width: 3840, height: 2160, frameRate: 30 });
    expect(candidates.some((mode) => mode.frameRate < 25)).toBe(false);
  });
});

describe('buildExactVideoConstraints', () => {
  const mode: CaptureMode = { width: 3840, height: 2160, frameRate: 30 };

  it('为设备和画面参数生成严格约束，并在支持时禁止浏览器缩放', () => {
    expect(buildExactVideoConstraints('capture-card', mode, true)).toEqual({
      deviceId: { exact: 'capture-card' },
      width: { exact: 3840 },
      height: { exact: 2160 },
      frameRate: { exact: 30 },
      resizeMode: { exact: 'none' },
    });
  });

  it('运行时不支持 resizeMode 时不发送该约束', () => {
    expect(buildExactVideoConstraints('capture-card', mode, false)).not.toHaveProperty('resizeMode');
  });
});

describe('acquireHighestQualityStream', () => {
  it('严格模式失败后继续尝试同分辨率的下一帧率，并返回实际设置', async () => {
    const probe = createStream(
      {
        width: { min: 640, max: 3840 },
        height: { min: 480, max: 2160 },
        frameRate: { min: 15, max: 60 },
      },
      { width: 1280, height: 720, frameRate: 30 },
    );
    const selected = createStream(
      {},
      { width: 3840, height: 2160, frameRate: 30, resizeMode: 'none' },
    );

    const getUserMedia = vi
      .fn<MediaDevicesLike['getUserMedia']>()
      .mockResolvedValueOnce(probe.stream)
      .mockRejectedValueOnce(new DOMException('不支持 4K60', 'OverconstrainedError'))
      .mockResolvedValueOnce(selected.stream);
    const mediaDevices: MediaDevicesLike = {
      getUserMedia,
      getSupportedConstraints: () => ({ resizeMode: true }),
    };

    const result = await acquireHighestQualityStream('capture-card', mediaDevices);

    expect(probe.stop).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledTimes(3);
    expect(result.requestedMode).toEqual({ width: 3840, height: 2160, frameRate: 30 });
    expect(result.settings).toMatchObject({ width: 3840, height: 2160, frameRate: 30 });
    expect(result.usedFallback).toBe(false);
  });

  it('所有严格模式失败时使用最高理想值回退，保证预览仍可启动', async () => {
    const probe = createStream(
      {
        width: { min: 1920, max: 1920 },
        height: { min: 1080, max: 1080 },
        frameRate: { min: 30, max: 30 },
      },
      { width: 1920, height: 1080, frameRate: 30 },
    );
    const fallback = createStream(
      {},
      { width: 1920, height: 1080, frameRate: 29.97 },
    );
    const getUserMedia = vi
      .fn<MediaDevicesLike['getUserMedia']>()
      .mockResolvedValueOnce(probe.stream)
      .mockRejectedValueOnce(new DOMException('严格模式失败', 'OverconstrainedError'))
      .mockResolvedValueOnce(fallback.stream);
    const mediaDevices: MediaDevicesLike = {
      getUserMedia,
      getSupportedConstraints: () => ({}),
    };

    const result = await acquireHighestQualityStream('capture-card', mediaDevices);

    expect(result.requestedMode).toBeNull();
    expect(result.settings.frameRate).toBe(29.97);
    expect(result.usedFallback).toBe(true);
  });
});
