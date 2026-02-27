import { IMAGE_PROCESSING } from '@shared/constants';

/**
 * 帧差分检测器 - 用于检测帧之间的差异
 */
export class FrameDiff {
  private threshold: number;

  constructor(threshold: number = IMAGE_PROCESSING.DIFF_THRESHOLD) {
    this.threshold = threshold;
  }

  /**
   * 对比两帧的像素差异
   * @param _currentFrame 当前帧 (base64)
   * @param previousFrame 上一帧 (base64)
   * @returns 差异百分比和类型
   */
  async compare(
    _currentFrame: string,
    previousFrame?: string
  ): Promise<{ percentage: number; type: 'static' | 'continuation' | 'new_scene' }> {
    if (!previousFrame) {
      return {
        percentage: 1.0,
        type: 'new_scene',
      };
    }

    // TODO: 实现实际的像素对比逻辑
    // 使用 Sharp 或 Canvas 进行像素级对比
    
    // 简化实现：返回模拟数据
    const percentage = 0.3;  // 30% 差异
    
    return {
      percentage,
      type: this.classifyDiff(percentage),
    };
  }

  /**
   * 计算重叠区域
   */
  async calculateOverlap(
    _currentFrame: string,
    _previousFrame: string
  ): Promise<number> {
    // TODO: 实现重叠区域计算
    // 可以通过图像匹配算法计算
    return 0.3;  // 默认返回 30%
  }

  /**
   * 根据差异百分比分类
   */
  private classifyDiff(percentage: number): 'static' | 'continuation' | 'new_scene' {
    if (percentage < this.threshold) {
      return 'static';
    } else if (percentage <= 0.6) {
      return 'continuation';
    } else {
      return 'new_scene';
    }
  }
}
