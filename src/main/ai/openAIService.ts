import OpenAI from 'openai';
import { ClaudeResponse, Frame, ChatRequest } from '@shared/types';
import { buildMultiFramePrompt } from './promptBuilder';

/**
 * OpenAI 兼容 API 服务
 * 支持智谱 AI Coding Plan 等使用 OpenAI 格式的 API
 */
export class OpenAIService {
  private client: OpenAI;
  private model: string = 'glm-4.7';
  private maxTokens: number = 8192;
  private baseUrl: string;

  constructor(
    apiKey: string,
    model?: string,
    baseUrl?: string
  ) {
    this.baseUrl = baseUrl || 'https://open.bigmodel.cn/api/coding/paas/v4';

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: this.baseUrl,
    });

    if (model) {
      this.model = model;
    }

    console.log(`[OpenAIService] Initialized with baseUrl: ${this.baseUrl}, model: ${this.model}`);
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

      // 解析 JSON 响应
      const result = this.parseResponse(responseText);

      return result;
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
   * 解析 API 响应
   */
  private parseResponse(text: string): ClaudeResponse {
    try {
      // 尝试提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          language: parsed.language || 'unknown',
          code: parsed.code || '',
          confidence: parsed.confidence || 0.5,
          explanation: parsed.explanation,
        };
      }

      // 如果没有找到 JSON，返回原始文本作为代码
      return {
        language: 'text',
        code: text,
        confidence: 0.3,
      };
    } catch (error) {
      console.error('[OpenAIService] Failed to parse response:', error);
      return {
        language: 'text',
        code: text,
        confidence: 0.3,
      };
    }
  }

  /**
   * 设置模型
   */
  setModel(model: string): void {
    this.model = model;
    console.log(`[OpenAIService] Model set to: ${model}`);
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
