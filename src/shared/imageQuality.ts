import type {
  AiImageQuality,
  AiImageQualityProfile,
  EncodedImage,
} from './types';

export const DEFAULT_AI_IMAGE_QUALITY: AiImageQuality = 'original';

/** AI 图片质量档位。原图档不修改源数据，其余档统一输出适合文字识别的 JPEG 4:4:4。 */
export const AI_IMAGE_QUALITY_PROFILES: Record<AiImageQuality, AiImageQualityProfile> = {
  economy: {
    id: 'economy',
    label: '节省（768px / JPEG 85）',
    maxWidth: 768,
    jpegQuality: 85,
    preserveOriginal: false,
  },
  balanced: {
    id: 'balanced',
    label: '平衡（1280px / JPEG 90）',
    maxWidth: 1280,
    jpegQuality: 90,
    preserveOriginal: false,
  },
  high: {
    id: 'high',
    label: '高画质（1920px / JPEG 95）',
    maxWidth: 1920,
    jpegQuality: 95,
    preserveOriginal: false,
  },
  original: {
    id: 'original',
    label: '最高画质（原图无损）',
    preserveOriginal: true,
  },
};

/** 对持久化配置做白名单收敛，未知值回退到用户确认的最高画质默认值。 */
export function getAiImageQualityProfile(value: unknown): AiImageQualityProfile {
  if (typeof value === 'string' && value in AI_IMAGE_QUALITY_PROFILES) {
    return AI_IMAGE_QUALITY_PROFILES[value as AiImageQuality];
  }
  return AI_IMAGE_QUALITY_PROFILES[DEFAULT_AI_IMAGE_QUALITY];
}

export function toImageDataUrl(image: EncodedImage): string {
  return `data:${image.mimeType};base64,${image.data}`;
}
