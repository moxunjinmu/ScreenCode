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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
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
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full glass-heavy bg-red-600/50 hover:bg-red-500/70 text-white text-xl transition-all"
      >
        ✕
      </button>
    </div>
  );
};

const ThumbnailQueue: React.FC<ThumbnailQueueProps> = ({ onCaptureFrame }) => {
  const { frames, clearFrames, isFull, isEmpty, selectedFrameIds, toggleFrameSelection, removeFrame } = useFrameStore();
  const { stream } = useCaptureStore();
  const [previewFrame, setPreviewFrame] = useState<{ data: string; index: number } | null>(null);

  const handlePreview = (frame: { data: string; id: string }, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewFrame({ data: frame.data, index });
  };

  const handleToggleSelect = (frameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFrameSelection(frameId);
  };

  const handleRemove = (frameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFrame(frameId);
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
            {selectedFrameIds.length > 0 && (
              <span className="ml-2 text-primary-400">已选 {selectedFrameIds.length}</span>
            )}
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
              className={`px-3 py-1 text-xs rounded transition-all ${
                !stream || isFull()
                  ? 'bg-white/[0.04] text-gray-500 cursor-not-allowed border border-white/[0.06]'
                  : 'glass-btn-primary text-white'
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
                <p>按 <kbd className="glass-kbd">Ctrl+Shift+S</kbd> 截图</p>
                <p className="text-xs mt-1 text-gray-600">或点击上方按钮</p>
              </div>
            </div>
          ) : (
            <>
              {frames.map((frame, index) => {
                const isSelected = selectedFrameIds.includes(frame.id);
                return (
                  <div
                    key={frame.id}
                    onClick={(e) => handleToggleSelect(frame.id, e)}
                    className={`relative flex-shrink-0 w-20 h-full bg-white/[0.06] backdrop-blur-sm rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-primary-500/60 ring-2 ring-primary-500/30 shadow-glass-glow'
                        : 'border-white/[0.08] hover:border-primary-500/40 hover:shadow-glass-glow'
                    }`}
                  >
                    <img
                      src={`data:image/jpeg;base64,${frame.data}`}
                      alt={`帧 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* 选中指示器 */}
                    {isSelected && (
                      <div className="absolute top-1 left-1 w-4 h-4 bg-primary-500/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-glass-glow">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {/* 序号 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm text-xs text-center py-0.5">
                      {index + 1}
                    </div>

                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleRemove(frame.id, e)}
                      className="absolute top-0 right-0 w-5 h-5 bg-red-500/70 backdrop-blur-sm hover:bg-red-400/90 rounded-bl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs z-10"
                      title="删除帧"
                    >
                      ✕
                    </button>

                    {/* 放大图标 */}
                    <div
                      onClick={(e) => handlePreview(frame, index, e)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ zIndex: 1 }}
                    >
                      <span className="text-2xl">🔍</span>
                    </div>
                  </div>
                );
              })}

              {/* 空占位符 */}
              {!isFull() && (
                <button
                  onClick={onCaptureFrame}
                  disabled={!stream}
                  className={`flex-shrink-0 w-20 h-full border-2 border-dashed rounded-lg flex items-center justify-center transition-all ${
                    stream
                      ? 'border-white/[0.10] hover:border-primary-500/40 hover:bg-white/[0.04] text-gray-400 hover:text-primary-400'
                      : 'border-white/[0.06] text-gray-600 cursor-not-allowed'
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
