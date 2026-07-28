import { useState, useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '../store/uiStore';

/** 面板宽度约束 */
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 320;
/** 拖到此宽度以下即视为收起面板 */
const CLOSE_THRESHOLD = 240;
/** 最大宽度占容器比例 */
const MAX_WIDTH_RATIO = 0.42;

/**
 * 聊天面板的拖拽调宽。
 * 拖到阈值以下自动收起面板，并把宽度复位到最小值供下次打开使用。
 */
export function useChatPanelResize() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const setChatPanelOpen = useUIStore((state) => state.setChatPanelOpen);

  const startDragging = useCallback(() => setIsDragging(true), []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;

    if (newWidth < CLOSE_THRESHOLD) {
      setChatPanelOpen(false);
      setWidth(MIN_WIDTH);
      setIsDragging(false);
      return;
    }

    const maxWidth = containerRect.width * MAX_WIDTH_RATIO;
    setWidth(Math.min(Math.max(newWidth, MIN_WIDTH), maxWidth));
  }, [setChatPanelOpen]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { containerRef, width, isDragging, startDragging };
}
