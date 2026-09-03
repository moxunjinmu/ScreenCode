# 配置系统

> 最后更新: 2026-09-03
> 文件: `src/main/config/store.ts`

## 存储方案

配置继续通过统一 IPC 读写，但主进程按字段拆分到两个 `electron-store`：

- 通用配置保存在 Electron `userData/config.json`，包括供应商、图像质量与界面设置
- 采集卡配置保存在 `D:\ProgramData\ScreenCode\capture-profile.json`，仅包含设备映射、采集后端和精确模式

拆分逻辑位于 `src/main/config/captureProfile.ts`。采集文件采用白名单写入，完整 `AppConfig` 中的 API Key
和供应商信息不会进入 D 盘采集缓存。

## API

| 函数 | 说明 |
|------|------|
| `getConfig()` | 获取完整 AppConfig |
| `getActiveProviderConfig()` | 获取当前激活供应商的 ProviderConfig |
| `setConfig(config: Partial<AppConfig>)` | 批量设置配置 |
| `getConfigValue<K>(key)` | 获取单项配置 |
| `setConfigValue<K>(key, value)` | 设置单项配置 |
| `migrateConfig()` | 旧配置格式迁移 |
| `setupConfigHandlers(ipcMain)` | 注册 IPC handler |

## 配置变更推送

```
Settings 保存 → CONFIG_SET (invoke)
  → main: setConfig() + event.sender.send(CONFIG_CHANGED, fullConfig)
    → renderer: onConfigChanged 回调 → 更新 UI
```

设置后自动推送完整配置到渲染进程，ChatPanel 模型名实时响应变更。

## 配置迁移

`migrateConfig()` 处理以下单次迁移：

- 旧格式: 单一 `claudeApiKey` / `claudeModel` 字段
- 新格式: `activeProvider` + `providerConfigs` 多供应商结构
- 旧 C 盘配置中的 `lastDeviceId`、`captureBackend`、`nativeCaptureSelection`
- 新 D 盘独立采集缓存及按原生设备保存的 `nativeCaptureProfiles`

迁移在应用启动时自动执行；D 盘写入完成后删除 C 盘旧采集字段，供应商和界面配置保持不变。

## 配置 Schema

详见 [配置 Schema](../03-interfaces/config-schema.md)。

## 相关 ADR

- [ADR-0003: 配置存储与迁移](../07-adrs/ADR-0003-config-store-and-migration.md)
