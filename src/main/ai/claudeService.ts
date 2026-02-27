import Anthropic from '@anthropic-ai/sdk';
import { ClaudeResponse, Frame, ClaudeModel } from '@shared/types';
import { buildMultiFramePrompt } from './promptBuilder';

/**
 * Claude API 服务
 * 支持最新的 Claude Opus 4.6 和 Sonnet 4.6 模型
 */
export class ClaudeService {
  private client: Anthropic;
  private model: ClaudeModel = 'claude-sonnet-4-6';
  private maxTokens: number = 8192;

  constructor(apiKey: string, model?: ClaudeModel) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
    if (model) {
      this.model = model;
    }
  }

  /**
   * 提取代码/文字
   */
  async extractCode(frames: Frame[]): Promise<ClaudeResponse> {
    const { systemPrompt, userPrompt, images } = buildMultiFramePrompt(frames);

    // 构建消息内容 - 图片放在前面，文字放在后面
    const imageContents = images.map((imageBase64) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: imageBase64,
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

      // 解析 JSON 响应
      const result = this.parseResponse(responseText);

      return result;
    } catch (error) {
      console.error('[ClaudeService] API error:', error);
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
      console.error('[ClaudeService] Failed to parse response:', error);
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
  setModel(model: ClaudeModel): void {
    this.model = model;
    console.log(`[ClaudeService] Model set to: ${model}`);
  }

  /**
   * 获取当前模型
   */
  getModel(): ClaudeModel {
    return this.model;
  }
}
