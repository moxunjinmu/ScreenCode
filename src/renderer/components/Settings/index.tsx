import React, { useState, useEffect } from 'react';
import { ApiProvider, ProviderConfig, DEFAULT_PROVIDERS } from '@shared/types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppConfig {
  activeProvider: string;
  providerConfigs: {
    [providerId: string]: ProviderConfig;
  };
  apiProviders?: ApiProvider[];
  lastDeviceId: string | null;
  toastDuration: number;
  frameDiffThreshold: number;
  maxFrames: number;
  compressionWidth: number;
  compressionQuality: number;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeProviderId, setActiveProviderId] = useState('zhipu');
  const [activeProviderConfig, setActiveProviderConfig] = useState<ProviderConfig | null>(null);
  const [providers, setProviders] = useState<ApiProvider[]>(DEFAULT_PROVIDERS);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // 同步 JSON 文本
  useEffect(() => {
    if (config) {
      setJsonText(JSON.stringify(config, null, 2));
    }
  }, [config]);

  const loadSettings = async () => {
    try {
      const loadedConfig = await window.electronAPI.getConfig();
      setConfig(loadedConfig);
      setActiveProviderId(loadedConfig.activeProvider || 'zhipu');
      setProviders(loadedConfig.apiProviders || DEFAULT_PROVIDERS);
      
      if (loadedConfig.providerConfigs && loadedConfig.activeProvider) {
        setActiveProviderConfig(loadedConfig.providerConfigs[loadedConfig.activeProvider]);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSelectProvider = async (providerId: string) => {
    if (!config) return;

    setActiveProviderId(providerId);
    const newConfig = config.providerConfigs[providerId] || {
      apiKey: '',
      baseUrl: providers.find(p => p.id === providerId)?.baseUrl || '',
      model: providers.find(p => p.id === providerId)?.models?.[0] || '',
    };
    setActiveProviderConfig(newConfig);

    // 更新 config 状态
    const updatedConfig = {
      ...config,
      activeProvider: providerId,
    };
    setConfig(updatedConfig);

    // 保存激活的供应商
    await window.electronAPI.setConfig(updatedConfig);
  };

  // 当输入框改变时，同步更新 config 和 JSON
  const handleConfigChange = (field: keyof ProviderConfig, value: string | number) => {
    if (!activeProviderConfig || !config) return;

    const updatedProviderConfig = {
      ...activeProviderConfig,
      [field]: value,
    };
    setActiveProviderConfig(updatedProviderConfig);

    // 同步更新 config
    const updatedConfig = {
      ...config,
      providerConfigs: {
        ...config.providerConfigs,
        [activeProviderId]: updatedProviderConfig,
      },
    };
    setConfig(updatedConfig);
  };

  // 当 JSON 改变时，同步更新输入框
  const handleJsonChange = (json: string) => {
    setJsonText(json);
    setJsonError('');

    try {
      const parsed = JSON.parse(json);
      
      // 更新 config
      setConfig(parsed);
      
      // 更新激活供应商
      if (parsed.activeProvider) {
        setActiveProviderId(parsed.activeProvider);
      }
      
      // 更新激活供应商配置
      if (parsed.providerConfigs && parsed.activeProvider) {
        setActiveProviderConfig(parsed.providerConfigs[parsed.activeProvider]);
      }
      
      // 更新供应商列表
      if (parsed.apiProviders) {
        setProviders(parsed.apiProviders);
      }
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      await window.electronAPI.setConfig(config);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
    setIsSaving(false);
  };

  if (!isOpen || !config) return null;

  const currentProvider = providers.find(p => p.id === activeProviderId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              API Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => handleSelectProvider(provider.id)}
                  className={`p-3 rounded cursor-pointer transition-colors border ${
                    activeProviderId === provider.id
                      ? 'bg-primary-600/30 border-primary-500'
                      : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  <div className="text-sm font-medium">{provider.name}</div>
                  <div className="text-xs text-gray-400 truncate mt-1">{provider.baseUrl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Provider Config */}
          {activeProviderConfig && currentProvider && (
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                {currentProvider.name} Configuration
              </h3>
              
              <div className="space-y-3">
                {/* API Key */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">API Key</label>
                  <input
                    type="password"
                    value={activeProviderConfig.apiKey || ''}
                    onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                    placeholder="Enter API Key..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={activeProviderConfig.baseUrl || ''}
                    onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                    placeholder="https://api.example.com"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Model</label>
                  <select
                    value={activeProviderConfig.model || ''}
                    onChange={(e) => handleConfigChange('model', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                  >
                    {currentProvider.models?.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                    <option value="custom">Custom Model</option>
                  </select>
                </div>

                {/* Custom Model */}
                {activeProviderConfig.model === 'custom' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Custom Model Name</label>
                    <input
                      type="text"
                      value={activeProviderConfig.customModel || ''}
                      onChange={(e) => handleConfigChange('customModel', e.target.value)}
                      placeholder="e.g., glm-5, gpt-4o..."
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                    />
                  </div>
                )}

                {/* Advanced Settings */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max Tokens</label>
                    <input
                      type="number"
                      value={activeProviderConfig.maxTokens || 8192}
                      onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={activeProviderConfig.temperature || 0.7}
                      onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* SDK Type Selection (for custom providers) */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    SDK Type
                    <span className="ml-2 text-gray-500">(第三方中转端点需手动选择)</span>
                  </label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => handleConfigChange('sdkType', 'openai')}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-colors border ${
                        activeProviderConfig.sdkType === 'openai'
                          ? 'bg-green-600/30 border-green-500 text-green-400'
                          : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      OpenAI 格式 (/v1/chat/completions)
                    </button>
                    <button
                      onClick={() => handleConfigChange('sdkType', 'anthropic')}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-colors border ${
                        activeProviderConfig.sdkType === 'anthropic'
                          ? 'bg-purple-600/30 border-purple-500 text-purple-400'
                          : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      Anthropic 格式 (/v1/messages)
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前 Base URL: {activeProviderConfig.baseUrl} | 
                    {activeProviderConfig.sdkType 
                      ? ` 已手动指定为 ${activeProviderConfig.sdkType.toUpperCase()} SDK`
                      : ' 自动检测'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* JSON Editor Toggle */}
          <div className="border-t border-gray-700 pt-4">
            <button
              onClick={() => setShowJsonEditor(!showJsonEditor)}
              className="text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
            >
              <span className={`transform transition-transform ${showJsonEditor ? 'rotate-90' : ''}`}>▶</span>
              Advanced: Edit Full JSON Config
            </button>
          </div>

          {/* JSON Editor */}
          {showJsonEditor && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 mb-1">
                Edit full configuration JSON (changes sync automatically)
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="w-full h-96 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-xs font-mono text-green-400 focus:outline-none focus:border-primary-500 resize-none"
                spellCheck={false}
              />
              
              {jsonError && (
                <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-800">
                  ⚠️ {jsonError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700 sticky bottom-0 bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
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
            {isSaving ? 'Saving...' : isSaved ? 'Saved ✓' : 'Save All'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
