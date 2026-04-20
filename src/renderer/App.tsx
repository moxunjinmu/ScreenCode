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
import { Frame } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [chatWidth, setChatWidth] = useState(350);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { loadDevices, captureFrame, stream } = useCaptureStore();
  const { addFrame, frames } = useFrameStore();
  const { setCodeResult, setError, setProcessing } = useAppStore();
  const { isFullscreenPreview, toggleFullscreenPreview, isChatPanelOpen, toggleChatPanel, setChatPanelOpen } = useUIStore();

  // 关闭阈值宽度
  const CLOSE_THRESHOLD = 200;
  // 最小宽度
  const MIN_WIDTH = 280;
  // 最大宽度比例
  const MAX_WIDTH_RATIO = 0.6;

  // 截图处理函数
  const handleCaptureFrame = useCallback(async () => {
    if (!stream) {
      setToast({ message: '请先启动视频采集', type: 'error' });
      setTimeout(() => setToast(null), 2000);
      return;
    }

    try {
      const base64Frame = await captureFrame();
      if (!base64Frame) {
        setToast({ message: '截图失败', type: 'error' });
        setTimeout(() => setToast(null), 2000);
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

      setToast({ message: `截图已入队 (${frames.length + 1}/8)`, type: 'success' });
      setTimeout(() => setToast(null), 1500);
    } catch (error) {
      console.error('Capture frame error:', error);
      setToast({ message: '截图失败', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  }, [stream, captureFrame, addFrame, frames.length]);

  useEffect(() => {
    // 加载设备列表
    loadDevices();

    // 监听截图事件 (来自全局热键)
    const unsubscribeCapture = window.electronAPI.onCaptureFrame(() => {
      handleCaptureFrame();
    });

    // 监听 AI 结果
    const unsubscribeAI = window.electronAPI.onAIResult((result) => {
      setCodeResult(result);
      setProcessing(false);
      setToast({ message: '代码提取完成', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    });

    // 监听错误
    const unsubscribeError = window.electronAPI.onError((error) => {
      setError(error);
      setProcessing(false);
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    });

    return () => {
      unsubscribeCapture();
      unsubscribeAI();
      unsubscribeError();
    };
  }, [loadDevices, setCodeResult, setError, setProcessing, handleCaptureFrame]);

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
      <div className="h-screen flex text-white">
        {/* 全屏视频预览 */}
        <div className="flex-1 relative">
          <Preview isFullscreen={true} onToggleFullscreen={toggleFullscreenPreview} />
        </div>

        {/* 打开聊天面板按钮 */}
        {!isChatPanelOpen && (
          <button
            onClick={toggleChatPanel}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-primary-600/50 backdrop-blur-md border border-primary-500/30 border-r-0 hover:bg-primary-600/70 text-white px-2 py-4 rounded-l-lg shadow-glass-glow transition-all duration-300 z-10"
            title="打开聊天面板"
          >
            ◀
          </button>
        )}

        {/* 聊天面板容器（带动画） */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isChatPanelOpen ? 'opacity-100' : 'opacity-0 w-0'}`}
          style={{ width: isChatPanelOpen ? chatWidth : 0 }}
        >
          {/* 拖拽分隔条 */}
          <div
            onMouseDown={handleMouseDown}
            className={`w-1 h-full bg-white/[0.10] hover:bg-primary-500/50 cursor-col-resize transition-all float-left ${isDragging ? 'bg-primary-500/60' : ''}`}
          />
          <div className="h-full float-right" style={{ width: chatWidth - 4 }}>
            <ChatPanel width={chatWidth - 4} onClose={toggleChatPanel} />
          </div>
        </div>

        {/* Toast 通知 */}
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  // 正常布局
  return (
    <Layout>
      <div ref={containerRef} className="flex h-full">
        {/* 左侧主区域 */}
        <div className="flex-1 flex flex-col gap-4 p-4 min-w-0 relative">
          {/* 实时预览 */}
          <section className="flex-1 min-h-[200px]">
            <Preview />
          </section>

          {/* 缩略图队列 */}
          <section className="h-24">
            <ThumbnailQueue onCaptureFrame={handleCaptureFrame} />
          </section>

          {/* 代码展示 */}
          <section className="flex-1 min-h-[200px]">
            <CodeDisplay />
          </section>

          {/* 打开聊天面板按钮 */}
          {!isChatPanelOpen && (
            <button
              onClick={toggleChatPanel}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-primary-600/50 backdrop-blur-md border border-primary-500/30 border-r-0 hover:bg-primary-600/70 text-white px-2 py-4 rounded-l-lg shadow-glass-glow transition-all duration-300 z-10"
              title="打开聊天面板"
            >
              ◀
            </button>
          )}
        </div>

        {/* 聊天面板容器（带动画） */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden flex ${isChatPanelOpen ? 'opacity-100' : 'opacity-0 w-0'}`}
          style={{ width: isChatPanelOpen ? chatWidth : 0 }}
        >
          {/* 拖拽分隔条 */}
          <div
            onMouseDown={handleMouseDown}
            className={`w-1 h-full bg-white/[0.10] hover:bg-primary-500/50 cursor-col-resize transition-all shrink-0 ${isDragging ? 'bg-primary-500/60' : ''}`}
          />

          {/* 聊天面板内容 */}
          <div className="h-full shrink-0" style={{ width: chatWidth - 4 }}>
            <ChatPanel width={chatWidth - 4} onClose={toggleChatPanel} />
          </div>
        </div>
      </div>

      {/* Toast 通知 */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </Layout>
  );
};

export default App;
