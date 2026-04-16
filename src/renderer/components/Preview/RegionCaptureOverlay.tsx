import React, { useCallback, useEffect, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useCaptureStore } from '../../store/captureStore';
import { useFrameStore } from '../../store/frameStore';
import { Frame } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface RegionCaptureOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onCapture?: (frame: Frame) => void;
}

const RegionCaptureOverlay: React.FC<RegionCaptureOverlayProps> = ({ videoRef, onCapture }) => {
  const { 
    isRegionCapture, 
    selectionRect, 
    isSelecting, 
    startSelection, 
    updateSelection, 
    endSelection,
    clearSelection 
  } = useUIStore();

  const { stream } = useCaptureStore();
  const { addFrame } = useFrameStore();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // 获取容器尺寸
  useEffect(() => {
    if (isRegionCapture && videoRef.current) {
      const rect = videoRef.current.getBoundingClientRect();
      setContainerRect(rect);
    }
  }, [isRegionCapture, videoRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isRegionCapture || !videoRef.current) return;
    
    const rect = videoRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startSelection(x, y);
  }, [isRegionCapture, videoRef, startSelection]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !videoRef.current) return;
    
    const rect = videoRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    updateSelection(x, y);
  }, [isSelecting, videoRef, updateSelection]);

  const handleMouseUp = useCallback(async () => {
    if (!isSelecting || !selectionRect || !videoRef.current || !stream) {
      clearSelection();
      return;
    }

    // 确保选择区域有足够大小
    if (selectionRect.width < 10 || selectionRect.height < 10) {
      clearSelection();
      return;
    }

    try {
      const video = videoRef.current;
      const containerRect = video.getBoundingClientRect();
      
      // 计算实际视频区域（考虑 object-contain 的缩放）
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      // 计算视频在容器中的实际显示区域
      const videoAspect = videoWidth / videoHeight;
      const containerAspect = containerWidth / containerHeight;
      
      let displayWidth, displayHeight, offsetX, offsetY;
      
      if (videoAspect > containerAspect) {
        // 视频更宽，以宽度为准
        displayWidth = containerWidth;
        displayHeight = containerWidth / videoAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayHeight) / 2;
      } else {
        // 视频更高，以高度为准
        displayHeight = containerHeight;
        displayWidth = containerHeight * videoAspect;
        offsetX = (containerWidth - displayWidth) / 2;
        offsetY = 0;
      }

      // 将选择区域转换为视频坐标
      const scaleX = videoWidth / displayWidth;
      const scaleY = videoHeight / displayHeight;
      
      const videoX = Math.round((selectionRect.x - offsetX) * scaleX);
      const videoY = Math.round((selectionRect.y - offsetY) * scaleY);
      const videoW = Math.round(selectionRect.width * scaleX);
      const videoH = Math.round(selectionRect.height * scaleY);

      // 创建 canvas 裁剪区域
      const canvas = document.createElement('canvas');
      canvas.width = videoW;
      canvas.height = videoH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        clearSelection();
        return;
      }

      // 从视频帧裁剪
      ctx.drawImage(
        video,
        Math.max(0, videoX),
        Math.max(0, videoY),
        Math.min(videoW, videoWidth - videoX),
        Math.min(videoH, videoHeight - videoY),
        0,
        0,
        videoW,
        videoH
      );

      // 转换为 base64
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

      // 创建帧对象
      const frame: Frame = {
        id: uuidv4(),
        timestamp: Date.now(),
        data: base64,
        type: 'new_scene',
        overlap: undefined
      };

      addFrame(frame);

      // 写入剪贴板
      await window.electronAPI.writeImageToClipboard(base64);

      onCapture?.(frame);
      
    } catch (error) {
      console.error('Region capture failed:', error);
    }

    clearSelection();
  }, [isSelecting, selectionRect, videoRef, stream, addFrame, clearSelection, onCapture]);

  if (!isRegionCapture) return null;

  return (
    <div
      className="absolute inset-0 z-20 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isSelecting) endSelection();
      }}
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 选择区域 */}
      {selectionRect && (
        <div
          className="absolute border-2 border-primary-500 bg-primary-500/10"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height
          }}
        >
          {/* 尺寸显示 */}
          {selectionRect.width > 50 && selectionRect.height > 30 && (
            <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 rounded text-xs text-white">
              {Math.round(selectionRect.width)} × {Math.round(selectionRect.height)}
            </div>
          )}
        </div>
      )}

      {/* 提示文字 */}
      {!isSelecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 rounded text-sm text-white">
          按住左键拖拽选择截图区域
        </div>
      )}
    </div>
  );
};

export default RegionCaptureOverlay;
