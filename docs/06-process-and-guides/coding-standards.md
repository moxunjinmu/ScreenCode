# 开发规范

> 最后更新: 2026-02-28

## 代码风格

- TypeScript 严格模式
- ESLint 规则检查: `npm run lint`
- 类型检查: `npm run typecheck`

## 文件组织

- 按功能/领域组织，非按类型
- 单文件 200-400 行为宜，不超过 800 行
- 函数不超过 50 行
- 嵌套不超过 4 层

## 命名约定

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件/目录 | camelCase | `captureStore.ts` |
| 组件 | PascalCase | `ChatPanel/` |
| 函数/变量 | camelCase | `getConfig()` |
| 常量 | UPPER_SNAKE | `IPC_CHANNELS` |
| 类型/接口 | PascalCase | `AppConfig` |

## 不可变性

优先创建新对象，避免原地修改：

```typescript
// 正确
const newConfig = { ...config, activeProvider: 'zhipu' };

// 避免
config.activeProvider = 'zhipu';
```

## 错误处理

- 所有异步操作必须有 try/catch
- API 调用必须有超时机制
- 用户可见错误提供友好提示
- 不静默吞掉错误

## IPC 通道

- 通道名称必须使用 `src/shared/constants.ts` 中的 `IPC_CHANNELS` 常量
- 禁止硬编码通道字符串

## 注释

- 核心方法/类必须带注释
- 不写显而易见的注释
- 复杂逻辑写清楚"为什么"而非"做什么"
