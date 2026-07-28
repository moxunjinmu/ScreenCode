import OpenAI from 'openai';
import { ClaudeResponse, Frame, ChatRequest } from '@shared/types';
import { AI_TIMEOUT } from '@shared/constants';
import { buildMultiFramePrompt } from './promptBuilder';
import { parseExtractionResponse } from './responseParser';
import { AIService, AIServiceOptions } from './types';

const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4';

/**
 * OpenAI 兼容 API 服务
 * 支持智谱 AI Coding Plan 等使用 OpenAI 格式的 API
 */
export class OpenAIService implements AIService {
  private client: OpenAI;
  private model: string = 'glm-4.7';
  private maxTokens: number;
  private temperature?: number;
  private baseUrl: string;

  constructor(options: AIServiceOptions) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature;

    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: this.baseUrl,
      timeout: options.timeout ?? AI_TIMEOUT,
    });

    if (options.model) {
      this.model = options.model;
    }

    console.log(
      `[OpenAIService] Initialized: baseUrl=${this.baseUrl}, model=${this.model}, ` +
      `maxTokens=${this.maxTokens}, temperature=${this.temperature ?? 'default'}`
    );
  }

  /**
   * 提取代码/文字
   */
  async extractCode(frames: Frame[]): Promise<ClaudeResponse> {
    const { systemPrompt, userPrompt, images } = buildMultiFramePrompt(frames);

    // 构建消息内容 - OpenAI 格式
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      ...images.map((imageBase64) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
        },
      })),
      {
        type: 'text' as const,
        text: userPrompt,
      },
    ];

    console.log(`[OpenAIService] Calling ${this.model} with ${images.length} images...`);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        ...(this.temperature !== undefined && { temperature: this.temperature }),
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content,
          },
        ],
      });

      // 提取响应文本
      const responseText = response.choices[0]?.message?.content || '';

      console.log(`[OpenAIService] Response received, length: ${responseText.length}`);

      return parseExtractionResponse(responseText);
    } catch (error) {
      console.error('[OpenAIService] API error:', error);
      throw error;
    }
  }

  /**
   * 聊天接口
   */
  async chat(request: ChatRequest): Promise<{ content: string }> {
    // 构建消息
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // 添加系统提示
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    } else {
      messages.push({
        role: 'system',
        content: '你是一个有帮助的AI助手，能够识别图片中的代码和文字。',
      });
    }

    // 添加对话历史
    for (const msg of request.messages) {
      if (msg.role === 'user' && msg.images && msg.images.length > 0) {
        // 带图片的消息（仅 user 支持）
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          ...msg.images.map((img) => ({
            type: 'image_url' as const,
            image_url: {
              url: `data:image/jpeg;base64,${img}`,
            },
          })),
          {
            type: 'text' as const,
            text: msg.content,
          },
        ];
        messages.push({ role: 'user', content });
      } else {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    console.log(`[OpenAIService] Chat with ${messages.length} messages...`);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        ...(this.temperature !== undefined && { temperature: this.temperature }),
        messages,
      });

      const responseText = response.choices[0]?.message?.content || '';

      console.log(`[OpenAIService] Chat response length: ${responseText.length}`);

      return { content: responseText };
    } catch (error) {
      console.error('[OpenAIService] Chat error:', error);
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
