import React, { useState, useEffect } from 'react';
import {
  ApiProvider,
  ProviderConfig,
  DEFAULT_PROVIDERS,
  type AiImageQuality,
  type AppConfig,
  type CaptureQualityStrategy,
} from '@shared/types';
import { AI_IMAGE_QUALITY_PROFILES } from '@shared/imageQuality';
import { electronAPI } from '../../lib/electronApi';
import Select from '../Select';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
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
  const [isRendered, setIsRendered] = useState(isOpen);

  // 关闭时延迟卸载，让遮罩和面板有完整的退出过渡。
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      return undefined;
    }

    const timer = window.setTimeout(() => setIsRendered(false), 180);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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

  const handleAppConfigChange = <K extends keyof AppConfig>(field: K, value: AppConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
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

  if (!isRendered || !config) return null;

  const currentProvider = providers.find(p => p.id === activeProviderId);

  return (
    // 全屏遮罩：唯一保留 backdrop-blur 的位置（规范 2.3），背后确实是主界面内容
    <div
      className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      data-state={isOpen ? 'open' : 'closed'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="settings-modal overlay w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-surface-1 z-10">
          <div>
            <h2 id="settings-title" className="panel-title">应用设置</h2>
            <p className="hint mt-1">统一管理模型供应商、接口参数和完整配置 JSON。</p>
          </div>
          <button
            onClick={onClose}
            className="btn px-3 py-1.5 text-sm"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 pb-6 space-y-3">
          <div className="card p-3">
            <label className="block text-sm text-muted mb-1">
              供应商选择
            </label>
            <p className="hint mb-3">切换后会立即更新当前激活的模型供应商，详细参数在下方编辑。</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {providers.map((provider) => {
                const isActive = activeProviderId === provider.id;
                return (
                  <button
                    type="button"
                    key={provider.id}
                    onClick={() => handleSelectProvider(provider.id)}
                    className={`relative p-3 rounded-md cursor-pointer transition-colors border text-left ${
                      isActive
                        ? 'bg-surface-2 border-accent-border'
                        : 'bg-surface-2 border-border hover:bg-surface-3'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent rounded-l-md" />
                    )}
                    <div className="text-sm font-medium">{provider.name}</div>
                    <div className="meta truncate mt-1">{provider.baseUrl}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {activeProviderConfig && currentProvider && (
            <div className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-medium">
                  当前配置：{currentProvider.name}
                </h3>
                <span className="chip">当前供应商 ID：{activeProviderId}</span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-muted mb-1">API Key</label>
                      <input
                        type="password"
                        value={activeProviderConfig.apiKey || ''}
                        onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                        placeholder="输入 API Key"
                        className="input w-full px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-muted mb-1">Base URL</label>
                      <input
                        type="text"
                        value={activeProviderConfig.baseUrl || ''}
                        onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                        placeholder="例如 https://api.example.com"
                        className="input w-full px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-muted mb-1">模型</label>
                      <Select
                        value={activeProviderConfig.model || ''}
                        options={[
                          ...(currentProvider.models?.map((model) => ({ value: model, label: model })) ?? []),
                          { value: 'custom', label: '自定义模型' },
                        ]}
                        onChange={(model) => handleConfigChange('model', model)}
                        className="w-full text-sm"
                        ariaLabel="模型"
                      />
                    </div>

                    {activeProviderConfig.model === 'custom' && (
                      <div>
                        <label className="block text-sm text-muted mb-1">自定义模型名</label>
                        <input
                          type="text"
                          value={activeProviderConfig.customModel || ''}
                          onChange={(e) => handleConfigChange('customModel', e.target.value)}
                          placeholder="例如 glm-5、gpt-4o"
                          className="input w-full px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-muted mb-1">最大 Token</label>
                        <input
                          type="number"
                          value={activeProviderConfig.maxTokens || 8192}
                          onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
                          className="input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted mb-1">Temperature</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={activeProviderConfig.temperature || 0.7}
                          onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                          className="input w-full px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="card p-3">
                      <label className="block text-sm text-muted mb-1">
                        SDK 请求格式
                        <span className="ml-2 text-dim">第三方中转端点建议手动指定</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() => handleConfigChange('sdkType', 'openai')}
                          className={`px-3 py-2 rounded-md text-sm transition-colors border ${
                            activeProviderConfig.sdkType === 'openai'
                              ? 'bg-accent-subtle border-accent-border text-accent-text'
                              : 'bg-surface-2 border-border hover:bg-surface-3'
                          }`}
                        >
                          OpenAI 格式
                          <div className="text-[11px] mt-1 opacity-80">/v1/chat/completions</div>
                        </button>
                        <button
                          onClick={() => handleConfigChange('sdkType', 'anthropic')}
                          className={`px-3 py-2 rounded-md text-sm transition-colors border ${
                            activeProviderConfig.sdkType === 'anthropic'
                              ? 'bg-accent-subtle border-accent-border text-accent-text'
                              : 'bg-surface-2 border-border hover:bg-surface-3'
                          }`}
                        >
                          Anthropic 格式
                          <div className="text-[11px] mt-1 opacity-80">/v1/messages</div>
                        </button>
                      </div>
                      <p className="hint mt-3 break-all">
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

          <div className="card p-3">
            <h3 className="text-sm font-medium mb-1">采集与 AI 图片质量</h3>
            <p className="hint mb-3">整帧和区域截图按所选档位入队；AI 对相同档位不重复编码，默认最高画质。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted mb-1">默认预览策略</label>
                <Select
                  value={config.captureQualityStrategy}
                  options={[
                    { value: 'quality', label: '画质优先（30 FPS）' },
                    { value: 'smooth', label: '流畅优先（最高标称 FPS）' },
                  ]}
                  onChange={(value) => handleAppConfigChange(
                    'captureQualityStrategy',
                    value as CaptureQualityStrategy,
                  )}
                  className="w-full text-sm"
                  ariaLabel="默认预览策略"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">截图与发送给 AI 的图片质量</label>
                <Select
                  value={config.aiImageQuality}
                  options={Object.values(AI_IMAGE_QUALITY_PROFILES).map((profile) => ({
                    value: profile.id,
                    label: profile.label,
                  }))}
                  onChange={(value) => handleAppConfigChange(
                    'aiImageQuality',
                    value as AiImageQuality,
                  )}
                  className="w-full text-sm"
                  ariaLabel="截图与 AI 图片质量"
                />
              </div>
            </div>

            <p className="hint mt-3">
              精确协议采集使用应用内置的 GStreamer 运行时；旧 FFmpeg 路径仅保留配置兼容，不再参与截图。
            </p>
          </div>

          <div className="card p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium mb-1">全屏体验</h3>
                <p className="hint">开启后，底部截图菜单在无操作 2.5 秒后自动隐藏，移动鼠标即可恢复。</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.fullscreenToolbarAutoHide}
                aria-label="全屏时自动隐藏截图菜单"
                className={`settings-switch${config.fullscreenToolbarAutoHide ? ' is-on' : ''}`}
                onClick={() => handleAppConfigChange(
                  'fullscreenToolbarAutoHide',
                  !config.fullscreenToolbarAutoHide,
                )}
              >
                <span className="settings-switch-thumb" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="card p-3">
            <button
              onClick={() => setShowJsonEditor(!showJsonEditor)}
              className="text-sm text-accent-text hover:text-accent flex items-center gap-2"
            >
              <span className={`transform transition-transform ${showJsonEditor ? 'rotate-90' : ''}`}>▶</span>
              高级模式：直接编辑完整 JSON 配置
            </button>
            <p className="hint mt-2">适合批量调整供应商列表、默认值和实验性字段。</p>

            {showJsonEditor && (
              <div className="space-y-2 mt-4">
                <div className="hint mb-1">
                  直接修改完整配置 JSON，输入框与当前表单会保持同步。
                </div>
                <textarea
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="input w-full h-96 px-3 py-2 text-xs font-mono resize-none"
                  spellCheck={false}
                />

                {jsonError && (
                  <div className="text-xs text-danger-text bg-danger-subtle p-2 rounded-sm border border-danger-border">
                    JSON 解析失败：{jsonError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-3 border-t border-border bg-surface-1 shrink-0">
          <button
            onClick={onClose}
            className="btn px-3 py-1.5 text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`${isSaved ? 'btn-success' : 'btn-primary'} px-3 py-1.5 text-sm`}
          >
            {isSaving ? '保存中...' : isSaved ? '已保存' : '保存全部'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
