import React, { useEffect, useRef, useState } from 'react';
import { useCaptureStore } from '../../store/captureStore';

const Preview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    stopCapture
  } = useCaptureStore();

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

  return (
    <div className="h-full flex flex-col">
      {/* 设备选择器 */}
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
            className={`px-3 py-1 text-xs rounded transition-colors ${
              isCapturing 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {isCapturing ? '停止' : '开始'}
          </button>
        )}
      </div>
      
      {/* 视频预览 */}
      <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center relative">
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
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          />
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
      </div>
    </div>
  );
};

export default Preview;
