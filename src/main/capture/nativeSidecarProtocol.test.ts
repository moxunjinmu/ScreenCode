import { describe, expect, it } from 'vitest';
import {
  MAX_SIDECAR_LINE_BYTES,
  encodeSidecarCommand,
  parseSidecarMessage,
} from './nativeSidecarProtocol';

describe('GStreamer sidecar 控制协议', () => {
  it('将受控启动选择编码为单行 JSON', () => {
    const line = encodeSidecarCommand({
      type: 'start',
      requestId: 'request-1',
      selection: {
        deviceId: 'mf:usb3-video',
        formatId: 'YUY2',
        modeId: 'YUY2:2560x1440:50/1',
      },
    });
    expect(line.endsWith('\n')).toBe(true);
    expect(line.trim()).toContain('"modeId":"YUY2:2560x1440:50/1"');
  });

  it('解析实际协商状态，而不是把请求值冒充实际值', () => {
    const status = parseSidecarMessage(JSON.stringify({
      type: 'status',
      phase: 'streaming',
      requestedModeId: 'YUY2:2560x1440:50/1',
      negotiated: {
        formatId: 'YUY2',
        width: 2560,
        height: 1440,
        frameRateNumerator: 50,
        frameRateDenominator: 1,
      },
      measuredFps: 49.8,
      previewCodec: 'H264',
      verified: true,
    }));
    expect(status.type).toBe('status');
    if (status.type === 'status') {
      expect(status.negotiated?.formatId).toBe('YUY2');
      expect(status.measuredFps).toBe(49.8);
      expect(status.verified).toBe(true);
    }
  });

  it('拒绝超过控制协议上限的输出', () => {
    expect(() => parseSidecarMessage('x'.repeat(MAX_SIDECAR_LINE_BYTES + 1))).toThrow('sidecar 消息超过上限');
  });

  it('拒绝非 JSON 和未知消息类型', () => {
    expect(() => parseSidecarMessage('not-json')).toThrow('sidecar 消息不是有效 JSON');
    expect(() => parseSidecarMessage('{"type":"raw-frame"}')).toThrow('未知 sidecar 消息类型');
  });
});
