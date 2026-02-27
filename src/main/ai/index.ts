import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ClaudeResponse, Frame } from '@shared/types';
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
}

/**
 * 获取或创建 Claude 服务实例
 */
function getClaudeService(): ClaudeService {
  const apiKey = getConfigValue('claudeApiKey');
  const model = getConfigValue('claudeModel') || 'claude-sonnet-4-6';

  // 如果服务不存在或模型变了，重新创建
  if (!claudeService || claudeService.getModel() !== model) {
    console.log(`[AI] Creating Claude service with model: ${model}`);
    claudeService = new ClaudeService(apiKey, model);
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

    console.log(`[AI] Extracting code from ${frames.length} frames using ${model}...`);

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
 * 重置服务（用于更新 API Key 或模型）
 */
export function resetService(): void {
  console.log('[AI] Resetting Claude service');
  claudeService = null;
}
