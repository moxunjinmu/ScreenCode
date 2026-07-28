import React, { useState, useEffect } from 'react';
import { ApiProvider, ProviderConfig, DEFAULT_PROVIDERS } from '@shared/types';
import { electronAPI } from '../../lib/electronApi';

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
      const loadedConfig = await electronAPI.getConfig();
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
    await electronAPI.setConfig(updatedConfig);
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
      await electronAPI.setConfig(config);
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
    <div className="fixed inset-0 z-50 bg-slate-950/78 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-strong shadow-glass-lg rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08] sticky top-0 glass-medium z-10" style={{ borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 className="text-lg font-semibold">应用设置</h2>
            <p className="panel-subheading mt-1">统一管理模型供应商、接口参数和完整配置 JSON。</p>
          </div>
          <button
            onClick={onClose}
            className="glass-btn px-3 py-1.5 text-sm text-slate-200"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-4">
          <div className="glass-subtle p-4">
            <label className="block text-sm text-slate-300 mb-2">
              供应商选择
            </label>
            <p className="panel-subheading mb-3">切换后会立即更新当前激活的模型供应商，详细参数在下方编辑。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {providers.map((provider) => (
                <button
                  type="button"
                  key={provider.id}
                  onClick={() => handleSelectProvider(provider.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border text-left ${
                    activeProviderId === provider.id
                      ? 'bg-primary-600/20 border-primary-500/40 shadow-glass-glow'
                      : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="text-sm font-medium">{provider.name}</div>
                  <div className="text-xs text-slate-400 truncate mt-1">{provider.baseUrl}</div>
                </button>
              ))}
            </div>
          </div>

          {activeProviderConfig && currentProvider && (
            <div className="glass-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-medium text-slate-200">
                  当前配置：{currentProvider.name}
                </h3>
                <span className="status-chip">当前供应商 ID：{activeProviderId}</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">API Key</label>
                      <input
                        type="password"
                        value={activeProviderConfig.apiKey || ''}
                        onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                        placeholder="输入 API Key"
                        className="glass-input w-full px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Base URL</label>
                      <input
                        type="text"
                        value={activeProviderConfig.baseUrl || ''}
                        onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                        placeholder="例如 https://api.example.com"
                        className="glass-input w-full px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 mb-1">模型</label>
                      <select
                        value={activeProviderConfig.model || ''}
                        onChange={(e) => handleConfigChange('model', e.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm"
                      >
                        {currentProvider.models?.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                        <option value="custom">自定义模型</option>
                      </select>
                    </div>

                    {activeProviderConfig.model === 'custom' && (
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">自定义模型名</label>
                        <input
                          type="text"
                          value={activeProviderConfig.customModel || ''}
                          onChange={(e) => handleConfigChange('customModel', e.target.value)}
                          placeholder="例如 glm-5、gpt-4o"
                          className="glass-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">最大 Token</label>
                        <input
                          type="number"
                          value={activeProviderConfig.maxTokens || 8192}
                          onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
                          className="glass-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Temperature</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={activeProviderConfig.temperature || 0.7}
                          onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                          className="glass-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <label className="block text-xs text-slate-300 mb-1">
                        SDK 请求格式
                        <span className="ml-2 text-slate-500">第三方中转端点建议手动指定</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() => handleConfigChange('sdkType', 'openai')}
                          className={`px-3 py-2 rounded-lg text-sm transition-all border ${
                            activeProviderConfig.sdkType === 'openai'
                              ? 'bg-sky-600/20 border-sky-500/40 text-sky-300'
                              : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]'
                          }`}
                        >
                          OpenAI 格式
                          <div className="text-[11px] mt-1 opacity-80">/v1/chat/completions</div>
                        </button>
                        <button
                          onClick={() => handleConfigChange('sdkType', 'anthropic')}
                          className={`px-3 py-2 rounded-lg text-sm transition-all border ${
                            activeProviderConfig.sdkType === 'anthropic'
                              ? 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                              : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]'
                          }`}
                        >
                          Anthropic 格式
                          <div className="text-[11px] mt-1 opacity-80">/v1/messages</div>
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-3 break-all">
                        当前 Base URL：{activeProviderConfig.baseUrl || '未设置'}
                        {activeProviderConfig.sdkType
                          ? `，已手动指定为 ${activeProviderConfig.sdkType.toUpperCase()} SDK`
                          : '，当前为自动检测'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="glass-subtle p-4">
            <button
              onClick={() => setShowJsonEditor(!showJsonEditor)}
              className="text-sm text-yellow-300 hover:text-yellow-200 flex items-center gap-2"
            >
              <span className={`transform transition-transform ${showJsonEditor ? 'rotate-90' : ''}`}>▶</span>
              高级模式：直接编辑完整 JSON 配置
            </button>
            <p className="panel-subheading mt-2">适合批量调整供应商列表、默认值和实验性字段。</p>

            {showJsonEditor && (
              <div className="space-y-2 mt-4">
                <div className="text-xs text-slate-400 mb-1">
                  直接修改完整配置 JSON，输入框与当前表单会保持同步。
                </div>
                <textarea
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="glass-input w-full h-96 px-3 py-2 text-xs font-mono text-green-300 resize-none bg-black/20"
                  spellCheck={false}
                />

                {jsonError && (
                  <div className="text-xs text-red-300 bg-red-600/10 p-2 rounded-lg border border-red-500/20">
                    JSON 解析失败：{jsonError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-white/[0.08] glass-medium shrink-0" style={{ borderRadius: '0 0 16px 16px' }}>
          <button
            onClick={onClose}
            className="glass-btn px-4 py-2 text-sm text-slate-200"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 text-sm rounded-lg transition-all ${
              isSaved
                ? 'glass-btn-success text-green-200'
                : 'glass-btn-primary text-white'
            }`}
          >
            {isSaving ? '保存中...' : isSaved ? '已保存' : '保存全部'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
