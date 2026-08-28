import type { EncodedImage, Frame } from '@shared/types';

/**
 * 构建 Claude API 的 Prompt
 * 优化用于屏幕代码/文字识别
 */
export function buildMultiFramePrompt(frames: Frame[]): {
  systemPrompt: string;
  userPrompt: string;
  images: EncodedImage[];
} {
  // 系统提示 - 强调 OCR 和代码识别能力
  const systemPrompt = `你是专业的屏幕内容识别专家。你的任务是从截图中识别并提取代码或文字内容。

## 核心能力
1. **OCR 识别**: 精确识别屏幕上的所有文字
2. **代码提取**: 识别编程语言，提取完整、可运行的代码
3. **去重合并**: 多张连续截图存在重叠内容时，智能去重并合并

## 输出要求
- 保持原始格式（缩进、换行、空格）
- 识别编程语言类型
- 如果是多帧，按时间顺序合并，去除重复行
- 置信度基于图像清晰度和识别难度评估

## 输出格式
必须返回 JSON 格式：
\`\`\`json
{
  "language": "编程语言或text",
  "code": "提取的完整代码/文字内容",
  "confidence": 0.0-1.0,
  "explanation": "可选：识别说明（如遇到的问题、特殊情况等）"
}
\`\`\`

## 语言识别
常见语言标识: javascript, typescript, python, java, cpp, c, go, rust, ruby, php, swift, kotlin, sql, html, css, json, yaml, markdown, bash, shell, text`;

  // 用户提示
  let userPrompt = `请识别以下 ${frames.length} 张截图中的代码/文字内容。

`;
  const images: EncodedImage[] = [];

  frames.forEach((frame, index) => {
    const total = frames.length;
    const metadata = generateFrameMetadata(frame);
    userPrompt += `**图片 ${index + 1}/${total}** [${metadata}]\n`;
    images.push({
      data: frame.data,
      mimeType: frame.mimeType,
      width: frame.width,
      height: frame.height,
    });
  });

  userPrompt += `
## 识别要求
1. 请仔细识别每张图片中的所有文字和代码
2. 如果有多张图片是连续滚动截图，请合并去重
3. 保持代码的原始缩进和格式
4. 返回 JSON 格式结果`;

  return {
    systemPrompt,
    userPrompt,
    images,
  };
}

/**
 * 生成帧元数据
 */
function generateFrameMetadata(frame: Frame): string {
  const parts: string[] = [];

  // 帧类型
  if (frame.type === 'new_scene') {
    parts.push('新场景');
  } else {
    parts.push('连续帧');
  }

  // 重叠信息
  if (frame.overlap) {
    parts.push(`与上帧重叠${Math.round(frame.overlap * 100)}%`);
  }

  // 时间戳
  const time = new Date(frame.timestamp).toLocaleTimeString();
  parts.push(time);

  return parts.join(' | ');
}
