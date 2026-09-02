import type {
  NativeCaptureDevice,
  NativeCaptureSelection,
  NativeCaptureSnapshot,
  NativeCaptureStatus,
} from '@shared/types';

const MAX_COMMAND_BYTES = 64 * 1024;
export const MAX_SIDECAR_LINE_BYTES = 28 * 1024 * 1024;

export type SidecarCommand =
  | { type: 'enumerate'; requestId: string }
  | { type: 'start'; requestId: string; selection: NativeCaptureSelection }
  | { type: 'stop'; requestId: string }
  | { type: 'snapshot'; requestId: string }
  | { type: 'shutdown'; requestId: string };

export type SidecarMessage =
  | { type: 'devices'; requestId: string; devices: NativeCaptureDevice[] }
  | ({ type: 'status' } & NativeCaptureStatus)
  | { type: 'snapshot'; requestId: string; snapshot: NativeCaptureSnapshot }
  | { type: 'ok'; requestId: string }
  | { type: 'error'; requestId?: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function encodeSidecarCommand(command: SidecarCommand): string {
  const line = `${JSON.stringify(command)}\n`;
  if (Buffer.byteLength(line, 'utf8') > MAX_COMMAND_BYTES) {
    throw new Error('sidecar 命令超过上限');
  }
  return line;
}

export function parseSidecarMessage(line: string): SidecarMessage {
  if (Buffer.byteLength(line, 'utf8') > MAX_SIDECAR_LINE_BYTES) {
    throw new Error('sidecar 消息超过上限');
  }

  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error('sidecar 消息不是有效 JSON');
  }
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('sidecar 消息结构无效');
  }

  if (!['devices', 'status', 'snapshot', 'ok', 'error'].includes(value.type)) {
    throw new Error('未知 sidecar 消息类型');
  }
  if (value.type === 'error' && typeof value.message !== 'string') {
    throw new Error('sidecar 错误消息结构无效');
  }
  if (value.type === 'status' && typeof value.phase !== 'string') {
    throw new Error('sidecar 状态消息结构无效');
  }

  return value as SidecarMessage;
}
