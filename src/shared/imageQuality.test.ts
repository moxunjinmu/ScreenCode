import { describe, expect, it } from 'vitest';
import {
  AI_IMAGE_QUALITY_PROFILES,
  DEFAULT_AI_IMAGE_QUALITY,
  getAiImageQualityProfile,
  toImageDataUrl,
} from './imageQuality';

describe('AI 图片画质档位', () => {
  it('默认使用原图无损档位', () => {
    expect(DEFAULT_AI_IMAGE_QUALITY).toBe('original');
    expect(getAiImageQualityProfile(undefined)).toEqual(AI_IMAGE_QUALITY_PROFILES.original);
    expect(AI_IMAGE_QUALITY_PROFILES.original.preserveOriginal).toBe(true);
  });

  it('提供节省、平衡、高画质和原图四档', () => {
    expect(AI_IMAGE_QUALITY_PROFILES).toMatchObject({
      economy: { maxWidth: 768, jpegQuality: 85 },
      balanced: { maxWidth: 1280, jpegQuality: 90 },
      high: { maxWidth: 1920, jpegQuality: 95 },
      original: { preserveOriginal: true },
    });
  });

  it('非法配置安全回退到原图无损', () => {
    expect(getAiImageQualityProfile('unknown')).toEqual(AI_IMAGE_QUALITY_PROFILES.original);
  });

  it('按图片自身 MIME 构造 data URL', () => {
    expect(toImageDataUrl({ data: 'abc', mimeType: 'image/png' })).toBe(
      'data:image/png;base64,abc',
    );
  });
});
