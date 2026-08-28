import type { ImageMimeType } from '@shared/types';
import sharp from 'sharp';
import { IMAGE_PROCESSING } from '@shared/constants';

/**
 * 图像压缩器 - 使用 Sharp 进行图像压缩
 */
export class ImageCompressor {
  private targetWidth: number;
  private quality: number;

  constructor(
    targetWidth: number = IMAGE_PROCESSING.TARGET_WIDTH,
    quality: number = IMAGE_PROCESSING.QUALITY
  ) {
    this.targetWidth = targetWidth;
    this.quality = quality;
  }

  /**
   * 压缩图像到目标宽度
   * @param input 输入图像 Buffer
   * @returns 压缩后的图像 Buffer
   */
  async compress(input: Buffer): Promise<Buffer> {
    return (await this.compressToJpeg(input)).buffer;
  }

  /** 转为适合代码识别的 JPEG 4:4:4；只缩小，不放大。 */
  async compressToJpeg(input: Buffer): Promise<{
    buffer: Buffer;
    mimeType: ImageMimeType;
    width: number;
    height: number;
  }> {
    const image = sharp(input);
    const metadata = await image.metadata();
    let pipeline = image;

    if (metadata.width && metadata.width > this.targetWidth) {
      const newHeight = Math.round(
        (this.targetWidth / metadata.width) * (metadata.height || 1),
      );
      pipeline = pipeline.resize(this.targetWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'inside',
      })
    }

    const result = await pipeline.jpeg({
      quality: this.quality,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
    }).toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      mimeType: 'image/jpeg',
      width: result.info.width,
      height: result.info.height,
    };
  }

  /**
   * 转换为 base64
   */
  toBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * 从 base64 解码
   */
  fromBase64(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
  }

  /**
   * 获取图像信息
   */
  async getInfo(buffer: Buffer): Promise<sharp.Metadata> {
    return sharp(buffer).metadata();
  }
}
