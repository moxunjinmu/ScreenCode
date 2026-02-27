import React from 'react';
import { useFrameStore } from '../../store/frameStore';
import { useCaptureStore } from '../../store/captureStore';

interface ThumbnailQueueProps {
  onCaptureFrame: () => void;
}

const ThumbnailQueue: React.FC<ThumbnailQueueProps> = ({ onCaptureFrame }) => {
  const { frames, clearFrames, isFull, isEmpty } = useFrameStore();
  const { stream } = useCaptureStore();

  return (
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
                className="relative flex-shrink-0 w-20 h-full bg-gray-800 rounded overflow-hidden border border-gray-700 hover:border-primary-500 transition-colors group"
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
  );
};

export default ThumbnailQueue;
