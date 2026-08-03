import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PANE_RATIO = 1 / 2.64;
const MIN_PANE_WIDTH = 360;
const MAX_PANE_RATIO = 0.48;
const KEYBOARD_RESIZE_STEP = 0.02;

/**
 * 通用右侧面板调宽逻辑。宽度使用容器比例保存，窗口缩放后仍保持合理布局。
 */
export function useResizablePane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paneRatio, setPaneRatio] = useState(DEFAULT_PANE_RATIO);
  const [isDragging, setIsDragging] = useState(false);

  const clampRatio = useCallback((nextRatio: number) => {
    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
    const minRatio = Math.min(MIN_PANE_WIDTH / containerWidth, MAX_PANE_RATIO);
    return Math.min(Math.max(nextRatio, minRatio), MAX_PANE_RATIO);
  }, []);

  const startDragging = useCallback(() => setIsDragging(true), []);
  const stopDragging = useCallback(() => setIsDragging(false), []);

  const resizeBy = useCallback((direction: -1 | 1) => {
    setPaneRatio((currentRatio) => clampRatio(currentRatio + direction * KEYBOARD_RESIZE_STEP));
  }, [clampRatio]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      setPaneRatio(clampRatio((rect.right - event.clientX) / rect.width));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragging);
    document.body.classList.add('is-resizing-pane');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      document.body.classList.remove('is-resizing-pane');
    };
  }, [clampRatio, isDragging, stopDragging]);

  return { containerRef, paneRatio, isDragging, startDragging, resizeBy };
}
