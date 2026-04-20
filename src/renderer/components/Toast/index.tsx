import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-up">
      <div
        className={`glass-heavy shadow-glass-glow px-4 py-2 ${
          type === 'success'
            ? 'bg-green-600/30 border-green-500/30 text-green-200'
            : 'bg-red-600/30 border-red-500/30 text-red-200'
        }`}
      >
        {message}
      </div>
    </div>
  );
};

export default Toast;
