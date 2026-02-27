# ScreenCode 开发推进计划

> 制定日期: 2026-02-27
> 文档版本: v1.0
> 基于: docs/TODO.md, docs/HANDOVER.md, docs/开发进度1.md

---

## 一、当前项目状态

### 1.1 整体完成度

```
总进度: ████████████████░░░░ 75%

核心功能: ████████████████████ 95%
用户体验: ██████████████░░░░░░ 70%
测试覆盖: ░░░░░░░░░░░░░░░░░░░░ 0%
```

### 1.2 模块完成状态

| 模块 | 状态 | 完成度 | 优先级 |
|------|------|--------|--------|
| 基础架构 | ✅ 完成 | 100% | - |
| 全局热键 | ✅ 完成 | 100% | - |
| IPC 通信 | ✅ 完成 | 100% | - |
| 帧队列管理 | ✅ 完成 | 100% | - |
| 图像压缩 | ✅ 完成 | 100% | - |
| 多模型支持 | ✅ 完成 | 100% | - |
| 第三方中转 | ✅ 完成 | 100% | - |
| 供应商管理 | ✅ 完成 | 100% | - |
| 设置界面 | ✅ 完成 | 100% | - |
| Toast 通知 | ✅ 完成 | 100% | - |
| 全屏预览 | ✅ 完成 | 100% | - |
| 聊天对话面板 | ✅ 完成 | 100% | - |
| 多图 OCR | ✅ 完成 | 100% | - |
| **视频采集** | 🔴 待完善 | 20% | P0 |
| **帧差分算法** | 🔴 待完善 | 30% | P0 |
| **系统托盘** | 🟡 待完善 | 50% | P1 |
| **测试覆盖** | ❌ 未开始 | 0% | P2 |

### 1.3 当前阻塞问题

| # | 问题 | 影响 | 文件 | 状态 |
|---|------|------|------|------|
| 1 | `window.electronAPI` 未定义 | 应用无法使用 | preload/index.ts, main/index.ts | 🔴 待修复 |

---

## 〇、已完成任务 (2026-02-27)

### ✅ 任务 0.1: 添加 GLM-5 支持

**优先级**: 🔴 P0
**完成时间**: 2026-02-27 22:30

**完成内容**:
- [x] 安装 OpenAI SDK (`npm install openai`)
- [x] 创建 `openAIService.ts` 支持 OpenAI 格式 API
- [x] 实现自动检测 API 格式逻辑
- [x] 验证 GLM-5 模型可用性
- [x] 确认模型 ID 为 `glm-5` (小写)

**验收标准**:
- ✅ 可以调用智谱 AI GLM-5 模型
- ✅ 自动检测端点格式并选择正确的 SDK

**相关文档**: [CHANGELOG_2026-02-27.md](./CHANGELOG_2026-02-27.md)

---

### ✅ 任务 0.2: 重构配置系统

**优先级**: 🔴 P0
**完成时间**: 2026-02-27 22:30

**完成内容**:
- [x] 设计新的配置结构 (`ProviderConfig`, `AppConfig`)
- [x] 实现每个供应商独立配置
- [x] 添加 `activeProvider` 字段
- [x] 添加 `providerConfigs` 按供应商 ID 分组
- [x] 实现配置迁移逻辑
- [x] 向后兼容旧配置格式

**验收标准**:
- ✅ 每个供应商可独立配置 API Key, Model
- ✅ 切换供应商自动加载对应配置
- ✅ 旧配置自动迁移

**相关文档**: [CHANGELOG_2026-02-27.md](./CHANGELOG_2026-02-27.md)

---

### ✅ 任务 0.3: 增强设置界面

**优先级**: 🟡 P1
**完成时间**: 2026-02-27 22:30

**完成内容**:
- [x] 重写设置组件，供应商网格布局
- [x] 实现输入框 ↔ JSON 双向同步
- [x] 添加 Base URL 配置项
- [x] 添加 Max Tokens 配置项
- [x] 添加 Temperature 配置项
- [x] 实时 JSON 格式验证

**验收标准**:
- ✅ 输入框修改自动更新 JSON
- ✅ JSON 修改自动更新输入框
- ✅ JSON 格式错误实时提示

**相关文档**: [CHANGELOG_2026-02-27.md](./CHANGELOG_2026-02-27.md)

---

## 二、开发任务清单

### 阶段一：紧急修复 (P0 - 立即执行)

