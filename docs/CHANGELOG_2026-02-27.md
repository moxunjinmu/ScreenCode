# ScreenCode 更新日志

## 2026-02-27 - GLM-5 支持与配置系统重构

### 🎯 核心改进

#### 1. 添加 OpenAI SDK 支持

**问题**: 智谱 AI Coding Plan 使用 OpenAI 格式 API，原代码仅支持 Anthropic 格式。

**解决方案**:
- 安装 `openai` npm 包
- 创建 `openAIService.ts` 支持 OpenAI 格式 API
- 自动检测 API 端点格式并选择正确的 SDK

**关键代码**:
```typescript
// src/main/ai/openAIService.ts
export class OpenAIService {
  private client: OpenAI;
  
  async extractCode(frames: Frame[]): Promise<ClaudeResponse> {
    // OpenAI 格式的图片上传
    const content = [
      ...images.map(img => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img}` }
      })),
      { type: 'text', text: userPrompt }
    ];
    
    return await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content }]
    });
  }
}
```

**自动检测逻辑**:
```typescript
function isOpenAICompatible(baseUrl: string): boolean {
  return baseUrl.includes('bigmodel.cn') || 
         baseUrl.includes('coding/paas') ||
         baseUrl.includes('openrouter.ai');
}

function getAIService(): AIService {
  if (isOpenAICompatible(baseUrl)) {
    return new OpenAIService(apiKey, model, baseUrl);
  } else {
    return new ClaudeService(apiKey, model, baseUrl);
  }
}
```

---

#### 2. 支持 GLM-5 模型

**验证过程**:
1. 测试 API 端点连通性
   ```bash
   curl https://open.bigmodel.cn/api/coding/paas/v4/models
   ```

2. 确认 GLM-5 模型 ID
   ```json
   {
     "data": [
       {"id": "glm-4.5"},
       {"id": "glm-4.6"},
       {"id": "glm-4.7"},
       {"id": "glm-5"}  ← 已支持
     ]
   }
   ```

3. 确认模型名称必须小写
   - ✅ 正确: `glm-5`
   - ❌ 错误: `GLM-5`

**配置示例**:
```json
{
  "providerConfigs": {
    "zhipu": {
      "apiKey": "your-api-key",
      "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
      "model": "glm-5"
    }
  }
}
```

---

#### 3. 重构配置系统

**背景**: 原配置将所有供应商的配置混在一起，无法为每个供应商独立配置。

**新配置结构**:
```typescript
interface AppConfig {
  activeProvider: string;  // 当前激活的供应商 ID
  providerConfigs: {
    [providerId: string]: ProviderConfig;
  };
  apiProviders: ApiProvider[];
  // 全局配置...
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  customModel?: string;
  maxTokens?: number;
  temperature?: number;
}
```

**配置迁移**:
```typescript
// src/main/config/store.ts
function migrateConfig(): void {
  const oldApiKey = store.get('claudeApiKey');
  const oldBaseUrl = store.get('claudeApiBaseUrl');
  
  if (oldApiKey && !store.get('activeProvider')) {
    // 根据 baseUrl 判断供应商
    let providerId = 'anthropic';
    if (oldBaseUrl?.includes('bigmodel.cn/api/coding')) {
      providerId = 'zhipu';
    }
    
    // 迁移到新格式
    store.set('activeProvider', providerId);
    store.set('providerConfigs', {
      [providerId]: {
        apiKey: oldApiKey,
        baseUrl: oldBaseUrl,
        model: oldModel
      }
    });
  }
}
```

---

#### 4. 双向同步设置界面

**功能特性**:
- 输入框修改 → 自动更新 JSON 编辑器
- JSON 编辑器修改 → 自动更新输入框
- 实时 JSON 格式验证
- 错误提示

**实现机制**:
```typescript
// 输入框 → JSON 同步
const handleConfigChange = (field, value) => {
  const updatedProviderConfig = {
    ...activeProviderConfig,
    [field]: value
  };
  setActiveProviderConfig(updatedProviderConfig);
  
  // 同步更新 config 对象
  const updatedConfig = {
    ...config,
    providerConfigs: {
      ...config.providerConfigs,
      [activeProviderId]: updatedProviderConfig
    }
  };
  setConfig(updatedConfig);
  // 自动触发 useEffect → 更新 jsonText
};

// JSON → 输入框同步
const handleJsonChange = (json: string) => {
  setJsonText(json);
  
  try {
    const parsed = JSON.parse(json);
    setConfig(parsed);
    setActiveProviderConfig(parsed.providerConfigs[parsed.activeProvider]);
  } catch (error) {
    setJsonError(error.message);
  }
};
```

**新增配置项**:
- Base URL (可手动修改)
- Max Tokens (默认 8192)
- Temperature (默认 0.7)

---

### 📦 新增文件

```
src/main/ai/openAIService.ts          # OpenAI 兼容 API 服务
src/shared/types.ts                    # 新增 ProviderConfig, 更新 AppConfig
src/main/config/store.ts               # 添加配置迁移逻辑
src/renderer/components/Settings/     # 重写设置组件
```

### 🔧 修改文件

```
package.json                           # 添加 openai 依赖
src/main/ai/index.ts                   # 支持双 SDK 切换
docs/TODO.md                           # 更新进度
docs/HANDOVER.md                       # 更新交接文档
```

### 📊 技术债务

- ✅ 已解决: 智谱 AI 端点不支持 Anthropic 格式
- ✅ 已解决: 配置混乱，无法为每个供应商独立配置
- ✅ 已解决: 设置界面输入框和 JSON 编辑器不同步

### 🐛 已修复问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| GLM-5 调用失败 | 使用了 Anthropic SDK 调用 OpenAI 格式端点 | 添加 OpenAI SDK，自动检测端点格式 |
| 模型名称错误 | 配置了 `GLM-5` (大写) | 改为 `glm-5` (小写) |
| ECONNRESET 错误 | API 格式不匹配 | 自动选择正确的 SDK |
| UTF-8 BOM 错误 | PowerShell 生成的配置文件包含 BOM | 使用 write_to_file 工具生成 |

### 🧪 测试验证

1. **API 连接测试**
   ```bash
   curl https://open.bigmodel.cn/api/coding/paas/v4/models
   # 返回模型列表，包含 glm-5
   ```

2. **配置迁移测试**
   - 删除新配置文件
   - 保留旧配置字段
   - 启动应用，自动迁移成功

3. **双向同步测试**
   - 修改输入框，JSON 自动更新 ✓
   - 修改 JSON，输入框自动更新 ✓
   - JSON 格式错误提示 ✓

### 📝 后续优化建议

1. **性能优化**
   - 添加 API 调用缓存
   - 实现请求去重
   - 添加请求取消功能

2. **用户体验**
   - 添加配置导入/导出
   - 支持配置模板
   - 添加配置验证工具

3. **错误处理**
   - 更详细的错误分类
   - 自动重试机制
   - 离线模式支持

---

## 版本信息

- **版本**: v1.1.0
- **发布日期**: 2026-02-27
- **分支**: dev/claude
- **提交**: feat: add GLM-5 support and refactor config system

---

## 相关链接

- [智谱 AI 开放平台](https://open.bigmodel.cn)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Anthropic API 文档](https://docs.anthropic.com)
