import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PANE_RATIO = 1 / 2.64;
const MIN_PANE_WIDTH = 360;
const MAX_PANE_RATIO = 0.48;
const KEYBOARD_RESIZE_STEP = 0.02;
// 拖过最小宽度后继续拖这么多像素，面板自动收起
const COLLAPSE_OVERSHOOT = 72;

/**
 * 通用右侧面板调宽逻辑。宽度使用容器比例保存，窗口缩放后仍保持合理布局。
 * 拖到最小宽度后继续往窄拖，触发 onCollapse 收起面板。
 */
export function useResizablePane(onCollapse?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paneRatio, setPaneRatio] = useState(DEFAULT_PANE_RATIO);
  const [isDragging, setIsDragging] = useState(false);

  const getMinRatio = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
    return Math.min(MIN_PANE_WIDTH / containerWidth, MAX_PANE_RATIO);
  }, []);

  const clampRatio = useCallback((nextRatio: number) => {
    return Math.min(Math.max(nextRatio, getMinRatio()), MAX_PANE_RATIO);
  }, [getMinRatio]);

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
      const rawRatio = (rect.right - event.clientX) / rect.width;

      // 拖过最小宽度并继续超出阈值：收起面板并结束拖拽。
      // 过渡由 CSS 保证（data-resizing 的 transition: none 对 is-collapsed 例外）
      if (onCollapse && rawRatio < getMinRatio() - COLLAPSE_OVERSHOOT / rect.width) {
        stopDragging();
        onCollapse();
        return;
      }

      setPaneRatio(clampRatio(rawRatio));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragging);
    document.body.classList.add('is-resizing-pane');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      document.body.classList.remove('is-resizing-pane');
    };
  }, [clampRatio, getMinRatio, isDragging, onCollapse, stopDragging]);

  return { containerRef, paneRatio, isDragging, startDragging, resizeBy };
}
