import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ClaudeResponse, Frame, ChatRequest } from '@shared/types';
import { ClaudeService } from './claudeService';
import { OpenAIService } from './openAIService';
import { getMainWindow } from '../index';
import { getActiveProviderConfig } from '../config/store';

// 服务实例
let claudeService: ClaudeService | null = null;
let openAIService: OpenAIService | null = null;

// 统一的服务接口
interface AIService {
  extractCode(frames: Frame[]): Promise<ClaudeResponse>;
  chat(request: ChatRequest): Promise<{ content: string }>;
  getModel(): string;
  getBaseUrl(): string;
}

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
 */
function isOpenAICompatible(baseUrl: string): boolean {
  // 智谱 Anthropic 兼容端点使用 Anthropic SDK 格式
  if (baseUrl.includes('/api/anthropic')) {
    return false;
  }
  // 智谱标准端点和 OpenRouter 使用 OpenAI 格式
  return baseUrl.includes('bigmodel.cn') ||
         baseUrl.includes('coding/paas') ||
         baseUrl.includes('openrouter.ai');
}

/**
 * 获取或创建 AI 服务实例（根据 API 类型自动选择）
 */
function getAIService(): AIService {
  const providerConfig = getActiveProviderConfig();
  const apiKey = providerConfig.apiKey;
  const baseUrl = providerConfig.baseUrl;
  const model = providerConfig.customModel || providerConfig.model;

  // 判断是否使用 OpenAI 格式
  if (isOpenAICompatible(baseUrl)) {
    // 使用 OpenAI 服务
    if (!openAIService ||
        openAIService.getModel() !== model ||
        openAIService.getBaseUrl() !== baseUrl) {
      console.log(`[AI] Creating OpenAI service with baseUrl: ${baseUrl}, model: ${model}`);
      openAIService = new OpenAIService(apiKey, model, baseUrl);
    }
    return openAIService;
  } else {
    // 使用 Anthropic 服务
    if (!claudeService ||
        claudeService.getModel() !== model ||
        claudeService.getBaseUrl() !== baseUrl) {
      console.log(`[AI] Creating Claude service with baseUrl: ${baseUrl}, model: ${model}`);
      claudeService = new ClaudeService(apiKey, model, baseUrl);
    }
    return claudeService;
  }
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
 * 重置服务（用于更新 API Key、模型或 Base URL）
 */
export function resetService(): void {
  console.log('[AI] Resetting AI services');
  claudeService = null;
  openAIService = null;
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
