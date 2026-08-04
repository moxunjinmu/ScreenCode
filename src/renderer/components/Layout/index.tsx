import React, { useState } from "react";
import {
  Bot,
  Code2,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Video,
} from "lucide-react";
import Settings from "../Settings";
import { useAppStore } from "../../store/appStore";
import { useCaptureStore } from "../../store/captureStore";
import { useUIStore, WorkspaceView } from "../../store/uiStore";
import { useTheme } from "../../providers/ThemeProvider";

interface LayoutProps {
  children: React.ReactNode;
}

const COMPACT_TABS: Array<{
  id: WorkspaceView;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "capture", label: "采集", icon: <Video size={14} /> },
  { id: "code", label: "代码", icon: <Code2 size={14} /> },
  { id: "chat", label: "AI", icon: <Bot size={14} /> },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showSettings, setShowSettings] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isCapturing, selectedDeviceId } = useCaptureStore();
  const isProcessing = useAppStore((state) => state.isProcessing);
  const { activeWorkspaceView, setWorkspaceView, isFullscreenPreview } =
    useUIStore();

  const captureState = isProcessing
    ? { label: "识别中", className: "is-processing" }
    : isCapturing
      ? { label: "采集中", className: "is-capturing" }
      : selectedDeviceId
        ? { label: "已暂停", className: "is-paused" }
        : { label: "待连接", className: "is-idle" };

  return (
    <div
      className={`app-shell${isFullscreenPreview ? " is-fullscreen-preview" : ""}`}
    >
      {!isFullscreenPreview && (
        <>
          <header className="topbar select-none">
            <div className="brand-lockup" aria-label="ScreenCode 1.1.0">
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-name">ScreenCode</span>
              <span className="version-badge">v1.1.0</span>
            </div>

            <div className="topbar-actions">
              <div
                className={`global-state ${captureState.className}`}
                aria-live="polite"
              >
                <span className="global-state-dot" aria-hidden="true" />
                <span>{captureState.label}</span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="btn topbar-button"
                aria-label={
                  theme === "dark" ? "切换为亮色主题" : "切换为暗色主题"
                }
                title={theme === "dark" ? "切换为亮色主题" : "切换为暗色主题"}
              >
                {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
                <span className="topbar-button-label">
                  {theme === "dark" ? "暗色" : "亮色"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceView("chat")}
                className={`btn topbar-button${activeWorkspaceView === "chat" ? " is-active" : ""}`}
                title="打开 AI 对话"
              >
                <span className="ai-state-dot" aria-hidden="true" />
                <span className="topbar-button-label">AI 助手</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="btn topbar-button"
                title="设置"
              >
                <SettingsIcon size={14} />
                <span className="topbar-button-label">设置</span>
              </button>
            </div>
          </header>

          <nav
            className="compact-navigation"
            role="tablist"
            aria-label="紧凑模式工作区"
          >
            {COMPACT_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                key={tab.id}
                aria-selected={activeWorkspaceView === tab.id}
                className={`compact-navigation-tab${activeWorkspaceView === tab.id ? " is-active" : ""}`}
                onClick={() => setWorkspaceView(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      <main className="app-content">{children}</main>

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Layout;
