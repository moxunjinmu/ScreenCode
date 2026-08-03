import React, { useEffect } from 'react';
import Layout from './components/Layout';
import Preview from './components/Preview';
import ThumbnailQueue from './components/ThumbnailQueue';
import CodeDisplay from './components/CodeDisplay';
import ChatPanelDock from './components/ChatPanelDock';
import Toast from './components/Toast';
import { useCaptureStore } from './store/captureStore';
import { useFrameStore } from './store/frameStore';
import { useAppStore } from './store/appStore';
import { useUIStore } from './store/uiStore';
import { useToast } from './hooks/useToast';
import { useFrameCapture } from './hooks/useFrameCapture';
import { useChatPanelResize } from './hooks/useChatPanelResize';
import { electronAPI } from './lib/electronApi';

const App: React.FC = () => {
  const { toast, showToast } = useToast();
  const captureFrame = useFrameCapture(showToast);
  const { containerRef, width: chatWidth, isDragging, startDragging } = useChatPanelResize();

  const loadDevices = useCaptureStore((state) => state.loadDevices);
  const { setCodeResult, setError, setProcessing, extractCode } = useAppStore();
  const {
    isFullscreenPreview,
    toggleFullscreenPreview,
    isChatPanelOpen,
    toggleChatPanel,
  } = useUIStore();

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // 订阅主进程事件
  useEffect(() => {
    // 全局热键 Ctrl+Shift+S
    const unsubscribeCapture = electronAPI.onCaptureFrame(() => {
      captureFrame();
    });

    // 全局热键 Ctrl+Shift+E
    const unsubscribeExtract = electronAPI.onExtractCode(() => {
      if (useFrameStore.getState().frames.length === 0) {
        showToast('帧队列为空，请先截图', 'error');
        return;
      }
      extractCode();
    });

    const unsubscribeAI = electronAPI.onAIResult((result) => {
      setCodeResult(result);
      setProcessing(false);
      showToast('代码提取完成', 'success');
    });

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
  }, [captureFrame, extractCode, setCodeResult, setError, setProcessing, showToast]);

  const chatDock = isChatPanelOpen && (
    <ChatPanelDock
      width={chatWidth}
      isDragging={isDragging}
      onStartDragging={startDragging}
      onClose={toggleChatPanel}
    />
  );

  // 全屏预览布局
  if (isFullscreenPreview) {
    return (
      <div ref={containerRef} className="h-screen flex gap-3 p-3">
        <div className="flex-1 min-w-0 relative">
          <Preview isFullscreen onToggleFullscreen={toggleFullscreenPreview} />
        </div>

        {chatDock}

        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  // 正常布局（垂直比例按规范 6.10 / 第 10 章问题 3：flex-[2] / 160px / flex-[1.4]）
  return (
    <Layout>
      <div ref={containerRef} className="flex h-full min-h-0 gap-3 p-3">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 relative overflow-y-auto">
          <section className="flex-[2] min-h-[220px] min-w-0">
            <Preview />
          </section>

          <section className="shrink-0">
            <ThumbnailQueue onCaptureFrame={captureFrame} />
          </section>

          <section className="flex-[1.4] min-h-[180px] min-w-0">
            <CodeDisplay />
          </section>
        </div>

        {chatDock}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </Layout>
  );
};

export default App;
