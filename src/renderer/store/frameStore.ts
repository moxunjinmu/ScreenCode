import { create } from 'zustand';
import { Frame } from '@shared/types';
import { FRAME_QUEUE } from '@shared/constants';

interface FrameState {
  frames: Frame[];
  maxFrames: number;
  
  // 操作
  addFrame: (frame: Frame) => void;
  removeFrame: (frameId: string) => void;
  clearFrames: () => Promise<void>;
  setFrames: (frames: Frame[]) => void;
  
  // 计算属性
  isFull: () => boolean;
  isEmpty: () => boolean;
}

export const useFrameStore = create<FrameState>((set, get) => ({
  frames: [],
  maxFrames: FRAME_QUEUE.MAX_FRAMES,
  
  addFrame: (frame) => {
    const { frames, maxFrames } = get();
    if (frames.length >= maxFrames) {
      // 移除最早的帧
      set({ frames: [...frames.slice(1), frame] });
    } else {
      set({ frames: [...frames, frame] });
    }
  },
  
  removeFrame: (frameId) => {
    set((state) => ({
      frames: state.frames.filter((f) => f.id !== frameId),
    }));
  },
  
  clearFrames: async () => {
    try {
      await window.electronAPI.clearFrames();
    } catch (error) {
      console.error('Failed to clear frames via IPC:', error);
    }
    set({ frames: [] });
  },
  
  setFrames: (frames) => set({ frames }),
  
  isFull: () => get().frames.length >= get().maxFrames,
  isEmpty: () => get().frames.length === 0,
}));
