import { describe, expect, it } from 'vitest';
import { getRegionKeyboardAction } from './regionKeyboard';

describe('区域截图键盘操作', () => {
  it('方向键移动 1px，Shift 加速为 10px', () => {
    expect(getRegionKeyboardAction({ key: 'ArrowLeft', shiftKey: false }))
      .toEqual({ type: 'move', dx: -1, dy: 0 });
    expect(getRegionKeyboardAction({ key: 'ArrowDown', shiftKey: true }))
      .toEqual({ type: 'move', dx: 0, dy: 10 });
  });

  it('Enter、Escape 和 R 分别映射到保存、取消与上次区域', () => {
    expect(getRegionKeyboardAction({ key: 'Enter', shiftKey: false })).toEqual({ type: 'confirm' });
    expect(getRegionKeyboardAction({ key: 'Escape', shiftKey: false })).toEqual({ type: 'cancel' });
    expect(getRegionKeyboardAction({ key: 'r', shiftKey: false })).toEqual({ type: 'restore-last' });
  });

  it('不处理无关按键', () => {
    expect(getRegionKeyboardAction({ key: 'a', shiftKey: false })).toBeNull();
  });
});
