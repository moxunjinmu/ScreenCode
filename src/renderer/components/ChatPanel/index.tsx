import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useFrameStore } from '../../store/frameStore';
import { electronAPI } from '../../lib/electronApi';
import { ChatMessage } from '@shared/types';
import { MAX_CHAT_IMAGES } from '@shared/constants';
import { v4 as uuidv4 } from 'uuid';

interface ChatPanelProps {
  width: number;
  onClose?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ width, onClose }) => {
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
  const handleAddFromQueue = (frameData: string) => {
    if (isImageLimitReached) return;
    useChatStore.getState().addSelectedImage(frameData);
  };

  return (
    <div className="h-full min-h-0 flex flex-col glass-medium border border-white/[0.08] overflow-hidden" style={{ width }}>
      <div className="px-4 py-3 border-b border-white/[0.08] relative bg-slate-950/15">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            {onClose && (
              <button
                onClick={onClose}
                className="glass-btn px-3 py-1.5 text-xs text-slate-200 mt-0.5"
                title="收起聊天面板"
              >
                收起
              </button>
            )}

            <div className="min-w-0">
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSessionList(!showSessionList); }}
                  className="panel-heading flex items-center gap-2 hover:text-primary-300 transition-colors"
                >
                  AI 对话
                  <span className="text-xs text-slate-400">{showSessionList ? '收起会话' : '切换会话'}</span>
                </button>

                {showSessionList && (
                  <div
                    className="absolute top-full left-0 mt-2 w-64 glass-heavy shadow-glass-lg z-20 max-h-60 overflow-y-auto p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer group rounded-lg transition-all ${
                          session.id === activeSessionId
                            ? 'bg-primary-600/20 border border-primary-500/20 text-white'
                            : 'text-gray-300 hover:bg-white/[0.06]'
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
                            className="text-slate-500 hover:text-red-300 opacity-0 group-hover:opacity-100 text-xs"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="panel-subheading mt-1">围绕截图做 OCR、补全和解释，支持多轮追问。</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="status-chip max-w-[170px] truncate">{currentModel || 'AI 模型未配置'}</span>
            <button
              onClick={() => { createSession(); setShowSessionList(false); }}
              className="glass-btn px-3 py-1.5 text-xs text-slate-200"
              title="新建会话"
            >
              新建会话
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm">
            <div className="text-center max-w-[240px]">
              <p className="text-slate-100 font-medium">把帧队列中的截图加入消息，再补一句明确指令。</p>
              <p className="text-xs text-slate-400 mt-2">例如“识别这段 TypeScript 并补全缺失的 import”，支持多图 OCR。</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 ${
                  msg.role === 'user'
                    ? 'glass-msg-user text-white'
                    : 'glass-msg-assistant text-gray-200'
                }`}
              >
                {/* 图片 */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {msg.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={`data:image/jpeg;base64,${img}`}
                        alt={`图${idx + 1}`}
                        className="w-20 h-20 object-cover rounded"
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
            <div className="glass-msg-assistant px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                <span className="text-sm text-slate-300">正在整理回复...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {frames.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.08] bg-slate-950/10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className="text-xs text-slate-300">从帧队列添加</div>
              <div className={`text-[11px] mt-1 ${isImageLimitReached ? 'text-amber-300' : 'text-slate-500'}`}>
                {isImageLimitReached
                  ? `已达上限 ${MAX_CHAT_IMAGES} 张，移除后可继续添加。`
                  : `点击缩略图即可加入当前消息，最多 ${MAX_CHAT_IMAGES} 张。`}
              </div>
            </div>
            <span className="status-chip">{frames.length} 帧可选</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {frames.map((frame) => (
              <img
                key={frame.id}
                src={`data:image/jpeg;base64,${frame.data}`}
                alt="帧"
                className={`w-14 h-14 object-cover rounded-lg transition-opacity ${
                  isImageLimitReached
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:ring-2 hover:ring-primary-500/40'
                }`}
                title={isImageLimitReached ? `最多添加 ${MAX_CHAT_IMAGES} 张图片` : '加入当前消息'}
                onClick={() => handleAddFromQueue(frame.data)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedImages.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.08]">
          <div className="text-xs text-slate-300 mb-2">待发送图片</div>
          <div className="flex gap-2 flex-wrap">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative">
                <img
                  src={`data:image/jpeg;base64,${img}`}
                  alt={`选${idx + 1}`}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <button
                  onClick={() => useChatStore.getState().removeSelectedImage(idx)}
                  className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 rounded-full text-white text-[10px]"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-white/[0.08] bg-slate-950/15">
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题或处理要求，例如：请合并这几张图里的函数并补全遗漏的类型。"
            className="glass-input flex-1 px-3 py-3 text-sm resize-none"
            rows={3}
            disabled={isLoading}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-slate-400">
            已选图片 {selectedImages.length}/{MAX_CHAT_IMAGES}，Enter 发送，Shift+Enter 换行
          </span>
          <button
            onClick={handleSend}
            disabled={isLoading || (!inputText.trim() && selectedImages.length === 0)}
            className="glass-btn-primary px-4 py-1.5 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
