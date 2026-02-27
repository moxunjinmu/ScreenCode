import React, { useState } from 'react';
import { useFrameStore } from '../../store/frameStore';
import { useCaptureStore } from '../../store/captureStore';

interface ThumbnailQueueProps {
  onCaptureFrame: () => void;
}

// 全屏预览组件
const FullscreenPreview: React.FC<{
  imageUrl: string;
  index: number;
  onClose: () => void;
}> = ({ imageUrl, index, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 关闭提示 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-gray-400 text-sm">
        点击任意处关闭 | 帧 {index + 1}
      </div>

      {/* 图片 */}
      <img
        src={imageUrl}
        alt={`帧 ${index + 1} 全屏预览`}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
      >
        ✕
      </button>
    </div>
  );
};

const ThumbnailQueue: React.FC<ThumbnailQueueProps> = ({ onCaptureFrame }) => {
  const { frames, clearFrames, isFull, isEmpty } = useFrameStore();
  const { stream } = useCaptureStore();
  const [previewFrame, setPreviewFrame] = useState<{ data: string; index: number } | null>(null);

  const handlePreview = (frame: { data: string }, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewFrame({ data: frame.data, index });
  };

  const closePreview = () => {
    setPreviewFrame(null);
  };

  // ESC 键关闭预览
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewFrame) {
        closePreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFrame]);

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm text-gray-400">
            帧队列 ({frames.length}/8)
          </h3>
          <div className="flex items-center gap-2">
            {!isEmpty() && (
              <button
                onClick={clearFrames}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                清空
              </button>
            )}
            <button
              onClick={onCaptureFrame}
              disabled={!stream || isFull()}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                !stream || isFull()
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
              title={!stream ? '请先启动视频采集' : isFull() ? '队列已满' : '截图 (Ctrl+Shift+S)'}
            >
              📷 截图
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-2 overflow-x-auto">
          {isEmpty() ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              <div className="text-center">
                <p>按 <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Ctrl+Shift+S</kbd> 截图</p>
                <p className="text-xs mt-1 text-gray-600">或点击上方按钮</p>
              </div>
            </div>
          ) : (
            <>
              {frames.map((frame, index) => (
                <div
                  key={frame.id}
                  onClick={(e) => handlePreview(frame, index, e)}
                  className="relative flex-shrink-0 w-20 h-full bg-gray-800 rounded overflow-hidden border border-gray-700 hover:border-primary-500 transition-colors cursor-pointer group"
                >
                  <img
                    src={`data:image/jpeg;base64,${frame.data}`}
                    alt={`帧 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-center py-0.5">
                    {index + 1}
                  </div>
                  <div className="absolute top-0 right-0 bg-black/60 text-xs px-1 rounded-bl">
                    {frame.type === 'new_scene' ? '🆕' : '↪️'}
                  </div>
                  {/* 放大图标 */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-2xl">🔍</span>
                  </div>
                </div>
              ))}

              {/* 空占位符 */}
              {!isFull() && (
                <button
                  onClick={onCaptureFrame}
                  disabled={!stream}
                  className={`flex-shrink-0 w-20 h-full border-2 border-dashed rounded flex items-center justify-center transition-colors ${
                    stream
                      ? 'border-gray-600 hover:border-primary-500 hover:bg-gray-800/50 text-gray-400 hover:text-primary-400'
                      : 'border-gray-700 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <span className="text-2xl">+</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 全屏预览 */}
      {previewFrame && (
        <FullscreenPreview
          imageUrl={`data:image/jpeg;base64,${previewFrame.data}`}
          index={previewFrame.index}
          onClose={closePreview}
        />
      )}
    </>
  );
};

export default ThumbnailQueue;
