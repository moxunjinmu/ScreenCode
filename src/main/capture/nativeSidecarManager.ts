import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { app } from 'electron';
import type {
  NativeCaptureDevice,
  NativeCaptureSelection,
  NativeCaptureSnapshot,
  NativeCaptureStatus,
} from '@shared/types';
import {
  encodeSidecarCommand,
  parseSidecarMessage,
  type SidecarCommand,
  type SidecarMessage,
} from './nativeSidecarProtocol';

export interface NativeSidecarProcess extends EventEmitter {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  pid?: number;
  kill: () => boolean;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface NativeSidecarManagerDependencies {
  spawnProcess?: () => NativeSidecarProcess;
  onStatus?: (status: NativeCaptureStatus) => void;
}

type SidecarCommandWithoutRequestId = SidecarCommand extends infer Command
  ? Command extends { requestId: string }
    ? Omit<Command, 'requestId'>
    : never
  : never;

const REQUEST_TIMEOUT_MS: Record<SidecarCommandWithoutRequestId['type'], number> = {
  enumerate: 60_000,
  start: 30_000,
  stop: 10_000,
  snapshot: 20_000,
  shutdown: 5_000,
};
const MAX_RESTARTS = 1;

function resolveRuntimePaths(): { executable: string; gstRoot: string } {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'native')
    : path.join(process.cwd(), 'resources', 'native');
  return {
    executable: path.join(base, 'screencode-gst-capture.exe'),
    gstRoot: app.isPackaged
      ? path.join(base, 'gstreamer')
      : path.join(process.cwd(), '.tools', 'gstreamer', '1.0', 'msvc_x86_64'),
  };
}

function spawnDefaultProcess(): NativeSidecarProcess {
  const { executable, gstRoot } = resolveRuntimePaths();
  const binPath = path.join(gstRoot, 'bin');
  const pluginPath = path.join(gstRoot, 'lib', 'gstreamer-1.0');
  const child = spawn(executable, [], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PATH: `${binPath}${path.delimiter}${process.env.PATH ?? ''}`,
      GST_PLUGIN_SYSTEM_PATH_1_0: pluginPath,
      GST_PLUGIN_PATH_1_0: pluginPath,
      GST_REGISTRY_1_0: path.join(app.getPath('userData'), 'gstreamer-registry.bin'),
    },
  });
  return child as NativeSidecarProcess;
}

/** 管理唯一的 GStreamer sidecar，并把 JSON Lines 响应关联回受控请求。 */
export class NativeSidecarManager {
  private readonly spawnProcess: () => NativeSidecarProcess;
  private readonly onStatus: (status: NativeCaptureStatus) => void;
  private child: NativeSidecarProcess | null = null;
  private stdoutBuffer = '';
  private pending = new Map<string, PendingRequest>();
  private restartCount = 0;
  private shuttingDown = false;

  constructor(dependencies: NativeSidecarManagerDependencies = {}) {
    this.spawnProcess = dependencies.spawnProcess ?? spawnDefaultProcess;
    this.onStatus = dependencies.onStatus ?? (() => undefined);
  }

  ensureStarted(): void {
    if (this.child) return;
    this.shuttingDown = false;
    this.spawnChild();
  }

  private spawnChild(): void {
    try {
      const child = this.spawnProcess();
      this.child = child;
      this.stdoutBuffer = '';
      child.stdout.on('data', (chunk: Buffer | string) => this.consumeStdout(chunk.toString()));
      child.stderr.on('data', (chunk: Buffer | string) => {
        console.warn(`[GStreamer] ${chunk.toString().trim()}`);
      });
      child.on('error', (error: Error) => this.handleProcessFailure(error));
      child.on('exit', (code: number | null) => this.handleExit(code));
      this.onStatus({ phase: 'idle', verified: false });
    } catch (error) {
      this.handleProcessFailure(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let newline = this.stdoutBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) {
        try {
          this.handleMessage(parseSidecarMessage(line));
        } catch (error) {
          this.onStatus({
            phase: 'error',
            verified: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      newline = this.stdoutBuffer.indexOf('\n');
    }
  }

  private handleMessage(message: SidecarMessage): void {
    if (message.type === 'status') {
      this.onStatus({
        phase: message.phase,
        requestedModeId: message.requestedModeId,
        negotiated: message.negotiated,
        measuredFps: message.measuredFps,
        previewCodec: message.previewCodec,
        verified: message.verified,
        signallingUrl: message.signallingUrl,
        producerId: message.producerId,
        error: message.error,
      });
      return;
    }

    const requestId = 'requestId' in message ? message.requestId : undefined;
    if (!requestId) return;
    const pending = this.pending.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(requestId);

    if (message.type === 'error') {
      pending.reject(new Error(message.message));
    } else if (message.type === 'devices') {
      pending.resolve(message.devices);
    } else if (message.type === 'snapshot') {
      pending.resolve(message.snapshot);
    } else {
      pending.resolve(undefined);
    }
  }

  private handleProcessFailure(error: Error): void {
    this.rejectAll(error);
    this.onStatus({ phase: 'error', verified: false, error: error.message });
  }

  private handleExit(code: number | null): void {
    this.child = null;
    this.rejectAll(new Error(`GStreamer sidecar 已退出（${code ?? 'unknown'}）`));
    if (this.shuttingDown) return;
    if (this.restartCount < MAX_RESTARTS) {
      this.restartCount += 1;
      this.spawnChild();
      return;
    }
    this.onStatus({ phase: 'error', verified: false, error: 'GStreamer sidecar 连续退出' });
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request<T>(command: SidecarCommandWithoutRequestId): Promise<T> {
    this.ensureStarted();
    if (!this.child) return Promise.reject(new Error('GStreamer sidecar 未启动'));
    const requestId = randomUUID();
    const fullCommand = { ...command, requestId } as SidecarCommand;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`GStreamer sidecar 请求超时：${command.type}`));
      }, REQUEST_TIMEOUT_MS[command.type]);
      this.pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      this.child?.stdin.write(encodeSidecarCommand(fullCommand));
    });
  }

  enumerateDevices(): Promise<NativeCaptureDevice[]> {
    return this.request<NativeCaptureDevice[]>({ type: 'enumerate' });
  }

  start(selection: NativeCaptureSelection): Promise<void> {
    return this.request<void>({ type: 'start', selection });
  }

  stop(): Promise<void> {
    return this.request<void>({ type: 'stop' });
  }

  snapshot(): Promise<NativeCaptureSnapshot> {
    return this.request<NativeCaptureSnapshot>({ type: 'snapshot' });
  }

  shutdown(): void {
    if (!this.child) return;
    this.shuttingDown = true;
    const requestId = randomUUID();
    this.child.stdin.write(encodeSidecarCommand({ type: 'shutdown', requestId }));
    this.child.kill();
  }
}
