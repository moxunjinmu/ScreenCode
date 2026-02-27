import React, { useState } from 'react';
import Settings from '../Settings';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* 标题栏 */}
      <header className="h-12 flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700 select-none">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">ScreenCode</h1>
          <span className="text-xs text-gray-500">v1.0.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs mr-1">Ctrl+Shift+S</kbd>
            截图
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs mx-1">Ctrl+Shift+E</kbd>
            提取
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
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
