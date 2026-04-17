# ScreenCode 变更日志

> 最后更新：2026-04-17

---

## 2026-04-17

### 区域截图二次编辑
- 区域截图选择后进入编辑模式，显示红色边框和 8 个手柄（四角 + 四边中点）
- 支持拖拽边框调整选区大小（8 方向：上/下/左/右/四角）
- 支持拖拽选区内部移动整个选区
- 鼠标悬停边框自动切换对应方向的 resize 光标
- 新增"重截"按钮：调整选区后可重新截取新区域
- ✓ 确认保存 / ✕ 取消退出
- 选区外点击可重新开始新选区

### 截图确认流程
- 区域截图选择完成后不再直接保存，显示 ✓/✕ 确认按钮
- 点击 ✓ 后才执行保存到帧队列和剪贴板
- 点击 ✕ 取消并退出区域截图模式

---

## 2026-04-16

### 截图保存到剪贴板
- 全屏截图和区域截图完成后自动将图片写入系统剪贴板
- 新增 `CLIPBOARD_WRITE_IMAGE` IPC 通道（renderer → main）
- 使用 Electron `clipboard.writeImage()` + `nativeImage` API

---

## 2026-04-08

### 显示分辨率调整
- Preview 组件新增分辨率选择器（源分辨率 + 预设分辨率 + 百分比缩放）
- 预设分辨率：1920x1080, 1280x720, 1024x576, 854x480
- 预设缩放比例：50%, 75%, 100%, 125%, 150%, 200%
- 自动检测视频源最大分辨率作为默认选项
- AppConfig 新增 `displayResolution` 字段支持持久化

### 聊天面板默认状态
- 默认关闭右侧 AI 对话面板（isChatPanelOpen 默认值改为 false）

---

## 2026-03-30

### 预览组件优化
- 全屏预览模式布局调整
- 聊天面板打开按钮样式优化
- 拖拽分隔条交互改进

---

## 2026-03-02

### 帧队列交互增强
- 点击帧卡片可选中/取消选中（高亮边框 + 勾选图标）
- 每个帧卡片添加删除按钮（hover 显示）
- frameStore 添加 `selectedFrameIds` 状态管理选中帧

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
