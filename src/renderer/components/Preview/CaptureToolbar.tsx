import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  Crop,
  LoaderCircle,
  Maximize2,
  MonitorCog,
  Pause,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { toggleToolbarPanel, type ToolbarPanel } from './previewToolbar';

interface CaptureToolbarProps {
  deviceControl: React.ReactNode;
  captureSettings?: React.ReactNode;
  displaySettings?: React.ReactNode;
  resolutionLabel: string | null;
  hasSelectedDevice: boolean;
  hasStream: boolean;
  isCapturing: boolean;
  isLoading: boolean;
  isRegionCapture: boolean;
  isPreparingRegion: boolean;
  onStartStop: () => void;
  onRegionCapture: () => void;
  onFullscreen: () => void;
}

/**
 * Neo Utility · Signal Amber Compact 工具栏。
 * Radix Popover 负责定位、焦点和关闭语义，本组件只组合 ScreenCode 的采集操作。
 */
const CaptureToolbar: React.FC<CaptureToolbarProps> = ({
  deviceControl,
  captureSettings,
  displaySettings,
  resolutionLabel,
  hasSelectedDevice,
  hasStream,
  isCapturing,
  isLoading,
  isRegionCapture,
  isPreparingRegion,
  onStartStop,
  onRegionCapture,
  onFullscreen,
}) => {
  const [activePanel, setActivePanel] = useState<ToolbarPanel>(null);

  // Select 的选项列表也使用 Portal；点击该列表时不能让外层 Radix Popover 提前关闭。
  const preserveNestedSelect = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.select-popover')) {
      event.preventDefault();
    }
  };

  const setPanelOpen = (panel: Exclude<ToolbarPanel, null>, open: boolean) => {
    setActivePanel((current) => (open ? toggleToolbarPanel(current, panel) : null));
  };

  const runAction = (action: () => void) => {
    setActivePanel(null);
    action();
  };

  return (
    <div className="capture-toolbar" role="toolbar" aria-label="采集控制">
      <div className="capture-control-row">
        <div className="capture-device-slot">{deviceControl}</div>

        {captureSettings && (
          <Popover.Root
            open={activePanel === 'capture'}
            onOpenChange={(open) => setPanelOpen('capture', open)}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className={`btn capture-toolbar-button${activePanel === 'capture' ? ' is-active' : ''}`}
                aria-label="采集参数"
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                <span className="capture-toolbar-button-label">采集参数</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="capture-toolbar-popover capture-settings-popover"
                side="bottom"
                align="start"
                sideOffset={8}
                collisionPadding={8}
                onInteractOutside={preserveNestedSelect}
              >
                <div className="capture-popover-title">采集参数</div>
                {captureSettings}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}

        {resolutionLabel && (
          <output className="capture-resolution-readout" aria-label={`当前分辨率 ${resolutionLabel}`}>
            {resolutionLabel}
          </output>
        )}

        {isLoading && (
          <LoaderCircle
            className="capture-loading-icon"
            size={15}
            aria-label="正在连接设备"
          />
        )}

        <div className="capture-toolbar-spacer" />

        <div className="capture-toolbar-actions">
          {hasSelectedDevice && (
            <button
              type="button"
              onClick={() => runAction(onStartStop)}
              className="btn capture-toolbar-button"
              aria-label={isCapturing ? '暂停预览' : '继续预览'}
              title={isCapturing ? '暂停预览' : '继续预览'}
            >
              {isCapturing
                ? <Pause size={15} aria-hidden="true" />
                : <Play size={15} aria-hidden="true" />}
              <span className="capture-toolbar-button-label">{isCapturing ? '暂停' : '继续'}</span>
            </button>
          )}

          {hasStream && (
            <>
              <button
                type="button"
                onClick={() => runAction(onRegionCapture)}
                disabled={isPreparingRegion}
                className={`${isRegionCapture ? 'btn-primary' : 'btn'} capture-toolbar-button`}
                aria-label={isRegionCapture ? '取消区域截图' : '区域截图'}
                title="区域截图 · Ctrl+Shift+R"
              >
                <Crop size={15} aria-hidden="true" />
                <span className="capture-toolbar-button-label">
                  {isPreparingRegion ? '准备中' : isRegionCapture ? '取消' : '区域截图'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => runAction(onFullscreen)}
                className="btn capture-toolbar-icon-button"
                aria-label="全屏预览"
                title="全屏预览"
              >
                <Maximize2 size={15} aria-hidden="true" />
              </button>
            </>
          )}

          {displaySettings && (
            <Popover.Root
              open={activePanel === 'display'}
              onOpenChange={(open) => setPanelOpen('display', open)}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`btn capture-toolbar-button${activePanel === 'display' ? ' is-active' : ''}`}
                  aria-label="显示设置"
                >
                  <MonitorCog size={15} aria-hidden="true" />
                  <span className="capture-toolbar-button-label">显示</span>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="capture-toolbar-popover display-settings-popover"
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  collisionPadding={8}
                  onInteractOutside={preserveNestedSelect}
                >
                  <div className="capture-popover-title">显示设置</div>
                  {displaySettings}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaptureToolbar;
