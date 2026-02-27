import React, { useState, useEffect } from 'react';
import { ClaudeModel, CLAUDE_MODEL_NAMES, DEFAULT_API_BASE_URL, ApiProvider, DEFAULT_PROVIDERS } from '@shared/types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [model, setModel] = useState<ClaudeModel>('claude-sonnet-4-6');
  const [customModel, setCustomModel] = useState('');
  const [providers, setProviders] = useState<ApiProvider[]>(DEFAULT_PROVIDERS);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 新供应商表单
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderUrl, setNewProviderUrl] = useState('');
  const [showAddProvider, setShowAddProvider] = useState(false);

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
      setProviders(config.apiProviders || DEFAULT_PROVIDERS);
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
        apiProviders: providers,
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

  // 添加供应商
  const handleAddProvider = () => {
    if (!newProviderName.trim() || !newProviderUrl.trim()) return;

    const newProvider: ApiProvider = {
      id: `custom_${Date.now()}`,
      name: newProviderName.trim(),
      baseUrl: newProviderUrl.trim(),
    };

    setProviders([...providers, newProvider]);
    setNewProviderName('');
    setNewProviderUrl('');
    setShowAddProvider(false);
  };

  // 删除供应商
  const handleDeleteProvider = (id: string) => {
    setProviders(providers.filter(p => p.id !== id));
  };

  // 选择供应商
  const handleSelectProvider = (baseUrl: string) => {
    setApiBaseUrl(baseUrl);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
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

          {/* API Provider */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              API 供应商
            </label>
            <div className="space-y-2">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    apiBaseUrl === provider.baseUrl
                      ? 'bg-primary-600/30 border border-primary-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => handleSelectProvider(provider.baseUrl)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      apiBaseUrl === provider.baseUrl ? 'bg-primary-400' : 'bg-gray-500'
                    }`} />
                    <div>
                      <div className="text-sm">{provider.name}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[200px]">{provider.baseUrl}</div>
                    </div>
                  </div>
                  {/* 删除按钮 - 只对自定义供应商显示 */}
                  {provider.id.startsWith('custom_') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProvider(provider.id);
                      }}
                      className="text-gray-400 hover:text-red-400 px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 添加供应商 */}
            {showAddProvider ? (
              <div className="mt-2 p-3 bg-gray-700 rounded space-y-2">
                <input
                  type="text"
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="供应商名称"
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-sm focus:outline-none focus:border-primary-500"
                />
                <input
                  type="text"
                  value={newProviderUrl}
                  onChange={(e) => setNewProviderUrl(e.target.value)}
                  placeholder="API Base URL"
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-sm focus:outline-none focus:border-primary-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddProvider(false)}
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-600 rounded hover:bg-gray-500"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddProvider}
                    disabled={!newProviderName.trim() || !newProviderUrl.trim()}
                    className="flex-1 px-3 py-1.5 text-sm bg-primary-600 rounded hover:bg-primary-500 disabled:opacity-50"
                  >
                    添加
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddProvider(true)}
                className="mt-2 w-full px-3 py-2 text-sm bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center gap-1"
              >
                <span>+</span> 添加供应商
              </button>
            )}
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

          {/* Custom Model Name */}
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
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  自定义 Base URL
                </label>
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder={DEFAULT_API_BASE_URL}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  手动输入或从上方供应商列表选择
                </p>
              </div>
            </div>
          )}
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
