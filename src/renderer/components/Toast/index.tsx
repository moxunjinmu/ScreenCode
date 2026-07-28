import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-toast">
      <div
        className={`glass-heavy shadow-glass-glow px-4 py-3 flex items-center gap-3 ${
          type === 'success'
            ? 'bg-green-600/30 border-green-500/30 text-green-200'
            : 'bg-red-600/30 border-red-500/30 text-red-200'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${type === 'success' ? 'bg-green-300' : 'bg-red-300'}`} />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
};

export default Toast;
