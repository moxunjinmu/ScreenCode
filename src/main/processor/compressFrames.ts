import type { AppConfig, EncodedImage, Frame } from '@shared/types';
import { getAiImageQualityProfile } from '@shared/imageQuality';
import { ImageCompressor } from './imageCompressor';
import { getConfig } from '../config/store';

/**
 * 按当前配置创建压缩器。
 * 每次调用重新读取配置，使设置面板中的调整立即生效。
 */
function createCompressor(): {
  compressor: ImageCompressor | null;
  qualityProfile: AppConfig['aiImageQuality'];
} {
  const config = getConfig();
  const profile = getAiImageQualityProfile(config.aiImageQuality);
  return {
    compressor: profile.preserveOriginal
      ? null
      : new ImageCompressor(profile.maxWidth, profile.jpegQuality),
    qualityProfile: profile.id,
  };
}

/**
 * 压缩单张 base64 图像。
 * 失败时返回原图 —— 压缩是成本优化而非功能必需，不应阻断 AI 请求。
 */
async function compressImage(
  image: EncodedImage,
  compressor: ImageCompressor | null,
  qualityProfile: AppConfig['aiImageQuality'],
): Promise<EncodedImage> {
  if (image.qualityProfile === qualityProfile) return image;
  if (!compressor) return image;
  try {
    const input = Buffer.from(image.data, 'base64');
    const output = await compressor.compressToJpeg(input);
    return {
      data: output.buffer.toString('base64'),
      mimeType: output.mimeType,
      width: output.width,
      height: output.height,
      qualityProfile,
    };
  } catch (error) {
    console.error('[Processor] Image compression failed, falling back to original:', error);
    return image;
  }
}

/** 统计压缩前后体积，用于日志中量化 token 节省 */
function logCompressionRatio(label: string, before: number, after: number): void {
  if (before === 0) return;
  const savedPercent = Math.round((1 - after / before) * 100);
  console.log(
    `[Processor] ${label}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB ` +
    `(节省 ${savedPercent}%)`
  );
}

/**
 * 压缩帧队列 —— 代码提取路径的入口。
 * 截图由渲染进程 canvas 以源分辨率编码，需在送往模型前降到目标宽度。
 */
export async function compressFrames(frames: Frame[]): Promise<Frame[]> {
  if (frames.length === 0) return frames;

  const { compressor, qualityProfile } = createCompressor();
  const before = frames.reduce((sum, f) => sum + f.data.length, 0);

  const compressed = await Promise.all(
    frames.map(async (frame) => ({
      ...frame,
      ...await compressImage(frame, compressor, qualityProfile),
    }))
  );

  const after = compressed.reduce((sum, f) => sum + f.data.length, 0);
  logCompressionRatio(`压缩 ${frames.length} 帧`, before, after);

  return compressed;
}

/**
 * 压缩聊天消息中的图片 —— AI 对话路径的入口。
 */
export async function compressImages(images: EncodedImage[]): Promise<EncodedImage[]> {
  if (images.length === 0) return images;

  const { compressor, qualityProfile } = createCompressor();
  const before = images.reduce((sum, image) => sum + image.data.length, 0);

  const compressed = await Promise.all(
    images.map((image) => compressImage(image, compressor, qualityProfile))
  );

  const after = compressed.reduce((sum, image) => sum + image.data.length, 0);
  logCompressionRatio(`压缩 ${images.length} 张聊天图片`, before, after);

  return compressed;
}
