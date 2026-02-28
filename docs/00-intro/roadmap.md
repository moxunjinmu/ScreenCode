# 路线图

> 最后更新: 2026-02-28
> 从 [PRD](prd.md) Phase 规划提炼

## Phase 1 — MVP 核心验证链路 ✅

> 目标：验证"采集卡→截图→VLM→代码"链路可行性

- ✅ 采集卡设备枚举 + 实时预览
- ✅ 全局热键截图（Ctrl+Shift+S），Ring Buffer 最多 8 帧
- ✅ 帧差分去重（像素 diff，阈值 5%）
- ✅ 一键代码提取（Ctrl+Shift+E）→ Claude API → JSON 输出
- ✅ 代码只读展示 + 一键复制
- ✅ 系统托盘常驻 + Toast 通知
- ✅ 多供应商配置系统（Anthropic / 智谱 / OpenRouter）
- ✅ 多轮 AI 对话 + 多会话管理
- ✅ 区域截图

## Phase 2 — 合规与体验增强（规划中）

- [ ] Obsidian Markdown 归档
- [ ] 本地 VLM（GLM-4V / Qwen-VL via Ollama）
- [ ] Mini 悬浮窗（320px 半透明置顶）
- [ ] 本地脱敏层（NER + 正则掩码）
- [ ] 合规路由（敏感内容强制本地模型）
- [ ] 审计日志（better-sqlite3 append-only）
- [ ] 流式输出（SSE）
- [ ] 消息复制/删除
- [ ] 对话历史持久化

## Phase 3 — 增强功能

- [ ] 截图历史记录持久化
- [ ] 多语言支持（i18n）
- [ ] 自定义热键配置
- [ ] 代码高亮主题切换
- [ ] 导出功能（PDF/图片）
- [ ] 项目管理

## 未来探索

- Tauri + Rust 重写（参见 [Tauri 架构设计](../01-architecture/tauri-alternative.md)）
- electron-updater 内网离线包更新
- 数据分级标签（公开/内部/机密）
