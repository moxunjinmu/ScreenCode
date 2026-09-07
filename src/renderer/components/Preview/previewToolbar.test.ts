import { describe, expect, it } from 'vitest';
import type { NativeCaptureStatus } from '@shared/types';
import {
  resolveToolbarResolution,
  toggleToolbarPanel,
  type ToolbarPanel,
} from './previewToolbar';

describe('简约采集工具栏', () => {
  it('原生预览只输出协商分辨率，不拼接 FPS、编码器或验证状态', () => {
    const status: NativeCaptureStatus = {
      phase: 'streaming',
      negotiated: {
        formatId: 'MJPEG',
        width: 2560,
        height: 1440,
        frameRateNumerator: 30,
        frameRateDenominator: 1,
      },
      measuredFps: 29.5,
      previewCodec: 'H264',
      verified: true,
    };

    const label = resolveToolbarResolution(status, { width: 1920, height: 1080 });

    expect(label).toBe('2560×1440');
    expect(label).not.toMatch(/FPS|H264|VP8|已验证/);
  });

  it('浏览器自动模式使用视频源固有分辨率', () => {
    expect(resolveToolbarResolution(
      { phase: 'idle', verified: false },
      { width: 1920, height: 1080 },
    )).toBe('1920×1080');
  });

  it('没有有效画面时不显示占位状态文本', () => {
    expect(resolveToolbarResolution(
      { phase: 'starting', verified: false },
      null,
    )).toBeNull();
  });

  it.each<[ToolbarPanel, Exclude<ToolbarPanel, null>, ToolbarPanel]>([
    [null, 'capture', 'capture'],
    ['capture', 'capture', null],
    ['capture', 'display', 'display'],
    ['display', 'capture', 'capture'],
  ])('面板从 %s 点击 %s 后切换为 %s', (current, requested, expected) => {
    expect(toggleToolbarPanel(current, requested)).toBe(expected);
  });
});
