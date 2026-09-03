import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '@shared/types';
import { FullscreenToolbarVisibilityController } from './fullscreenToolbarVisibility';

describe('全屏截图菜单自动隐藏', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('默认关闭自动隐藏以保持现有行为', () => {
    expect(DEFAULT_CONFIG.fullscreenToolbarAutoHide).toBe(false);
  });

  it('开启后先显示，并在2.5秒无活动后隐藏', () => {
    const onVisibilityChange = vi.fn();
    const controller = new FullscreenToolbarVisibilityController(2_500, onVisibilityChange);

    controller.setAutoHideActive(true);
    expect(controller.visible).toBe(true);

    vi.advanceTimersByTime(2_499);
    expect(controller.visible).toBe(true);
    vi.advanceTimersByTime(1);

    expect(controller.visible).toBe(false);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('用户活动立即显示菜单并从最后一次活动重新计时', () => {
    const controller = new FullscreenToolbarVisibilityController(2_500, vi.fn());
    controller.setAutoHideActive(true);
    vi.advanceTimersByTime(2_500);

    controller.notifyActivity();
    expect(controller.visible).toBe(true);
    vi.advanceTimersByTime(2_499);
    expect(controller.visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(controller.visible).toBe(false);
  });

  it('悬停、键盘焦点或截图状态要求保持时不隐藏', () => {
    const controller = new FullscreenToolbarVisibilityController(2_500, vi.fn());
    controller.setAutoHideActive(true);
    controller.setHeldVisible(true);

    vi.advanceTimersByTime(10_000);
    expect(controller.visible).toBe(true);

    controller.setHeldVisible(false);
    vi.advanceTimersByTime(2_500);
    expect(controller.visible).toBe(false);
  });

  it('关闭自动隐藏或退出全屏时清理计时并恢复显示', () => {
    const controller = new FullscreenToolbarVisibilityController(2_500, vi.fn());
    controller.setAutoHideActive(true);
    vi.advanceTimersByTime(2_500);
    expect(controller.visible).toBe(false);

    controller.setAutoHideActive(false);
    expect(controller.visible).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(controller.visible).toBe(true);
  });

  it('销毁后不会再触发隐藏回调', () => {
    const onVisibilityChange = vi.fn();
    const controller = new FullscreenToolbarVisibilityController(2_500, onVisibilityChange);
    controller.setAutoHideActive(true);
    controller.dispose();
    onVisibilityChange.mockClear();

    vi.advanceTimersByTime(10_000);

    expect(onVisibilityChange).not.toHaveBeenCalled();
  });
});
