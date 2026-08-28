import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toImageDataUrl } from '@shared/imageQuality';
import type { EncodedImage, Frame, SourceCropRect } from '@shared/types';
import { electronAPI } from '../../lib/electronApi';
import { useFrameStore } from '../../store/frameStore';
import { useUIStore } from '../../store/uiStore';
import {
  displayRectToSourceRect,
  fitContainedSource,
  moveSourceRect,
  sourceRectToDisplayRect,
  type DisplayRect,
} from '../../capture/regionGeometry';
import { getRegionKeyboardAction } from '../../capture/regionKeyboard';

interface RegionCaptureOverlayProps {
  sourceImage: EncodedImage;
  sourceKind: 'yuy2' | 'preview';
  onCapture?: (frame: Frame) => void;
  onCancel?: () => void;
}

type DragMode = 'none' | 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type EditState = 'idle' | 'selecting' | 'editing';

const EDGE_THRESHOLD = 8;
const MIN_SOURCE_SIZE = 1;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hitTest(mx: number, my: number, rect: DisplayRect): DragMode {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const nearLeft = Math.abs(mx - rect.x) < EDGE_THRESHOLD;
  const nearRight = Math.abs(mx - right) < EDGE_THRESHOLD;
  const nearTop = Math.abs(my - rect.y) < EDGE_THRESHOLD;
  const nearBottom = Math.abs(my - bottom) < EDGE_THRESHOLD;
  const insideX = mx >= rect.x && mx <= right;
  const insideY = my >= rect.y && my <= bottom;

  if (nearLeft && nearTop) return 'nw';
  if (nearRight && nearBottom) return 'se';
  if (nearLeft && nearBottom) return 'sw';
  if (nearRight && nearTop) return 'ne';
  if (nearTop && insideX) return 'n';
  if (nearBottom && insideX) return 's';
  if (nearLeft && insideY) return 'w';
  if (nearRight && insideY) return 'e';
  return insideX && insideY ? 'move' : 'none';
}

function getCursor(mode: DragMode): string {
  const cursors: Record<DragMode, string> = {
    none: 'crosshair',
    move: 'move',
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    ne: 'nesw-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
    sw: 'nesw-resize',
  };
  return cursors[mode];
}

function resizeSourceRect(
  start: SourceCropRect,
  mode: DragMode,
  dx: number,
  dy: number,
  sourceWidth: number,
  sourceHeight: number,
): SourceCropRect {
  if (mode === 'move') {
    return moveSourceRect(start, dx, dy, { width: sourceWidth, height: sourceHeight });
  }

  let left = start.left;
  let top = start.top;
  let right = start.left + start.width;
  let bottom = start.top + start.height;
  if (mode.includes('w')) left = clamp(left + dx, 0, right - MIN_SOURCE_SIZE);
  if (mode.includes('e')) right = clamp(right + dx, left + MIN_SOURCE_SIZE, sourceWidth);
  if (mode.includes('n')) top = clamp(top + dy, 0, bottom - MIN_SOURCE_SIZE);
  if (mode.includes('s')) bottom = clamp(bottom + dy, top + MIN_SOURCE_SIZE, sourceHeight);
  return { left, top, width: right - left, height: bottom - top };
}

