import { ClaudeResponse } from '@shared/types';

/** 模型未按 JSON 格式返回时的兜底置信度 */
const FALLBACK_CONFIDENCE = 0.3;
/** JSON 中缺失 confidence 字段时的默认值 */
const DEFAULT_CONFIDENCE = 0.5;

/**
 * 解析模型返回的代码提取结果。
 * 模型被要求返回 JSON，但实际可能夹带 markdown 围栏或前后说明文字，
 * 因此先尝试提取首个 JSON 对象，失败则整体降级为纯文本结果。
 */
export function parseExtractionResponse(text: string): ClaudeResponse {
  const fallback: ClaudeResponse = {
    language: 'text',
    code: text,
    confidence: FALLBACK_CONFIDENCE,
  };

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      language: parsed.language || 'unknown',
      code: parsed.code || '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : DEFAULT_CONFIDENCE,
      explanation: parsed.explanation,
    };
  } catch (error) {
    console.error('[AI] Failed to parse response as JSON:', error);
    return fallback;
  }
}
