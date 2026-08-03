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
  clearFrames: () => void;
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
    const { frames, maxFrames, selectedFrameIds } = get();
    if (frames.length >= maxFrames) {
      // 队列已满：顶掉最旧帧，同步清理其选中态；新帧默认选中
      const evictedId = frames[maxFrames - 1]?.id;
      set({
        frames: [frame, ...frames.slice(0, maxFrames - 1)],
        selectedFrameIds: [frame.id, ...selectedFrameIds.filter((id) => id !== evictedId)],
      });
    } else {
      // 新帧默认选中，提取以选中帧为准
      set({
        frames: [frame, ...frames],
        selectedFrameIds: [...selectedFrameIds, frame.id],
      });
    }
  },

  removeFrame: (frameId: string) => {
    set((state) => ({
      frames: state.frames.filter((f) => f.id !== frameId),
      selectedFrameIds: state.selectedFrameIds.filter((id) => id !== frameId),
    }));
  },

  clearFrames: () => set({ frames: [], selectedFrameIds: [] }),

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
