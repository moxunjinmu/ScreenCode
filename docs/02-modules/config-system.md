# 配置系统

> 最后更新: 2026-02-28
> 文件: `src/main/config/store.ts`

## 存储方案

使用 `electron-store<AppConfig>` 持久化配置，默认值来自 `DEFAULT_CONFIG`（定义在 `src/shared/types.ts`）。

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

`migrateConfig()` 处理旧格式到新格式的自动迁移：

- 旧格式: 单一 `claudeApiKey` / `claudeModel` 字段
- 新格式: `activeProvider` + `providerConfigs` 多供应商结构

迁移在应用启动时自动执行，迁移后删除旧字段。

## 配置 Schema

详见 [配置 Schema](../03-interfaces/config-schema.md)。

## 相关 ADR

- [ADR-0003: 配置存储与迁移](../07-adrs/ADR-0003-config-store-and-migration.md)
