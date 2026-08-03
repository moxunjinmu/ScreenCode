import React, { useState } from 'react';
import { Settings as SettingsIcon, MessageSquare } from 'lucide-react';
import Settings from '../Settings';
import { useUIStore } from '../../store/uiStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showSettings, setShowSettings] = useState(false);
  const { isChatPanelOpen, toggleChatPanel } = useUIStore();

  return (
    <div className="h-screen flex flex-col">
      <header className="panel border-x-0 border-t-0 rounded-none select-none">
        <div className="h-12 px-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-semibold tracking-tight">ScreenCode</h1>
            <span className="meta">v1.0.0</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isChatPanelOpen && (
              <button
                onClick={toggleChatPanel}
                className="btn-primary px-3 py-1.5 text-sm"
                title="打开 AI 对话"
              >
                <MessageSquare size={14} />
                AI 对话
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="btn p-1.5"
              title="设置"
            >
              <SettingsIcon size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Layout;
