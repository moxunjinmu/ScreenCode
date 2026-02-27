# ScreenCode 开发待办清单

> 最后更新: 2026-02-27

## 项目概述

ScreenCode 是一个 Electron 桌面应用，用于隔离网络环境下的屏幕捕获和代码提取。通过采集卡捕获内网机器屏幕，使用 Claude 3.5 Sonnet API 进行代码识别和提取。

---

## 开发进度总览

| 模块 | 状态 | 完成度 |
|------|------|--------|
| 基础架构 | ✅ 完成 | 100% |
| 全局热键 | ✅ 完成 | 100% |
| IPC 通信 | ✅ 完成 | 100% |
| 帧队列管理 | ✅ 完成 | 100% |
| 图像压缩 | ✅ 完成 | 100% |
| Claude API 集成 | ✅ 完成 | 100% |
| 设置界面 | ✅ 完成 | 100% |
| Toast 通知 | ✅ 完成 | 100% |
| 视频采集 | 🔶 待完善 | 20% |
| 帧差分算法 | 🔶 待完善 | 30% |
| 系统托盘 | 🔶 待完善 | 50% |
| 测试覆盖 | ❌ 未开始 | 0% |

---

## 🔴 高优先级 - 核心功能

### 1. 视频采集模块完善

**文件**: `src/main/capture/index.ts`

**当前状态**: 只有框架，返回硬编码数据

**待实现**:
- [ ] 实现真实的设备枚举逻辑
  - 使用 `desktopCapturer` API 枚举屏幕/窗口
  - 支持采集卡设备检测
  - 返回设备详细信息（分辨率、帧率等）
- [ ] 实现 `selectDevice` 设备选择
  - 存储当前选中设备
  - 初始化视频流
- [ ] 实现 `startCapture` 开始捕获
  - 获取 MediaStream
  - 通过 IPC 发送帧数据到渲染进程
- [ ] 实现 `stopCapture` 停止捕获
  - 关闭 MediaStream
  - 清理资源

**技术方案**:
```typescript
// 使用 Electron desktopCapturer
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

---

### 2. 帧差分算法实现

**文件**: `src/main/processor/frameDiff.ts`

**当前状态**: `compare` 和 `calculateOverlap` 返回模拟数据

**待实现**:
- [ ] 像素级对比算法
  - 使用 Sharp 库进行图像处理
  - 计算两帧之间的像素差异百分比
  - 性能优化：采样对比而非全像素对比
- [ ] 重叠区域计算
  - 实现图像特征匹配
  - 计算滚动/平移重叠区域
- [ ] 分类逻辑优化
  - `static`: 差异 < 5%（丢弃）
  - `continuation`: 差异 5%-60%（连续帧）
  - `new_scene`: 差异 > 60%（新场景）

**技术方案**:
```typescript
import sharp from 'sharp';

async compare(currentFrame: string, previousFrame: string): Promise<...> {
  // 解码 base64 图像
  const current = sharp(Buffer.from(currentFrame, 'base64'));
  const previous = sharp(Buffer.from(previousFrame, 'base64'));

  // 缩小到 64x64 进行快速对比
  const currentSmall = await current.resize(64, 64).raw().toBuffer();
  const previousSmall = await previous.resize(64, 64).raw().toBuffer();

  // 计算像素差异
  let diff = 0;
  for (let i = 0; i < currentSmall.length; i++) {
    diff += Math.abs(currentSmall[i] - previousSmall[i]);
  }
  const percentage = diff / (currentSmall.length * 255);

  return { percentage, type: this.classifyDiff(percentage) };
}
```

---

## 🟡 中优先级 - 用户体验

### 3. 系统托盘完善

**文件**: `src/main/tray/trayManager.ts`

**待实现**:
- [ ] 创建实际的托盘图标资源
  - 设计 16x16/32x32 PNG 图标
  - 不同状态的图标变体（连接/断开/处理中）
- [ ] 实现 `updateTrayIcon` 状态切换
  - 绿色 = 已连接设备
  - 红色 = 未连接
  - 黄色 = 处理中
- [ ] 完善托盘菜单
  - 设备快速切换
  - 最近截图历史
  - 快捷操作

---

### 4. 错误处理增强

**当前状态**: 基础错误处理已实现

**待完善**:
- [ ] 全局错误边界
- [ ] 网络错误重试机制
- [ ] API 限流处理
- [ ] 用户友好的错误提示

---

## 🟢 低优先级 - 增强功能

### 5. 测试覆盖

**当前状态**: 无测试文件

**待实现**:
- [ ] 单元测试
  - 帧差分算法测试
  - Ring Buffer 测试
  - Prompt 构建器测试
- [ ] 集成测试
  - IPC 通信测试
  - 端到端流程测试
- [ ] 测试覆盖率目标: 80%+

**技术栈**: Vitest + Playwright

---

### 6. 性能优化

**待实现**:
- [ ] 图像压缩质量自适应
- [ ] 帧队列内存管理
- [ ] API 响应缓存
- [ ] 冷启动优化

---

### 7. 功能增强

**待实现**:
- [ ] 截图历史记录
- [ ] 多语言支持
- [ ] 自定义热键配置
- [ ] 代码高亮主题切换
- [ ] 导出功能（PDF/图片）

---

## 文件结构参考

```
ScreenCode/
├── src/
│   ├── main/                    # 主进程
│   │   ├── index.ts             # 入口文件
│   │   ├── capture/
│   │   │   └── index.ts         # 🔴 视频采集 (待完善)
│   │   ├── processor/
│   │   │   ├── index.ts         # 帧处理入口
│   │   │   ├── ringBuffer.ts    # ✅ 环形缓冲区
│   │   │   ├── frameDiff.ts     # 🔴 帧差分 (待完善)
│   │   │   └── imageCompressor.ts # ✅ 图像压缩
│   │   ├── ai/
│   │   │   ├── index.ts         # AI 模块入口
│   │   │   ├── claudeService.ts # ✅ Claude API
│   │   │   └── promptBuilder.ts # ✅ Prompt 构建
│   │   ├── tray/
│   │   │   └── trayManager.ts   # 🟡 系统托盘 (待完善)
│   │   └── config/
│   │       └── store.ts         # ✅ 配置存储
│   ├── preload/
│   │   └── index.ts             # ✅ Preload 脚本
│   ├── renderer/                # 渲染进程
│   │   ├── App.tsx              # ✅ 主应用
│   │   ├── store/               # ✅ Zustand 状态
│   │   └── components/          # ✅ React 组件
│   └── shared/
│       ├── constants.ts         # ✅ 常量定义
│       └── types.ts             # ✅ 类型定义
├── docs/
│   └── TODO.md                  # 本文件
└── package.json
```

---

## 快捷键参考

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+S` | 截图入队 |
| `Ctrl+Shift+E` | 提取代码 |
| `Ctrl+Shift+M` | 显示主窗口 |

---

## 开发命令

```bash
# 开发
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 构建
npm run build

# 打包
npm run package
```

---

## 相关文档

- [CLAUDE.md](../CLAUDE.md) - 项目架构说明
- [开发进度1.md](./开发进度1.md) - 历史开发记录
