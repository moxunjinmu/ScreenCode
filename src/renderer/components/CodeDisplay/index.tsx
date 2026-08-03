import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useFrameStore } from '../../store/frameStore';

interface CodeDisplayProps {
  embedded?: boolean;
}

const CodeDisplay: React.FC<CodeDisplayProps> = ({ embedded = false }) => {
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
    <div className="code-display h-full min-h-0 flex flex-col">
      <div className="code-result-header">
        <h3 className="panel-title">
          {isProcessing ? '正在识别' : codeResult ? '识别结果' : '等待提取'}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">待处理帧 {frames.length}</span>
          {codeResult && (
            <>
              <span className="chip">
                语言 <span className="text-accent-text font-medium">{codeResult.language}</span>
              </span>
              <span className="chip">
                置信度 <span className={
                  codeResult.confidence > 0.8 ? 'text-success' :
                  codeResult.confidence > 0.5 ? 'text-accent-text' : 'text-danger'
                }>{(codeResult.confidence * 100).toFixed(0)}%</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className={`code-result-body flex-1 min-h-0 overflow-hidden flex flex-col${embedded ? '' : ' panel'}`}>
        {codeResult ? (
          <>
            <div className="code-editor flex-1 overflow-auto p-3 bg-surface-code">
              {codeResult.explanation && (
                <div className="mb-3 card px-3 py-2 text-sm text-muted">
                  {codeResult.explanation}
                </div>
              )}

              <pre className="whitespace-pre-wrap break-all font-mono text-sm leading-relaxed">
                {codeResult.code}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 border-t border-border">
              <span className="hint">建议在复制前快速复核缩进、边界条件和识别遗漏。</span>
              <button
                onClick={handleCopy}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    复制代码
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="state-view flex-1 flex flex-col items-center justify-center text-center px-6" data-state={isProcessing ? 'processing' : 'empty'}>
            {isProcessing ? (
              <div>
                <div className="animate-spin w-12 h-12 border-[3px] border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-accent-text font-medium">正在提取代码...</p>
                <p className="hint mt-2">通常需要 10 到 20 秒，期间可以继续调整帧队列。</p>
              </div>
            ) : (
              <div>
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
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                <p className="text-lg font-medium">把关键画面送去识别，提取代码。</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <button
                    onClick={extractCode}
                    disabled={isEmpty()}
                    className="btn-primary px-3 py-1.5 text-sm"
                  >
                    提取代码
                  </button>
                  {!isEmpty() && (
                    <span className="chip">已准备 {frames.length} 帧，可直接开始提取</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeDisplay;
