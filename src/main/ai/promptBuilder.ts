import { Frame } from '@shared/types';

/**
 * 构建 Claude API 的 Prompt
 */
export function buildMultiFramePrompt(frames: Frame[]): {
  systemPrompt: string;
  userPrompt: string;
  images: string[];
} {
  // 系统提示
  const systemPrompt = `你是代码提取专家。你将收到 N 张按时序排列的代码截图，它们来自同一文件的连续滚动操作。
相邻截图之间存在重叠行，请去重并输出完整连贯代码。`;

  // 用户提示 + 图片
  let userPrompt = '';
  const images: string[] = [];

  frames.forEach((frame, index) => {
    const total = frames.length;
    const metadata = generateFrameMetadata(frame, index, total);
    userPrompt += `[${metadata}] <image>\n`;
    images.push(frame.data);
  });

  userPrompt += `
输出格式（JSON）：
{
  "language": "编程语言",
  "code": "完整连贯的代码",
  "confidence": 0.0-1.0
}`;

  return {
    systemPrompt,
    userPrompt,
    images,
  };
}

/**
 * 生成帧元数据
 */
function generateFrameMetadata(frame: Frame, index: number, total: number): string {
  const frameTypeStr = frame.type === 'new_scene' ? 'new_scene' : 'continuation';
  const overlapStr = frame.overlap
    ? ` | 与上帧重叠约${Math.round(frame.overlap * 100)}%`
    : '';

  return `帧${index + 1}/${total} | 类型:${frameTypeStr}${overlapStr}`;
}
