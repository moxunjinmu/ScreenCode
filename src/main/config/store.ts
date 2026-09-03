import { IpcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from '@shared/constants';
import {
  AppConfig,
  CaptureProfileConfig,
  DEFAULT_CONFIG,
  DEFAULT_PROVIDERS,
  ProviderConfig,
} from '@shared/types';
import {
  CAPTURE_PROFILE_DIRECTORY,
  CAPTURE_PROFILE_NAME,
  DEFAULT_CAPTURE_PROFILE_CONFIG,
  isCaptureProfileKey,
  migrateLegacyCaptureProfile,
  readCaptureProfileConfig,
  splitCaptureProfilePatch,
  writeCaptureProfilePatch,
} from './captureProfile';

// 配置存储
const store = new Store<AppConfig>({
  defaults: DEFAULT_CONFIG,
});

// 采集卡协议不含敏感信息，按产品约定独立保存到 D 盘。
const captureProfileStore = new Store<CaptureProfileConfig>({
  cwd: CAPTURE_PROFILE_DIRECTORY,
  name: CAPTURE_PROFILE_NAME,
  defaults: DEFAULT_CAPTURE_PROFILE_CONFIG,
});

/**
 * 迁移旧配置到新格式
 */
function migrateConfig(): void {
  migrateLegacyCaptureProfile(store, captureProfileStore);
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
  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (event, config: Partial<AppConfig>) => {
    setConfig(config);
    // 配置变更后推送完整配置给渲染进程
    try {
      if (!event.sender.isDestroyed()) {
        const fullConfig = getConfig();
        event.sender.send(IPC_CHANNELS.CONFIG_CHANGED, fullConfig);
      }
    } catch (error) {
      console.error('[Config] Failed to send config changed event:', error);
    }
  });
}

/**
 * 获取配置
 */
export function getConfig(): AppConfig {
  const captureProfile = readCaptureProfileConfig(captureProfileStore);
  const config: AppConfig = {
    activeProvider: store.get('activeProvider', 'zhipu'),
    providerConfigs: store.get('providerConfigs', DEFAULT_CONFIG.providerConfigs),
    apiProviders: store.get('apiProviders', DEFAULT_PROVIDERS),
    lastDeviceId: captureProfile.lastDeviceId,
    toastDuration: store.get('toastDuration', 1500),
    frameDiffThreshold: store.get('frameDiffThreshold', 0.05),
    maxFrames: store.get('maxFrames', 8),
    compressionWidth: store.get('compressionWidth', 768),
    compressionQuality: store.get('compressionQuality', 85),
    aiImageQuality: store.get('aiImageQuality', 'original'),
    captureQualityStrategy: store.get('captureQualityStrategy', 'quality'),
    fullscreenToolbarAutoHide: store.get('fullscreenToolbarAutoHide', false) === true,
    captureBackend: captureProfile.captureBackend,
    nativeCaptureSelection: captureProfile.nativeCaptureSelection,
    lastNativeDeviceId: captureProfile.lastNativeDeviceId,
    nativeCaptureProfiles: captureProfile.nativeCaptureProfiles,
    ffmpegPath: store.get('ffmpegPath', ''),
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
  const { appPatch, capturePatch } = splitCaptureProfilePatch(config);
  Object.entries(appPatch).forEach(([key, value]) => {
    if (value !== undefined) {
      store.set(key as keyof AppConfig, value);
    }
  });
  writeCaptureProfilePatch(captureProfileStore, capturePatch);
}

/**
 * 获取单个配置项
 */
export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  if (isCaptureProfileKey(key)) {
    return getConfig()[key];
  }
  return store.get(key);
}

/**
 * 设置单个配置项
 */
export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  if (isCaptureProfileKey(key)) {
    setConfig({ [key]: value } as Pick<AppConfig, K>);
    return;
  }
  store.set(key, value);
}
