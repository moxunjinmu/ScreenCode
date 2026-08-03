import React from 'react';
import { Bot, Code2 } from 'lucide-react';
import ChatPanel from '../ChatPanel';
import CodeDisplay from '../CodeDisplay';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';

/**
 * 代码结果与 AI 对话共用的输出工作区。
 * 两个视图始终挂载，切换仅改变可见状态，避免重置代码与聊天输入。
 */
const OutputWorkspace: React.FC = () => {
  const activeOutputView = useUIStore((state) => state.activeOutputView);
  const setOutputView = useUIStore((state) => state.setOutputView);
  const messageCount = useChatStore((state) => state.messages.length);

  return (
    <div className="output-workspace">
      <div className="output-tabs" role="tablist" aria-label="输出工作区">
        <button
          type="button"
          role="tab"
          aria-selected={activeOutputView === 'code'}
          className={`workspace-tab${activeOutputView === 'code' ? ' is-active' : ''}`}
          onClick={() => setOutputView('code')}
        >
          <Code2 size={14} />
          <span>代码结果</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeOutputView === 'chat'}
          className={`workspace-tab${activeOutputView === 'chat' ? ' is-active' : ''}`}
          onClick={() => setOutputView('chat')}
        >
          <Bot size={14} />
          <span>AI 对话</span>
          <span className="ai-state-dot" aria-hidden="true" />
          {messageCount > 0 && <span className="tab-badge">{messageCount}</span>}
        </button>
      </div>

      <div className="output-views">
        <section
          role="tabpanel"
          aria-hidden={activeOutputView !== 'code'}
          className={`output-view${activeOutputView === 'code' ? ' is-active' : ''}`}
        >
          <CodeDisplay embedded />
        </section>
        <section
          role="tabpanel"
          aria-hidden={activeOutputView !== 'chat'}
          className={`output-view${activeOutputView === 'chat' ? ' is-active' : ''}`}
        >
          <ChatPanel embedded />
        </section>
      </div>
    </div>
  );
};

export default OutputWorkspace;
