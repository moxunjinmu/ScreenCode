import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useFrameStore } from '../../store/frameStore';
import { electronAPI } from '../../lib/electronApi';
import { Frame } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface RegionCaptureOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onCapture?: (frame: Frame) => void;
}

/** 选区矩形 */
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
  if (nearLeft && nearTop) return 'nw';
  if (nearRight && nearBottom) return 'se';
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

/** 从视频帧裁剪指定区域，返回 base64（先截全帧再裁剪，确保可靠） */
function cropVideoRegion(video: HTMLVideoElement, rect: Rect): string | null {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  // 第一步：截取完整视频帧
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = videoWidth;
  fullCanvas.height = videoHeight;
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) return null;
  fullCtx.drawImage(video, 0, 0, videoWidth, videoHeight);

  // 第二步：计算 CSS 坐标 → 视频像素坐标
  const containerRect = video.getBoundingClientRect();
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerRect.width / containerRect.height;

  let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;
  if (videoAspect > containerAspect) {
    displayWidth = containerRect.width;
    displayHeight = containerRect.width / videoAspect;
    offsetX = 0;
    offsetY = (containerRect.height - displayHeight) / 2;
  } else {
    displayHeight = containerRect.height;
    displayWidth = containerRect.height * videoAspect;
    offsetX = (containerRect.width - displayWidth) / 2;
    offsetY = 0;
  }

  const scaleX = videoWidth / displayWidth;
  const scaleY = videoHeight / displayHeight;

  const vx = Math.max(0, Math.round((rect.x - offsetX) * scaleX));
  const vy = Math.max(0, Math.round((rect.y - offsetY) * scaleY));
  const vw = Math.min(Math.round(rect.width * scaleX), videoWidth - vx);
  const vh = Math.min(Math.round(rect.height * scaleY), videoHeight - vy);

  if (vw <= 0 || vh <= 0) return null;

  // 第三步：从全帧裁剪
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = vw;
  cropCanvas.height = vh;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) return null;

  cropCtx.drawImage(fullCanvas, vx, vy, vw, vh, 0, 0, vw, vh);

  return cropCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

