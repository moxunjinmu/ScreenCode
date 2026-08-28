import Anthropic from '@anthropic-ai/sdk';
import { ClaudeResponse, Frame, ClaudeModel, DEFAULT_API_BASE_URL, ChatRequest } from '@shared/types';
import { AI_TIMEOUT } from '@shared/constants';
import { buildMultiFramePrompt } from './promptBuilder';
import { parseExtractionResponse } from './responseParser';
import { AIService, AIServiceOptions } from './types';

const DEFAULT_MAX_TOKENS = 8192;

/**
 * Claude API 服务
 * 支持最新的 Claude Opus 4.6 和 Sonnet 4.6 模型
 * 支持第三方中转 API
 */
export class ClaudeService implements AIService {
  private client: Anthropic;
  private model: ClaudeModel | string = 'claude-sonnet-4-6';
  private maxTokens: number;
  private temperature?: number;
  private baseUrl: string;

  constructor(options: AIServiceOptions) {
    this.baseUrl = options.baseUrl || DEFAULT_API_BASE_URL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature;

    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: this.baseUrl,
      timeout: options.timeout ?? AI_TIMEOUT,
    });

    if (options.model) {
      this.model = options.model;
    }

    console.log(
      `[ClaudeService] Initialized: baseUrl=${this.baseUrl}, model=${this.model}, ` +
      `maxTokens=${this.maxTokens}, temperature=${this.temperature ?? 'default'}`
    );
  }

  /**
   * 提取代码/文字
   */
  async extractCode(frames: Frame[]): Promise<ClaudeResponse> {
    const { systemPrompt, userPrompt, images } = buildMultiFramePrompt(frames);

    // 构建消息内容 - 图片放在前面，文字放在后面
    const imageContents = images.map((image) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: image.mimeType,
        data: image.data,
      },
    }));

    const textContent = {
      type: 'text' as const,
      text: userPrompt,
    };

    const content = [...imageContents, textContent];

    console.log(`[ClaudeService] Calling ${this.model} with ${images.length} images...`);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        ...(this.temperature !== undefined && { temperature: this.temperature }),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      });

      // 提取响应文本
      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText = textBlock && 'text' in textBlock ? textBlock.text : '';

      console.log(`[ClaudeService] Response received, length: ${responseText.length}`);

      return parseExtractionResponse(responseText);
    } catch (error) {
      console.error('[ClaudeService] API error:', error);
      throw error;
    }
  }

  /**
   * 聊天接口
   */
  async chat(request: ChatRequest): Promise<{ content: string }> {
    // 构建消息
    const messages: Anthropic.Messages.MessageParam[] = request.messages.map((msg) => {
      if (msg.images && msg.images.length > 0) {
        // 带图片的消息
        const imageContents = msg.images.map((image) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mimeType,
            data: image.data,
          },
        }));
        const textContent = {
          type: 'text' as const,
          text: msg.content,
        };
        return {
          role: msg.role,
          content: [...imageContents, textContent],
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });

    console.log(`[ClaudeService] Chat with ${messages.length} messages...`);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        ...(this.temperature !== undefined && { temperature: this.temperature }),
        system: request.systemPrompt || '你是一个有帮助的AI助手，能够识别图片中的代码和文字。',
        messages,
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText = textBlock && 'text' in textBlock ? textBlock.text : '';

      console.log(`[ClaudeService] Chat response length: ${responseText.length}`);

      return { content: responseText };
    } catch (error) {
      console.error('[ClaudeService] Chat error:', error);
      throw error;
    }
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.model;
  }

  /**
   * 获取当前 Base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
