import { describe, expect, it, vi } from 'vitest';
import { captureWithYuy2AndRestore } from './captureOrchestrator';

const fallbackImage = { data: 'jpeg', mimeType: 'image/jpeg' as const };
const yuy2Image = {
  data: 'png',
  mimeType: 'image/png' as const,
  width: 1920,
  height: 1080,
};

describe('YUY2 截图状态恢复', () => {
  it('成功时停止预览、返回 YUY2 PNG 并恢复预览', async () => {
    const stopPreview = vi.fn().mockResolvedValue(undefined);
    const restorePreview = vi.fn().mockResolvedValue(undefined);
    const result = await captureWithYuy2AndRestore({
      captureFallback: vi.fn().mockResolvedValue(fallbackImage),
      stopPreview,
      captureYuy2: vi.fn().mockResolvedValue(yuy2Image),
      restorePreview,
    });

    expect(result).toEqual({ image: yuy2Image, source: 'yuy2' });
    expect(stopPreview).toHaveBeenCalledOnce();
    expect(restorePreview).toHaveBeenCalledOnce();
  });

  it('YUY2 失败时明确回退到预览帧并仍然恢复预览', async () => {
    const restorePreview = vi.fn().mockResolvedValue(undefined);
    const result = await captureWithYuy2AndRestore({
      captureFallback: vi.fn().mockResolvedValue(fallbackImage),
      stopPreview: vi.fn().mockResolvedValue(undefined),
      captureYuy2: vi.fn().mockRejectedValue(new Error('FFmpeg unavailable')),
      restorePreview,
    });

    expect(result).toMatchObject({ image: fallbackImage, source: 'preview' });
    expect(result.warning).toContain('FFmpeg unavailable');
    expect(restorePreview).toHaveBeenCalledOnce();
  });

  it('预览恢复失败时单独报告，不丢失已经截取的图片', async () => {
    const result = await captureWithYuy2AndRestore({
      captureFallback: vi.fn().mockResolvedValue(fallbackImage),
      stopPreview: vi.fn().mockResolvedValue(undefined),
      captureYuy2: vi.fn().mockResolvedValue(yuy2Image),
      restorePreview: vi.fn().mockRejectedValue(new Error('device busy')),
    });

    expect(result.image).toEqual(yuy2Image);
    expect(result.restoreError).toContain('device busy');
  });
});
