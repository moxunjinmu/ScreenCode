import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewClickController } from './previewClickController';

describe('预览点击意图', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('单击超过等待时间后只截图一次', () => {
    const capture = vi.fn();
    const controller = new PreviewClickController(300);

    controller.scheduleCapture(capture);
    vi.advanceTimersByTime(299);
    expect(capture).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(capture).toHaveBeenCalledOnce();
  });

  it('双击进入全屏时取消待执行截图', () => {
    const capture = vi.fn();
    const toggleFullscreen = vi.fn();
    const controller = new PreviewClickController(300);

    controller.scheduleCapture(capture);
    controller.toggleFullscreen(toggleFullscreen);
    vi.advanceTimersByTime(300);

    expect(toggleFullscreen).toHaveBeenCalledOnce();
    expect(capture).not.toHaveBeenCalled();
  });

  it('双击退出全屏时同样不截图', () => {
    const capture = vi.fn();
    const toggleFullscreen = vi.fn();
    const controller = new PreviewClickController(300);

    controller.scheduleCapture(capture);
    controller.toggleFullscreen(toggleFullscreen);
    controller.scheduleCapture(capture);
    controller.toggleFullscreen(toggleFullscreen);
    vi.runAllTimers();

    expect(toggleFullscreen).toHaveBeenCalledTimes(2);
    expect(capture).not.toHaveBeenCalled();
  });
});
