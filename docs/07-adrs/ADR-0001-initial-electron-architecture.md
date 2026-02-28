# ADR-0001: 初始 Electron 架构

- Status: Accepted
- Date: 2026-02-27
- Authors: ScreenCode Team
- Impacted Areas:
  - Modules: 全部
  - Interfaces: IPC channels, Preload API
  - Users: 所有用户

## 1. 背景与问题

ScreenCode 需要一个桌面应用框架来实现：
- USB 采集卡视频流捕获
- 全局热键注册
- 系统托盘常驻
- 本地图像处理（Sharp Native 模块）
- 跨进程 AI API 调用

需要在开发效率、性能、生态成熟度之间做出选择。

## 2. 目标

- 两周内完成 MVP 核心链路
- 支持 Windows 平台（目标用户 95% 为 Windows 企业环境）
- 支持 Native 模块（Sharp 图像处理）
- 全局热键和系统托盘
- 非目标：跨平台优化、极致包体积

## 3. 备选方案

### 3.1 方案 A：Electron + Vite

- 描述：Electron 28 + Electron Forge + Vite 构建，React 前端，TypeScript 全栈
- 优点：
  - 开发效率高（JS/TS 全栈）
  - 生态非常成熟，问题容易排查
  - getUserMedia 直接支持采集卡枚举
  - Sharp Native 模块生态完善
  - Vite 热更新快
- 缺点：
  - 打包体积大（60-100MB）
  - 内存占用高（100-200MB）

### 3.2 方案 B：Tauri + Rust

- 描述：Tauri 2.0 + Rust 后端，React 前端
- 优点：
  - 打包体积小（5-15MB）
  - 内存占用低（30-60MB）
  - Rust 图像处理性能更优
- 缺点：
  - 需要学习 Rust，开发效率降低
  - 视频采集需自定义插件
  - 生态不如 Electron 成熟

### 3.3 其他备选

- NW.js：生态不如 Electron，社区较小
- Flutter Desktop：Dart 生态对 AI SDK 支持不足

## 4. 决策

我们选择：**方案 A：Electron + Vite**。

- 核心原因：
  - 两周 MVP 时间约束下，开发效率是第一优先级
  - getUserMedia 原生支持采集卡，无需自定义插件
  - TypeScript 全栈降低认知负担
- 关键取舍：
  - 牺牲包体积和内存占用，换取开发速度
- 与现有实现的关系：
  - 全新项目，无历史包袱
  - Tauri 方案保留为 Phase 2+ 备选（见 [Tauri 架构设计](../01-architecture/tauri-alternative.md)）

## 5. 详细设计概要

- 进程模型：Main（系统操作）+ Renderer（React UI）+ Preload（安全桥接）
- 状态管理：Zustand（轻量，适配 IPC 异步）
- 图像处理：Sharp Native 模块（1080p → 768px，降低 65% token 成本）
- 构建：Electron Forge + Vite

详见 [架构概览](../01-architecture/overview.md)。

## 6. 影响与迁移

- 无迁移需求（新项目）
- 用户需安装 60-100MB 安装包
- 测试：需配置 Electron 测试环境

## 7. 风险与后续工作

- 风险：包体积对企业内网分发可能造成不便
- 监控：关注内存占用和启动速度
- 后续工作：评估 Tauri 重写的可行性（Phase 2+）
