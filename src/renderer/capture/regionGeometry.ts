import type { SourceCropRect } from '@shared/types';

export interface Size {
  width: number;
  height: number;
}

export interface DisplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** 计算源图以 contain 方式显示在容器内时的实际内容区域。 */
export function fitContainedSource(container: Size, source: Size): DisplayRect {
  if (container.width <= 0 || container.height <= 0 || source.width <= 0 || source.height <= 0) {
    throw new Error('容器和源图尺寸必须大于 0');
  }
  const scale = Math.min(container.width / source.width, container.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

/**
 * 将显示坐标映射为源图整数像素。左上向下取整、右下向上取整，避免漏掉框选边缘。
 */
export function displayRectToSourceRect(
  displayRect: DisplayRect,
  contentRect: DisplayRect,
  source: Size,
): SourceCropRect | null {
  const left = Math.max(displayRect.x, contentRect.x);
  const top = Math.max(displayRect.y, contentRect.y);
  const right = Math.min(displayRect.x + displayRect.width, contentRect.x + contentRect.width);
  const bottom = Math.min(displayRect.y + displayRect.height, contentRect.y + contentRect.height);
  if (right <= left || bottom <= top) return null;

  const sourceLeft = clamp(
    Math.floor((left - contentRect.x) * source.width / contentRect.width),
    0,
    source.width,
  );
  const sourceTop = clamp(
    Math.floor((top - contentRect.y) * source.height / contentRect.height),
    0,
    source.height,
  );
  const sourceRight = clamp(
    Math.ceil((right - contentRect.x) * source.width / contentRect.width),
    sourceLeft,
    source.width,
  );
  const sourceBottom = clamp(
    Math.ceil((bottom - contentRect.y) * source.height / contentRect.height),
    sourceTop,
    source.height,
  );

  return {
    left: sourceLeft,
    top: sourceTop,
    width: sourceRight - sourceLeft,
    height: sourceBottom - sourceTop,
  };
}

/** 将保存的源像素选区恢复为当前窗口尺寸下的显示坐标。 */
export function sourceRectToDisplayRect(
  sourceRect: SourceCropRect,
  contentRect: DisplayRect,
  source: Size,
): DisplayRect {
  return {
    x: contentRect.x + sourceRect.left * contentRect.width / source.width,
    y: contentRect.y + sourceRect.top * contentRect.height / source.height,
    width: sourceRect.width * contentRect.width / source.width,
    height: sourceRect.height * contentRect.height / source.height,
  };
}

/** 移动源像素选区，并把整个矩形收敛在图像边界内。 */
export function moveSourceRect(
  rect: SourceCropRect,
  dx: number,
  dy: number,
  source: Size,
): SourceCropRect {
  return {
    ...rect,
    left: clamp(rect.left + dx, 0, Math.max(0, source.width - rect.width)),
    top: clamp(rect.top + dy, 0, Math.max(0, source.height - rect.height)),
  };
}
