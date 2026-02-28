# ScreenCode 待办清单

> 最后更新: 2026-02-28
> 仅包含未完成任务，已完成任务归档至 [archive/completed-tasks.md](archive/completed-tasks.md)

---

## P0 - 核心功能

### 视频采集模块

文件: `src/main/capture/index.ts`
状态: 返回硬编码数据，需实现真实采集

- [ ] 实现 `enumerateDevices` 使用 desktopCapturer API
- [ ] 实现 `selectDevice` 设备选择
- [ ] 实现 `startCapture` 获取 MediaStream
- [ ] 实现 `stopCapture` 清理资源

### 帧差分算法

文件: `src/main/processor/frameDiff.ts`
状态: `compare` 返回固定值 0.3，需实现像素级对比

- [ ] 像素级对比算法 (Sharp 采样对比)
- [ ] 重叠区域计算
- [ ] 分类逻辑: static(<5%) / continuation(5-60%) / new_scene(>60%)

---

## P1 - 用户体验

### 系统托盘完善

文件: `src/main/tray/trayManager.ts`

- [ ] 设计托盘图标 (16x16, 32x32)
- [ ] 状态图标变体 (绿=连接/红=断开/黄=处理中)
- [ ] 完善托盘菜单

### 错误处理增强

- [ ] 全局错误边界组件
- [ ] 网络错误重试机制
- [ ] API 限流处理

### 聊天面板增强

- [ ] 流式输出 (SSE)
- [ ] 消息复制/删除
- [ ] 对话历史持久化

---

## P2 - 稳定性

### 测试覆盖

- [ ] 配置 Jest + Testing Library
- [ ] 核心模块单元测试 (ringBuffer, frameDiff, imageCompressor)
- [ ] AI 服务测试 (claudeService, promptBuilder)
- [ ] E2E 测试 (Playwright)
- [ ] 目标覆盖率: 80%+

---

## P3 - 增强功能

- [ ] 截图历史记录持久化
- [ ] 多语言支持 (i18n)
- [ ] 自定义热键配置
- [ ] 代码高亮主题切换
- [ ] 导出功能 (PDF/图片)
