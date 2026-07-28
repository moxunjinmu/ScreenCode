import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ClaudeResponse, Frame, ChatRequest, ProviderConfig } from '@shared/types';
import { ClaudeService } from './claudeService';
import { OpenAIService } from './openAIService';
import { AIService, AIServiceOptions } from './types';
import { getMainWindow } from '../index';
import { getActiveProviderConfig } from '../config/store';

// 缓存的服务实例及其对应的配置签名
let cachedService: AIService | null = null;
let cachedSignature = '';

// 设置 AI 相关的 IPC 处理器
export function setupAIHandlers(ipcMain: IpcMain) {
  // 提取代码
  ipcMain.handle(IPC_CHANNELS.AI_EXTRACT, async (_event, frames: Frame[]): Promise<ClaudeResponse> => {
    return extractCode(frames);
  });

  // 聊天
  ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (_event, request: ChatRequest): Promise<{ content: string }> => {
    return chat(request);
  });
}

/**
 * 判断是否使用 OpenAI 格式的 API
 * 优先级：sdkType 配置 > 自动检测
 */
function isOpenAICompatible(baseUrl: string, sdkType?: 'anthropic' | 'openai'): boolean {
  // 如果显式指定了 SDK 类型，直接使用
  if (sdkType === 'openai') return true;
  if (sdkType === 'anthropic') return false;
  
  // 智谱 Anthropic 兼容端点使用 Anthropic SDK 格式
  if (baseUrl.includes('/api/anthropic')) {
    return false;
  }
  // 智谱标准端点、OpenRouter、阿里云 DashScope 使用 OpenAI 格式
  return baseUrl.includes('bigmodel.cn') ||
         baseUrl.includes('coding/paas') ||
         baseUrl.includes('openrouter.ai') ||
         baseUrl.includes('dashscope.aliyuncs.com');
}

/**
 * 计算配置签名 — 任一字段变化都必须重建服务实例。
 * 尤其是 apiKey：SDK 客户端在构造时固化凭据，仅比对 model/baseUrl 会导致
 * 用户更新 Key 后仍用旧 Key 发起请求。
 */
function buildSignature(config: ProviderConfig): string {
  const model = config.customModel || config.model;
  return [
    config.apiKey,
    config.baseUrl,
    model,
    config.maxTokens,
    config.temperature,
    config.sdkType,
  ].join('|');
}

/**
 * 获取或创建 AI 服务实例（根据 API 类型自动选择，配置变更时自动重建）
 */
function getAIService(): AIService {
  const providerConfig = getActiveProviderConfig();
  const signature = buildSignature(providerConfig);

  if (cachedService && signature === cachedSignature) {
    return cachedService;
  }

  const options: AIServiceOptions = {
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
    model: providerConfig.customModel || providerConfig.model,
    maxTokens: providerConfig.maxTokens,
    temperature: providerConfig.temperature,
  };

  const useOpenAI = isOpenAICompatible(providerConfig.baseUrl, providerConfig.sdkType);
  console.log(
    `[AI] Creating ${useOpenAI ? 'OpenAI' : 'Claude'} service: ` +
    `baseUrl=${options.baseUrl}, model=${options.model}, sdkType=${providerConfig.sdkType || 'auto'}`
  );

  cachedService = useOpenAI ? new OpenAIService(options) : new ClaudeService(options);
  cachedSignature = signature;

  return cachedService;
}

/**
 * 提取代码
 */
async function extractCode(frames: Frame[]): Promise<ClaudeResponse> {
  const mainWindow = getMainWindow();

  if (!frames || frames.length === 0) {
    mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
      code: 'FRAME_QUEUE_EMPTY',
      message: '帧队列为空，请先截图',
      timestamp: Date.now(),
    });
    throw new Error('帧队列为空');
  }

  try {
    // 获取当前激活供应商的配置
    const providerConfig = getActiveProviderConfig();
    
    if (!providerConfig.apiKey) {
      mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
        code: 'API_ERROR',
        message: '请先配置 API Key',
        timestamp: Date.now(),
      });
      throw new Error('API Key 未配置');
    }

    // 获取 AI 服务
    const service = getAIService();
    const model = service.getModel();
    const baseUrl = service.getBaseUrl();

    console.log(`[AI] Extracting code from ${frames.length} frames using ${model} at ${baseUrl}...`);

    // 调用 API
    const result = await service.extractCode(frames);

    console.log('[AI] Code extraction completed:', {
      language: result.language,
      confidence: result.confidence,
      codeLength: result.code.length
    });

    // 发送结果到渲染进程
    mainWindow?.webContents.send(IPC_CHANNELS.AI_RESULT, result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('[AI] Code extraction failed:', errorMessage);

    mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
      code: 'API_ERROR',
      message: `代码提取失败: ${errorMessage}`,
      timestamp: Date.now(),
    });

    throw error;
  }
}

/**
 * 强制重置服务实例。
 * 常规配置变更由 getAIService 的签名比对自动处理，此处仅供外部显式失效使用。
 */
export function resetService(): void {
  console.log('[AI] Resetting AI services');
  cachedService = null;
  cachedSignature = '';
}

/**
 * 聊天
 */
async function chat(request: ChatRequest): Promise<{ content: string }> {
  const mainWindow = getMainWindow();

  try {
    // 获取当前激活供应商的配置
    const providerConfig = getActiveProviderConfig();
    
    if (!providerConfig.apiKey) {
      mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
        code: 'API_ERROR',
        message: '请先配置 API Key',
        timestamp: Date.now(),
      });
      throw new Error('API Key 未配置');
    }

    // 获取 AI 服务
    const service = getAIService();

    console.log(`[AI] Chat request with ${request.messages.length} messages`);

    // 调用 API
    const result = await service.chat(request);

    console.log(`[AI] Chat response length: ${result.content.length}`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('[AI] Chat failed:', errorMessage);

    mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
      code: 'API_ERROR',
      message: `对话失败: ${errorMessage}`,
      timestamp: Date.now(),
    });

    throw error;
  }
}
