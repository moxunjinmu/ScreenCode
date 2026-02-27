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
    const image = sharp(input);
    const metadata = await image.metadata();

    // 如果宽度小于目标宽度，不放大
    if (metadata.width && metadata.width <= this.targetWidth) {
      return input;
    }

    // 计算新高度
    const newHeight = Math.round(
      (this.targetWidth / (metadata.width || 1)) * (metadata.height || 1)
    );

    // 压缩并编码为 JPEG
    return image
      .resize(this.targetWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'inside',
      })
      .jpeg({
        quality: this.quality,
        mozjpeg: true,
      })
      .toBuffer();
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
