import sharp from 'sharp';
import { AI_IMAGE_QUALITY_PROFILES } from '@shared/imageQuality';
import type {
  AiImageQuality,
  ProcessCapturedImageRequest,
  ProcessedImage,
  SourceCropRect,
} from '@shared/types';

const MAX_CAPTURE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const STRICT_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeImageData(data: unknown): Buffer {
  if (typeof data !== 'string' || data.length === 0 || data.length % 4 !== 0) {
    throw new Error('图片数据不是有效 base64');
  }
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const estimatedBytes = data.length * 3 / 4 - padding;
  if (estimatedBytes > MAX_CAPTURE_IMAGE_BYTES) throw new Error('图片数据超过 20MB 上限');
  if (!STRICT_BASE64.test(data)) throw new Error('图片数据不是有效 base64');
  return Buffer.from(data, 'base64');
}

function validateQuality(quality: unknown): AiImageQuality {
  if (typeof quality !== 'string' || !(quality in AI_IMAGE_QUALITY_PROFILES)) {
    throw new Error('无效的图片画质档位');
  }
  return quality as AiImageQuality;
}

function validateCrop(crop: SourceCropRect, imageWidth: number, imageHeight: number): SourceCropRect {
  const values = [crop.left, crop.top, crop.width, crop.height];
  if (!values.every(Number.isInteger) || crop.left < 0 || crop.top < 0 || crop.width <= 0 || crop.height <= 0) {
    throw new Error('选区必须是非负整数坐标和正整数尺寸');
  }
  if (crop.left + crop.width > imageWidth || crop.top + crop.height > imageHeight) {
    throw new Error('选区超出图像范围');
  }
  return crop;
}

/**
 * 对冻结截图执行受控裁剪和画质编码。所有尺寸以源图像素为准，不信任渲染层传入的图片元数据。
 */
export async function processCapturedImage(
  request: ProcessCapturedImageRequest,
): Promise<ProcessedImage> {
  if (request.image.mimeType !== 'image/png' && request.image.mimeType !== 'image/jpeg') {
    throw new Error('不支持的图片类型');
  }
  const quality = validateQuality(request.quality);
  const input = decodeImageData(request.image.data);
  const metadata = await sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error('无法读取图片尺寸');
  const expectedFormat = request.image.mimeType === 'image/png' ? 'png' : 'jpeg';
  if (metadata.format !== expectedFormat) throw new Error('图片内容与 MIME 类型不匹配');

  const crop = request.crop
    ? validateCrop(request.crop, metadata.width, metadata.height)
    : undefined;
  if (!crop && request.image.qualityProfile === quality) {
    return request.image as ProcessedImage;
  }

  const profile = AI_IMAGE_QUALITY_PROFILES[quality];
  if (!crop && profile.preserveOriginal) {
    return {
      ...request.image,
      width: metadata.width,
      height: metadata.height,
      qualityProfile: request.image.qualityProfile ?? 'original',
    };
  }

  let pipeline = sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  });
  const croppedWidth = crop?.width ?? metadata.width;
  if (crop) pipeline = pipeline.extract(crop);

  if (!profile.preserveOriginal && profile.maxWidth && croppedWidth > profile.maxWidth) {
    pipeline = pipeline.resize({
      width: profile.maxWidth,
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    });
  }

  const output = profile.preserveOriginal
    ? request.image.mimeType === 'image/png'
      ? await pipeline.png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true })
      : await pipeline.jpeg({ quality: 100, chromaSubsampling: '4:4:4', mozjpeg: true })
          .toBuffer({ resolveWithObject: true })
    : await pipeline.jpeg({
        quality: profile.jpegQuality,
        chromaSubsampling: '4:4:4',
        mozjpeg: true,
      }).toBuffer({ resolveWithObject: true });

  return {
    data: output.data.toString('base64'),
    mimeType: profile.preserveOriginal ? request.image.mimeType : 'image/jpeg',
    width: output.info.width,
    height: output.info.height,
    qualityProfile: quality,
  };
}
