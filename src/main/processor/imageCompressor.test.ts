import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ImageCompressor } from './imageCompressor';

describe('AI 高画质 JPEG 处理', () => {
  it('按目标宽度输出 JPEG95 4:4:4，并且不放大小图', async () => {
    const input = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: '#ffffff',
      },
    }).png().toBuffer();
    const compressor = new ImageCompressor(100, 95);

    const result = await compressor.compressToJpeg(input);
    const metadata = await sharp(result.buffer).metadata();

    expect(result.mimeType).toBe('image/jpeg');
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(50);
    expect(metadata.chromaSubsampling).toBe('4:4:4');
  });

  it('小于目标宽度的 PNG 转 JPEG 时保持原尺寸', async () => {
    const input = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 3,
        background: '#000000',
      },
    }).png().toBuffer();
    const compressor = new ImageCompressor(100, 90);

    const result = await compressor.compressToJpeg(input);
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.width).toBe(40);
    expect(metadata.height).toBe(20);
  });

  it('复用 base64 转换与元数据读取能力', async () => {
    const input = await sharp({
      create: {
        width: 8,
        height: 6,
        channels: 3,
        background: '#336699',
      },
    }).png().toBuffer();
    const compressor = new ImageCompressor();

    const base64 = compressor.toBase64(input);
    const restored = compressor.fromBase64(base64);
    const metadata = await compressor.getInfo(restored);

    expect(restored.equals(input)).toBe(true);
    expect(metadata.width).toBe(8);
    expect(metadata.height).toBe(6);
  });
});