const RegionCaptureOverlay: React.FC<RegionCaptureOverlayProps> = ({ videoRef, onCapture }) => {
  const { isRegionCapture, setRegionCapture } = useUIStore();
  const { addFrame } = useFrameStore();

  const [rect, setRect] = useState<Rect | null>(null);
  const [editState, setEditState] = useState<EditState>('idle');
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [cursor, setCursor] = useState('crosshair');

  const dragStartRef = useRef<{ x: number; y: number; rect: Rect } | null>(null);

  // 退出区域截图时清理状态
  useEffect(() => {
    if (!isRegionCapture) {
      setRect(null);
      setEditState('idle');
      setDragMode('none');
      setCursor('crosshair');
      dragStartRef.current = null;
    }
  }, [isRegionCapture]);

  // editing + 拖拽中：全局 mousemove / mouseup
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
        let newX = r.x, newY = r.y, newW = r.width, newH = r.height;

        if (dragMode === 'move') {
          newX = r.x + dx;
          newY = r.y + dy;
        } else {
          if (dragMode.includes('n')) { const d = Math.min(dy, r.height - MIN_SIZE); newY = r.y + d; newH = r.height - d; }
          if (dragMode.includes('s')) { newH = Math.max(MIN_SIZE, r.height + dy); }
          if (dragMode.includes('w')) { const d = Math.min(dx, r.width - MIN_SIZE); newX = r.x + d; newW = r.width - d; }
          if (dragMode.includes('e')) { newW = Math.max(MIN_SIZE, r.width + dx); }
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

  // selecting：全局 mousemove / mouseup
  useEffect(() => {
    if (editState !== 'selecting' || !videoRef.current) return;

    const handleGlobalMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !videoRef.current) return;
      const bounds = videoRef.current.getBoundingClientRect();
      const mx = e.clientX - bounds.left;
      const my = e.clientY - bounds.top;
      const { x: sx, y: sy } = dragStartRef.current;

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
      // 选区太小则丢弃，否则直接进入编辑模式
      setRect(prev => {
        if (!prev || prev.width < MIN_SIZE || prev.height < MIN_SIZE) return null;
        setEditState('editing');
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

  // overlay 鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isRegionCapture || !videoRef.current) return;
    e.preventDefault();

    const bounds = videoRef.current.getBoundingClientRect();
    const mx = e.clientX - bounds.left;
    const my = e.clientY - bounds.top;

    // editing 模式下 hitTest
    if (editState === 'editing' && rect) {
      const mode = hitTest(mx, my, rect);
      if (mode === 'none') {
        // 选区外重新画
        dragStartRef.current = { x: mx, y: my, rect: { x: mx, y: my, width: 0, height: 0 } };
        setRect({ x: mx, y: my, width: 0, height: 0 });
        setEditState('selecting');
        return;
      }
      dragStartRef.current = { x: e.clientX, y: e.clientY, rect: { ...rect } };
      setDragMode(mode);
      return;
    }

    // idle → 开始新选区
    dragStartRef.current = { x: mx, y: my, rect: { x: mx, y: my, width: 0, height: 0 } };
    setRect({ x: mx, y: my, width: 0, height: 0 });
    setEditState('selecting');
  }, [isRegionCapture, videoRef, editState, rect]);

  // 鼠标移动 → 更新光标
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!videoRef.current) return;
    if (editState !== 'editing' || !rect || dragMode !== 'none') {
      setCursor(editState === 'selecting' ? 'crosshair' : getCursor(dragMode));
      return;
    }
    const bounds = videoRef.current.getBoundingClientRect();
    const mode = hitTest(e.clientX - bounds.left, e.clientY - bounds.top, rect);
    setCursor(getCursor(mode));
  }, [videoRef, editState, rect, dragMode]);

  /** 确认保存 — 实时从 video 截取，不再依赖预捕获 */
  const handleConfirm = useCallback(() => {
    if (!rect || !videoRef.current) return;

    const base64 = cropVideoRegion(videoRef.current, rect);
    if (!base64) return;

    // 先退出区域截图模式（确保 UI 立即响应）
    setRect(null);
    setEditState('idle');
    setRegionCapture(false);

    // 再异步保存
    const frame: Frame = {
      id: uuidv4(),
      timestamp: Date.now(),
      data: base64,
      type: 'new_scene',
      overlap: undefined,
    };
    addFrame(frame);
    onCapture?.(frame);

    electronAPI.writeImageToClipboard(base64).catch((err: unknown) => {
      console.error('Clipboard write failed:', err);
    });
  }, [rect, videoRef, addFrame, setRegionCapture, onCapture]);

  /** 取消 */
  const handleCancel = useCallback(() => {
    setRect(null);
    setEditState('idle');
    setRegionCapture(false);
  }, [setRegionCapture]);

  if (!isRegionCapture) return null;

  const showButtons = editState === 'editing' && rect;
  const showHint = editState === 'idle' && !rect;

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
          {/* editing 状态下显示 8 个手柄 */}
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

          {/* 选择中显示尺寸 */}
          {editState !== 'editing' && rect.width > 50 && rect.height > 30 && (
            <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 rounded text-xs text-white">
              {Math.round(rect.width)} × {Math.round(rect.height)}
            </div>
          )}
        </div>
      )}

      {/* 确认 / 取消按钮（阻止 mousedown 冒泡，避免触发 overlay 的选区重置） */}
      {showButtons && (
        <div
          className="absolute flex items-center gap-1.5"
          style={{
            left: rect.x + rect.width / 2,
            top: rect.y + rect.height + 8,
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCancel}
            className="glass-btn-danger px-3 py-2 text-xs text-white"
            title="取消"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="glass-btn-success px-3 py-2 text-xs text-white"
            title="确认保存"
          >
            保存
          </button>
        </div>
      )}

      {/* 提示文字 */}
      {showHint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-strong text-sm text-white pointer-events-none">
          按住左键拖拽选择截图区域
        </div>
      )}
    </div>
  );
};

export default RegionCaptureOverlay;
