# 贡献指南

> 最后更新: 2026-02-28

## 分支策略

| 分支 | 用途 |
|------|------|
| `master` | 稳定版本 |
| `dev/*` | 开发分支 |
| `fix/*` | Bug 修复 |
| `feat/*` | 新功能 |

## 提交规范

使用 Conventional Commits 格式：

```
<type>: <description>

<optional body>
```

类型: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## 开发流程

1. 从 `master` 创建功能分支
2. 开发并通过本地测试
3. `npm run typecheck` + `npm run lint` 通过
4. 提交并推送
5. 创建 PR 到 `master`

## 文档更新

完成功能后需同步更新：

| 场景 | 更新文件 |
|------|----------|
| 完成功能 | `05-dev-and-ops/backlog.md` 标记完成 → `08-history/completed-tasks.md` 归档 |
| 变更记录 | `08-history/changelog.md` 追加 |
| 架构变更 | `01-architecture/` 相关文件 |
| 新增模块 | `02-modules/` 对应文件 |
| 接口变更 | `03-interfaces/` 对应文件 |
| 设计决策 | `07-adrs/` 新增 ADR |
