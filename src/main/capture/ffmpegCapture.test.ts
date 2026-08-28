import { describe, expect, it, vi } from 'vitest';
import {
  buildYuy2CaptureArgs,
  captureYuy2Frame,
  normalizeDshowDeviceName,
  validateDshowDeviceName,
  type FfmpegCaptureDependencies,
} from './ffmpegCapture';

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('test-png-payload'),
]);

function createDependencies(
  overrides: Partial<FfmpegCaptureDependencies> = {},
): FfmpegCaptureDependencies {
  return {
    resolveFfmpegPath: vi.fn().mockResolvedValue('C:\\Tools\\ffmpeg.exe'),
    listVideoDevices: vi.fn().mockResolvedValue(['USB Video']),
    execute: vi.fn().mockResolvedValue({ exitCode: 0, stdout: PNG_BYTES, stderr: '' }),
    ...overrides,
  };
}

describe('FFmpeg YUY2 单帧截图', () => {
  it('规范化 Chromium 追加 VID/PID 的设备名', () => {
    expect(normalizeDshowDeviceName('USB Video (534d:2109)')).toBe('USB Video');
  });

  it('拒绝控制字符和超长设备名', () => {
    expect(() => validateDshowDeviceName('USB\nVideo')).toThrow('设备名');
    expect(() => validateDshowDeviceName('x'.repeat(129))).toThrow('设备名');
  });

  it('使用无 Shell 参数构造 1080p5 YUY2 到 PNG 管线', () => {
    const args = buildYuy2CaptureArgs('USB Video');
    expect(args).toEqual(expect.arrayContaining([
      '-video_size', '1920x1080',
      '-framerate', '5',
      '-pixel_format', 'yuyv422',
      '-i', 'video=USB Video',
      '-frames:v', '1',
      '-c:v', 'png',
      'pipe:1',
    ]));
  });

  it('仅允许已枚举设备并返回带 MIME 和尺寸的 PNG', async () => {
    const dependencies = createDependencies();
    const result = await captureYuy2Frame(
      { deviceName: 'USB Video (534d:2109)' },
      dependencies,
    );

    expect(result).toEqual({
      data: PNG_BYTES.toString('base64'),
      mimeType: 'image/png',
      width: 1920,
      height: 1080,
    });
    expect(dependencies.execute).toHaveBeenCalledOnce();
  });

  it('设备未出现在 FFmpeg 白名单时拒绝执行', async () => {
    const dependencies = createDependencies({
      listVideoDevices: vi.fn().mockResolvedValue(['Integrated Camera']),
    });

    await expect(captureYuy2Frame({ deviceName: 'USB Video' }, dependencies)).rejects.toThrow(
      '未找到采集设备',
    );
    expect(dependencies.execute).not.toHaveBeenCalled();
  });

  it('拒绝非 PNG、非零退出和超出上限的输出', async () => {
    await expect(captureYuy2Frame(
      { deviceName: 'USB Video' },
      createDependencies({
        execute: vi.fn().mockResolvedValue({ exitCode: 0, stdout: Buffer.from('bad'), stderr: '' }),
      }),
    )).rejects.toThrow('PNG');

    await expect(captureYuy2Frame(
      { deviceName: 'USB Video' },
      createDependencies({
        execute: vi.fn().mockResolvedValue({ exitCode: 1, stdout: Buffer.alloc(0), stderr: 'busy' }),
      }),
    )).rejects.toThrow('busy');

    await expect(captureYuy2Frame(
      { deviceName: 'USB Video' },
      createDependencies({
        execute: vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: Buffer.alloc(20 * 1024 * 1024 + 1),
          stderr: '',
        }),
      }),
    )).rejects.toThrow('过大');
  });
});
