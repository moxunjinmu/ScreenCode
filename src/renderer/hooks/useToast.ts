import { useState, useCallback, useRef, useEffect } from 'react';
import { TOAST_DURATION } from '@shared/constants';

export type ToastType = 'success' | 'error';

export interface ToastState {
  message: string;
  type: ToastType;
}

/**
 * Toast 通知状态管理。
 * 单一定时器：新通知会取消上一条的倒计时，避免连续弹出时
 * 前一个定时器提前清掉后一条通知。
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setToast({ message, type });
    timerRef.current = setTimeout(
      () => setToast(null),
      type === 'success' ? TOAST_DURATION.SUCCESS : TOAST_DURATION.ERROR
    );
  }, []);

  // 卸载时清理，避免对已卸载组件 setState
  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return { toast, showToast };
}
