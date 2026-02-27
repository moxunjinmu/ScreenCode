import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ClaudeResponse, Frame, ChatRequest } from '@shared/types';
import { ClaudeService } from './claudeService';
import { getMainWindow } from '../index';
import { getConfigValue } from '../config/store';

// Claude 服务实例
let claudeService: ClaudeService | null = null;

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
 * 获取实际使用的模型名称
 */
function getActualModel(): string {
  const model = getConfigValue('claudeModel');
  const customModel = getConfigValue('claudeCustomModel');

  // 如果选择自定义模型且有自定义模型名称，使用自定义名称
  if (model === 'custom' && customModel) {
    return customModel;
  }

  return model || 'claude-sonnet-4-6';
}

/**
 * 获取或创建 Claude 服务实例
 */
function getClaudeService(): ClaudeService {
  const apiKey = getConfigValue('claudeApiKey');
  const baseUrl = getConfigValue('claudeApiBaseUrl');
  const actualModel = getActualModel();

  // 如果服务不存在或配置变了，重新创建
  if (!claudeService ||
      claudeService.getModel() !== actualModel ||
      claudeService.getBaseUrl() !== baseUrl) {
    console.log(`[AI] Creating Claude service with baseUrl: ${baseUrl}, model: ${actualModel}`);
    claudeService = new ClaudeService(apiKey, actualModel, baseUrl);
  }

  return claudeService;
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
    // 获取 API Key
    const apiKey = getConfigValue('claudeApiKey');

    if (!apiKey) {
      mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
        code: 'API_ERROR',
        message: '请先配置 Claude API Key',
        timestamp: Date.now(),
      });
      throw new Error('API Key 未配置');
    }

    // 获取 Claude 服务
    const service = getClaudeService();
    const model = service.getModel();
    const baseUrl = service.getBaseUrl();

    console.log(`[AI] Extracting code from ${frames.length} frames using ${model} at ${baseUrl}...`);

    // 调用 Claude API
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
  console.log('[AI] Resetting Claude service');
  claudeService = null;
}

/**
 * 聊天
 */
async function chat(request: ChatRequest): Promise<{ content: string }> {
  const mainWindow = getMainWindow();

  try {
    // 获取 API Key
    const apiKey = getConfigValue('claudeApiKey');

    if (!apiKey) {
      mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
        code: 'API_ERROR',
        message: '请先配置 API Key',
        timestamp: Date.now(),
      });
      throw new Error('API Key 未配置');
    }

    // 获取 Claude 服务
    const service = getClaudeService();

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
