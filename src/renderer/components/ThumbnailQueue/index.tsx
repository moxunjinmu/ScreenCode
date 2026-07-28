import React, { useState } from 'react';
import { useFrameStore } from '../../store/frameStore';
import { useCaptureStore } from '../../store/captureStore';
import { FRAME_QUEUE } from '@shared/constants';

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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 status-chip bg-black/40">
        查看帧 {index + 1}，点击空白处关闭
      </div>

      <img
        src={imageUrl}
        alt={`帧 ${index + 1} 全屏预览`}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        onClick={onClose}
        className="absolute top-4 right-4 glass-btn-danger px-3 py-2 text-sm text-white"
      >
        关闭
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
      <div className="h-full glass-subtle p-3 flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="panel-heading">帧队列</h3>
            <p className="panel-subheading mt-1">保留关键画面，选中的帧会作为代码提取与 AI 对话的输入素材。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="status-chip">已缓存 {frames.length}/{FRAME_QUEUE.MAX_FRAMES} 帧</span>
            {selectedFrameIds.length > 0 && (
              <span className="status-chip text-sky-200 border-sky-400/30 bg-sky-500/10">已选 {selectedFrameIds.length} 帧</span>
            )}
            {!isEmpty() && (
              <button
                onClick={clearFrames}
                className="glass-btn-danger px-3 py-1.5 text-xs text-red-100"
              >
                清空
              </button>
            )}
            <button
              onClick={onCaptureFrame}
              disabled={!stream || isFull()}
              className={`px-3 py-1.5 text-xs rounded transition-all ${
                !stream || isFull()
                  ? 'bg-white/[0.04] text-slate-500 cursor-not-allowed border border-white/[0.06]'
                  : 'glass-btn-primary text-white'
              }`}
              title={!stream ? '请先启动视频采集' : isFull() ? '队列已满' : '截图 (Ctrl+Shift+S)'}
            >
              添加截图
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-2 overflow-x-auto">
          {isEmpty() ? (
            <div className="flex-1 rounded-xl border border-dashed border-white/10 bg-white/[0.03] flex items-center justify-center text-sm">
              <div className="text-center">
                <p className="text-slate-200">按 <kbd className="glass-kbd px-1.5 py-0.5">Ctrl+Shift+S</kbd> 抓取当前画面</p>
                <p className="text-xs mt-2 text-slate-400">也可以在预览区单击截图，或使用上方按钮补充关键帧。</p>
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
                    className={`relative flex-shrink-0 w-32 h-full rounded-xl overflow-hidden border transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-primary-500/60 ring-2 ring-primary-500/20 shadow-glass-glow bg-sky-500/5'
                        : 'border-white/[0.08] hover:border-primary-500/40 bg-white/[0.03]'
                    }`}
                  >
                    <div className="relative h-[calc(100%-34px)]">
                      <img
                        src={`data:image/jpeg;base64,${frame.data}`}
                        alt={`帧 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {isSelected && (
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-sky-500/80 text-[11px] font-medium text-white shadow-glass-glow">
                          已选
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-slate-950/90 to-transparent text-[11px] text-slate-200">
                        帧 {index + 1}
                      </div>
                    </div>

                    <div className="h-[34px] px-2 flex items-center justify-between bg-slate-950/35 border-t border-white/[0.06] text-[11px] text-slate-300">
                      <button
                        onClick={(e) => handlePreview(frame, index, e)}
                        className="hover:text-white transition-colors"
                      >
                        查看
                      </button>
                      <button
                        onClick={(e) => handleRemove(frame.id, e)}
                        className="hover:text-red-300 transition-colors"
                        title="删除帧"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isFull() && (
                <button
                  onClick={onCaptureFrame}
                  disabled={!stream}
                  className={`flex-shrink-0 w-32 h-full border border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
                    stream
                      ? 'border-white/[0.10] hover:border-primary-500/40 hover:bg-white/[0.04] text-slate-300'
                      : 'border-white/[0.06] text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="text-sm font-medium">继续添加</span>
                  <span className="text-[11px] mt-1 text-slate-400">保留更多关键帧</span>
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
