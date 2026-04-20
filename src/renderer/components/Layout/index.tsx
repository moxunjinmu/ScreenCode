import React, { useState } from 'react';
import Settings from '../Settings';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen flex flex-col text-white">
      {/* 标题栏 */}
      <header className="h-12 flex items-center justify-between px-4 glass-medium rounded-none select-none" style={{ borderRadius: 0 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">ScreenCode</h1>
          <span className="text-xs text-gray-500">v1.0.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            <kbd className="glass-kbd mr-1">Ctrl+Shift+S</kbd>
            截图
            <kbd className="glass-kbd mx-1">Ctrl+Shift+E</kbd>
            提取
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/[0.10] rounded transition-all"
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </header>
      
      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      
      {/* 设置弹窗 */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Layout;
