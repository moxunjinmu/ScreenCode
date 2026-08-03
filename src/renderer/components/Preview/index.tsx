import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Crop, Maximize2, Minimize2 } from 'lucide-react';
import { useCaptureStore } from '../../store/captureStore';
import { useUIStore } from '../../store/uiStore';
import { useFrameStore } from '../../store/frameStore';
import { electronAPI } from '../../lib/electronApi';
import { Frame, DisplayResolution, PRESET_RESOLUTIONS, PRESET_SCALES } from '@shared/types';
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
    captureFrame,
    setVideoElement
  } = useCaptureStore();

  const { isRegionCapture, setRegionCapture, isFullscreenPreview, setFullscreenPreview, displayResolution, setDisplayResolution } = useUIStore();
  const { addFrame } = useFrameStore();

  // 视频源分辨率状态
  const [sourceResolution, setSourceResolution] = useState<{ width: number; height: number } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('source');  // 'source' 或分辨率索引
  const [selectedScale, setSelectedScale] = useState<number>(1.0);

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

  // 将预览 video 注册到 store，供全局热键截图直接复用（避免另建临时 video）
  useEffect(() => {
    setVideoElement(videoRef.current);
    return () => setVideoElement(null);
  }, [stream, setVideoElement]);

  // 检测视频源分辨率
  useEffect(() => {
    if (!videoRef.current || !stream) return;

    const video = videoRef.current;
    const handleLoadedMetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width && height) {
        setSourceResolution({ width, height });
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    // 如果已经加载过元数据
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [stream]);

  // 分辨率或缩放变化时更新显示
  useEffect(() => {
    if (!videoRef.current) return;

    const baseRes = selectedPreset === 'source' && sourceResolution
      ? sourceResolution
      : selectedPreset !== 'source'
        ? PRESET_RESOLUTIONS[parseInt(selectedPreset)] || sourceResolution
        : sourceResolution;

    if (baseRes) {
      const displayRes: DisplayResolution = {
        width: Math.round(baseRes.width * selectedScale),
        height: Math.round(baseRes.height * selectedScale),
        scale: selectedScale,
      };
      setDisplayResolution(displayRes);
    }
  }, [selectedPreset, selectedScale, sourceResolution, setDisplayResolution]);

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

        // 写入剪贴板
        await electronAPI.writeImageToClipboard(base64Frame);
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
  const handleRegionCapture = useCallback(() => {
    setRegionCapture(false);
  }, [setRegionCapture]);

  const displayText = displayResolution
    ? `${displayResolution.width} × ${displayResolution.height}`
    : sourceResolution
      ? `${sourceResolution.width} × ${sourceResolution.height}`
      : '跟随源分辨率';

  return (
    <div className={`preview-workspace h-full min-h-0 flex flex-col relative${isFullscreen ? ' is-fullscreen' : ''}`}>
      {!isFullscreen && (
        <div className="capture-toolbar">
          <div className="capture-toolbar-head">
            <h2 className="panel-title">实时预览</h2>
          </div>

          <div className="capture-control-row">
            <div className="capture-controls">
              <select
                value={selectedDeviceId || ''}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="input capture-device-select px-2 py-1 text-sm"
                title="采集设备"
              >
                <option value="">选择设备...</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>

              {selectedDeviceId && (
                <button
                  onClick={handleStartStop}
                  className="btn px-3 py-1 text-sm"
                >
                  {isCapturing ? '暂停预览' : '恢复预览'}
                </button>
              )}

              {isLoading && (
                <span className="chip">正在连接设备...</span>
              )}

              {stream && (
                <>
                  <button
                    onClick={handleCaptureFrame}
                    className="btn px-3 py-1 text-sm"
                    title="快捷键: Ctrl+Shift+S"
                  >
                    <Camera size={14} />
                    截取整帧
                  </button>
                  <button
                    onClick={() => setRegionCapture(!isRegionCapture)}
                    className={`${isRegionCapture ? 'btn-primary' : 'btn'} px-3 py-1 text-sm`}
                    title="快捷键: Ctrl+Shift+R"
                  >
                    <Crop size={14} />
                    {isRegionCapture ? '取消区域截取' : '区域截取'}
                  </button>
                  <button
                    onClick={handleDoubleClick}
                    className="btn p-1"
                    title="全屏预览"
                  >
                    <Maximize2 size={14} />
                  </button>
                </>
              )}
            </div>

            {stream && sourceResolution && (
              <div className="capture-toolbar-secondary">
                <span className="capture-resolution-state">显示 {displayText}</span>

                <label className="text-sm text-muted">分辨率</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="input capture-resolution-select px-2 py-1 text-sm"
                  title={`源分辨率 ${sourceResolution.width}×${sourceResolution.height}`}
                >
                  <option value="source">源分辨率</option>
                  {PRESET_RESOLUTIONS.map((res, idx) => (
                    <option key={idx} value={idx}>
                      {res.width}×{res.height}
                    </option>
                  ))}
                </select>

                <label className="text-sm text-muted">缩放</label>
                <select
                  value={selectedScale}
                  onChange={(e) => setSelectedScale(parseFloat(e.target.value))}
                  className="input capture-scale-select px-2 py-1 text-sm"
                >
                  {PRESET_SCALES.map((scale) => (
                    <option key={scale} value={scale}>
                      {Math.round(scale * 100)}%
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={`preview-stage flex-1 min-h-0 overflow-hidden flex items-center justify-center relative${isFullscreen ? ' is-fullscreen' : ''}${stream ? ' has-stream' : ''}`}
        onDoubleClick={handleDoubleClick}
      >
        {error && (
          <div className="preview-error-state absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <div className="text-center state-enter">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={() => setError(null)}
                className="btn px-3 py-1.5 text-sm"
              >
                关闭提示
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
              className={`${isRegionCapture ? 'cursor-crosshair' : 'cursor-pointer'} object-contain`}
              style={displayResolution ? {
                width: `${displayResolution.width}px`,
                height: `${displayResolution.height}px`,
                maxWidth: '100%',
                maxHeight: '100%',
              } : {
                width: '100%',
                height: '100%',
              }}
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
          <div className="preview-empty-state text-center px-6 state-enter">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-dim"
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
            <p className="text-lg font-medium">请选择视频采集设备</p>
            <p className="hint mt-2">支持 USB 采集卡或屏幕录制，选择后会自动尝试建立预览。</p>
          </div>
        )}

        {isFullscreen && stream && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 overlay">
            <button
              onClick={() => setRegionCapture(!isRegionCapture)}
              className={`${isRegionCapture ? 'btn-primary' : 'btn'} px-3 py-1 text-xs`}
            >
              <Crop size={14} />
              {isRegionCapture ? '取消选择' : '区域截图'}
            </button>
            <button
              onClick={handleCaptureFrame}
              className="btn-success px-3 py-1 text-xs"
            >
              <Camera size={14} />
              全屏截图
            </button>
            <button
              onClick={handleDoubleClick}
              className="btn p-1"
              title="退出全屏"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Preview;
