import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Crop, Minimize2 } from 'lucide-react';
import { useCaptureStore } from '../../store/captureStore';
import { useUIStore } from '../../store/uiStore';
import { useFrameStore } from '../../store/frameStore';
import { electronAPI } from '../../lib/electronApi';
import {
  Frame,
  DisplayResolution,
  PRESET_RESOLUTIONS,
  PRESET_SCALES,
  type EncodedImage,
  DEFAULT_CONFIG,
} from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import RegionCaptureOverlay from './RegionCaptureOverlay';
import { PreviewClickController } from './previewClickController';
import Select from '../Select';
import { connectNativePreview } from '../../capture/nativeWebRtcPreview';
import { FullscreenToolbarVisibilityController } from './fullscreenToolbarVisibility';
import CaptureToolbar from './CaptureToolbar';
import { resolveToolbarResolution } from './previewToolbar';

interface PreviewProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

// 防抖延迟（ms），低于此时间内的双击会取消之前的单击截图
const CAPTURE_DEBOUNCE_MS = 300;
const FULLSCREEN_TOOLBAR_HIDE_DELAY_MS = 2_500;

const Preview: React.FC<PreviewProps> = ({ isFullscreen = false, onToggleFullscreen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickControllerRef = useRef<PreviewClickController | null>(null);
  if (!clickControllerRef.current) {
    clickControllerRef.current = new PreviewClickController(CAPTURE_DEBOUNCE_MS);
  }
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fullscreenToolbarAutoHide, setFullscreenToolbarAutoHide] = useState(
    DEFAULT_CONFIG.fullscreenToolbarAutoHide,
  );
  const [isFullscreenToolbarVisible, setFullscreenToolbarVisible] = useState(true);
  const [isFullscreenToolbarInteracting, setFullscreenToolbarInteracting] = useState(false);
  const fullscreenToolbarControllerRef = useRef<FullscreenToolbarVisibilityController | null>(null);
  if (!fullscreenToolbarControllerRef.current) {
    fullscreenToolbarControllerRef.current = new FullscreenToolbarVisibilityController(
      FULLSCREEN_TOOLBAR_HIDE_DELAY_MS,
      setFullscreenToolbarVisible,
    );
  }

  const {
    devices,
    nativeDevices,
    selectedDeviceId,
    selectedDeviceType,
    captureBackend,
    nativeSelection,
    nativeDiscoveryPhase,
    nativeStatus,
    selectDevice,
    loadDevices,
    setNativeSelection,
    setNativeStatus,
    isCapturing,
    stream,
    isHighQualityCapturing,
    startCapture,
    stopCapture,
    captureFrame,
    setStream,
    setVideoElement,
  } = useCaptureStore();

  const isDiscovering = nativeDiscoveryPhase === 'idle' || nativeDiscoveryPhase === 'loading';
  useEffect(() => {
    if (nativeStatus.phase === 'error' && nativeStatus.error) setError(nativeStatus.error);
  }, [nativeStatus.phase, nativeStatus.error]);

  const { isRegionCapture, setRegionCapture, isFullscreenPreview, setFullscreenPreview, displayResolution, setDisplayResolution } = useUIStore();
  const { addFrame } = useFrameStore();

  // 视频源分辨率状态
  const [sourceResolution, setSourceResolution] = useState<{ width: number; height: number } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('source');  // 'source' 或分辨率索引
  const [selectedScale, setSelectedScale] = useState<number>(1.0);
  const [regionSource, setRegionSource] = useState<{
    image: EncodedImage;
    source: 'yuy2' | 'native' | 'preview';
    sourceFormat?: string;
  } | null>(null);

  useEffect(() => electronAPI.onNativeCaptureStatus((status) => {
    setNativeStatus(status);
    if (status.phase === 'error' && status.error) setError(status.error);
  }), [setNativeStatus]);

  useEffect(() => {
    let isActive = true;
    void electronAPI.getConfig().then((config) => {
      if (isActive) setFullscreenToolbarAutoHide(config.fullscreenToolbarAutoHide);
    });
    const unsubscribe = electronAPI.onConfigChanged((config) => {
      setFullscreenToolbarAutoHide(config.fullscreenToolbarAutoHide);
    });
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    fullscreenToolbarControllerRef.current?.setAutoHideActive(
      isFullscreen && Boolean(stream) && fullscreenToolbarAutoHide,
    );
  }, [fullscreenToolbarAutoHide, isFullscreen, stream]);

  useEffect(() => {
    fullscreenToolbarControllerRef.current?.setHeldVisible(
      isFullscreenToolbarInteracting || isRegionCapture || isHighQualityCapturing,
    );
  }, [isFullscreenToolbarInteracting, isHighQualityCapturing, isRegionCapture]);

  useEffect(() => () => fullscreenToolbarControllerRef.current?.dispose(), []);

  useEffect(() => {
    if (
      captureBackend !== 'gstreamer-mf' ||
      nativeStatus.phase !== 'streaming' ||
      !nativeStatus.signallingUrl
    ) return undefined;

    const connection = connectNativePreview({
      signallingUrl: nativeStatus.signallingUrl,
      onStream: (nativeStream) => {
        setStream(nativeStream);
        if (videoRef.current) videoRef.current.srcObject = nativeStream;
        setIsLoading(false);
      },
      onError: setError,
    });
    return () => connection.close();
  }, [captureBackend, nativeStatus.phase, nativeStatus.signallingUrl, setStream]);

  // 当选择设备后自动开始捕获
  useEffect(() => {
    let cancelled = false;
    let checkStream: ReturnType<typeof setInterval> | undefined;
    let connectionTimeout: ReturnType<typeof setTimeout> | undefined;
    const startVideoStream = async () => {
      if (!selectedDeviceId) return;
      if (
        selectedDeviceType === 'videoinput'
        && captureBackend === 'gstreamer-mf'
        && nativeDiscoveryPhase !== 'ready'
      ) return;

      setIsLoading(true);
      setError(null);

      try {
        if (selectedDeviceType === 'videoinput') {
          // 启动视频捕获
          await startCapture();
          if (cancelled) return;

          // 等待 stream 更新
          checkStream = setInterval(() => {
            const currentStream = useCaptureStore.getState().stream;
            if (currentStream && videoRef.current) {
              videoRef.current.srcObject = currentStream;
              clearInterval(checkStream);
              clearTimeout(connectionTimeout);
              setIsLoading(false);
            }
          }, 100);

          // 超时处理
          connectionTimeout = setTimeout(() => {
            clearInterval(checkStream);
            const connectedStream = useCaptureStore.getState().stream;
            if (!connectedStream && captureBackend === 'gstreamer-mf') {
              setError('GStreamer 已完成原始采集，但 WebRTC 预览连接超时');
            }
            setIsLoading(false);
          }, captureBackend === 'gstreamer-mf' ? 30_000 : 5_000);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '启动视频捕获失败';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    startVideoStream();

    return () => {
      cancelled = true;
      clearInterval(checkStream);
      clearTimeout(connectionTimeout);
    };
  }, [
    selectedDeviceId,
    selectedDeviceType,
    captureBackend,
    nativeDiscoveryPhase,
    nativeSelection?.formatId,
    nativeSelection?.modeId,
    startCapture,
  ]);

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
  }, [stream, isHighQualityCapturing]);

  // 将预览 video 注册到 store，供全局热键截图直接复用（避免另建临时 video）
  useEffect(() => {
    setVideoElement(videoRef.current);
    return () => setVideoElement(null);
  }, [stream, isHighQualityCapturing, setVideoElement]);

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
  }, [stream, isHighQualityCapturing]);

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

  const selectedNativeDevice = nativeDevices.find(
    (device) => device.id === nativeSelection?.deviceId,
  );
  const selectedNativeFormat = selectedNativeDevice?.formats.find(
    (format) => format.id === nativeSelection?.formatId,
  );
  const selectedNativeMode = selectedNativeFormat?.modes.find(
    (mode) => mode.id === nativeSelection?.modeId,
  );
  const nativeResolutions = selectedNativeFormat
    ? [...new Map(selectedNativeFormat.modes.map((mode) => [
        `${mode.width}x${mode.height}`,
        { width: mode.width, height: mode.height },
      ])).values()]
    : [];
  const modesAtSelectedResolution = selectedNativeFormat?.modes.filter(
    (mode) => mode.width === selectedNativeMode?.width && mode.height === selectedNativeMode?.height,
  ) ?? [];
  const toolbarResolution = resolveToolbarResolution(nativeStatus, sourceResolution);

  const changeNativeMode = async (formatId: string, modeId: string) => {
    setError(null);
    try {
      await setNativeSelection(formatId, modeId);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  };

  const handleNativeFormatChange = async (formatId: string) => {
    const format = selectedNativeDevice?.formats.find((item) => item.id === formatId);
    const mode = format?.modes.find((item) => item.verified) ?? format?.modes[0];
    if (mode) await changeNativeMode(formatId, mode.id);
  };

  const handleNativeResolutionChange = async (resolution: string) => {
    if (!selectedNativeFormat) return;
    const [width, height] = resolution.split('x').map(Number);
    const modes = selectedNativeFormat.modes
      .filter((mode) => mode.width === width && mode.height === height)
      .sort((left, right) =>
        right.frameRateNumerator / right.frameRateDenominator -
        left.frameRateNumerator / left.frameRateDenominator);
    const mode = modes.find((item) => item.verified) ?? modes[0];
    if (mode) await changeNativeMode(selectedNativeFormat.id, mode.id);
  };

  const handleDeviceChange = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setError(null);
      try {
        await selectDevice(deviceId, device.type);
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
      }
    }
  };

  const handleStartStop = async () => {
    if (nativeDiscoveryPhase === 'failed') {
      setError(null);
      await loadDevices();
      return;
    }
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

  // 立即截图，仅供明确的截图操作调用。
  const captureImmediately = useCallback(async () => {
    if (!isCapturing) return;
    try {
      const outcome = await captureFrame();
      if (!outcome) return;

      const frame: Frame = {
        id: uuidv4(),
        timestamp: Date.now(),
        ...outcome.image,
        type: 'new_scene',
        overlap: undefined
      };

      addFrame(frame);

      // 写入剪贴板
      await electronAPI.writeImageToClipboard(outcome.image);
    } catch (error) {
      console.error('Capture frame error:', error);
    }
  }, [isCapturing, captureFrame, addFrame]);

  /** 区域截图先冻结一张原始 YUY2 帧，再进入选区，保证所见与最终裁剪来自同一时刻。 */
  const toggleRegionCapture = useCallback(async () => {
    if (isRegionCapture) {
      setRegionCapture(false);
      return;
    }
    if (!isCapturing || isHighQualityCapturing) return;

    setError(null);
    const outcome = await captureFrame({ quality: 'original' });
    if (!outcome) {
      setError('无法准备区域截图源图');
      return;
    }
    setRegionSource({
      image: outcome.image,
      source: outcome.source,
      sourceFormat: outcome.sourceFormat,
    });
    const captureWarning = outcome.restoreError || outcome.warning;
    if (captureWarning) setError(captureWarning);
    setRegionCapture(true);
  }, [captureFrame, isCapturing, isHighQualityCapturing, isRegionCapture, setRegionCapture]);

  // 区域截图快捷键负责准备冻结帧；选区内的 Enter/Esc/R/方向键由覆盖层处理。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void toggleRegionCapture();
      } else if (event.key === 'Escape' && !isRegionCapture && isFullscreenPreview) {
        setFullscreenPreview(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenPreview, isRegionCapture, setFullscreenPreview, toggleRegionCapture]);

  // 预览区单击需要延迟确认，双击事件会在延迟窗口内取消截图。
  const handlePreviewClick = useCallback(() => {
    clickControllerRef.current?.scheduleCapture(() => {
      void captureImmediately();
    });
  }, [captureImmediately]);

  // 双击进入/退出全屏
  const handleDoubleClick = () => {
    clickControllerRef.current?.toggleFullscreen(() => {
      if (onToggleFullscreen) {
        onToggleFullscreen();
      } else {
        setFullscreenPreview(!isFullscreenPreview);
      }
    });
  };

  useEffect(() => {
    return () => clickControllerRef.current?.cancelPendingCapture();
  }, []);

  // 区域截图完成回调
  const handleRegionCapture = useCallback(() => {
    setRegionCapture(false);
  }, [setRegionCapture]);

  return (
    <div className={`preview-workspace h-full min-h-0 flex flex-col relative${isFullscreen ? ' is-fullscreen' : ''}`}>
      {!isFullscreen && (
        <CaptureToolbar
          deviceControl={(
            <Select
              value={selectedDeviceId || ''}
              options={devices.map((device) => ({ value: device.id, label: device.name }))}
              onChange={(deviceId) => {
                if (deviceId) void handleDeviceChange(deviceId);
              }}
              placeholder="选择设备..."
              className="capture-device-select text-sm"
              title="采集设备"
              ariaLabel="采集设备"
            />
          )}
          captureSettings={selectedDeviceType === 'videoinput' ? (
            <div className="capture-popover-fields">
              {isDiscovering && <p className="capture-discovery-note" role="status">正在连接采集卡，已保存的参数将在确认后自动应用…</p>}
              {nativeDiscoveryPhase === 'failed' && (
                <button type="button" className="btn" onClick={() => void loadDevices()}>重新探测采集卡</button>
              )}
              {nativeDiscoveryPhase === 'ready' && !selectedNativeMode && (
                <p className="capture-discovery-note">当前设备没有可用的精确模式，请检查采集卡连接。</p>
              )}
              {captureBackend === 'gstreamer-mf' && selectedNativeFormat && selectedNativeMode && (
                <>
                  <label className="capture-popover-field">
                    <span>原始格式</span>
                    <Select
                      value={selectedNativeFormat.id}
                      disabled={nativeDiscoveryPhase !== 'ready'}
                      options={selectedNativeDevice?.formats.map((format) => ({
                        value: format.id,
                        label: format.label,
                      })) ?? []}
                      onChange={(formatId) => void handleNativeFormatChange(formatId)}
                      className="capture-format-select text-sm"
                      ariaLabel="原始采集协议"
                      title="采集卡真实输入格式"
                    />
                  </label>
                  <label className="capture-popover-field">
                    <span>采集分辨率</span>
                    <Select
                      value={`${selectedNativeMode.width}x${selectedNativeMode.height}`}
                      disabled={nativeDiscoveryPhase !== 'ready'}
                      options={nativeResolutions.map((resolution) => ({
                        value: `${resolution.width}x${resolution.height}`,
                        label: `${resolution.width}×${resolution.height}`,
                      }))}
                      onChange={(resolution) => void handleNativeResolutionChange(resolution)}
                      className="capture-native-resolution-select text-sm"
                      ariaLabel="原始采集分辨率"
                    />
                  </label>
                  <label className="capture-popover-field">
                    <span>采集帧率</span>
                    <Select
                      value={selectedNativeMode.id}
                      disabled={nativeDiscoveryPhase !== 'ready'}
                      options={modesAtSelectedResolution.map((mode) => ({
                        value: mode.id,
                        label: `${Number((mode.frameRateNumerator / mode.frameRateDenominator).toFixed(2))} FPS${mode.verified ? ' · 已验证' : ''}`,
                      }))}
                      onChange={(modeId) => void changeNativeMode(selectedNativeFormat.id, modeId)}
                      className="capture-native-fps-select text-sm"
                      ariaLabel="原始采集帧率"
                    />
                  </label>
                </>
              )}
            </div>
          ) : undefined}
          displaySettings={stream && sourceResolution ? (
            <div className="capture-popover-fields display-popover-fields">
              <label className="capture-popover-field">
                <span>预览尺寸</span>
                <Select
                  value={selectedPreset}
                  options={[
                    { value: 'source', label: '源分辨率' },
                    ...PRESET_RESOLUTIONS.map((res, idx) => ({
                      value: String(idx),
                      label: `${res.width}×${res.height}`,
                    })),
                  ]}
                  onChange={setSelectedPreset}
                  className="capture-resolution-select text-sm"
                  title={`源分辨率 ${sourceResolution.width}×${sourceResolution.height}`}
                  ariaLabel="预览显示尺寸"
                />
              </label>
              <label className="capture-popover-field">
                <span>画面缩放</span>
                <Select
                  value={String(selectedScale)}
                  options={PRESET_SCALES.map((scale) => ({
                    value: String(scale),
                    label: `${Math.round(scale * 100)}%`,
                  }))}
                  onChange={(v) => setSelectedScale(parseFloat(v))}
                  className="capture-scale-select text-sm"
                  ariaLabel="预览缩放"
                />
              </label>
            </div>
          ) : undefined}
          resolutionLabel={toolbarResolution}
          hasSelectedDevice={Boolean(selectedDeviceId)}
          hasStream={Boolean(stream)}
          isCapturing={isCapturing}
          isLoading={isLoading || isDiscovering}
          isRegionCapture={isRegionCapture}
          isPreparingRegion={isHighQualityCapturing}
          onStartStop={() => void handleStartStop()}
          onRegionCapture={() => void toggleRegionCapture()}
          onFullscreen={handleDoubleClick}
        />
      )}

      <div
        className={`preview-stage flex-1 min-h-0 overflow-hidden flex items-center justify-center relative${isFullscreen ? ' is-fullscreen' : ''}${stream ? ' has-stream' : ''}`}
        onPointerMove={() => fullscreenToolbarControllerRef.current?.notifyActivity()}
        onPointerDown={() => fullscreenToolbarControllerRef.current?.notifyActivity()}
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
              style={isFullscreen
                ? { width: '100%', height: '100%' }
                : displayResolution
                  ? {
                      width: `${displayResolution.width}px`,
                      height: `${displayResolution.height}px`,
                      maxWidth: '100%',
                      maxHeight: '100%',
                    }
                  : { width: '100%', height: '100%' }}
              onClick={(e) => {
                // 如果不在区域截图模式，单击截图
                if (!isRegionCapture && e.detail === 1) {
                  handlePreviewClick();
                }
              }}
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

        {regionSource && (
          <RegionCaptureOverlay
            sourceImage={regionSource.image}
            sourceKind={regionSource.source}
            sourceFormat={regionSource.sourceFormat}
            onCapture={handleRegionCapture}
            onCancel={handleRegionCapture}
          />
        )}

        {isFullscreen && stream && (
          <div
            className={`fullscreen-capture-menu absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 overlay${isFullscreenToolbarVisible ? ' is-visible' : ' is-hidden'}`}
            data-state={isFullscreenToolbarVisible ? 'visible' : 'hidden'}
            onPointerEnter={() => setFullscreenToolbarInteracting(true)}
            onPointerLeave={() => setFullscreenToolbarInteracting(false)}
            onFocus={() => setFullscreenToolbarInteracting(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setFullscreenToolbarInteracting(false);
              }
            }}
          >
            <button
              onClick={() => void toggleRegionCapture()}
              disabled={isHighQualityCapturing}
              className={`${isRegionCapture ? 'btn-primary' : 'btn'} px-3 py-1 text-xs`}
            >
              <Crop size={14} />
              {isRegionCapture ? '取消选择' : '区域截图'}
            </button>
            <button
              onClick={() => void captureImmediately()}
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