#### 任务 1.1: 修复 Preload 脚本加载问题

**优先级**: 🔴 P0 - 阻塞
**预计时间**: 2 小时
**负责文件**: `src/main/index.ts`, `vite.preload.config.ts`

**问题描述**:
- `window.electronAPI` 在渲染进程中未定义
- preload.js 未正确加载到渲染进程

**任务清单**:
- [ ] 检查 `__dirname` 在运行时的值
- [ ] 确认 preload.js 文件存在于 `.vite/build/` 目录
- [ ] 修改 preload 路径配置
- [ ] 验证 `contextBridge.exposeInMainWorld` 执行成功
- [ ] 测试 API 可用性

**验收标准**:
```javascript
// 在渲染进程控制台中执行
console.log(window.electronAPI); // 应返回对象，不是 undefined
```

**文档对照检查点**:
- HANDOVER.md 第八节 IPC 通道是否正确暴露
- TODO.md 快捷键参考是否可用

---

### 阶段二：核心功能完善 (P0 - 1-3天)

#### 任务 2.1: 实现视频采集功能

**优先级**: 🔴 P0
**预计时间**: 1 天
**负责文件**: `src/main/capture/index.ts`

**当前状态**: 返回硬编码数据

**任务清单**:
- [ ] 实现 `enumerateDevices` 使用 `desktopCapturer` API
  ```typescript
  // 参考实现
  import { desktopCapturer } from 'electron';
  
  async function enumerateDevices(): Promise<Device[]> {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window']
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      type: 'screen',
      isConnected: true,
      thumbnail: source.thumbnail.toDataURL()
    }));
  }
  ```
- [ ] 实现 `selectDevice` 设备选择逻辑
- [ ] 实现 `startCapture` 获取 MediaStream
- [ ] 实现 `stopCapture` 清理资源
- [ ] 添加错误处理和日志

**验收标准**:
- 设备下拉列表显示真实屏幕/窗口
- 选择设备后视频预览正常显示
- 开始/停止采集功能正常

**文档对照检查点**:
- TODO.md 第一节 "视频采集模块完善"
- HANDOVER.md 第九节 "已知问题" 第1条

---

#### 任务 2.2: 实现帧差分算法

**优先级**: 🔴 P0
**预计时间**: 1 天
**负责文件**: `src/main/processor/frameDiff.ts`

**当前状态**: `compare` 返回固定值 0.3

**任务清单**:
- [ ] 实现像素级对比算法
  ```typescript
  // 使用 Sharp 进行图像处理
  import sharp from 'sharp';
  
  async function compareFrames(
    current: Buffer,
    previous: Buffer
  ): Promise<number> {
    // 采样对比，避免全像素对比
    const { data: currentData } = await sharp(current)
      .resize(100, 100)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 计算差异百分比
    // ...
  }
  ```
- [ ] 实现重叠区域计算
- [ ] 优化分类逻辑
  - `static`: 差异 < 5% (丢弃)
  - `continuation`: 差异 5%-60% (连续帧)
  - `new_scene`: 差异 > 60% (新场景)
- [ ] 添加性能优化 (采样对比)

**验收标准**:
- 相同帧被正确标记为 `static`
- 滚动帧被正确标记为 `continuation`
- 场景切换被正确标记为 `new_scene`

**文档对照检查点**:
- TODO.md 第二节 "帧差分算法实现"
- HANDOVER.md 第九节 "已知问题" 第2条

---

### 阶段三：用户体验提升 (P1 - 3-5天)

#### 任务 3.1: 完善系统托盘

**优先级**: 🟡 P1
**预计时间**: 0.5 天
**负责文件**: `src/main/tray/trayManager.ts`

**当前状态**: 缺少图标资源

**任务清单**:
- [ ] 设计托盘图标 (16x16, 32x32 PNG)
- [ ] 创建不同状态图标变体
  - `icon-connected.png` (绿色)
  - `icon-disconnected.png` (红色)
  - `icon-processing.png` (黄色)
- [ ] 实现 `updateTrayIcon` 状态切换
- [ ] 完善托盘菜单
  - 设备快速切换
  - 最近截图历史
  - 快捷操作

**验收标准**:
- 托盘图标正确显示
- 状态变化时图标切换
- 右键菜单功能正常

**文档对照检查点**:
- TODO.md 第三节 "系统托盘完善"
- HANDOVER.md 第五节 "待完善功能" 中优先级

---