const RegionCaptureOverlay: React.FC<RegionCaptureOverlayProps> = ({
  sourceImage,
  sourceKind,
  onCapture,
  onCancel,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastRegionRef = useRef<SourceCropRect | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    sourceRect: SourceCropRect;
    displayX: number;
    displayY: number;
  } | null>(null);
  const { isRegionCapture, setRegionCapture } = useUIStore();
  const { addFrame } = useFrameStore();
  const [sourceRect, setSourceRect] = useState<SourceCropRect | null>(null);
  const [editState, setEditState] = useState<EditState>('idle');
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [cursor, setCursor] = useState('crosshair');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLayoutRevision] = useState(0);

  const sourceSize = useMemo(() => ({
    width: sourceImage.width ?? 0,
    height: sourceImage.height ?? 0,
  }), [sourceImage.height, sourceImage.width]);

  const getContentRect = useCallback((): DisplayRect | null => {
    const overlay = overlayRef.current;
    if (!overlay || sourceSize.width <= 0 || sourceSize.height <= 0) return null;
    return fitContainedSource(
      { width: overlay.clientWidth, height: overlay.clientHeight },
      sourceSize,
    );
  }, [sourceSize]);

  const getDisplayRect = useCallback((rect: SourceCropRect): DisplayRect | null => {
    const content = getContentRect();
    return content ? sourceRectToDisplayRect(rect, content, sourceSize) : null;
  }, [getContentRect, sourceSize]);

  const cancel = useCallback(() => {
    setSourceRect(null);
    setEditState('idle');
    setError(null);
    setRegionCapture(false);
    onCancel?.();
  }, [onCancel, setRegionCapture]);

  const confirm = useCallback(async () => {
    if (!sourceRect || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const config = await electronAPI.getConfig();
      const image = await electronAPI.processCapturedImage({
        image: sourceImage,
        crop: sourceRect,
        quality: config.aiImageQuality,
      });
      const frame: Frame = {
        id: uuidv4(),
        timestamp: Date.now(),
        ...image,
        type: 'new_scene',
        overlap: undefined,
      };
      lastRegionRef.current = sourceRect;
      addFrame(frame);
      await electronAPI.writeImageToClipboard(image);
      setRegionCapture(false);
      onCapture?.(frame);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : '区域截图处理失败');
    } finally {
      setIsSaving(false);
    }
  }, [addFrame, isSaving, onCapture, setRegionCapture, sourceImage, sourceRect]);

  const restoreLastRegion = useCallback(() => {
    const previous = lastRegionRef.current;
    if (!previous) return;
    const width = Math.min(previous.width, sourceSize.width);
    const height = Math.min(previous.height, sourceSize.height);
    setSourceRect(moveSourceRect(
      { ...previous, width, height },
      0,
      0,
      sourceSize,
    ));
    setEditState('editing');
  }, [sourceSize]);

  useEffect(() => {
    if (!isRegionCapture) {
      setSourceRect(null);
      setEditState('idle');
      setDragMode('none');
      setCursor('crosshair');
      setError(null);
      dragStartRef.current = null;
    }
  }, [isRegionCapture]);

  useEffect(() => {
    if (!isRegionCapture) return;
    const overlay = overlayRef.current;
    if (!overlay || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setLayoutRevision((revision) => revision + 1));
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [isRegionCapture]);

  useEffect(() => {
    if (!isRegionCapture) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getRegionKeyboardAction(event);
      if (!action) return;
      event.preventDefault();
      if (action.type === 'cancel') cancel();
      if (action.type === 'confirm') void confirm();
      if (action.type === 'restore-last') restoreLastRegion();
      if (action.type === 'move') {
        setSourceRect((current) => current
          ? moveSourceRect(current, action.dx, action.dy, sourceSize)
          : current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancel, confirm, isRegionCapture, restoreLastRegion, sourceSize]);

  useEffect(() => {
    if (!isRegionCapture || dragMode === 'none') return;
    const handleMove = (event: MouseEvent) => {
      const start = dragStartRef.current;
      const content = getContentRect();
      if (!start || !content) return;
      const dx = Math.round((event.clientX - start.clientX) * sourceSize.width / content.width);
      const dy = Math.round((event.clientY - start.clientY) * sourceSize.height / content.height);
      setSourceRect(resizeSourceRect(
        start.sourceRect,
        dragMode,
        dx,
        dy,
        sourceSize.width,
        sourceSize.height,
      ));
    };
    const handleUp = () => {
      dragStartRef.current = null;
      setDragMode('none');
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragMode, getContentRect, isRegionCapture, sourceSize]);

  useEffect(() => {
    if (!isRegionCapture || editState !== 'selecting') return;
    const handleMove = (event: MouseEvent) => {
      const start = dragStartRef.current;
      const overlay = overlayRef.current;
      const content = getContentRect();
      if (!start || !overlay || !content) return;
      const bounds = overlay.getBoundingClientRect();
      const currentX = clamp(event.clientX - bounds.left, content.x, content.x + content.width);
      const currentY = clamp(event.clientY - bounds.top, content.y, content.y + content.height);
      const displayRect = {
        x: Math.min(start.displayX, currentX),
        y: Math.min(start.displayY, currentY),
        width: Math.abs(currentX - start.displayX),
        height: Math.abs(currentY - start.displayY),
      };
      setSourceRect(displayRectToSourceRect(displayRect, content, sourceSize));
    };
    const handleUp = () => {
      dragStartRef.current = null;
      setSourceRect((current) => {
        if (current) setEditState('editing');
        return current;
      });
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [editState, getContentRect, isRegionCapture, sourceSize]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const overlay = overlayRef.current;
    const content = getContentRect();
    if (!overlay || !content || isSaving) return;
    event.preventDefault();
    const bounds = overlay.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < content.x || x > content.x + content.width || y < content.y || y > content.y + content.height) {
      return;
    }

    if (editState === 'editing' && sourceRect) {
      const displayRect = getDisplayRect(sourceRect);
      if (displayRect) {
        const mode = hitTest(x, y, displayRect);
        if (mode !== 'none') {
          dragStartRef.current = {
            clientX: event.clientX,
            clientY: event.clientY,
            sourceRect,
            displayX: x,
            displayY: y,
          };
          setDragMode(mode);
          return;
        }
      }
    }

    dragStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      sourceRect: { left: 0, top: 0, width: 1, height: 1 },
      displayX: x,
      displayY: y,
    };
    setSourceRect(null);
    setEditState('selecting');
  }, [editState, getContentRect, getDisplayRect, isSaving, sourceRect]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (editState !== 'editing' || !sourceRect || dragMode !== 'none') {
      setCursor(editState === 'selecting' ? 'crosshair' : getCursor(dragMode));
      return;
    }
    const overlay = overlayRef.current;
    const displayRect = getDisplayRect(sourceRect);
    if (!overlay || !displayRect) return;
    const bounds = overlay.getBoundingClientRect();
    setCursor(getCursor(hitTest(event.clientX - bounds.left, event.clientY - bounds.top, displayRect)));
  }, [dragMode, editState, getDisplayRect, sourceRect]);

  if (!isRegionCapture) return null;
  const displayRect = sourceRect ? getDisplayRect(sourceRect) : null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20 overflow-hidden bg-black"
      style={{ cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <img
        src={toImageDataUrl(sourceImage)}
        alt="冻结的区域截图源图"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />
      {!displayRect && <div className="absolute inset-0 bg-black/35 pointer-events-none" />}

      {displayRect && displayRect.width > 0 && displayRect.height > 0 && (
        <div
          className="absolute border-2 border-red-500"
          style={{
            left: displayRect.x,
            top: displayRect.y,
            width: displayRect.width,
            height: displayRect.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
          }}
        >
          {editState === 'editing' && (
            <>
              <span className="absolute -top-[4px] -left-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -top-[4px] -right-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -bottom-[4px] -left-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -bottom-[4px] -right-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute top-1/2 -translate-y-1/2 -left-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute top-1/2 -translate-y-1/2 -right-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
            </>
          )}
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 rounded-sm text-xs text-white whitespace-nowrap">
            x {sourceRect?.left} · y {sourceRect?.top} · {sourceRect?.width} × {sourceRect?.height}
          </div>
        </div>
      )}

      {displayRect && editState === 'editing' && (
        <div
          className="absolute flex items-center gap-1.5"
          style={{
            left: displayRect.x + displayRect.width / 2,
            top: Math.min(displayRect.y + displayRect.height + 8, (overlayRef.current?.clientHeight ?? 0) - 38),
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button onClick={cancel} className="btn-danger px-3 py-1.5 text-xs" disabled={isSaving}>
            取消
          </button>
          <button onClick={() => void confirm()} className="btn-success px-3 py-1.5 text-xs" disabled={isSaving}>
            {isSaving ? '处理中…' : '保存'}
          </button>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 overlay text-sm pointer-events-none whitespace-nowrap">
        {sourceKind === 'yuy2' ? 'YUY2 无损冻结帧' : '预览帧降级模式'} · 拖拽选择 · 方向键 1px · Shift 10px · Enter 保存 · Esc 取消 · R 上次区域
      </div>
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 bg-red-950/90 text-red-100 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default RegionCaptureOverlay;
