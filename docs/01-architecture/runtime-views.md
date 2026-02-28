# 运行时序

> 最后更新: 2026-02-28
> 关键业务流程的时序描述

## 1. 截图入队流程

```
用户 ──Ctrl+Shift+S──→ Main Process
                         │
                         ├─ 从视频流捕获当前帧
                         ├─ 帧差分检查
                         │   ├─ diff < 5%  → 丢弃（静态重复帧）
                         │   ├─ 5%-60%    → 保留，标记 continuation
                         │   └─ > 60%     → 保留，标记 new_scene
                         ├─ Sharp 压缩 (1080p → 768px, JPEG Q=85)
                         ├─ 存入 Ring Buffer (最多 8 帧)
                         │
                         ├──IPC FRAME_ADD──→ Renderer
                         │                    └─ frameStore.addFrame()
                         │                    └─ 更新缩略图
                         │
                         └─ Toast 通知 (1.5s 自动消失)
```

## 2. 代码提取流程

```
用户 ──Ctrl+Shift+E──→ Main Process
                         │
                         ├─ 检查 Ring Buffer 是否有帧
                         │   └─ 空 → AI_ERROR → Renderer 显示错误
                         │
                         ├─ 获取当前供应商配置
                         │   └─ 无 API Key → AI_ERROR
                         │
                         ├─ 构建结构化多帧 Prompt
                         │   ├─ 帧元数据 (序号/总数/类型/重叠率)
                         │   ├─ 图像 base64
                         │   └─ JSON 输出格式指令
                         │
                         ├─ isOpenAICompatible(baseUrl) 路由判断
                         │   ├─ /api/anthropic      → ClaudeService (Anthropic SDK)
                         │   ├─ bigmodel.cn          → OpenAIService (OpenAI SDK)
                         │   ├─ openrouter.ai        → OpenAIService (OpenAI SDK)
                         │   └─ 其他                 → ClaudeService (默认)
                         │
                         ├─ 调用 AI API (超时 25s)
                         ├─ 解析 JSON {language, code, confidence}
                         │
                         └──IPC AI_RESULT──→ Renderer
                                              └─ appStore.setCodeResult()
                                              └─ 展示代码
```

## 3. 配置变更推送流程

```
Renderer (Settings)
  │
  ├──IPC CONFIG_SET──→ Main Process
  │                     ├─ electron-store 持久化
  │                     ├─ resetService() (重建 AI 服务实例)
  │                     │
  │                     └──IPC CONFIG_CHANGED──→ Renderer (广播)
  │                                               ├─ chatStore.setCurrentModel()
  │                                               └─ UI 更新
  │
  └─ Settings 组件 onConfigChanged 回调更新本地状态
```

## 4. 聊天对话流程

```
用户输入消息 + 可选图片(最多4张)
  │
  ├─ chatStore.addMessage(userMsg)
  ├─ chatStore.setLoading(true)
  │
  ├──IPC AI_CHAT──→ Main Process
  │                  ├─ 获取供应商配置
  │                  ├─ 路由到对应 AI Service
  │                  ├─ 调用 chat(request)
  │                  └─ 返回 {content: string}
  │
  ├─ chatStore.addMessage(assistantMsg)
  └─ chatStore.setLoading(false)
```

## 5. 会话管理流程

```
新建会话: createSession()
  └─ 生成新 ChatSession {id, title:'新会话', messages:[], createdAt}
  └─ 切换到新会话，清空当前消息

切换会话: switchSession(id)
  └─ 保存当前会话消息到 sessions
  └─ 恢复目标会话消息

删除会话: deleteSession(id)
  ├─ 删除目标会话
  ├─ 若删除当前会话 → 切换到最后一个会话
  └─ 若全部删除 → 自动新建一个空会话
```

## 性能目标

| 操作 | 目标延迟 |
|------|----------|
| 热键触发 → Toast 消失（截图入队） | < 200ms |
| 代码提取（8帧 → 完整代码） | < 20s（P90） |
| AI 聊天问答 | < 8s（P90） |
| AI API 超时 | 25s |
| Toast 通知持续时间 | 1.5s |
