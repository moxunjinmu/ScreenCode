import { create } from 'zustand';
import { Frame } from '@shared/types';
import { FRAME_QUEUE } from '@shared/constants';

interface FrameState {
  frames: Frame[];
  maxFrames: number;
  selectedFrameIds: string[];

  // 操作
  addFrame: (frame: Frame) => void;
  removeFrame: (frameId: string) => void;
  clearFrames: () => Promise<void>;
  setFrames: (frames: Frame[]) => void;
  toggleFrameSelection: (frameId: string) => void;
  selectFrame: (frameId: string) => void;
  deselectAllFrames: () => void;

  // 计算属性
  isFull: () => boolean;
  isEmpty: () => boolean;
}

export const useFrameStore = create<FrameState>((set, get) => ({
  frames: [],
  maxFrames: FRAME_QUEUE.MAX_FRAMES,
  selectedFrameIds: [],

  addFrame: (frame) => {
    const { frames, maxFrames } = get();
    if (frames.length >= maxFrames) {
      set({ frames: [frame, ...frames.slice(0, maxFrames - 1)] });
    } else {
      set({ frames: [frame, ...frames] });
    }
  },

  removeFrame: (frameId: string) => {
    set((state) => ({
      frames: state.frames.filter((f) => f.id !== frameId),
      selectedFrameIds: state.selectedFrameIds.filter((id) => id !== frameId),
    }));
  },

  clearFrames: async () => {
    try {
      await window.electronAPI.clearFrames();
    } catch (error) {
      console.error('Failed to clear frames via IPC:', error);
    }
    set({ frames: [], selectedFrameIds: [] });
  },

  setFrames: (frames) => set({ frames }),

  toggleFrameSelection: (frameId: string) => {
    const { selectedFrameIds } = get();
    const isSelected = selectedFrameIds.includes(frameId);
    if (isSelected) {
      set({ selectedFrameIds: selectedFrameIds.filter((id) => id !== frameId) });
    } else {
      set({ selectedFrameIds: [...selectedFrameIds, frameId] });
    }
  },

  selectFrame: (frameId: string) => {
    set({ selectedFrameIds: [frameId] });
  },

  deselectAllFrames: () => {
    set({ selectedFrameIds: [] });
  },

  isFull: () => get().frames.length >= get().maxFrames,
  isEmpty: () => get().frames.length === 0,
}));
