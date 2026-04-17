import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useCaptureStore } from '../../store/captureStore';
import { useFrameStore } from '../../store/frameStore';
import { Frame } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface RegionCaptureOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onCapture?: (frame: Frame) => void;
}

/** 暂存区域截图预览数据，待用户确认后再保存 */
interface PendingCapture {
  base64: string;
}

/** 选区矩形（组件内部使用） */
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 拖拽模式 */
type DragMode = 'none' | 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** 编辑状态 */
type EditState = 'idle' | 'selecting' | 'editing';

/** 边框感应区域宽度(px) */
const EDGE_THRESHOLD = 8;
/** 选区最小尺寸(px) */
const MIN_SIZE = 20;

/** 根据鼠标位置检测拖拽模式 */
function hitTest(mx: number, my: number, rect: Rect): DragMode {
  const { x, y, width, height } = rect;
  const r = x + width;
  const b = y + height;

  const nearLeft = Math.abs(mx - x) < EDGE_THRESHOLD;
  const nearRight = Math.abs(mx - r) < EDGE_THRESHOLD;
  const nearTop = Math.abs(my - y) < EDGE_THRESHOLD;
  const nearBottom = Math.abs(my - b) < EDGE_THRESHOLD;
  const insideX = mx >= x && mx <= r;
  const insideY = my >= y && my <= b;

  // 四角优先
  if ((nearLeft && nearTop) || (nearRight && nearBottom) && insideX && insideY) return nearLeft && nearTop ? 'nw' : 'se';
  if (nearLeft && nearBottom) return 'sw';
  if (nearRight && nearTop) return 'ne';

  // 四边
  if (nearTop && insideX) return 'n';
  if (nearBottom && insideX) return 's';
  if (nearLeft && insideY) return 'w';
  if (nearRight && insideY) return 'e';

  // 内部移动
  if (insideX && insideY) return 'move';

  return 'none';
}

