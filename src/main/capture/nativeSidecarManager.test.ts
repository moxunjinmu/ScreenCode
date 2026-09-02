import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { NativeSidecarManager, type NativeSidecarProcess } from './nativeSidecarManager';

function readCommand(child: NativeSidecarProcess): { requestId: string; type: string } {
  const written = (child.stdin as PassThrough).read()?.toString() ?? '';
  return JSON.parse(written.trim()) as { requestId: string; type: string };
}

function createFakeProcess(): NativeSidecarProcess {
  const process = new EventEmitter() as NativeSidecarProcess;
  process.stdin = new PassThrough();
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.kill = vi.fn(() => true);
  process.pid = 42;
  return process;
}

describe('原生采集 sidecar 生命周期', () => {
  it('枚举请求只返回 sidecar 实际上报的设备', async () => {
    const child = createFakeProcess();
    const manager = new NativeSidecarManager({ spawnProcess: () => child });
    const pending = manager.enumerateDevices();
    const { requestId } = readCommand(child);
    (child.stdout as PassThrough).write(`${JSON.stringify({ type: 'devices', requestId, devices: [] })}\n`);
    await expect(pending).resolves.toEqual([]);
  });

  it('关联启动、截图、停止三类成功响应，并转发实际状态', async () => {
    const child = createFakeProcess();
    const statuses: Array<{ phase: string; measuredFps?: number }> = [];
    const manager = new NativeSidecarManager({
      spawnProcess: () => child,
      onStatus: (status) => statuses.push(status),
    });
    const selection = {
      deviceId: 'mf:usb3-video',
      formatId: 'YUY2',
      modeId: 'YUY2:2560x1440:50/1',
    };

    const startPending = manager.start(selection);
    const startCommand = readCommand(child);
    (child.stdout as PassThrough).write(`${JSON.stringify({
      type: 'status',
      phase: 'streaming',
      measuredFps: 49.8,
      verified: true,
    })}\n${JSON.stringify({ type: 'ok', requestId: startCommand.requestId })}\n`);
    await expect(startPending).resolves.toBeUndefined();
    expect(statuses.at(-1)).toMatchObject({ phase: 'streaming', measuredFps: 49.8 });

    const snapshotPending = manager.snapshot();
    const snapshotCommand = readCommand(child);
    const snapshot = {
      data: 'iVBORw0KGgo=',
      mimeType: 'image/png' as const,
      width: 2560,
      height: 1440,
      sourceFormat: 'YUY2',
    };
    (child.stdout as PassThrough).write(`${JSON.stringify({
      type: 'snapshot', requestId: snapshotCommand.requestId, snapshot,
    })}\n`);
    await expect(snapshotPending).resolves.toEqual(snapshot);

    const stopPending = manager.stop();
    const stopCommand = readCommand(child);
    (child.stdout as PassThrough).write(`${JSON.stringify({
      type: 'ok', requestId: stopCommand.requestId,
    })}\n`);
    await expect(stopPending).resolves.toBeUndefined();
  });

  it('sidecar 明确错误时拒绝对应请求，畸形 JSON 转为错误状态', async () => {
    const child = createFakeProcess();
    const statuses: Array<{ phase: string; error?: string }> = [];
    const manager = new NativeSidecarManager({
      spawnProcess: () => child,
      onStatus: (status) => statuses.push(status),
    });
    const pending = manager.enumerateDevices();
    const command = readCommand(child);
    (child.stdout as PassThrough).write('{not-json\n');
    expect(statuses.at(-1)).toMatchObject({ phase: 'error', error: 'sidecar 消息不是有效 JSON' });
    (child.stdout as PassThrough).write(`${JSON.stringify({
      type: 'error', requestId: command.requestId, message: '设备已被占用',
    })}\n`);
    await expect(pending).rejects.toThrow('设备已被占用');
  });

  it('忽略依赖写入 stdout 的普通日志，不把它误报为协议错误', () => {
    const child = createFakeProcess();
    const statuses: Array<{ phase: string; error?: string }> = [];
    const manager = new NativeSidecarManager({
      spawnProcess: () => child,
      onStatus: (status) => statuses.push(status),
    });
    manager.ensureStarted();
    (child.stdout as PassThrough).write(
      '2026-09-02T02:36:15Z INFO gst_plugin_webrtc_signalling producer registered\n',
    );

    expect(statuses).not.toContainEqual(expect.objectContaining({ phase: 'error' }));
  });

  it('进程错误会拒绝所有等待请求并上报错误', async () => {
    const child = createFakeProcess();
    const statuses: Array<{ phase: string; error?: string }> = [];
    const manager = new NativeSidecarManager({
      spawnProcess: () => child,
      onStatus: (status) => statuses.push(status),
    });
    const pending = manager.enumerateDevices();
    readCommand(child);
    child.emit('error', new Error('runtime missing'));
    await expect(pending).rejects.toThrow('runtime missing');
    expect(statuses.at(-1)).toMatchObject({ phase: 'error', error: 'runtime missing' });
  });

  it('同步启动失败也会形成明确错误状态', () => {
    const statuses: Array<{ phase: string; error?: string }> = [];
    const manager = new NativeSidecarManager({
      spawnProcess: () => { throw new Error('spawn failed'); },
      onStatus: (status) => statuses.push(status),
    });
    manager.ensureStarted();
    expect(statuses.at(-1)).toMatchObject({ phase: 'error', error: 'spawn failed' });
  });

  it('异常退出最多重启一次，第二次退出进入错误状态', () => {
    const first = createFakeProcess();
    const second = createFakeProcess();
    const spawnProcess = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const statuses: string[] = [];
    const manager = new NativeSidecarManager({
      spawnProcess,
      onStatus: (status) => statuses.push(status.phase),
    });

    manager.ensureStarted();
    first.emit('exit', 1, null);
    expect(spawnProcess).toHaveBeenCalledTimes(2);
    second.emit('exit', 1, null);
    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('error');
  });

  it('关闭时发送 shutdown 并终止进程，不触发自动重启', async () => {
    const child = createFakeProcess();
    const spawnProcess = vi.fn(() => child);
    const manager = new NativeSidecarManager({ spawnProcess });
    manager.ensureStarted();
    manager.shutdown();
    const command = (child.stdin as PassThrough).read()?.toString() ?? '';
    expect(command).toContain('"type":"shutdown"');
    expect(child.kill).toHaveBeenCalledOnce();
    child.emit('exit', 0, null);
    expect(spawnProcess).toHaveBeenCalledOnce();
  });
});
