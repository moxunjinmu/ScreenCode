# ScreenCode 变更日志

---

## 2026-03-02

### 聊天面板交互增强
- 新增聊天面板开关功能（uiStore 添加 `isChatPanelOpen` 状态）
- 拖拽宽度小于 200px 时自动关闭面板
- 关闭时显示打开按钮（右侧边缘）
- ChatPanel 头部添加关闭按钮
- 添加 300ms 过渡动画效果

---

## 2026-02-28

### GLM-5 端点修复
- zhipu baseUrl 从 Coding Plan 端点 `/api/coding/paas/v4` 改为标准端点 `/api/paas/v4`
- 标准端点支持 glm-5，Coding Plan 端点会静默降级为 glm-4-plus
- 修复 zhipu-anthropic 路由 bug：`/api/anthropic` 检查优先于 `bigmodel.cn` 匹配

### 配置实时推送
- 新增 `CONFIG_CHANGED` IPC 事件
- Settings 保存后 main 进程推送完整配置到 renderer
- ChatPanel 模型名实时响应配置变更

### 会话管理
- 新建/切换/删除会话
- 会话标题自动取首条用户消息前 20 字符
- 会话数据存于内存 (Zustand)

### 区域截图和预览增强
- 新增 RegionCaptureOverlay 组件
- 新增 uiStore (全屏预览/区域截图状态)

---

## 2026-02-27

### 多供应商配置系统
- 每个供应商独立配置 (API Key, Base URL, Model, Max Tokens, Temperature)
- `activeProvider` + `providerConfigs` 结构
- 旧配置自动迁移

### OpenAI SDK 支持
- 新增 `openAIService.ts`，支持 OpenAI 兼容格式
- `isOpenAICompatible()` 自动检测端点格式选择 SDK

### 设置界面重构
- 供应商网格布局
- 输入框 ↔ JSON 双向同步
- 实时 JSON 格式验证

### 基础功能
- 视频采集设备枚举 + 实时预览
- 全局热键 (Ctrl+Shift+S 截图, Ctrl+Shift+E 提取)
- 帧队列管理 (最多 8 帧)
- Claude API 集成 + 代码提取
- 聊天对话面板 (可拖拽宽度, 多图 OCR)
- Toast 通知
- 全屏预览
