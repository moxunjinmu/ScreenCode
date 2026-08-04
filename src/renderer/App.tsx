import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PanelRightOpen } from "lucide-react";
import Layout from "./components/Layout";
import Preview from "./components/Preview";
import ThumbnailQueue from "./components/ThumbnailQueue";
import OutputWorkspace from "./components/OutputWorkspace";
import Toast from "./components/Toast";
import { useCaptureStore } from "./store/captureStore";
import { useFrameStore } from "./store/frameStore";
import { useAppStore } from "./store/appStore";
import { useUIStore } from "./store/uiStore";
import { useToast } from "./hooks/useToast";
import { useFrameCapture } from "./hooks/useFrameCapture";
import { useResizablePane } from "./hooks/useResizablePane";
import { electronAPI } from "./lib/electronApi";

const App: React.FC = () => {
  const { toast, showToast } = useToast();
  const captureFrame = useFrameCapture(showToast);
  const { containerRef, paneRatio, isDragging, startDragging, resizeBy } =
    useResizablePane(
      // 拖过最小宽度继续拖 → 收起输出面板
      useCallback(() => useUIStore.getState().setOutputCollapsed(true), []),
    );

  const loadDevices = useCaptureStore((state) => state.loadDevices);
  const { setCodeResult, setError, setProcessing, extractCode } = useAppStore();
  const {
    isFullscreenPreview,
    toggleFullscreenPreview,
    activeWorkspaceView,
    setWorkspaceView,
    isOutputCollapsed,
    setOutputCollapsed,
  } = useUIStore();

  // 收起/展开过渡期间冻结内容宽度，避免文字随宽度缩减重排折行。
  // 状态变化的那一拍记录面板像素宽，过渡结束（展开完成）后解除冻结。
  const [frozenPaneWidth, setFrozenPaneWidth] = useState<number | null>(null);
  const [prevCollapsed, setPrevCollapsed] = useState(isOutputCollapsed);
  if (prevCollapsed !== isOutputCollapsed) {
    setPrevCollapsed(isOutputCollapsed);
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    setFrozenPaneWidth(
      containerWidth > 0 ? Math.round(paneRatio * containerWidth) : null,
    );
  }

  const paneStyle: React.CSSProperties = {
    flexBasis: isOutputCollapsed ? 0 : `${paneRatio * 100}%`,
  };
  if (frozenPaneWidth !== null) {
    (paneStyle as Record<string, string>)["--frozen-pane-width"] =
      `${frozenPaneWidth}px`;
  }

  // 全屏切换 FLIP 形变：采集面板在「窗口槽位矩形」与「全屏矩形」之间用 transform 平滑过渡，
  // 由 WAAPI 驱动并使用贝塞尔缓动（--ease-out），避免 fixed 定位切换时布局瞬间跳变。
  const capturePaneRef = useRef<HTMLElement | null>(null);
  // 进入全屏前记录的窗口矩形（退出时起点是全屏矩形，无需预记录）
  const windowedRectRef = useRef<DOMRect | null>(null);
  const isFirstFullscreenRenderRef = useRef(true);

  const handleToggleFullscreen = useCallback(() => {
    // 进入全屏前先记录当前窗口矩形作为 FLIP 起点
    if (!useUIStore.getState().isFullscreenPreview && capturePaneRef.current) {
      windowedRectRef.current = capturePaneRef.current.getBoundingClientRect();
    }
    toggleFullscreenPreview();
  }, [toggleFullscreenPreview]);

  useLayoutEffect(() => {
    if (isFirstFullscreenRenderRef.current) {
      isFirstFullscreenRenderRef.current = false;
      return;
    }
    const pane = capturePaneRef.current;
    if (!pane) return;

    // 进入：起点=切换前记录的窗口矩形；退出：起点=全屏矩形（fixed inset:0 即视口）
    const first = isFullscreenPreview
      ? windowedRectRef.current
      : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    windowedRectRef.current = null;
    if (!first) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const last = pane.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = last.width > 0 ? first.width / last.width : 1;
    const sy = last.height > 0 ? first.height / last.height : 1;
    if (dx === 0 && dy === 0 && sx === 1 && sy === 1) return;

    // 动效时长/曲线取自 CSS 设计令牌，保持与整体动效体系一致
    const rootStyle = getComputedStyle(document.documentElement);
    const duration =
      parseFloat(rootStyle.getPropertyValue("--motion-layout")) || 300;
    const easing =
      rootStyle.getPropertyValue("--ease-out").trim() ||
      "cubic-bezier(0.16, 1, 0.3, 1)";

    // 快速连续切换时取消上一段动画，避免叠加
    pane.getAnimations().forEach((animation) => animation.cancel());
    pane.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: "top left",
        },
        {
          transform: "translate(0, 0) scale(1, 1)",
          transformOrigin: "top left",
        },
      ],
      { duration, easing },
    );
  }, [isFullscreenPreview]);

  const handleExtractCode = useCallback(() => {
    const { frames, selectedFrameIds } = useFrameStore.getState();
    if (frames.length === 0) {
      showToast("帧队列为空，请先截图", "error");
      return;
    }
    if (selectedFrameIds.length === 0) {
      showToast("请先选择要提取的帧", "error");
      return;
    }
    setOutputCollapsed(false);
    setWorkspaceView("code");
    void extractCode();
  }, [extractCode, setWorkspaceView, setOutputCollapsed, showToast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    const unsubscribeCapture = electronAPI.onCaptureFrame(captureFrame);
    const unsubscribeExtract = electronAPI.onExtractCode(handleExtractCode);

    const unsubscribeAI = electronAPI.onAIResult((result) => {
      setCodeResult(result);
      setProcessing(false);
      setOutputCollapsed(false);
      setWorkspaceView("code");
      showToast("代码提取完成", "success");
    });

    const unsubscribeError = electronAPI.onError((error) => {
      setError(error);
      setProcessing(false);
      showToast(error.message, "error");
    });

    return () => {
      unsubscribeCapture();
      unsubscribeExtract();
      unsubscribeAI();
      unsubscribeError();
    };
  }, [
    captureFrame,
    handleExtractCode,
    setCodeResult,
    setError,
    setProcessing,
    setWorkspaceView,
    setOutputCollapsed,
    showToast,
  ]);

  // 注意：全屏预览不能卸载重挂 <Preview>（卸载 cleanup 会 stop 视频流，画面黑屏中断），
  // 保持组件常驻，仅通过 is-fullscreen-preview 类把采集面板覆盖为全屏。
  return (
    <Layout>
      <div
        ref={containerRef}
        className={`workspace-shell${isFullscreenPreview ? "is-fullscreen-preview" : ""}`}
        data-compact-view={activeWorkspaceView}
        data-resizing={isDragging ? "true" : "false"}
      >
        <section
          ref={capturePaneRef}
          className="workspace-pane capture-workspace"
          aria-label="采集与帧队列"
        >
          <Preview
            isFullscreen={isFullscreenPreview}
            onToggleFullscreen={handleToggleFullscreen}
          />
          <ThumbnailQueue onCaptureFrame={captureFrame} />
        </section>

        <div
          className={`workspace-resizer${isOutputCollapsed ? "is-collapsed" : ""}`}
          role="separator"
          aria-label="调整输出工作区宽度"
          aria-orientation="vertical"
          aria-valuemin={36}
          aria-valuemax={48}
          aria-valuenow={Math.round(paneRatio * 100)}
          tabIndex={0}
          onMouseDown={startDragging}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              resizeBy(1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              resizeBy(-1);
            }
          }}
        >
          <span aria-hidden="true" />
        </div>

        <section
          className={`workspace-pane output-pane${isOutputCollapsed ? "is-collapsed" : ""}`}
          aria-label="代码结果与 AI 对话"
          data-frozen={frozenPaneWidth !== null ? "true" : "false"}
          style={paneStyle}
          onTransitionEnd={(e) => {
            // 展开过渡完成后解除宽度冻结（收起期间保持冻结，供下次展开复用）
            if (e.propertyName === "flex-basis" && !isOutputCollapsed) {
              setFrozenPaneWidth(null);
            }
          }}
        >
          <OutputWorkspace />
        </section>

        {isOutputCollapsed && (
          <div className="output-expand-rail">
            <button
              type="button"
              onClick={() => setOutputCollapsed(false)}
              className="btn output-expand-btn"
              title="展开面板"
              aria-label="展开面板"
            >
              <PanelRightOpen size={14} />
            </button>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </Layout>
  );
};

export default App;
