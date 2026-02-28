# 测试策略

> 最后更新: 2026-02-28

## 当前状态

测试基础设施尚未搭建，属于 P2 优先级任务。

## 计划方案

### 单元测试

框架: Jest + Testing Library

核心模块测试目标：

| 模块 | 文件 | 测试重点 |
|------|------|----------|
| RingBuffer | `processor/ringBuffer.ts` | 入队/出队/满覆盖/清空 |
| FrameDiff | `processor/frameDiff.ts` | 分类逻辑 (static/continuation/new_scene) |
| ImageCompressor | `processor/imageCompressor.ts` | 压缩尺寸/质量/不放大 |
| AI 路由 | `ai/index.ts` | `isOpenAICompatible()` 路由判断 |
| PromptBuilder | `ai/promptBuilder.ts` | 多帧 Prompt 结构 |
| Config Store | `config/store.ts` | 配置读写/迁移 |

### 集成测试

- AI 服务调用（Mock API）
- IPC 通道通信
- 配置变更推送链路

### E2E 测试

框架: Playwright

关键用户流程：
- 设备枚举 → 选择 → 预览
- 截图入队 → 缩略图显示
- 代码提取 → 结果展示
- 聊天对话 → 多会话切换
- 配置修改 → 实时生效

### 覆盖率目标

80%+

## 相关待办

见 [backlog.md](backlog.md) P2 测试覆盖章节。
