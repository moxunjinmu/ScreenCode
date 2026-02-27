import { IpcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from '@shared/constants';
import { AppConfig, DEFAULT_CONFIG, DEFAULT_PROVIDERS, ProviderConfig } from '@shared/types';

// 配置存储
const store = new Store<AppConfig>({
  defaults: DEFAULT_CONFIG,
});

/**
 * 迁移旧配置到新格式
 */
function migrateConfig(): void {
  const oldApiKey = store.get('claudeApiKey');
  const oldBaseUrl = store.get('claudeApiBaseUrl');
  const oldModel = store.get('claudeModel');
  const oldCustomModel = store.get('claudeCustomModel');

  // 如果存在旧配置但没有新配置，则迁移
  if (oldApiKey && !store.get('activeProvider')) {
    console.log('[Config] Migrating old config format...');
    
    // 根据 baseUrl 判断供应商
    let providerId = 'anthropic';
    if (oldBaseUrl?.includes('bigmodel.cn/api/coding')) {
      providerId = 'zhipu';
    } else if (oldBaseUrl?.includes('bigmodel.cn/api/anthropic')) {
      providerId = 'zhipu-anthropic';
    } else if (oldBaseUrl?.includes('openrouter')) {
      providerId = 'openrouter';
    }

    const providerConfigs: { [key: string]: ProviderConfig } = {
      [providerId]: {
        apiKey: oldApiKey,
        baseUrl: oldBaseUrl || DEFAULT_PROVIDERS.find(p => p.id === providerId)?.baseUrl || '',
        model: oldCustomModel || oldModel || 'claude-sonnet-4-6',
        customModel: oldCustomModel,
        maxTokens: 8192,
        temperature: 0.7,
      },
    };

    store.set('activeProvider', providerId);
    store.set('providerConfigs', providerConfigs);
    
    console.log(`[Config] Migrated to provider: ${providerId}`);
  }
}

/**
 * 设置配置相关的 IPC 处理器
 */
export function setupConfigHandlers(ipcMain: IpcMain) {
  // 启动时迁移配置
  migrateConfig();

  // 获取配置
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (): Promise<AppConfig> => {
    return getConfig();
  });

  // 设置配置
  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_event, config: Partial<AppConfig>) => {
    return setConfig(config);
  });
}

/**
 * 获取配置
 */
export function getConfig(): AppConfig {
  const config: AppConfig = {
    activeProvider: store.get('activeProvider', 'zhipu'),
    providerConfigs: store.get('providerConfigs', DEFAULT_CONFIG.providerConfigs),
    apiProviders: store.get('apiProviders', DEFAULT_PROVIDERS),
    lastDeviceId: store.get('lastDeviceId', null),
    toastDuration: store.get('toastDuration', 1500),
    frameDiffThreshold: store.get('frameDiffThreshold', 0.05),
    maxFrames: store.get('maxFrames', 8),
    compressionWidth: store.get('compressionWidth', 768),
    compressionQuality: store.get('compressionQuality', 85),
  };

  return config;
}

/**
 * 获取当前激活供应商的配置
 */
export function getActiveProviderConfig(): ProviderConfig {
  const activeProvider = store.get('activeProvider', 'zhipu');
  const providerConfigs = store.get('providerConfigs', DEFAULT_CONFIG.providerConfigs);
  
  return providerConfigs[activeProvider] || DEFAULT_CONFIG.providerConfigs[activeProvider];
}

/**
 * 设置配置
 */
export function setConfig(config: Partial<AppConfig>): void {
  Object.entries(config).forEach(([key, value]) => {
    if (value !== undefined) {
      store.set(key as keyof AppConfig, value);
    }
  });
}

/**
 * 获取单个配置项
 */
export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return store.get(key);
}

/**
 * 设置单个配置项
 */
export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  store.set(key, value);
}
