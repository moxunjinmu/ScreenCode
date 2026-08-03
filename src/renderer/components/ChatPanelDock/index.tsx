import React from 'react';
import ChatPanel from '../ChatPanel';

/** 拖拽手柄宽度，需从面板总宽中扣除 */
const RESIZE_HANDLE_WIDTH = 4;

interface ChatPanelDockProps {
  width: number;
  isDragging: boolean;
  onStartDragging: () => void;
  onClose: () => void;
}

/**
 * 聊天面板 + 拖拽手柄的组合。
 * 正常布局与全屏布局共用，避免两处重复的定位代码。
 */
const ChatPanelDock: React.FC<ChatPanelDockProps> = ({
  width,
  isDragging,
  onStartDragging,
  onClose,
}) => {
  const panelWidth = width - RESIZE_HANDLE_WIDTH;

  return (
    <div className="shrink-0 flex" style={{ width }}>
      <div
        onMouseDown={onStartDragging}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整聊天面板宽度"
        className={`w-1 h-full rounded-sm cursor-col-resize transition-colors shrink-0 ${
          isDragging ? 'bg-accent' : 'bg-border-strong hover:bg-accent'
        }`}
      />
      <div className="h-full shrink-0" style={{ width: panelWidth }}>
        <ChatPanel width={panelWidth} onClose={onClose} />
      </div>
    </div>
  );
};

export default ChatPanelDock;
