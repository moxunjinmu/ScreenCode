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

    // 初始化 Claude 服务
    if (!claudeService) {
      claudeService = new ClaudeService(apiKey);
    }

    console.log(`Extracting code from ${frames.length} frames...`);

    // 调用 Claude API
    const result = await claudeService.extractCode(frames);

    console.log('Code extraction completed:', {
      language: result.language,
      confidence: result.confidence,
      codeLength: result.code.length
    });

    // 发送结果到渲染进程
    mainWindow?.webContents.send(IPC_CHANNELS.AI_RESULT, result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('Code extraction failed:', errorMessage);
    
    mainWindow?.webContents.send(IPC_CHANNELS.AI_ERROR, {
      code: 'API_ERROR',
      message: `代码提取失败: ${errorMessage}`,
      timestamp: Date.now(),
    });

    throw error;
  }
}

/**
 * 重置服务（用于更新 API Key）
 */
export function resetService(): void {
  claudeService = null;
}
