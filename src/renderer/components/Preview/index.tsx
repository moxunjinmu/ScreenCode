import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCaptureStore } from '../../store/captureStore';
import { useUIStore } from '../../store/uiStore';
import { useFrameStore } from '../../store/frameStore';
import { Frame } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import RegionCaptureOverlay from './RegionCaptureOverlay';

interface PreviewProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

// 防抖延迟（ms），低于此时间内的双击会取消之前的单击截图
const CAPTURE_DEBOUNCE_MS = 300;

const Preview: React.FC<PreviewProps> = ({ isFullscreen = false, onToggleFullscreen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    devices,
    selectedDeviceId,
    selectedDeviceType,
    selectDevice,
    isCapturing,
    stream,
    startCapture,
    stopCapture,
    captureFrame
  } = useCaptureStore();

  const { isRegionCapture, setRegionCapture, isFullscreenPreview, setFullscreenPreview } = useUIStore();
  const { addFrame, frames } = useFrameStore();

  // 当选择设备后自动开始捕获
  useEffect(() => {
    const startVideoStream = async () => {
      if (!selectedDeviceId || !videoRef.current) return;

      setIsLoading(true);
      setError(null);

      try {
        if (selectedDeviceType === 'videoinput') {
          // 启动视频捕获
          await startCapture();

          // 等待 stream 更新
          const checkStream = setInterval(() => {
            const currentStream = useCaptureStore.getState().stream;
            if (currentStream && videoRef.current) {
              videoRef.current.srcObject = currentStream;
              clearInterval(checkStream);
              setIsLoading(false);
            }
          }, 100);

          // 超时处理
          setTimeout(() => {
            clearInterval(checkStream);
            setIsLoading(false);
          }, 5000);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '启动视频捕获失败';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    startVideoStream();

    return () => {
      // 清理
    };
  }, [selectedDeviceId, selectedDeviceType, startCapture]);

  // 组件卸载时停止捕获
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // 绑定视频流到 video 元素
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // 监听快捷键 - 区域截图
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + R 进入区域截图模式
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setRegionCapture(!isRegionCapture);
      }
      // ESC 退出区域截图模式或全屏模式
      if (e.key === 'Escape') {
        if (isRegionCapture) {
          setRegionCapture(false);
        } else if (isFullscreenPreview) {
          setFullscreenPreview(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRegionCapture, setRegionCapture, isFullscreenPreview, setFullscreenPreview]);

  const handleDeviceChange = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setError(null);
      await selectDevice(deviceId, device.type);
    }
  };

  const handleStartStop = async () => {
    if (isCapturing) {
      await stopCapture();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } else if (selectedDeviceId) {
      setIsLoading(true);
      try {
        await startCapture();
      } catch (err) {
        setError(err instanceof Error ? err.message : '启动失败');
      }
      setIsLoading(false);
    }
  };

  // 单击截图（带防抖，避免双击时误触发）
  const handleCaptureFrame = useCallback(async () => {
    if (!stream) return;

    // 清除之前的防抖定时器
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
      return; // 双击时直接取消之前的单击截图
    }

    // 设置防抖定时器，如果在 CAPTURE_DEBOUNCE_MS 内发生双击会被清除
    captureTimerRef.current = setTimeout(async () => {
      captureTimerRef.current = null;
      try {
        const base64Frame = await captureFrame();
        if (!base64Frame) return;

        const frame: Frame = {
          id: uuidv4(),
          timestamp: Date.now(),
          data: base64Frame,
          type: 'new_scene',
          overlap: undefined
        };

        addFrame(frame);
      } catch (error) {
        console.error('Capture frame error:', error);
      }
    }, CAPTURE_DEBOUNCE_MS);
  }, [stream, captureFrame, addFrame]);

  // 双击进入/退出全屏
  const handleDoubleClick = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setFullscreenPreview(!isFullscreenPreview);
    }
  };

  // 区域截图完成回调
  const handleRegionCapture = useCallback((frame: Frame) => {
    setRegionCapture(false);
  }, [setRegionCapture]);

  return (
    <div ref={containerRef} className={`h-full flex flex-col ${isFullscreen ? '' : ''}`}>
      {/* 设备选择器 - 全屏模式下隐藏 */}
      {!isFullscreen && (
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm text-gray-400">设备:</label>
          <select
            value={selectedDeviceId || ''}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-primary-500 min-w-[200px]"
          >
            <option value="">选择设备...</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>

          {isCapturing && (
            <span className="px-2 py-1 bg-green-600 text-xs rounded animate-pulse">
              ● 采集中
            </span>
          )}

          {isLoading && (
            <span className="px-2 py-1 bg-yellow-600 text-xs rounded">
              加载中...
            </span>
          )}

          {selectedDeviceId && (
            <button
              onClick={handleStartStop}
              className={`px-3 py-1 text-xs rounded transition-colors ${isCapturing
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-primary-600 hover:bg-primary-700'
                }`}
            >
              {isCapturing ? '停止' : '开始'}
            </button>
          )}

          {/* 区域截图按钮 */}
          {stream && (
            <button
              onClick={() => setRegionCapture(!isRegionCapture)}
              className={`px-3 py-1 text-xs rounded transition-colors ${isRegionCapture
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-gray-700 hover:bg-gray-600'
                }`}
              title="快捷键: Ctrl+Shift+R"
            >
              {isRegionCapture ? '取消选择' : '区域截图'}
            </button>
          )}
        </div>
      )}

      {/* 视频预览 */}
      <div
        className={`flex-1 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center relative ${isFullscreen ? 'rounded-none' : ''}`}
        onDoubleClick={handleDoubleClick}
      >
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="text-center">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-sm text-gray-400 hover:text-white"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-contain ${isRegionCapture ? 'cursor-crosshair' : 'cursor-pointer'}`}
              onClick={(e) => {
                // 如果不在区域截图模式，单击截图
                if (!isRegionCapture && e.detail === 1) {
                  handleCaptureFrame();
                }
              }}
            />

            {/* 区域截图覆盖层 */}
            <RegionCaptureOverlay
              videoRef={videoRef}
              onCapture={handleRegionCapture}
            />
          </>
        ) : (
          <div className="text-gray-500 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="mb-2">请选择视频采集设备</p>
            <p className="text-xs">支持 USB 采集卡或屏幕录制</p>
            <p className="text-xs mt-2 text-gray-600">选择设备后将自动开始预览</p>
          </div>
        )}

        {/* 全屏模式下的工具栏 */}
        {isFullscreen && stream && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/70 rounded-lg">
            <button
              onClick={() => setRegionCapture(!isRegionCapture)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${isRegionCapture
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-gray-700 hover:bg-gray-600'
                }`}
            >
              {isRegionCapture ? '取消选择' : '区域截图'}
            </button>
            <button
              onClick={handleCaptureFrame}
              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              全屏截图
            </button>
            <button
              onClick={handleDoubleClick}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              退出全屏
            </button>
          </div>
        )}
      </div>

      {/* 全屏模式提示 */}
      {isFullscreen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 rounded text-xs text-gray-300">
          双击视频退出全屏 | ESC 退出 | 单击截图 | Ctrl+Shift+R 区域截图
        </div>
      )}
    </div>
  );
};

export default Preview;
