import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import Preview from './components/Preview';
import ThumbnailQueue from './components/ThumbnailQueue';
import CodeDisplay from './components/CodeDisplay';
import ChatPanel from './components/ChatPanel';
import Toast from './components/Toast';
import { useCaptureStore } from './store/captureStore';
import { useFrameStore } from './store/frameStore';
import { useAppStore } from './store/appStore';
import { useUIStore } from './store/uiStore';
import { electronAPI } from './lib/electronApi';
import { Frame } from '@shared/types';
import { FRAME_QUEUE, TOAST_DURATION } from '@shared/constants';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [chatWidth, setChatWidth] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { loadDevices, captureFrame, stream } = useCaptureStore();
  const { addFrame } = useFrameStore();
  const { setCodeResult, setError, setProcessing, extractCode } = useAppStore();
  const { isFullscreenPreview, toggleFullscreenPreview, isChatPanelOpen, toggleChatPanel, setChatPanelOpen } = useUIStore();

  // 关闭阈值宽度
  const CLOSE_THRESHOLD = 240;
  const MIN_WIDTH = 320;
  const MAX_WIDTH_RATIO = 0.42;

  // 弹出 Toast 并按类型自动消失
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(
      () => setToast(null),
      type === 'success' ? TOAST_DURATION.SUCCESS : TOAST_DURATION.ERROR
    );
  }, []);

  // 截图处理函数
  const handleCaptureFrame = useCallback(async () => {
    if (!stream) {
      showToast('请先启动视频采集', 'error');
      return;
    }

    try {
      const base64Frame = await captureFrame();
      if (!base64Frame) {
        showToast('截图失败', 'error');
        return;
      }

      // 创建帧对象
      const frame: Frame = {
        id: uuidv4(),
        timestamp: Date.now(),
        data: base64Frame,
        type: 'new_scene', // 后续实现帧差分检测
        overlap: undefined
      };

      // 添加到队列
      addFrame(frame);

      // 直接读最新队列长度，避免把 frames 放进依赖导致事件监听反复重建
      const queued = useFrameStore.getState().frames.length;
      showToast(`截图已入队 (${queued}/${FRAME_QUEUE.MAX_FRAMES})`, 'success');
    } catch (error) {
      console.error('Capture frame error:', error);
      showToast('截图失败', 'error');
    }
  }, [stream, captureFrame, addFrame, showToast]);

  useEffect(() => {
    // 加载设备列表
    loadDevices();

    // 监听截图事件 (来自全局热键 Ctrl+Shift+S)
    const unsubscribeCapture = electronAPI.onCaptureFrame(() => {
      handleCaptureFrame();
    });

    // 监听代码提取事件 (来自全局热键 Ctrl+Shift+E)
    const unsubscribeExtract = electronAPI.onExtractCode(() => {
      if (useFrameStore.getState().frames.length === 0) {
        showToast('帧队列为空，请先截图', 'error');
        return;
      }
      extractCode();
    });

    // 监听 AI 结果
    const unsubscribeAI = electronAPI.onAIResult((result) => {
      setCodeResult(result);
      setProcessing(false);
      showToast('代码提取完成', 'success');
    });

    // 监听错误
    const unsubscribeError = electronAPI.onError((error) => {
      setError(error);
      setProcessing(false);
      showToast(error.message, 'error');
    });

    return () => {
      unsubscribeCapture();
      unsubscribeExtract();
      unsubscribeAI();
      unsubscribeError();
    };
  }, [loadDevices, setCodeResult, setError, setProcessing, handleCaptureFrame, extractCode, showToast]);

  // 拖拽处理
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;
    const maxWidth = containerRect.width * MAX_WIDTH_RATIO;

    // 如果宽度小于阈值，关闭面板
    if (newWidth < CLOSE_THRESHOLD) {
      setChatPanelOpen(false);
      setChatWidth(MIN_WIDTH); // 重置为最小宽度，下次打开时使用
      setIsDragging(false);
      return;
    }

    setChatWidth(Math.min(Math.max(newWidth, MIN_WIDTH), maxWidth));
  }, [isDragging, setChatPanelOpen]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 全屏预览模式布局
  if (isFullscreenPreview) {
    return (
      <div className="h-screen flex gap-3 p-3 text-white">
        <div className="flex-1 min-w-0 relative">
          <Preview isFullscreen={true} onToggleFullscreen={toggleFullscreenPreview} />
        </div>

        {!isChatPanelOpen && (
          <button
            onClick={toggleChatPanel}
            className="absolute right-6 top-6 glass-btn-primary px-4 py-2 text-sm text-white z-10"
            title="打开聊天面板"
          >
            打开 AI 对话
          </button>
        )}

        {isChatPanelOpen && (
          <div className="shrink-0 flex" style={{ width: chatWidth }}>
            <div
              onMouseDown={handleMouseDown}
              className={`w-1 h-full rounded-full bg-white/[0.10] hover:bg-primary-500/50 cursor-col-resize transition-all shrink-0 ${isDragging ? 'bg-primary-500/60' : ''}`}
            />
            <div className="h-full shrink-0" style={{ width: chatWidth - 4 }}>
              <ChatPanel width={chatWidth - 4} onClose={toggleChatPanel} />
            </div>
          </div>
        )}

        {/* Toast 通知 */}
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  // 正常布局
  return (
    <Layout>
      <div ref={containerRef} className="flex h-full min-h-0 gap-3 p-3 xl:gap-4 xl:p-4">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4 relative">
          <section className="flex-[1.1] min-h-[250px] min-w-0">
            <Preview />
          </section>

          <section className="h-32 min-h-[128px]">
            <ThumbnailQueue onCaptureFrame={handleCaptureFrame} />
          </section>

          <section className="flex-1 min-h-[220px] min-w-0">
            <CodeDisplay />
          </section>

          {!isChatPanelOpen && (
            <button
              onClick={toggleChatPanel}
              className="absolute top-4 right-4 glass-btn-primary px-4 py-2 text-sm text-white z-10"
              title="打开聊天面板"
            >
              打开 AI 对话
            </button>
          )}
        </div>

        {isChatPanelOpen && (
          <div className="shrink-0 flex" style={{ width: chatWidth }}>
            <div
              onMouseDown={handleMouseDown}
              className={`w-1 h-full rounded-full bg-white/[0.10] hover:bg-primary-500/50 cursor-col-resize transition-all shrink-0 ${isDragging ? 'bg-primary-500/60' : ''}`}
            />

            <div className="h-full shrink-0" style={{ width: chatWidth - 4 }}>
              <ChatPanel width={chatWidth - 4} onClose={toggleChatPanel} />
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </Layout>
  );
};

export default App;
