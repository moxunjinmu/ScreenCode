import { describe, expect, it } from 'vitest';
import {
  fitContainedSource,
  moveSourceRect,
  sourceRectToDisplayRect,
  displayRectToSourceRect,
} from './regionGeometry';

describe('区域截图坐标映射', () => {
  it('扣除上下留白后映射到源图整数像素', () => {
    const content = fitContainedSource(
      { width: 800, height: 600 },
      { width: 1920, height: 1080 },
    );

    expect(content).toEqual({ x: 0, y: 75, width: 800, height: 450 });
    expect(displayRectToSourceRect(
      { x: 100, y: 100, width: 200, height: 100 },
      content,
      { width: 1920, height: 1080 },
    )).toEqual({ left: 240, top: 60, width: 480, height: 240 });
  });

  it('选区越过黑边时收敛到有效源图范围', () => {
    const content = fitContainedSource(
      { width: 800, height: 600 },
      { width: 1920, height: 1080 },
    );

    expect(displayRectToSourceRect(
      { x: -20, y: 0, width: 900, height: 700 },
      content,
      { width: 1920, height: 1080 },
    )).toEqual({ left: 0, top: 0, width: 1920, height: 1080 });
  });

  it('源像素区域可以恢复到尺寸变化后的显示坐标', () => {
    const sourceRect = { left: 240, top: 60, width: 480, height: 240 };
    const content = fitContainedSource(
      { width: 1600, height: 900 },
      { width: 1920, height: 1080 },
    );

    expect(sourceRectToDisplayRect(sourceRect, content, { width: 1920, height: 1080 }))
      .toEqual({ x: 200, y: 50, width: 400, height: 200 });
  });

  it('键盘移动不会让源像素选区越界', () => {
    expect(moveSourceRect(
      { left: 5, top: 5, width: 100, height: 80 },
      -10,
      200,
      { width: 1920, height: 1080 },
    )).toEqual({ left: 0, top: 205, width: 100, height: 80 });
  });
});
