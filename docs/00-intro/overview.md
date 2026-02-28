# 项目概览

> 最后更新: 2026-02-28

## 什么是 ScreenCode

ScreenCode 是一个 Electron 桌面应用，用于**隔离网络环境下的屏幕捕获和代码提取**。

核心场景：外包开发者在内网机器上编写代码，通过采集卡将内网屏幕画面传输到外网个人电脑，ScreenCode 捕获画面后使用多供应商 AI API（智谱 GLM-5、Claude Sonnet 等）进行代码识别和提取，支持多轮 AI 对话和会话管理。

## 核心能力

- 视频采集设备枚举 + 实时预览
- 全局热键截图（Ctrl+Shift+S），帧差分自动去重
- 一键代码提取（Ctrl+Shift+E），多帧结构化 Prompt → AI → JSON 输出
- 多供应商 AI 路由（Anthropic / 智谱 / OpenRouter）
- 多轮 AI 对话 + 多会话管理
- 系统托盘常驻 + Toast 通知

## 目标用户

在物理隔离网络环境下工作的外包开发者，需要将内网屏幕上的代码快速还原为可编辑文本。

## MVP 核心假设

> "在物理隔离的内网环境下，开发者能否通过采集卡→截图→VLM 这一链路，在 30 秒内还原一个完整函数/类的代码，准确率超过 85%？"

验证标准：
- 代码还原字符级准确率 > 85%
- 端到端延迟 < 30 秒（P90）
- 无需人工修正可直接使用 > 60%

## 技术栈

| 层次 | 技术 | 用途 |
|------|------|------|
| 运行时 | Electron ^28 | 桌面应用框架 |
| 构建 | Electron Forge + Vite | 开发与打包 |
| 前端 | React 18 + TypeScript | UI |
| 状态 | Zustand | 状态管理 |
| 样式 | TailwindCSS | 原子化 CSS |
| 图像 | Sharp | 高性能压缩 |
| AI | @anthropic-ai/sdk + openai | 双 SDK 自动路由 |
| 存储 | electron-store | 配置持久化 |

## 相关文档

- [路线图](roadmap.md)
- [产品需求文档](prd.md)
- [架构设计](../01-architecture/overview.md)
