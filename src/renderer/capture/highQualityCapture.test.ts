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
  applyConstraints = vi.fn<
    Parameters<MediaStreamTrack['applyConstraints']>,
    ReturnType<MediaStreamTrack['applyConstraints']>
  >().mockResolvedValue(undefined),
) {
  const stop = vi.fn();
  const track = {
    getCapabilities: () => capabilities,
    getSettings: () => settings,
    applyConstraints,
    stop,
  } as unknown as MediaStreamTrack;
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  return { stream, stop, applyConstraints };
}

describe('buildCaptureCandidates', () => {
  it('按分辨率优先、同分辨率按帧率优先排序', () => {
    const candidates = buildCaptureCandidates({
      width: { min: 640, max: 3840 },
      height: { min: 480, max: 2160 },
      frameRate: { min: 15, max: 60 },
    });

    expect(candidates.slice(0, 3)).toEqual([
      { width: 3840, height: 2160, frameRate: 30 },
      { width: 3840, height: 2160, frameRate: 29.97 },
      { width: 3840, height: 2160, frameRate: 25 },
    ]);

    const fullHd60Index = candidates.findIndex(
      (mode) => mode.width === 1920 && mode.height === 1080 && mode.frameRate === 60,
    );
    const ultraHd30Index = candidates.findIndex(
      (mode) => mode.width === 3840 && mode.height === 2160 && mode.frameRate === 30,
    );
    expect(ultraHd30Index).toBeLessThan(fullHd60Index);
  });

  it('流畅优先策略在同分辨率下仍按标称帧率降序', () => {
    const candidates = buildCaptureCandidates({
      width: { min: 640, max: 1920 },
      height: { min: 480, max: 1080 },
      frameRate: { min: 15, max: 60 },
    }, 'smooth');

    expect(candidates.slice(0, 3)).toEqual([
      { width: 1920, height: 1080, frameRate: 60 },
      { width: 1920, height: 1080, frameRate: 59.94 },
      { width: 1920, height: 1080, frameRate: 50 },
    ]);
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

  it('设备未报告能力范围时仍生成标准降级模式', () => {
    const candidates = buildCaptureCandidates({});

    expect(candidates[0]).toEqual({ width: 7680, height: 4320, frameRate: 60 });
    expect(candidates.at(-1)).toEqual({ width: 640, height: 480, frameRate: 15 });
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
  it('拒绝空设备 ID，且不访问媒体设备', async () => {
    const getUserMedia = vi.fn<
      Parameters<MediaDevicesLike['getUserMedia']>,
      ReturnType<MediaDevicesLike['getUserMedia']>
    >();
    const mediaDevices: MediaDevicesLike = {
      getUserMedia,
      getSupportedConstraints: () => ({}),
    };

    await expect(acquireHighestQualityStream('  ', mediaDevices)).rejects.toThrow(
      '采集设备 ID 不能为空',
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('探测流没有视频轨道时停止流并返回明确错误', async () => {
    const stop = vi.fn();
    const stream = {
      getVideoTracks: () => [],
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const mediaDevices: MediaDevicesLike = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      getSupportedConstraints: () => ({}),
    };

    await expect(acquireHighestQualityStream('capture-card', mediaDevices)).rejects.toThrow(
      '采集设备未返回视频轨道',
    );
    expect(stop).toHaveBeenCalled();
  });

  it('严格模式失败后继续尝试同分辨率的下一帧率，并返回实际设置', async () => {
    const applyConstraints = vi
      .fn<
        Parameters<MediaStreamTrack['applyConstraints']>,
        ReturnType<MediaStreamTrack['applyConstraints']>
      >()
      .mockRejectedValueOnce(new DOMException('不支持 4K30', 'OverconstrainedError'))
      .mockResolvedValueOnce(undefined);
    const selected = createStream(
      {
        width: { min: 640, max: 3840 },
        height: { min: 480, max: 2160 },
        frameRate: { min: 15, max: 60 },
      },
      { width: 3840, height: 2160, frameRate: 29.97, resizeMode: 'none' } as
        MediaTrackSettings & { resizeMode: string },
      applyConstraints,
    );

    const getUserMedia = vi
      .fn<Parameters<MediaDevicesLike['getUserMedia']>, ReturnType<MediaDevicesLike['getUserMedia']>>()
      .mockResolvedValueOnce(selected.stream);
    const mediaDevices: MediaDevicesLike = {
      getUserMedia,
      getSupportedConstraints: () => (
        { resizeMode: true } as MediaTrackSupportedConstraints & { resizeMode: boolean }
      ),
    };

    const result = await acquireHighestQualityStream('capture-card', mediaDevices);

    expect(selected.stop).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(applyConstraints).toHaveBeenCalledTimes(2);
    expect(result.requestedMode).toEqual({ width: 3840, height: 2160, frameRate: 29.97 });
    expect(result.settings).toMatchObject({ width: 3840, height: 2160, frameRate: 29.97 });
    expect(result.usedFallback).toBe(false);
  });

  it('所有严格模式失败时使用最高理想值回退，保证预览仍可启动', async () => {
    const applyConstraints = vi
      .fn<
        Parameters<MediaStreamTrack['applyConstraints']>,
        ReturnType<MediaStreamTrack['applyConstraints']>
      >()
      .mockRejectedValueOnce(new DOMException('严格模式失败', 'OverconstrainedError'))
      .mockResolvedValueOnce(undefined);
    const fallback = createStream(
      {
        width: { min: 1920, max: 1920 },
        height: { min: 1080, max: 1080 },
        frameRate: { min: 30, max: 30 },
      },
      { width: 1920, height: 1080, frameRate: 29.97 },
      applyConstraints,
    );
    const getUserMedia = vi
      .fn<Parameters<MediaDevicesLike['getUserMedia']>, ReturnType<MediaDevicesLike['getUserMedia']>>()
      .mockResolvedValueOnce(fallback.stream);
    const mediaDevices: MediaDevicesLike = {
      getUserMedia,
      getSupportedConstraints: () => ({}),
    };

    const result = await acquireHighestQualityStream('capture-card', mediaDevices);

    expect(result.requestedMode).toBeNull();
    expect(result.settings.frameRate).toBe(29.97);
    expect(result.usedFallback).toBe(true);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(applyConstraints).toHaveBeenCalledTimes(2);
  });

  it('打开设备时的权限错误直接返回，不重复请求', async () => {
    const getUserMedia = vi
      .fn<
        Parameters<MediaDevicesLike['getUserMedia']>,
        ReturnType<MediaDevicesLike['getUserMedia']>
      >()
      .mockRejectedValueOnce(new DOMException('用户拒绝访问', 'NotAllowedError'));
    const mediaDevices: MediaDevicesLike = {
      getUserMedia,
      getSupportedConstraints: () => ({}),
    };

    await expect(acquireHighestQualityStream('capture-card', mediaDevices)).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });
});
