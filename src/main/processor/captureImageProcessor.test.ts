import { beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processCapturedImage } from './captureImageProcessor';

let sourcePng = '';

beforeAll(async () => {
  sourcePng = (await sharp({
    create: {
      width: 2000,
      height: 1000,
      channels: 3,
      background: { r: 36, g: 112, b: 220 },
    },
  }).png().toBuffer()).toString('base64');
});

describe('区域截图画质输出', () => {
  it('默认从 PNG 母版裁剪无损 PNG', async () => {
    const result = await processCapturedImage({
      image: { data: sourcePng, mimeType: 'image/png', width: 2000, height: 1000 },
      crop: { left: 100, top: 50, width: 800, height: 400 },
      quality: 'original',
    });
    const metadata = await sharp(Buffer.from(result.data, 'base64')).metadata();

    expect(result).toMatchObject({
      mimeType: 'image/png',
      width: 800,
      height: 400,
      qualityProfile: 'original',
    });
    expect(metadata.format).toBe('png');
  });

  it.each([
    ['high', 1920, 95],
    ['balanced', 1280, 90],
    ['economy', 768, 85],
  ] as const)('%s 档按最大宽度输出 JPEG 4:4:4', async (quality, expectedWidth) => {
    const result = await processCapturedImage({
      image: { data: sourcePng, mimeType: 'image/png', width: 2000, height: 1000 },
      crop: { left: 0, top: 0, width: 2000, height: 1000 },
      quality,
    });
    const metadata = await sharp(Buffer.from(result.data, 'base64')).metadata();

    expect(result).toMatchObject({
      mimeType: 'image/jpeg',
      width: expectedWidth,
      height: expectedWidth / 2,
      qualityProfile: quality,
    });
    expect(metadata.chromaSubsampling).toBe('4:4:4');
  });

  it('小选区不会因画质档位被放大', async () => {
    const result = await processCapturedImage({
      image: { data: sourcePng, mimeType: 'image/png', width: 2000, height: 1000 },
      crop: { left: 0, top: 0, width: 320, height: 160 },
      quality: 'high',
    });

    expect(result).toMatchObject({ width: 320, height: 160 });
  });

  it('相同画质且无需裁剪时不重复编码', async () => {
    const first = await processCapturedImage({
      image: { data: sourcePng, mimeType: 'image/png', width: 2000, height: 1000 },
      quality: 'economy',
    });
    const second = await processCapturedImage({ image: first, quality: 'economy' });

    expect(second).toEqual(first);
  });

  it('拒绝越界选区、非法 MIME 和非法 base64', async () => {
    await expect(processCapturedImage({
      image: { data: sourcePng, mimeType: 'image/png', width: 2000, height: 1000 },
      crop: { left: 1900, top: 0, width: 200, height: 100 },
      quality: 'original',
    })).rejects.toThrow('选区超出图像范围');

    await expect(processCapturedImage({
      image: { data: sourcePng, mimeType: 'image/gif' as never },
      quality: 'original',
    })).rejects.toThrow('不支持的图片类型');

    await expect(processCapturedImage({
      image: { data: 'not-base64!', mimeType: 'image/png' },
      quality: 'original',
    })).rejects.toThrow('图片数据不是有效 base64');
  });
});
