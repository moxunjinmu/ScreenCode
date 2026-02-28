# ADR-0003: 配置存储与迁移策略

- Status: Accepted
- Date: 2026-02-27
- Authors: ScreenCode Team
- Impacted Areas:
  - Modules: config-system
  - Interfaces: config schema, IPC channels (CONFIG_GET, CONFIG_SET, CONFIG_CHANGED)
  - Users: 所有用户

## 1. 背景与问题

ScreenCode 需要持久化存储应用配置，包括：
- 多供应商 API 配置（Key、URL、Model）
- 图像处理参数
- 设备选择记忆

初版使用单一 `claudeApiKey` / `claudeModel` 字段，重构为多供应商后需要：
- 新的配置结构
- 旧配置自动迁移
- 配置变更实时推送到渲染进程

## 2. 目标

- 配置持久化到本地文件
- 支持多供应商独立配置
- 旧格式自动迁移，用户无感
- 配置变更实时推送（Settings 保存 → UI 即时更新）
- 非目标：加密存储（Phase 2）、云端同步

## 3. 备选方案

### 3.1 方案 A：electron-store + IPC 推送

- 描述：使用 `electron-store` JSON 持久化，配置变更通过 `CONFIG_CHANGED` IPC 事件推送
- 优点：
  - 轻量，零依赖
  - JSON 格式可读可调试
  - 自动处理文件路径和权限
  - IPC 推送实现简单
- 缺点：
  - 明文存储 API Key
  - 无 schema 校验

### 3.2 方案 B：SQLite + 配置表

- 描述：使用 better-sqlite3 存储配置
- 优点：事务支持，可扩展
- 缺点：配置场景过重，引入额外依赖

### 3.3 方案 C：dotenv + 环境变量

- 描述：API Key 存环境变量，其他配置存 JSON
- 优点：API Key 不在应用文件中
- 缺点：用户配置体验差，不适合桌面应用

## 4. 决策

我们选择：**方案 A：electron-store + IPC 推送**。

- 核心原因：
  - 桌面应用配置场景，electron-store 是最成熟的方案
  - JSON 格式便于调试和手动编辑
  - IPC 推送实现配置变更实时生效
- 关键取舍：
  - API Key 明文存储，Phase 2 计划加密

## 5. 详细设计概要

- 模块：`src/main/config/store.ts`
- 数据模型：`AppConfig`（含 `activeProvider` + `providerConfigs` 多供应商结构）
- 接口：
  - `CONFIG_GET` / `CONFIG_SET`：invoke 模式读写
  - `CONFIG_CHANGED`：event 模式推送完整配置
- 迁移流程：
  ```
  启动 → migrateConfig()
    → 检测旧字段 (claudeApiKey, claudeModel, claudeBaseUrl)
    → 映射到 providerConfigs.anthropic
    → 删除旧字段
  ```

详见 [配置系统](../02-modules/config-system.md) 和 [配置 Schema](../03-interfaces/config-schema.md)。

## 6. 影响与迁移

- 旧配置自动迁移，用户无感知
- Settings 页面重构为供应商网格布局 + JSON 双向同步
- ChatPanel 模型名实时响应配置变更

## 7. 风险与后续工作

- 风险：API Key 明文存储存在安全隐患
- 监控：electron-store 文件权限由 OS 控制
- 后续工作：
  - 加密存储敏感字段
  - 配置导出/导入功能
  - 团队级配置共享
