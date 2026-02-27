# ScreenCode 项目交接文档

> 交接日期: 2026-02-27
> 当前版本: dev/claude 分支
> 远程仓库: https://github.com/moxunjinmu/ScreenCode

---

## 一、项目概述

ScreenCode 是一个 Electron 桌面应用，用于隔离网络环境下的屏幕捕获和 AI 代码识别。通过摄像头/采集卡捕获屏幕，使用大模型 API（支持智谱 AI、Anthropic 等）进行 OCR 和代码提取。

### 技术栈

| 类型 | 技术 |
|------|------|
| 框架 | Electron Forge + Vite |
| 前端 | React 18 + TypeScript |
| 状态管理 | Zustand |
| 样式 | TailwindCSS |
| 图像处理 | Sharp |
| AI SDK | @anthropic-ai/sdk |
| 配置存储 | electron-store |

---

## 二、已完成功能

### ✅ 核心功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 视频预览 | ✅ 完成 | 摄像头实时预览 |
| 截图入队 | ✅ 完成 | Ctrl+Shift+S 全局热键 |
| 帧队列管理 | ✅ 完成 | 最多 8 帧，支持清空 |
| 全屏预览 | ✅ 完成 | 点击缩略图放大查看 |
| 图像压缩 | ✅ 完成 | Sharp 压缩到 768px |

### ✅ AI 功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 多模型支持 | ✅ 完成 | Opus 4.6 / Sonnet 4.6 / 3.5 Sonnet |
| 自定义模型 | ✅ 完成 | 支持 GLM-5 等第三方模型 |
| 第三方中转 | ✅ 完成 | 智谱 AI / OpenRouter / 自定义 |
| 供应商管理 | ✅ 完成 | 可添加/删除供应商 |
| 聊天对话 | ✅ 完成 | 右侧可拖拽宽度面板 |
| 多图 OCR | ✅ 完成 | 最多 4 张图片同时发送 |

### ✅ UI/UX

| 功能 | 状态 | 说明 |
|------|------|------|
| 设置界面 | ✅ 完成 | API Key / 模型 / 供应商配置 |
| Toast 通知 | ✅ 完成 | 操作反馈 |
| 代码展示 | ✅ 完成 | 语言识别 + 置信度 |
| 可拖拽面板 | ✅ 完成 | 聊天面板宽度可调 |

---

## 三、项目结构

```
ScreenCode/
├── src/
│   ├── main/                      # 主进程
│   │   ├── index.ts               # 入口，窗口/热键管理
│   │   ├── capture/
│   │   │   └── index.ts           # 视频采集 (待完善)
│   │   ├── processor/
│   │   │   ├── index.ts           # 帧处理入口
│   │   │   ├── ringBuffer.ts      # ✅ 环形缓冲区
│   │   │   ├── frameDiff.ts       # 🔴 帧差分 (模拟实现)
│   │   │   └── imageCompressor.ts # ✅ 图像压缩
│   │   ├── ai/
│   │   │   ├── index.ts           # ✅ AI IPC 处理器
│   │   │   ├── claudeService.ts   # ✅ API 服务
│   │   │   └── promptBuilder.ts   # ✅ Prompt 构建
│   │   ├── tray/
│   │   │   └── trayManager.ts     # 🟡 托盘 (待完善)
│   │   └── config/
│   │       └── store.ts           # ✅ 配置存储
│   ├── preload/
│   │   └── index.ts               # ✅ Preload 脚本
│   ├── renderer/                  # 渲染进程
│   │   ├── App.tsx                # ✅ 主应用 + 布局
│   │   ├── store/
│   │   │   ├── appStore.ts        # ✅ 应用状态
│   │   │   ├── captureStore.ts    # ✅ 采集状态
│   │   │   ├── frameStore.ts      # ✅ 帧队列状态
│   │   │   └── chatStore.ts       # ✅ 聊天状态
│   │   └── components/
│   │       ├── Layout/            # ✅ 布局
│   │       ├── Preview/           # ✅ 视频预览
│   │       ├── ThumbnailQueue/    # ✅ 帧队列 + 全屏预览
│   │       ├── CodeDisplay/       # ✅ 代码展示
│   │       ├── ChatPanel/         # ✅ 聊天面板
│   │       ├── Settings/          # ✅ 设置界面
│   │       └── Toast/             # ✅ 通知
│   └── shared/
│       ├── constants.ts           # ✅ IPC 通道/常量
│       └── types.ts               # ✅ 类型定义
├── docs/
│   ├── TODO.md                    # 开发待办
│   └── HANDOVER.md                # 本文件
├── CLAUDE.md                      # 项目说明
└── package.json
```

