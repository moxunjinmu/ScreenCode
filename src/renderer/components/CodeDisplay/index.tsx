import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useFrameStore } from '../../store/frameStore';

const CodeDisplay: React.FC = () => {
  const { codeResult, isProcessing, extractCode } = useAppStore();
  const { frames, isEmpty } = useFrameStore();
  const [copied, setCopied] = useState(false);

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
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="panel-heading">代码结果</h3>
          <p className="panel-subheading mt-1">整理好的帧会发往模型识别，结果会在这里汇总展示。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="status-chip">待处理帧 {frames.length}</span>
          {codeResult && (
            <>
              <span className="status-chip">
                语言 <span className="text-primary-300 font-medium">{codeResult.language}</span>
              </span>
              <span className="status-chip">
                置信度 <span className={
                  codeResult.confidence > 0.8 ? 'text-green-400' :
                  codeResult.confidence > 0.5 ? 'text-yellow-400' : 'text-red-400'
                }>{(codeResult.confidence * 100).toFixed(0)}%</span>
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 min-h-0 glass-subtle shadow-glass overflow-hidden flex flex-col">
        {codeResult ? (
          <>
            <div className="flex-1 overflow-auto p-4">
              {codeResult.explanation && (
                <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  {codeResult.explanation}
                </div>
              )}

              <pre className="text-slate-200 whitespace-pre-wrap break-all font-mono text-sm leading-relaxed">
                {codeResult.code}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 border-t border-white/[0.08] bg-slate-950/20">
              <span className="text-xs text-slate-400">建议在复制前快速复核缩进、边界条件和识别遗漏。</span>
              <button
                onClick={handleCopy}
                className="glass-btn-primary px-4 py-1.5 text-sm flex items-center gap-2 text-white"
              >
                {copied ? (
                  <>
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <span>复制代码</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            {isProcessing ? (
              <div>
                <div className="animate-spin w-12 h-12 border-[3px] border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-primary-300 font-medium">正在提取代码...</p>
                <p className="text-xs mt-2 text-slate-400">通常需要 10 到 20 秒，期间可以继续调整帧队列。</p>
              </div>
            ) : (
              <div>
                <svg 
                  className="w-16 h-16 mx-auto mb-4 text-slate-500" 
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
                <p className="text-lg font-medium text-slate-100">把关键画面送去识别</p>
                <p className="text-sm text-slate-300 mt-2">优先保留字体清晰、滚动连续的帧，能显著提升识别质量。</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <button
                    onClick={extractCode}
                    disabled={isEmpty()}
                    className="glass-btn-primary px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white"
                  >
                    提取代码
                  </button>
                  <span className="text-xs text-slate-400">
                    或按 <kbd className="glass-kbd px-1.5 py-0.5">Ctrl+Shift+E</kbd>
                  </span>
                </div>
                {!isEmpty() && (
                  <p className="text-xs mt-3 text-primary-300">
                    当前已准备 {frames.length} 帧，可直接开始提取。
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
