import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useFrameStore } from '../../store/frameStore';

const CodeDisplay: React.FC = () => {
  const { codeResult, isProcessing } = useAppStore();
  const { frames, isEmpty } = useFrameStore();
  const [copied, setCopied] = useState(false);

  const handleExtractCode = async () => {
    if (isEmpty()) {
      return;
    }

    try {
      await window.electronAPI.extractCode(frames);
    } catch (error) {
      console.error('Failed to extract code:', error);
    }
  };

  const handleCopy = async () => {
    if (codeResult?.code) {
      try {
        await navigator.clipboard.writeText(codeResult.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-gray-400">提取的代码</h3>
        <div className="flex items-center gap-3">
          {codeResult && (
            <>
              <span className="text-xs text-gray-500">
                语言: <span className="text-primary-400">{codeResult.language}</span>
              </span>
              <span className="text-xs text-gray-500">
                置信度: <span className={
                  codeResult.confidence > 0.8 ? 'text-green-400' :
                  codeResult.confidence > 0.5 ? 'text-yellow-400' : 'text-red-400'
                }>{(codeResult.confidence * 100).toFixed(0)}%</span>
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* 代码展示区 */}
      <div className="flex-1 glass-subtle shadow-glass overflow-hidden flex flex-col">
        {codeResult ? (
          <>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-gray-300 whitespace-pre-wrap break-all font-mono text-sm leading-relaxed">
                {codeResult.code}
              </pre>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 p-2 border-t border-white/[0.08]">
              <button
                onClick={handleCopy}
                className="glass-btn-primary px-4 py-1.5 text-sm flex items-center gap-2 text-white"
              >
                {copied ? (
                  <>
                    <span>✓</span>
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>复制代码</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            {isProcessing ? (
              <div className="text-center">
                <div className="animate-spin w-12 h-12 border-3 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-primary-400">正在提取代码...</p>
                <p className="text-xs mt-2 text-gray-600">这可能需要 10-20 秒</p>
              </div>
            ) : (
              <div className="text-center">
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
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" 
                  />
                </svg>
                <p className="mb-4">截取代码截图后点击提取</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExtractCode}
                    disabled={isEmpty()}
                    className="glass-btn-primary px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white"
                  >
                    提取代码
                  </button>
                  <span className="text-xs text-gray-600">
                    或按 <kbd className="glass-kbd">Ctrl+Shift+E</kbd>
                  </span>
                </div>
                {!isEmpty() && (
                  <p className="text-xs mt-3 text-primary-400">
                    已准备 {frames.length} 帧截图
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeDisplay;
