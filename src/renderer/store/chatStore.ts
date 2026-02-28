import { create } from 'zustand';
import { ChatMessage, ChatSession } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedImages: string[];
  inputText: string;
  currentModel: string;

  // 会话管理
  sessions: ChatSession[];
  activeSessionId: string;

  // 消息操作
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setSelectedImages: (images: string[]) => void;
  addSelectedImage: (image: string) => void;
  removeSelectedImage: (index: number) => void;
  clearSelectedImages: () => void;
  setInputText: (text: string) => void;

  // 模型
  setCurrentModel: (model: string) => void;

  // 会话操作
  createSession: () => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
}

const initialSessionId = uuidv4();

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  selectedImages: [],
  inputText: '',
  currentModel: '',
  sessions: [{ id: initialSessionId, title: '新会话', messages: [], createdAt: Date.now() }],
  activeSessionId: initialSessionId,

  // 添加消息（同步更新会话）
  addMessage: (message) => set((state) => {
    const newMessages = [...state.messages, message];
    const sessions = state.sessions.map((s) =>
      s.id === state.activeSessionId
        ? {
            ...s,
            messages: newMessages,
            title: s.title === '新会话' && message.role === 'user'
              ? message.content.slice(0, 20) || '新会话'
              : s.title,
          }
        : s
    );
    return { messages: newMessages, sessions };
  }),

  setMessages: (messages) => set({ messages }),

  clearMessages: () => set((state) => ({
    messages: [],
    sessions: state.sessions.map((s) =>
      s.id === state.activeSessionId ? { ...s, messages: [] } : s
    ),
  })),

  setLoading: (loading) => set({ isLoading: loading }),

  setSelectedImages: (images) => set({ selectedImages: images }),

  addSelectedImage: (image) => set((state) => ({
    selectedImages: [...state.selectedImages, image],
  })),

  removeSelectedImage: (index) => set((state) => ({
    selectedImages: state.selectedImages.filter((_, i) => i !== index),
  })),

  clearSelectedImages: () => set({ selectedImages: [] }),

  setInputText: (text) => set({ inputText: text }),

  setCurrentModel: (model) => set({ currentModel: model }),

  // 新建会话
  createSession: () => set((state) => {
    const newId = uuidv4();
    const newSession: ChatSession = {
      id: newId,
      title: '新会话',
      messages: [],
      createdAt: Date.now(),
    };
    return {
      sessions: [...state.sessions, newSession],
      activeSessionId: newId,
      messages: [],
      inputText: '',
      selectedImages: [],
    };
  }),

  // 切换会话
  switchSession: (sessionId) => set((state) => {
    const target = state.sessions.find((s) => s.id === sessionId);
    if (!target || sessionId === state.activeSessionId) return state;
    return {
      activeSessionId: sessionId,
      messages: [...target.messages],
      inputText: '',
      selectedImages: [],
    };
  }),

  // 删除会话
  deleteSession: (sessionId) => set((state) => {
    const filtered = state.sessions.filter((s) => s.id !== sessionId);
    if (sessionId === state.activeSessionId) {
      if (filtered.length === 0) {
        const newId = uuidv4();
        return {
          sessions: [{ id: newId, title: '新会话', messages: [], createdAt: Date.now() }],
          activeSessionId: newId,
          messages: [],
        };
      }
      const last = filtered[filtered.length - 1];
      return {
        sessions: filtered,
        activeSessionId: last.id,
        messages: [...last.messages],
      };
    }
    return { sessions: filtered };
  }),
}));