/** 拖拽模式 → CSS cursor */
function getCursor(mode: DragMode): string {
  const map: Record<DragMode, string> = {
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
  return map[mode];
}

/** 从视频帧裁剪指定区域，返回 base64 */
function cropVideoRegion(
  video: HTMLVideoElement,
  rect: Rect
): string | null {
  const containerRect = video.getBoundingClientRect();
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;

  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;

  if (videoAspect > containerAspect) {
    displayWidth = containerWidth;
    displayHeight = containerWidth / videoAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayHeight) / 2;
  } else {
    displayHeight = containerHeight;
    displayWidth = containerHeight * videoAspect;
    offsetX = (containerWidth - displayWidth) / 2;
    offsetY = 0;
  }

  const scaleX = videoWidth / displayWidth;
  const scaleY = videoHeight / displayHeight;

  const vx = Math.round((rect.x - offsetX) * scaleX);
  const vy = Math.round((rect.y - offsetY) * scaleY);
  const vw = Math.round(rect.width * scaleX);
  const vh = Math.round(rect.height * scaleY);

  const canvas = document.createElement('canvas');
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(
    video,
    Math.max(0, vx),
    Math.max(0, vy),
    Math.min(vw, videoWidth - vx),
    Math.min(vh, videoHeight - vy),
    0, 0, vw, vh
  );

  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

const RegionCaptureOverlay: React.FC<RegionCaptureOverlayProps> = ({ videoRef, onCapture }) => {
  const { isRegionCapture, setRegionCapture } = useUIStore();
  const { stream } = useCaptureStore();
  const { addFrame } = useFrameStore();

  /** 选区矩形（完全由组件内部管理） */
  const [rect, setRect] = useState<Rect | null>(null);
  /** 编辑状态 */
  const [editState, setEditState] = useState<EditState>('idle');
  /** 拖拽模式 */
  const [dragMode, setDragMode] = useState<DragMode>('none');
  /** 待确认的截图数据 */
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  /** 当前光标 */
  const [cursor, setCursor] = useState('crosshair');

  /** 拖拽起始数据（ref 避免闭包问题） */
  const dragStartRef = useRef<{ x: number; y: number; rect: Rect } | null>(null);

  // ===== 退出区域截图时清理所有状态 =====
  useEffect(() => {
    if (!isRegionCapture) {
      setRect(null);
      setEditState('idle');
      setDragMode('none');
      setPendingCapture(null);
      setCursor('crosshair');
      dragStartRef.current = null;
    }
  }, [isRegionCapture]);

  // ===== 全局 mousemove / mouseup（拖拽移动和 resize） =====
  useEffect(() => {
    if (editState !== 'editing' || dragMode === 'none') return;

    const handleGlobalMove = (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      setRect(prev => {
        if (!prev) return prev;
        const r = start.rect;

        let newX = r.x;
        let newY = r.y;
        let newW = r.width;
        let newH = r.height;

        if (dragMode === 'move') {
          newX = r.x + dx;
          newY = r.y + dy;
        } else {
          // 调整北边
          if (dragMode.includes('n')) {
            const delta = Math.min(dy, r.height - MIN_SIZE);
            newY = r.y + delta;
            newH = r.height - delta;
          }
          // 调整南边
          if (dragMode.includes('s')) {
            newH = Math.max(MIN_SIZE, r.height + dy);
          }
          // 调整西边
          if (dragMode.includes('w')) {
            const delta = Math.min(dx, r.width - MIN_SIZE);
            newX = r.x + delta;
            newW = r.width - delta;
          }
          // 调整东边
          if (dragMode.includes('e')) {
            newW = Math.max(MIN_SIZE, r.width + dx);
          }
        }

        return { x: newX, y: newY, width: newW, height: newH };
      });
    };

    const handleGlobalUp = () => {
      dragStartRef.current = null;
      setDragMode('none');
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [editState, dragMode]);

  // ===== 拖拽选区阶段的全局事件 =====
  useEffect(() => {
    if (editState !== 'selecting' || !videoRef.current) return;

    const handleGlobalMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !videoRef.current) return;
      const video = videoRef.current;
      const bounds = video.getBoundingClientRect();
      const mx = e.clientX - bounds.left;
      const my = e.clientY - bounds.top;
      const sx = dragStartRef.current.x;
      const sy = dragStartRef.current.y;

      setRect({
        x: Math.min(sx, mx),
        y: Math.min(sy, my),
        width: Math.abs(mx - sx),
        height: Math.abs(my - sy),
      });
    };

    const handleGlobalUp = () => {
      if (!dragStartRef.current) return;
      dragStartRef.current = null;
      setEditState('idle');

      // 选区太小则丢弃
      setRect(prev => {
        if (!prev || prev.width < MIN_SIZE || prev.height < MIN_SIZE) return null;
        return prev;
      });
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [editState, videoRef]);

  // ===== 选区确定后自动裁剪并进入编辑模式 =====
  useEffect(() => {
    if (editState !== 'idle' || !rect || !videoRef.current || !stream) return;
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return;
    // 只在刚完成拖拽选择时触发（没有 pendingCapture 时）
    if (pendingCapture) return;

    const base64 = cropVideoRegion(videoRef.current, rect);
    if (base64) {
      setPendingCapture({ base64 });
      setEditState('editing');
    }
  }, [editState, rect, videoRef, stream, pendingCapture]);

  // ===== Overlay 上的鼠标按下 =====
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isRegionCapture || !videoRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const video = videoRef.current;
    const bounds = video.getBoundingClientRect();
    const mx = e.clientX - bounds.left;
    const my = e.clientY - bounds.top;

    // editing 模式下检查 hitTest
    if (editState === 'editing' && rect) {
      const mode = hitTest(mx, my, rect);

      if (mode === 'none') {
        // 在选区外重新画选区
        setPendingCapture(null);
        dragStartRef.current = { x: mx, y: my, rect: { x: mx, y: my, width: 0, height: 0 } };
        setRect({ x: mx, y: my, width: 0, height: 0 });
        setEditState('selecting');
        return;
      }

      // 移动或 resize
      dragStartRef.current = { x: e.clientX, y: e.clientY, rect: { ...rect } };
      setDragMode(mode);
      return;
    }

    // idle 模式 — 开始新选区
    dragStartRef.current = { x: mx, y: my, rect: { x: mx, y: my, width: 0, height: 0 } };
    setRect({ x: mx, y: my, width: 0, height: 0 });
    setEditState('selecting');
    setPendingCapture(null);
  }, [isRegionCapture, videoRef, editState, rect]);

  // ===== 鼠标移动 — 更新光标 =====
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!videoRef.current) return;
    if (editState !== 'editing' || !rect || dragMode !== 'none') {
      setCursor(editState === 'selecting' ? 'crosshair' : getCursor(dragMode));
      return;
    }

    const bounds = videoRef.current.getBoundingClientRect();
    const mx = e.clientX - bounds.left;
    const my = e.clientY - bounds.top;
    const mode = hitTest(mx, my, rect);
    setCursor(getCursor(mode));
  }, [videoRef, editState, rect, dragMode]);

  // ===== 确认保存 =====
  const handleConfirm = useCallback(async () => {
    if (!pendingCapture) return;

    try {
      const frame: Frame = {
        id: uuidv4(),
        timestamp: Date.now(),
        data: pendingCapture.base64,
        type: 'new_scene',
        overlap: undefined,
      };
      addFrame(frame);
      await window.electronAPI.writeImageToClipboard(pendingCapture.base64);
      onCapture?.(frame);
    } catch (error) {
      console.error('Save region capture failed:', error);
    }

    setPendingCapture(null);
    setRect(null);
    setEditState('idle');
    setRegionCapture(false);
  }, [pendingCapture, addFrame, setRegionCapture, onCapture]);

  // ===== 取消 =====
  const handleCancel = useCallback(() => {
    setPendingCapture(null);
    setRect(null);
    setEditState('idle');
    setRegionCapture(false);
  }, [setRegionCapture]);

  // ===== 重新截图（editing 模式下 resize/move 后需要重新裁剪） =====
  const handleRecapture = useCallback(() => {
    if (!rect || !videoRef.current || !stream) return;
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return;
    const base64 = cropVideoRegion(videoRef.current, rect);
    if (base64) {
      setPendingCapture({ base64 });
    }
  }, [rect, videoRef, stream]);

  if (!isRegionCapture) return null;

  const showButtons = editState === 'editing' && pendingCapture && rect;
  const showHint = editState === 'idle' && !rect && !pendingCapture;

  return (
    <div
      className="absolute inset-0 z-20"
      style={{ cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 选区 */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          className="absolute border-2 border-red-500"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            backgroundColor: editState === 'editing' ? 'transparent' : 'rgba(239,68,68,0.08)',
          }}
        >
          {/* editing 状态下显示四角手柄 */}
          {editState === 'editing' && (
            <>
              {/* 四个角手柄 */}
              <span className="absolute -top-[4px] -left-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -top-[4px] -right-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -bottom-[4px] -left-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -bottom-[4px] -right-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              {/* 四个边中点手柄 */}
              <span className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute top-1/2 -translate-y-1/2 -left-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
              <span className="absolute top-1/2 -translate-y-1/2 -right-[4px] w-2 h-2 bg-white border border-red-500 rounded-sm" />
            </>
          )}

          {/* 选择中显示尺寸 */}
          {editState !== 'editing' && rect.width > 50 && rect.height > 30 && (
            <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 rounded text-xs text-white">
              {Math.round(rect.width)} × {Math.round(rect.height)}
            </div>
          )}
        </div>
      )}

      {/* 确认 / 取消 + 重新截图按钮 */}
      {showButtons && rect && (
        <div
          className="absolute flex items-center gap-1.5"
          style={{
            left: rect.x + rect.width / 2 - 78,
            top: rect.y + rect.height + 8,
          }}
        >
          <button
            onClick={handleCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-red-600/90 hover:bg-red-500 transition-colors text-white text-lg shadow-lg"
            title="取消"
          >
            ✕
          </button>
          <button
            onClick={handleRecapture}
            className="h-9 px-3 flex items-center justify-center rounded-full bg-blue-600/90 hover:bg-blue-500 transition-colors text-white text-xs shadow-lg"
            title="重新截取当前区域"
          >
            重截
          </button>
          <button
            onClick={handleConfirm}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-green-600/90 hover:bg-green-500 transition-colors text-white text-lg shadow-lg"
            title="确认保存"
          >
            ✓
          </button>
        </div>
      )}

      {/* 提示文字 */}
      {showHint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 rounded text-sm text-white pointer-events-none">
          按住左键拖拽选择截图区域
        </div>
      )}
    </div>
  );
};

export default RegionCaptureOverlay;
