import { create } from 'zustand';
import { ClaudeResponse, AppError, AppStatus } from '@shared/types';
import { electronAPI } from '../lib/electronApi';
import { useFrameStore } from './frameStore';

interface AppState {
  codeResult: ClaudeResponse | null;
  isProcessing: boolean;
  error: AppError | null;
  status: AppStatus;

  // 操作
  setCodeResult: (result: ClaudeResponse | null) => void;
  setProcessing: (status: boolean) => void;
  setError: (error: AppError | null) => void;
  setStatus: (status: AppStatus) => void;
  clearError: () => void;

  /** 提取代码 — 热键与按钮的统一入口 */
  extractCode: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  codeResult: null,
  isProcessing: false,
  error: null,
  status: 'idle',

  setCodeResult: (result) => set({ codeResult: result }),
  setProcessing: (status) => set({ isProcessing: status, status: status ? 'processing' : 'idle' }),
  setError: (error) => set({ error, status: 'error' }),
  setStatus: (status) => set({ status }),
  clearError: () => set({ error: null, status: 'idle' }),

  /**
   * 提取代码：仅发送选中帧。置 processing → 调用主进程 → 结果经 AI_RESULT 事件回流。
   * 失败时主进程会同时推送 AI_ERROR（由 App 层弹 Toast），此处只负责复位状态。
   */
  extractCode: async () => {
    const { frames, selectedFrameIds } = useFrameStore.getState();
    // 仅发送选中帧，保持队列顺序
    const selectedFrames = frames.filter((f) => selectedFrameIds.includes(f.id));
    if (selectedFrames.length === 0 || get().isProcessing) return;

    set({ isProcessing: true, status: 'processing' });
    try {
      await electronAPI.extractCode(selectedFrames);
    } catch (error) {
      console.error('Failed to extract code:', error);
      set({ isProcessing: false, status: 'error' });
    }
  },
}));
