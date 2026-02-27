import React, { useState, useEffect } from 'react';
import { ClaudeModel, CLAUDE_MODEL_NAMES } from '@shared/types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<ClaudeModel>('claude-sonnet-4-6');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setApiKey(config.claudeApiKey || '');
      setModel(config.claudeModel || 'claude-sonnet-4-6');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await window.electronAPI.setConfig({
        claudeApiKey: apiKey,
        claudeModel: model
      });
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setIsSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Claude API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-api..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              从 <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">Anthropic Console</a> 获取 API Key
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              AI 模型
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as ClaudeModel)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
            >
              {Object.entries(CLAUDE_MODEL_NAMES).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Sonnet 4.6 推荐 - 平衡速度与效果；Opus 4.6 最强但较慢
            </p>
          </div>

          {/* Model Info */}
          <div className="bg-gray-700/50 rounded p-3">
            <h4 className="text-sm font-medium mb-2">模型说明</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• <span className="text-primary-400">Opus 4.6</span> - 最强推理能力，复杂代码识别</li>
              <li>• <span className="text-green-400">Sonnet 4.6</span> - 推荐，平衡速度与质量</li>
              <li>• <span className="text-gray-300">3.5 Sonnet</span> - 稳定版本，兼容性好</li>
            </ul>
          </div>

          {/* Tips */}
          <div className="bg-gray-700/50 rounded p-3">
            <h4 className="text-sm font-medium mb-2">使用说明</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• API Key 将安全存储在本地</li>
              <li>• 截图将发送到 Claude API 进行代码识别</li>
              <li>• 请确保网络可以访问 api.anthropic.com</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              isSaved
                ? 'bg-green-600 text-white'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            {isSaving ? '保存中...' : isSaved ? '已保存 ✓' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
