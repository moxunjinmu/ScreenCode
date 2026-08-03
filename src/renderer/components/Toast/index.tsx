import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-toast">
      {/* 规范 6.9：左侧 3px 语义色边框 + 中性底，替代整块染色 */}
      <div
        className={`overlay px-4 py-3 flex items-center gap-3 border-l-[3px] ${
          type === 'success' ? 'border-l-success' : 'border-l-danger'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${type === 'success' ? 'bg-success' : 'bg-danger'}`} />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
};

export default Toast;