---

## 四、关键模块说明

### 1. AI 服务 (src/main/ai/)

```typescript
// claudeService.ts - 核心 API 调用
class ClaudeService {
  // 代码提取
  async extractCode(frames: Frame[]): Promise<ClaudeResponse>

  // 聊天对话
  async chat(request: ChatRequest): Promise<{ content: string }>
}
```

**配置读取**:
- `claudeApiKey`: API 密钥
- `claudeApiBaseUrl`: 中转地址
- `claudeModel`: 模型选择
- `claudeCustomModel`: 自定义模型名称

### 2. 聊天面板 (src/renderer/components/ChatPanel/)

**功能**:
- 从帧队列选择图片 (最多 4 张)
- 输入提示词发送给 AI
- 消息历史记录
- 可拖拽调整宽度

### 3. 供应商管理 (src/renderer/components/Settings/)

**数据结构**:
```typescript
interface ApiProvider {
  id: string;        // 'anthropic' | 'zhipu' | 'openrouter' | 'custom_xxx'
  name: string;      // 显示名称
  baseUrl: string;   // API 地址
}
```

---

## 五、待完善功能

### 🔴 高优先级

| 功能 | 文件 | 说明 |
|------|------|------|
| 视频采集 | `src/main/capture/index.ts` | 当前返回硬编码数据，需实现真实采集 |
| 帧差分 | `src/main/processor/frameDiff.ts` | 当前返回模拟数据，需实现像素级对比 |

### 🟡 中优先级

| 功能 | 说明 |
|------|------|
| 托盘图标 | 设计实际图标，状态切换 |
| 错误处理 | 全局错误边界，重试机制 |

### 🟢 低优先级

| 功能 | 说明 |
|------|------|
| 测试覆盖 | 单元测试 + E2E 测试 |
| 截图历史 | 持久化存储 |
| 多语言 | i18n 支持 |

---

## 六、开发命令

```bash
# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 构建生产版本
npm run build

# 打包应用
npm run package
```

---

## 七、配置说明

### 智谱 AI 配置示例

```
API 供应商: 智谱 AI
Base URL: https://open.bigmodel.cn/api/anthropic
模型: 自定义模型
自定义模型名称: GLM-5
API Key: [从智谱控制台获取]
```

### Anthropic 配置示例

```
API 供应商: Anthropic 官方
Base URL: https://api.anthropic.com
模型: Claude Sonnet 4.6
API Key: [从 Anthropic Console 获取]
```

---

## 八、IPC 通道

| 通道 | 用途 |
|------|------|
| `ai:extract` | 代码提取 |
| `ai:chat` | 聊天对话 |
| `ai:result` | 返回结果 |
| `ai:error` | 错误通知 |
| `capture:frame` | 截图事件 |
| `config:get` | 获取配置 |
| `config:set` | 设置配置 |
| `device:enum` | 枚举设备 |

---

## 九、已知问题

1. **视频采集**: 当前 `enumerateDevices` 返回模拟数据，需要实现真实的 `desktopCapturer` 调用
2. **帧差分**: `frameDiff.ts` 中的 `compare` 方法返回固定值 0.3，需要实现真实算法
3. **托盘图标**: 缺少实际的图标资源文件

---

## 十、后续开发建议

### 第一阶段：完善核心功能

1. 实现真实的视频采集 (`src/main/capture/index.ts`)
2. 实现帧差分算法 (`src/main/processor/frameDiff.ts`)
3. 添加托盘图标资源

### 第二阶段：用户体验

1. 添加全局错误处理
2. 实现截图历史记录
3. 优化聊天面板 UI

### 第三阶段：稳定性

1. 添加单元测试
2. 添加 E2E 测试
3. 性能优化

---

## 十一、Git 分支说明

| 分支 | 说明 |
|------|------|
| `master` | 主分支，稳定版本 |
| `dev/claude` | 当前开发分支 |

---

## 十二、联系方式

- **GitHub**: https://github.com/moxunjinmu/ScreenCode
- **问题反馈**: https://github.com/moxunjinmu/ScreenCode/issues

---

*文档最后更新: 2026-02-27*
