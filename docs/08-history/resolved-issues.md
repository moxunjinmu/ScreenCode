# 已解决问题归档

> 此文件归档已解决的问题，日常开发无需读取

---

## #001 - window.electronAPI 未定义

发现: 2026-02-27
严重度: 阻塞
原因: preload 脚本文件名配置不正确
解决: 修正 preload 路径配置
状态: 已解决

## #002 - GLM-5 调用实际使用 glm-4-plus

发现: 2026-02-28
严重度: 功能异常
原因: Coding Plan 端点 `/api/coding/paas/v4` 不支持 glm-5，静默降级
解决: 改用标准端点 `/api/paas/v4`
状态: 已解决

## #003 - zhipu-anthropic 路由错误

发现: 2026-02-28
严重度: 功能异常
原因: `isOpenAICompatible()` 中 `bigmodel.cn` 匹配优先于 `/api/anthropic` 检查
解决: 添加 `/api/anthropic` 早期返回
状态: 已解决
