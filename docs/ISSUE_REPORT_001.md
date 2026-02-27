## 问题报告 #001

**发现时间**: 2026-02-27 15:30
**影响范围**: 全局 - 应用无法正常使用
**严重程度**: 🔴 严重 - 阻塞所有功能

---

### 问题描述

渲染进程中 `window.electronAPI` 未定义，导致所有 IPC 通信失败。

### 错误信息

```
Uncaught TypeError: Cannot read properties of undefined (reading 'onCaptureFrame')
    at App.tsx:30:29

Failed to load devices: TypeError: Cannot read properties of undefined (reading 'getConfig')
```

### 差异分析

**文档描述** (HANDOVER.md 第八节):
> IPC 通道已定义，preload 脚本应暴露 `electronAPI` 到 `window` 对象

**实际状态**:
- `preload.js` 文件存在于 `.vite/build/` 目录
- `contextBridge.exposeInMainWorld` 已调用
- 但渲染进程中 `window.electronAPI` 仍为 `undefined`

### 可能原因

1. **Preload 路径不正确**
   - `__dirname` 指向的目录可能不包含 `preload.js`
   - Vite 编译后的文件结构可能与预期不同

2. **CSP 策略限制**
   - Content Security Policy 可能阻止了 preload 脚本执行

3. **Electron Forge 配置问题**
   - Vite 插件的 preload 配置可能有误

### 已尝试的解决方案

| 尝试 | 结果 |
|------|------|
| 修改 preload 路径为 `path.join(__dirname, 'preload.js')` | ❌ 未解决 |
| 更新 `vite.preload.config.ts` 输出文件名 | ❌ 未解决 |
| 添加 `sandbox: false` 到 webPreferences | ❌ 未解决 |
| 更新 CSP 允许 `unsafe-eval` | ❌ 未解决 |

### 下一步计划

- [ ] 检查 Electron Forge Vite 插件的官方示例
- [ ] 对比其他项目的 preload 配置
- [ ] 尝试使用 `require.resolve` 获取正确路径
- [ ] 检查 Electron 主进程日志中的错误

### 处理状态

- [x] 问题已记录
- [ ] 原因已定位
- [ ] 解决方案已实施
- [ ] 已验证修复

---

### 附录：相关文件

**主进程入口** (`src/main/index.ts`):
```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: false,
},
```

**Preload 脚本** (`src/preload/index.ts`):
```typescript
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

**构建输出**:
```
.vite/build/
├── main.js
├── preload.js  ← 文件存在
└── index-xxxxx.js
```

---

*报告创建时间: 2026-02-27*
