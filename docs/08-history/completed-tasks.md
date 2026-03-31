# 已完成任务归档

> 此文件归档已完成的开发任务，日常开发无需读取
> 最后更新：2026-03-31

---

## 2026-03-30

| 任务 | 完成时间 | 关键文件 |
|------|----------|----------|
| 全屏预览模式布局优化 | 03-30 | App.tsx, Preview/index.tsx |
| 聊天面板打开按钮改进 | 03-30 | App.tsx |
| 拖拽分隔条交互优化 | 03-30 | App.tsx |

---

## 2026-02-28

| 任务 | 完成时间 | 关键文件 |
|------|----------|----------|
| GLM-5 端点修复 (标准端点替换 Coding Plan) | 02-28 | ai/index.ts, types.ts |
| zhipu-anthropic 路由 bug 修复 | 02-28 | ai/index.ts |
| CONFIG_CHANGED 实时推送 | 02-28 | config/store.ts, preload/index.ts |
| ChatPanel 动态模型名 | 02-28 | ChatPanel/index.tsx, chatStore.ts |
| 多会话管理 (新建/切换/删除) | 02-28 | chatStore.ts, ChatPanel/index.tsx |
| 区域截图覆盖层 | 02-28 | RegionCaptureOverlay, uiStore.ts |

## 2026-02-27

| 任务 | 完成时间 | 关键文件 |
|------|----------|----------|
| OpenAI SDK 支持 | 02-27 | openAIService.ts |
| 多供应商配置系统重构 | 02-27 | types.ts, config/store.ts |
| 配置迁移 (旧格式 → 新格式) | 02-27 | config/store.ts |
| 设置界面重构 (网格布局+双向同步) | 02-27 | Settings/index.tsx |
| 视频采集设备枚举 + 预览 | 02-27 | capture/, captureStore.ts |
| 全局热键 (截图/提取/主窗口) | 02-27 | main/index.ts |
| 帧队列管理 | 02-27 | frameStore.ts, ThumbnailQueue/ |
| 图像压缩 (Sharp 768px) | 02-27 | imageCompressor.ts |
| Claude API 集成 | 02-27 | claudeService.ts, promptBuilder.ts |
| 聊天对话面板 | 02-27 | ChatPanel/, chatStore.ts |
| 多图 OCR (最多 4 张) | 02-27 | ChatPanel/index.tsx |
| Toast 通知 | 02-27 | Toast/ |
| 全屏预览 | 02-27 | ThumbnailQueue/ |
| Preload 脚本修复 | 02-27 | preload/index.ts |
