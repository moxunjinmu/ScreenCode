import React, { useState } from 'react';
import Settings from '../Settings';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen flex flex-col text-white">
      <header className="glass-medium border-x-0 border-t-0 rounded-none select-none" style={{ borderRadius: 0 }}>
        <div className="h-14 px-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight">ScreenCode</h1>
              <span className="status-chip">v1.0.0</span>
            </div>
            <p className="panel-subheading mt-0.5">采集画面、整理帧队列，并将截图交给 AI 提取代码</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="status-chip hidden lg:inline-flex">
              <kbd className="glass-kbd px-1.5 py-0.5">Ctrl+Shift+S</kbd>
              截图
            </span>
            <span className="status-chip hidden lg:inline-flex">
              <kbd className="glass-kbd px-1.5 py-0.5">Ctrl+Shift+E</kbd>
              提取代码
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className="glass-btn px-3 py-1.5 text-sm text-slate-200"
              title="打开设置"
            >
              设置
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
