import Anthropic from '@anthropic-ai/sdk';
import { ClaudeResponse, Frame } from '@shared/types';
import { buildMultiFramePrompt } from './promptBuilder';

/**
 * Claude API 服务
 */
export class ClaudeService {
  private client: Anthropic;
  private model: string = 'claude-3-5-sonnet-20241022';
  private maxTokens: number = 4096;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY || '',
    });
  }

  /**
   * 提取代码
   */
  async extractCode(frames: Frame[]): Promise<ClaudeResponse> {
    const { systemPrompt, userPrompt, images } = buildMultiFramePrompt(frames);

    // 构建消息内容
    const textContent = {
      type: 'text' as const,
      text: userPrompt,
    };
    
    const imageContents = images.map((imageBase64) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: imageBase64,
      },
    }));
    
    const content = [textContent, ...imageContents];

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
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

      // 解析 JSON 响应
      const result = this.parseResponse(responseText);

      return result;
    } catch (error) {
      console.error('Claude API error:', error);
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
        };
      }

      // 如果没有找到 JSON，返回原始文本作为代码
      return {
        language: 'unknown',
        code: text,
        confidence: 0.3,
      };
    } catch (error) {
      console.error('Failed to parse response:', error);
      return {
        language: 'unknown',
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
  }
}
