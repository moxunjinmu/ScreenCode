import { create } from 'zustand';
import { ChatMessage } from '@shared/types';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedImages: string[];  // 选中的图片 base64
  inputText: string;

  // 操作
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setSelectedImages: (images: string[]) => void;
  addSelectedImage: (image: string) => void;
  removeSelectedImage: (index: number) => void;
  clearSelectedImages: () => void;
  setInputText: (text: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  selectedImages: [],
  inputText: '',

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  setMessages: (messages) => set({ messages }),

  clearMessages: () => set({ messages: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  setSelectedImages: (images) => set({ selectedImages: images }),

  addSelectedImage: (image) => set((state) => ({
    selectedImages: [...state.selectedImages, image]
  })),

  removeSelectedImage: (index) => set((state) => ({
    selectedImages: state.selectedImages.filter((_, i) => i !== index)
  })),

  clearSelectedImages: () => set({ selectedImages: [] }),

  setInputText: (text) => set({ inputText: text }),
}));
