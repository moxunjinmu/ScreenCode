import React, { useRef, useEffect, useState } from 'react';
import { PanelRightClose, Plus, Send } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useFrameStore } from '../../store/frameStore';
import { electronAPI } from '../../lib/electronApi';
import { ChatMessage } from '@shared/types';
import { MAX_CHAT_IMAGES } from '@shared/constants';
import { v4 as uuidv4 } from 'uuid';
import type { EncodedImage } from '@shared/types';
import { toImageDataUrl } from '@shared/imageQuality';

interface ChatPanelProps {
  width?: number;
  onClose?: () => void;
  embedded?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ width, onClose, embedded = false }) => {
  const {
    messages,
    isLoading,
    selectedImages,
    inputText,
    currentModel,
    sessions,
    activeSessionId,
    addMessage,
    setLoading,
    clearSelectedImages,
    setInputText,
    setCurrentModel,
    createSession,
    switchSession,
    deleteSession,
  } = useChatStore();

  const { frames } = useFrameStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSessionList, setShowSessionList] = useState(false);

  // 获取当前模型名称 + 监听配置变更
  useEffect(() => {
    electronAPI.getConfig().then((config) => {
      const providerConfig = config.providerConfigs?.[config.activeProvider];
      setCurrentModel(providerConfig?.customModel || providerConfig?.model || '');
    });

    const unsubscribe = electronAPI.onConfigChanged((config) => {
      const providerConfig = config.providerConfigs?.[config.activeProvider];
      setCurrentModel(providerConfig?.customModel || providerConfig?.model || '');
    });

    return () => {
      unsubscribe();
    };
  }, [setCurrentModel]);

  // 滚动到底部
  useEffect(() => {
    const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [messages]);

  // 点击外部关闭会话列表
  useEffect(() => {
    if (!showSessionList) return;
    const handleClick = () => setShowSessionList(false);
    // 延迟注册，避免当前点击立即触发
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showSessionList]);

  // 发送消息
  const handleSend = async () => {
    if ((!inputText.trim() && selectedImages.length === 0) || isLoading) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: inputText.trim(),
      images: selectedImages.length > 0 ? [...selectedImages] : undefined,
      timestamp: Date.now(),
    };

    console.log('[ChatPanel] Sending message:', {
      hasImages: selectedImages.length > 0,
      imageCount: selectedImages.length,
      contentLength: inputText.trim().length,
    });

    addMessage(userMessage);
    setInputText('');
    clearSelectedImages();
    setLoading(true);

    try {
      // 使用最新的消息列表（包含刚添加的 userMessage）
      const allMessages = [...messages, userMessage];

      console.log('[ChatPanel] All messages to send:', {
        total: allMessages.length,
        withImages: allMessages.filter(m => m.images && m.images.length > 0).length,
      });

      const response = await electronAPI.chat({
        messages: allMessages.map(m => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
      });

      console.log('[ChatPanel] AI response received:', {
        contentLength: response.content.length,
      });

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
      };

      addMessage(assistantMessage);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `错误: ${error instanceof Error ? error.message : '请求失败'}`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 按键处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 图片数量已达上限，帧队列缩略图需切换为禁用态
  const isImageLimitReached = selectedImages.length >= MAX_CHAT_IMAGES;

  // 从帧队列添加图片
  const handleAddFromQueue = (image: EncodedImage) => {
    if (isImageLimitReached) return;
    useChatStore.getState().addSelectedImage(image);
  };

  return (
    <div
      className={`chat-panel h-full min-h-0 flex flex-col overflow-hidden${embedded ? '' : ' panel'}`}
      style={width ? { width } : undefined}
    >
      <div className="panel-header relative">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button
              onClick={onClose}
              className="btn p-1"
              title="收起面板"
            >
              <PanelRightClose size={14} />
            </button>
          )}

          <div className="relative min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSessionList(!showSessionList); }}
              className="panel-title flex items-center gap-2 hover:text-accent-text transition-colors"
            >
              AI 对话
              <span className="hint">{showSessionList ? '收起会话' : '切换会话'}</span>
            </button>

            {showSessionList && (
              <div
                className="absolute top-full left-0 mt-2 w-64 overlay z-20 max-h-60 overflow-y-auto p-1"
                onClick={(e) => e.stopPropagation()}
              >
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer group rounded-sm transition-colors ${
                      session.id === activeSessionId
                        ? 'bg-accent-subtle border border-accent-border text-accent-text'
                        : 'text-muted hover:bg-surface-3'
                    }`}
                  >
                    <span
                      className="truncate flex-1"
                      onClick={() => { switchSession(session.id); setShowSessionList(false); }}
                    >
                      {session.title}
                    </span>
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                        className="text-dim hover:text-danger opacity-0 group-hover:opacity-100 text-xs"
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="chip max-w-[170px] truncate">{currentModel || 'AI 模型未配置'}</span>
          <button
            onClick={() => { createSession(); setShowSessionList(false); }}
            className="btn p-1"
            title="新建会话"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm">
            <div className="text-center max-w-[240px]">
              <p className="font-medium">把帧队列中的截图加入消息，再补一句明确指令。</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 ${
                  msg.role === 'user'
                    ? 'msg-user'
                    : 'msg-assistant'
                }`}
              >
                {/* 图片 */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {msg.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={toImageDataUrl(img)}
                        alt={`图${idx + 1}`}
                        className="w-20 h-20 object-cover rounded-sm"
                      />
                    ))}
                  </div>
                )}
                {/* 文本 */}
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{msg.content}</pre>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="msg-assistant px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full" />
                <span className="text-sm text-muted">正在整理回复...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {frames.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            {isImageLimitReached && (
              <div className="hint text-accent-text">已达上限 {MAX_CHAT_IMAGES} 张，移除后可继续添加。</div>
            )}
            <span className="chip ml-auto">{frames.length} 帧可选</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {frames.map((frame) => (
              <img
                key={frame.id}
                src={toImageDataUrl(frame)}
                alt="帧"
                className={`w-14 h-14 object-cover rounded-md border transition-colors ${
                  isImageLimitReached
                    ? 'opacity-40 cursor-not-allowed border-transparent'
                    : 'cursor-pointer border-transparent hover:border-accent'
                }`}
                title={isImageLimitReached ? `最多添加 ${MAX_CHAT_IMAGES} 张图片` : '加入当前消息'}
                onClick={() => handleAddFromQueue(frame)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedImages.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <div className="text-xs text-muted mb-2">待发送图片</div>
          <div className="flex gap-2 flex-wrap">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative">
                <img
                  src={toImageDataUrl(img)}
                  alt={`选${idx + 1}`}
                  className="w-16 h-16 object-cover rounded-md"
                />
                <button
                  onClick={() => useChatStore.getState().removeSelectedImage(idx)}
                  className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-danger rounded-full text-white text-[10px]"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题或处理要求，例如：请合并这几张图里的函数并补全遗漏的类型。"
            className="input flex-1 px-3 py-2 text-sm resize-none"
            rows={3}
            disabled={isLoading}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="hint">
            已选图片 {selectedImages.length}/{MAX_CHAT_IMAGES}，Enter 发送，Shift+Enter 换行
          </span>
          <button
            onClick={handleSend}
            disabled={isLoading || (!inputText.trim() && selectedImages.length === 0)}
            className="btn-primary px-3 py-1.5 text-sm"
          >
            <Send size={14} />
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
