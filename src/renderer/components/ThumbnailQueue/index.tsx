import React, { useState } from "react";
import { Camera, ChevronDown, ChevronUp, Eye, Trash2 } from "lucide-react";
import { useFrameStore } from "../../store/frameStore";
import { useCaptureStore } from "../../store/captureStore";
import { FRAME_QUEUE } from "@shared/constants";
import type { Frame, ImageMimeType } from "@shared/types";
import { toImageDataUrl } from "@shared/imageQuality";

interface ThumbnailQueueProps {
  onCaptureFrame: () => void;
}

// 全屏预览组件（常驻挂载，通过 data-state 控制进出场过渡，关闭时不卸载避免闪断）
const FullscreenPreview: React.FC<{
  imageUrl: string;
  index: number;
  open: boolean;
  onClose: () => void;
}> = ({ imageUrl, index, open, onClose }) => {
  return (
    <div
      className="flex fixed inset-0 z-50 justify-center items-center frame-preview-backdrop bg-black/80"
      data-state={open ? "open" : "closed"}
      onClick={onClose}
    >
      <div className="absolute top-4 left-1/2 -translate-x-1/2 hint px-3 py-1.5 rounded-sm bg-black/60 text-white">
        查看帧 {index + 1}，点击空白处关闭
      </div>

      <img
        src={imageUrl}
        alt={`帧 ${index + 1} 全屏预览`}
        className="object-contain max-w-full max-h-full frame-preview-image"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        onClick={onClose}
        className="absolute top-4 right-4 btn-danger px-3 py-1.5 text-sm"
      >
        关闭
      </button>
    </div>
  );
};

const ThumbnailQueue: React.FC<ThumbnailQueueProps> = ({ onCaptureFrame }) => {
  const {
    frames,
    clearFrames,
    isFull,
    isEmpty,
    selectedFrameIds,
    toggleFrameSelection,
    removeFrame,
  } = useFrameStore();
  const { stream } = useCaptureStore();
  const [previewFrame, setPreviewFrame] = useState<{
    data: string;
    mimeType: ImageMimeType;
    index: number;
  } | null>(null);
  // 开合状态与帧数据分离：关闭时保留帧数据播放退场动画，下次打开再替换
  const [previewOpen, setPreviewOpen] = useState(false);
  // 整体折叠仅保留单行 header；紧凑模式已有固定布局，因此不再按窗口高度强制折叠。
  const [collapsed, setCollapsed] = useState(false);

  const handlePreview = (
    frame: Frame,
    index: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setPreviewFrame({ data: frame.data, mimeType: frame.mimeType, index });
    setPreviewOpen(true);
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
    setPreviewOpen(false);
  };

  // ESC 键关闭预览
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewOpen) {
        closePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  return (
    <>
      <div
        className={`frame-queue panel flex flex-col${collapsed ? " is-collapsed" : ""}`}
      >
        <div className="panel-header">
          <h3 className="panel-title">帧队列</h3>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="chip">
              已缓存 {frames.length}/{FRAME_QUEUE.MAX_FRAMES} 帧
            </span>
            {selectedFrameIds.length > 0 && (
              <span className="chip chip-active">
                已选 {selectedFrameIds.length} 帧
              </span>
            )}
            {!isEmpty() && (
              <button
                onClick={clearFrames}
                className="px-3 py-1 text-xs btn-danger"
              >
                清空
              </button>
            )}
            <button
              onClick={onCaptureFrame}
              disabled={!stream || isFull()}
              className="px-3 py-1 text-xs btn-primary"
              title={
                !stream
                  ? "请先启动视频采集"
                  : isFull()
                    ? "队列已满"
                    : "截图 (Ctrl+Shift+S)"
              }
            >
              <Camera size={14} />
              添加截图
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 btn"
              title={collapsed ? "展开帧队列" : "折叠帧队列"}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="flex overflow-x-auto flex-1 gap-2 p-3 pt-2 min-h-0 frame-list">
            {isEmpty() ? (
              <div className="flex flex-1 justify-center items-center text-sm rounded-md border border-dashed border-border bg-surface-2">
                <div className="text-center">
                  <p className="hint">
                    按 <kbd className="kbd">Ctrl+Shift+S</kbd> 抓取当前画面
                  </p>
                  <p className="mt-1 hint">
                    也可以在预览区单击截图，或使用上方按钮补充关键帧。
                  </p>
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
                      className={`frame-card relative flex-shrink-0 w-36 h-full rounded-md overflow-hidden border cursor-pointer group${isSelected ? " is-selected" : ""} ${
                        isSelected
                          ? "border-accent-border bg-accent-subtle"
                          : "border-border hover:border-accent-border bg-surface-2"
                      }`}
                    >
                      <div className="relative h-[calc(100%-34px)]">
                        <img
                          src={toImageDataUrl(frame)}
                          alt={`帧 ${index + 1}`}
                          className="object-cover w-full h-full"
                        />

                        {isSelected && (
                          <div className="absolute top-1 left-1 chip chip-active">
                            已选
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent text-[11px] text-white">
                          帧 {index + 1}
                        </div>
                      </div>

                      <div className="h-[34px] px-2 flex items-center justify-between bg-surface-1 border-t border-border text-muted">
                        <button
                          onClick={(e) => handlePreview(frame, index, e)}
                          className="p-1 transition-colors hover:text-text"
                          title="查看帧"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={(e) => handleRemove(frame.id, e)}
                          className="p-1 transition-colors hover:text-danger"
                          title="删除帧"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!isFull() && (
                  <button
                    onClick={onCaptureFrame}
                    disabled={!stream}
                    className={`flex-shrink-0 w-36 h-full border border-dashed rounded-md flex flex-col items-center justify-center transition-colors ${
                      stream
                        ? "border-border hover:border-accent-border hover:bg-surface-2 text-muted"
                        : "cursor-not-allowed border-border text-dim"
                    }`}
                  >
                    <span className="text-sm font-medium">继续添加</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 全屏预览：常驻挂载，关闭时播放退场过渡 */}
      <FullscreenPreview
        imageUrl={
          previewFrame ? toImageDataUrl(previewFrame) : ""
        }
        index={previewFrame?.index ?? 0}
        open={previewOpen}
        onClose={closePreview}
      />
    </>
  );
};

export default ThumbnailQueue;
