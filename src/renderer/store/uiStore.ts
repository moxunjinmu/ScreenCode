import { create } from 'zustand';
import { DisplayResolution } from '@shared/types';

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UIState {
  // 全屏预览模式
  isFullscreenPreview: boolean;
  toggleFullscreenPreview: () => void;
  setFullscreenPreview: (value: boolean) => void;

  // 区域截图模式
  isRegionCapture: boolean;
  selectionRect: SelectionRect | null;
  isSelecting: boolean;
  selectionStart: { x: number; y: number } | null;

  setRegionCapture: (value: boolean) => void;
  startSelection: (x: number, y: number) => void;
  updateSelection: (x: number, y: number) => void;
  endSelection: () => void;
  clearSelection: () => void;

  // 聊天面板开关
  isChatPanelOpen: boolean;
  toggleChatPanel: () => void;
  setChatPanelOpen: (value: boolean) => void;

  // 显示分辨率
  displayResolution: DisplayResolution | null;
  setDisplayResolution: (resolution: DisplayResolution | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // 全屏预览模式
  isFullscreenPreview: false,
  toggleFullscreenPreview: () => set((state) => ({ isFullscreenPreview: !state.isFullscreenPreview })),
  setFullscreenPreview: (value) => set({ isFullscreenPreview: value }),

  // 区域截图模式
  isRegionCapture: false,
  selectionRect: null,
  isSelecting: false,
  selectionStart: null,

  setRegionCapture: (value) => set({ 
    isRegionCapture: value, 
    selectionRect: null, 
    isSelecting: false,
    selectionStart: null 
  }),

  startSelection: (x, y) => set({
    isSelecting: true,
    selectionStart: { x, y },
    selectionRect: { x, y, width: 0, height: 0 }
  }),

  updateSelection: (x, y) => {
    const { selectionStart, isSelecting } = get();
    if (!isSelecting || !selectionStart) return;

    const rect = {
      x: Math.min(selectionStart.x, x),
      y: Math.min(selectionStart.y, y),
      width: Math.abs(x - selectionStart.x),
      height: Math.abs(y - selectionStart.y)
    };

    set({ selectionRect: rect });
  },

  endSelection: () => set({ isSelecting: false }),

  clearSelection: () => set({
    selectionRect: null,
    isSelecting: false,
    selectionStart: null
  }),

  // 聊天面板开关
  isChatPanelOpen: false,
  toggleChatPanel: () => set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen })),
  setChatPanelOpen: (value) => set({ isChatPanelOpen: value }),

  // 显示分辨率
  displayResolution: null,
  setDisplayResolution: (resolution) => set({ displayResolution: resolution }),
}));
