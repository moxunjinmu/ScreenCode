import { IpcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from '@shared/constants';
import { AppConfig, DEFAULT_CONFIG } from '@shared/types';

// 配置存储
const store = new Store<AppConfig>({
  defaults: DEFAULT_CONFIG,
});

/**
 * 设置配置相关的 IPC 处理器
 */
export function setupConfigHandlers(ipcMain: IpcMain) {
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
  return {
    claudeApiKey: store.get('claudeApiKey', ''),
    claudeModel: store.get('claudeModel', 'claude-sonnet-4-6'),
    lastDeviceId: store.get('lastDeviceId', null),
    toastDuration: store.get('toastDuration', 1500),
    frameDiffThreshold: store.get('frameDiffThreshold', 0.05),
    maxFrames: store.get('maxFrames', 8),
    compressionWidth: store.get('compressionWidth', 768),
    compressionQuality: store.get('compressionQuality', 85),
  };
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
