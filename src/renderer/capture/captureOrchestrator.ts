import type { EncodedImage, HighQualityCaptureResult } from '@shared/types';

export interface HighQualityCaptureOutcome {
  image: EncodedImage;
  source: 'yuy2' | 'native' | 'preview';
  sourceFormat?: string;
  warning?: string;
  restoreError?: string;
}

export interface HighQualityCaptureDependencies {
  captureFallback: () => Promise<EncodedImage | null>;
  stopPreview: () => Promise<void>;
  captureYuy2: () => Promise<HighQualityCaptureResult>;
  restorePreview: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 统一管理高保真截图的暂停、外部采集和恢复状态。
 * 截图失败可显式回退，但任何路径都必须尝试恢复预览。
 */
export async function captureWithYuy2AndRestore(
  dependencies: HighQualityCaptureDependencies,
): Promise<HighQualityCaptureOutcome> {
  const fallback = await dependencies.captureFallback();
  let outcome: HighQualityCaptureOutcome | null = null;
  try {
    await dependencies.stopPreview();
    const image = await dependencies.captureYuy2();
    outcome = { image, source: 'yuy2' };
  } catch (error) {
    if (!fallback) throw error;
    outcome = {
      image: fallback,
      source: 'preview',
      warning: `高保真截图失败，已回退到预览帧：${getErrorMessage(error)}`,
    };
  } finally {
    try {
      await dependencies.restorePreview();
    } catch (error) {
      if (outcome) {
        outcome.restoreError = `预览恢复失败：${getErrorMessage(error)}`;
      }
    }
  }

  if (!outcome) throw new Error('高保真截图未生成结果');
  return outcome;
}