#### 任务 3.2: 错误处理增强

**优先级**: 🟡 P1
**预计时间**: 0.5 天
**负责文件**: `src/renderer/components/ErrorBoundary/`

**任务清单**:
- [ ] 创建全局错误边界组件
- [ ] 实现网络错误重试机制
- [ ] 添加 API 限流处理
- [ ] 优化用户友好的错误提示

---

### 阶段四：稳定性保障 (P2 - 5-7天)

#### 任务 4.1: 单元测试

**优先级**: 🟢 P2
**预计时间**: 2 天

**任务清单**:
- [ ] 配置 Jest + Testing Library
- [ ] 编写核心模块测试
  - [ ] ringBuffer.test.ts
  - [ ] frameDiff.test.ts
  - [ ] imageCompressor.test.ts
- [ ] 编写 AI 服务测试
  - [ ] claudeService.test.ts
  - [ ] promptBuilder.test.ts

**目标覆盖率**: 80%+

---

#### 任务 4.2: E2E 测试

**优先级**: 🟢 P2
**预计时间**: 1 天

**任务清单**:
- [ ] 配置 Playwright
- [ ] 编写核心流程测试
  - [ ] 设备选择流程
  - [ ] 截图流程
  - [ ] 代码提取流程

---

## 三、文档一致性检查机制

### 3.1 检查节点

| 节点 | 检查内容 | 频率 |
|------|----------|------|
| **每日检查** | TODO.md 任务状态更新 | 每天 |
| **功能完成时** | HANDOVER.md 模块说明更新 | 每次功能完成 |
| **版本发布时** | 全文档一致性审查 | 每次发布 |

### 3.2 检查清单

#### 功能开发完成后检查:

- [ ] `docs/TODO.md` 开发进度表已更新
- [ ] `docs/HANDOVER.md` 已完成功能列表已更新
- [ ] 文件结构说明与实际代码一致
- [ ] IPC 通道文档与 `shared/constants.ts` 一致
- [ ] 类型定义文档与 `shared/types.ts` 一致

#### 发现差异时处理流程:

```
发现差异
    │
    ▼
暂停相关功能开发
    │
    ▼
记录差异点 (问题报告)
    │
    ▼
确认文档还是代码为正确版本
    │
    ├── 文档正确 → 修改代码
    │
    └── 代码正确 → 更新文档
    │
    ▼
继续开发
```

---

## 四、问题报告模板

```markdown
## 问题报告 #N

**发现时间**: YYYY-MM-DD HH:mm
**发现人**: [开发者]
**影响范围**: [功能模块]

### 差异描述

**文档描述**:
[文档中的描述]

**实际代码**:
[代码中的实际实现]

### 影响分析

[差异对功能/用户体验的影响]

### 解决方案

- [ ] 文档需要更新
- [ ] 代码需要修改

### 处理状态

- [ ] 待处理
- [ ] 处理中
- [ ] 已解决
- [ ] 已验证

**处理人**: [负责人]
**完成时间**: YYYY-MM-DD
```

---

## 五、开发时间线

```
Week 1 (2026-02-27 ~ 2026-03-05)
├── Day 1: 修复 Preload 问题 (P0)
├── Day 2-3: 实现视频采集 (P0)
├── Day 4: 实现帧差分算法 (P0)
└── Day 5: 文档一致性审查

Week 2 (2026-03-06 ~ 2026-03-12)
├── Day 1-2: 系统托盘完善 (P1)
├── Day 3: 错误处理增强 (P1)
├── Day 4-5: 单元测试 (P2)
└── Day 6: E2E 测试 (P2)

Week 3 (2026-03-13 ~ )
├── 功能验收测试
├── 性能优化
└── 版本发布准备
```

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Preload 问题难以定位 | 延期 | 查阅 Electron Forge 文档，参考示例项目 |
| desktopCapturer 权限问题 | 功能受限 | 添加权限引导，提供 fallback 方案 |
| 帧差分性能问题 | 用户体验差 | 采样对比，Web Worker 优化 |

---

## 七、参考资料

- [Electron Forge 文档](https://www.electronforge.io/)
- [Electron desktopCapturer API](https://www.electronjs.org/docs/latest/api/desktop-capturer)
- [Sharp 图像处理](https://sharp.pixelplumbing.com/)
- [项目 PRD](../PRD.md)
- [项目架构](../ARCHITECTURE.md)

---

*文档最后更新: 2026-02-27*
