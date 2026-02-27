import React, { useState, useEffect } from 'react';
import { ClaudeModel, CLAUDE_MODEL_NAMES, DEFAULT_API_BASE_URL } from '@shared/types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [model, setModel] = useState<ClaudeModel>('claude-sonnet-4-6');
  const [customModel, setCustomModel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setApiKey(config.claudeApiKey || '');
      setApiBaseUrl(config.claudeApiBaseUrl || DEFAULT_API_BASE_URL);
      setModel(config.claudeModel || 'claude-sonnet-4-6');
      setCustomModel(config.claudeCustomModel || '');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await window.electronAPI.setConfig({
        claudeApiKey: apiKey,
        claudeApiBaseUrl: apiBaseUrl,
        claudeModel: model,
        claudeCustomModel: customModel,
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

  // 常用中转服务
  const presetBaseUrls = [
    { name: 'Anthropic 官方', url: 'https://api.anthropic.com' },
    { name: '智谱 AI', url: 'https://open.bigmodel.cn/api/anthropic' },
    { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-800">
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
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
            />
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
          </div>

          {/* Custom Model Name (only show when custom is selected) */}
          {model === 'custom' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                自定义模型名称
              </label>
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="例如: GLM-5, gpt-4o..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                输入第三方服务支持的模型名称
              </p>
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
              高级设置
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 pl-2 border-l-2 border-gray-700">
              {/* API Base URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder={DEFAULT_API_BASE_URL}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  留空使用官方地址，或选择下方预设
                </p>

                {/* Preset buttons */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {presetBaseUrls.map((preset) => (
                    <button
                      key={preset.url}
                      onClick={() => setApiBaseUrl(preset.url)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        apiBaseUrl === preset.url
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Config for 智谱 AI */}
          <div className="bg-gray-700/50 rounded p-3">
            <h4 className="text-sm font-medium mb-2">快速配置 - 智谱 AI</h4>
            <div className="text-xs text-gray-400 space-y-1">
              <p>1. API Base URL 选择 "智谱 AI"</p>
              <p>2. 模型选择 "自定义模型"</p>
              <p>3. 输入模型名称: <code className="bg-gray-600 px-1 rounded">GLM-5</code></p>
              <p>4. 填入智谱 AI 的 API Key</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700 sticky bottom-0 bg-gray-800">
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
