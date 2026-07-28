# UI 重构记录（2026-04-23）

## 方案

本轮围绕桌面端主工作流做结构性 UI 整理，不做纯视觉换皮，重点处理以下问题：

1. 主布局弹性不足，窗口缩小时预览区、缩略图区、代码区和聊天面板互相挤压。
2. 预览区交互过密，截图、全屏、区域截取、状态提示缺少清晰分层。
3. 缩略图区单卡过小且承担过多动作，查看、删除、选择的发现性偏弱。
4. 设置面板语言和控件风格割裂，英文标签、硬编码双列和弱焦点态影响可用性。
5. 全局玻璃态过重、辅助文字偏灰、键盘焦点反馈缺失，导致层级不清和可访问性偏弱。

## 清单

- [x] 收紧全局背景和玻璃层级，提升主体内容对比度。
- [x] 补齐按钮、输入框、下拉框的 `focus-visible` 焦点态。
- [x] 重构标题栏，统一中文文案与快捷键入口样式。
- [x] 优化主布局比例，增大缩略图区可用高度，收敛聊天面板宽度策略。
- [x] 重做预览区工具条与状态信息，明确设备、分辨率、操作提示。
- [x] 重做缩略图区卡片布局，让查看、删除、选择具备更稳定的入口。
- [x] 优化代码结果区空状态、识别说明、结果统计和复制操作区。
- [x] 重做聊天面板头部、会话切换、待发送图片区和输入区辅助文案。
- [x] 统一设置面板为中文，补上响应式栅格和供应商可聚焦按钮。
- [x] 调整 Toast 为右下角提示，并补充更明确的状态标识。
- [x] 完成类型检查和 ESLint 验证。

## 执行

本次改动覆盖以下区域：

- `src/main/index.ts`
- `src/preload/types.d.ts`
- `src/renderer/styles/globals.css`
- `src/renderer/App.tsx`
- `src/renderer/lib/electronApi.ts`
- `src/renderer/components/Layout/index.tsx`
- `src/renderer/components/Preview/index.tsx`
- `src/renderer/components/Preview/RegionCaptureOverlay.tsx`
- `src/renderer/components/ThumbnailQueue/index.tsx`
- `src/renderer/components/CodeDisplay/index.tsx`
- `src/renderer/components/ChatPanel/index.tsx`
- `src/renderer/components/Settings/index.tsx`
- `src/renderer/components/Toast/index.tsx`

## 审查

执行后做了以下自查：

1. 确认设置面板中供应商卡片改为按钮，避免只有鼠标可点、键盘无焦点的问题。
2. 修正代码结果区无效的 `border-3` 类名，避免运行时样式失真。
3. 为预览根节点补充相对定位，确保全屏提示和浮层定位稳定。
4. 检查聊天面板、设置面板和主布局的 `min-h-0 / min-w-0`，避免滚动区被 flex 撑坏。
5. 修正 Electron 开发态窗口加载逻辑，改为优先使用 Forge Vite 注入的开发服务器地址与构建产物入口。
6. 为渲染层补充浏览器环境降级 `electronAPI`，让 Playwright 直接访问 Vite 页面时不会因为缺少 preload 而崩溃。
7. 调整设置弹窗结构，去掉遮挡内容的 sticky footer，并增强遮罩层级，减少背景 CTA 抢焦点的问题。
8. 收敛聊天面板关闭态渲染，关闭后不再保留宽度为 `0` 的侧栏 DOM，避免中等窗口下出现残留布局干扰。

## 测试

执行日期：2026-04-23

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run dev`
- [x] Playwright 打开 `http://localhost:52000/` 做浏览器态 UI 复查
- [x] 复查设置弹窗滚动与底部按钮区不再遮挡配置内容
- [x] 复查聊天面板打开后，主界面“打开 AI 对话”入口不再残留
- [x] 清理浏览器控制台中 `favicon.ico` 404 噪音

未完成项：

- [ ] 未在 Electron 实际窗口中做人工视觉回归
- [ ] 未针对极小窗口尺寸做手工拖拽回归

## 后续建议

1. 在 Electron 真机窗口下补一轮视觉回归，重点检查全屏预览、聊天面板拖拽和设置弹窗滚动。
2. 收敛聊天区与设置区的工程化原始文案，例如模型标识和供应商术语，进一步提升成品感。
3. 如果后续继续提升质感，可以补图标系统和语义色规范，逐步替换残留的字符式控件表达。
