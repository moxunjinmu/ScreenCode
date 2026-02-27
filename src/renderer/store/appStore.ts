import { create } from 'zustand';
import { ClaudeResponse, AppError, AppStatus } from '@shared/types';

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
}

export const useAppStore = create<AppState>((set) => ({
  codeResult: null,
  isProcessing: false,
  error: null,
  status: 'idle',
  
  setCodeResult: (result) => set({ codeResult: result }),
  setProcessing: (status) => set({ isProcessing: status, status: status ? 'processing' : 'idle' }),
  setError: (error) => set({ error, status: 'error' }),
  setStatus: (status) => set({ status }),
  clearError: () => set({ error: null, status: 'idle' }),
}));
