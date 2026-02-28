# 持久化

> 最后更新: 2026-02-28

## 当前持久化方案

| 数据 | 存储方式 | 位置 |
|------|----------|------|
| 应用配置 (AppConfig) | electron-store | 用户数据目录 JSON 文件 |
| 会话/消息 | Zustand 内存 | 无持久化（应用关闭即丢失） |
| 帧队列 | Zustand 内存 | 无持久化 |
| 截图数据 | 内存 base64 | 无持久化 |

## electron-store

文件: `src/main/config/store.ts`

- 底层使用 `electron-store<AppConfig>`
- 存储路径: 系统用户数据目录（由 Electron 管理）
- 格式: JSON
- 默认值: `DEFAULT_CONFIG`（定义在 `src/shared/types.ts`）

### 持久化字段

完整字段见 [配置 Schema](../03-interfaces/config-schema.md)，核心字段：

- `activeProvider`: 当前供应商 ID
- `providerConfigs`: 各供应商的 API Key、Base URL、Model 等
- `lastDeviceId`: 上次选择的采集设备
- 图像处理参数: `frameDiffThreshold`, `maxFrames`, `compressionWidth`, `compressionQuality`

### 安全性

- API Key 以明文存储在本地 JSON 文件中
- 文件权限由操作系统用户权限控制
- Phase 2 计划: 加密存储敏感字段

## Phase 2 持久化规划

| 数据 | 计划方案 |
|------|----------|
| 对话历史 | better-sqlite3 |
| 截图元数据 | better-sqlite3 |
| 审计日志 | better-sqlite3 (append-only) |
| Markdown 归档 | Obsidian fs 直写 |
