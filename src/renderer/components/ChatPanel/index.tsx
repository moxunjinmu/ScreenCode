import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useFrameStore } from '../../store/frameStore';
import { ChatMessage } from '@shared/types';
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showSessionList, setShowSessionList] = useState(false);

  // 获取当前模型名称 + 监听配置变更
  useEffect(() => {
    window.electronAPI.getConfig().then((config) => {
      const providerConfig = config.providerConfigs?.[config.activeProvider];
      setCurrentModel(providerConfig?.customModel || providerConfig?.model || '');
    });

    const unsubscribe = window.electronAPI.onConfigChanged((config) => {
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

    addMessage(userMessage);
    setInputText('');
    clearSelectedImages();
    setLoading(true);

    try {
      const response = await window.electronAPI.chat({
        messages: messages.concat(userMessage).map(m => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
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

  // 从帧队列添加图片
  const handleAddFromQueue = (frameData: string) => {
    if (selectedImages.length < 4) {
      useChatStore.getState().addSelectedImage(frameData);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800" style={{ width }}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 relative">
        {/* 左侧：关闭按钮 */}
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white mr-2 transition-colors"
            title="关闭聊天面板"
          >
            ▶
          </button>
        )}

        {/* 会话列表触发 */}
        <div className="relative flex-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSessionList(!showSessionList); }}
            className="text-sm font-medium hover:text-primary-400 flex items-center gap-1"
          >
            <span>AI 对话</span>
            <span className="text-xs text-gray-500">▼</span>
          </button>

          {/* 会话列表下拉 */}
          {showSessionList && (
            <div
              className="absolute top-full left-0 mt-1 w-56 bg-gray-700 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer group ${
                    session.id === activeSessionId
                      ? 'bg-primary-600/30 text-white'
                      : 'text-gray-300 hover:bg-gray-600'
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
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 ml-2 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 中间：模型名 */}
        <span className="text-xs text-gray-500">{currentModel || 'AI'}</span>

        {/* 右侧：新建会话 */}
        <button
          onClick={() => { createSession(); setShowSessionList(false); }}
          className="text-gray-400 hover:text-white text-lg"
          title="新建会话"
        >
          +
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            <div className="text-center">
              <p className="mb-2">选择截图并发送提示词</p>
              <p className="text-xs text-gray-600">支持多图 OCR 识别</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-200'
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
                <pre className="whitespace-pre-wrap text-sm font-sans">{msg.content}</pre>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                <span className="text-sm text-gray-400">思考中...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 选择的帧队列图片 */}
      {frames.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">点击添加到消息:</div>
          <div className="flex gap-2 overflow-x-auto">
            {frames.map((frame) => (
              <img
                key={frame.id}
                src={`data:image/jpeg;base64,${frame.data}`}
                alt="帧"
                className="w-12 h-12 object-cover rounded cursor-pointer hover:ring-2 hover:ring-primary-500"
                onClick={() => handleAddFromQueue(frame.data)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已选择的图片 */}
      {selectedImages.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-700">
          <div className="flex gap-2 flex-wrap">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative">
                <img
                  src={`data:image/jpeg;base64,${img}`}
                  alt={`选${idx + 1}`}
                  className="w-16 h-16 object-cover rounded"
                />
                <button
                  onClick={() => useChatStore.getState().removeSelectedImage(idx)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入提示词... (Shift+Enter 换行)"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm resize-none focus:outline-none focus:border-primary-500"
            rows={3}
            disabled={isLoading}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500">
            {selectedImages.length}/4 张图片
          </span>
          <button
            onClick={handleSend}
            disabled={isLoading || (!inputText.trim() && selectedImages.length === 0)}
            className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm rounded transition-colors"
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
