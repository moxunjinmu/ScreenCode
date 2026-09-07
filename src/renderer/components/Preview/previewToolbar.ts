import type { NativeCaptureStatus } from '@shared/types';

export type ToolbarPanel = 'capture' | 'display' | null;

interface Resolution {
  width: number;
  height: number;
}

function isValidResolution(resolution: Resolution | null | undefined): resolution is Resolution {
  return Boolean(
    resolution
    && Number.isFinite(resolution.width)
    && Number.isFinite(resolution.height)
    && resolution.width > 0
    && resolution.height > 0,
  );
}

/** 顶部只输出当前画面的分辨率，协议、帧率和预览编码留在内部状态。 */
export function resolveToolbarResolution(
  nativeStatus: NativeCaptureStatus,
  sourceResolution: Resolution | null,
): string | null {
  const resolution = isValidResolution(nativeStatus.negotiated)
    ? nativeStatus.negotiated
    : sourceResolution;
  return isValidResolution(resolution)
    ? `${Math.round(resolution.width)}×${Math.round(resolution.height)}`
    : null;
}

/** 同一个工具栏同时只展开一个设置面板，再次点击当前面板即关闭。 */
export function toggleToolbarPanel(
  current: ToolbarPanel,
  requested: Exclude<ToolbarPanel, null>,
): ToolbarPanel {
  return current === requested ? null : requested;
}
