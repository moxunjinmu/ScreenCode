import React, { useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import Preview from './components/Preview';
import ThumbnailQueue from './components/ThumbnailQueue';
import OutputWorkspace from './components/OutputWorkspace';
import Toast from './components/Toast';
import { useCaptureStore } from './store/captureStore';
import { useFrameStore } from './store/frameStore';
import { useAppStore } from './store/appStore';
import { useUIStore } from './store/uiStore';
import { useToast } from './hooks/useToast';
import { useFrameCapture } from './hooks/useFrameCapture';
import { useResizablePane } from './hooks/useResizablePane';
import { electronAPI } from './lib/electronApi';

const App: React.FC = () => {
  const { toast, showToast } = useToast();
  const captureFrame = useFrameCapture(showToast);
  const { containerRef, paneRatio, isDragging, startDragging, resizeBy } = useResizablePane();

  const loadDevices = useCaptureStore((state) => state.loadDevices);
  const { setCodeResult, setError, setProcessing, extractCode } = useAppStore();
  const {
    isFullscreenPreview,
    toggleFullscreenPreview,
    activeWorkspaceView,
    setWorkspaceView,
  } = useUIStore();

  const handleExtractCode = useCallback(() => {
    const { frames, selectedFrameIds } = useFrameStore.getState();
    if (frames.length === 0) {
      showToast('帧队列为空，请先截图', 'error');
      return;
    }
    if (selectedFrameIds.length === 0) {
      showToast('请先选择要提取的帧', 'error');
      return;
    }
    setWorkspaceView('code');
    void extractCode();
  }, [extractCode, setWorkspaceView, showToast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    const unsubscribeCapture = electronAPI.onCaptureFrame(captureFrame);
    const unsubscribeExtract = electronAPI.onExtractCode(handleExtractCode);

    const unsubscribeAI = electronAPI.onAIResult((result) => {
      setCodeResult(result);
      setProcessing(false);
      setWorkspaceView('code');
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
  }, [captureFrame, handleExtractCode, setCodeResult, setError, setProcessing, setWorkspaceView, showToast]);

  if (isFullscreenPreview) {
    return (
      <div className="fullscreen-workspace">
        <Preview isFullscreen onToggleFullscreen={toggleFullscreenPreview} />
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  return (
    <Layout>
      <div
        ref={containerRef}
        className="workspace-shell"
        data-compact-view={activeWorkspaceView}
        data-resizing={isDragging ? 'true' : 'false'}
      >
        <section className="workspace-pane capture-workspace" aria-label="采集与帧队列">
          <Preview />
          <ThumbnailQueue onCaptureFrame={captureFrame} />
        </section>

        <div
          className="workspace-resizer"
          role="separator"
          aria-label="调整输出工作区宽度"
          aria-orientation="vertical"
          aria-valuemin={36}
          aria-valuemax={48}
          aria-valuenow={Math.round(paneRatio * 100)}
          tabIndex={0}
          onMouseDown={startDragging}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              resizeBy(1);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              resizeBy(-1);
            }
          }}
        >
          <span aria-hidden="true" />
        </div>

        <section
          className="workspace-pane output-pane"
          aria-label="代码结果与 AI 对话"
          style={{ flexBasis: `${paneRatio * 100}%` }}
        >
          <OutputWorkspace />
        </section>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </Layout>
  );
};

export default App;
