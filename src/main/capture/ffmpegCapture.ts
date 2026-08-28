import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { HighQualityCaptureRequest, HighQualityCaptureResult } from '@shared/types';

const CAPTURE_TIMEOUT_MS = 8_000;
const MAX_STDOUT_BYTES = 20 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ProcessExecutionResult {
  exitCode: number;
  stdout: Buffer;
  stderr: string;
}

export type ExecuteProcess = (
  executable: string,
  args: string[],
) => Promise<ProcessExecutionResult>;

export interface FfmpegCaptureDependencies {
  resolveFfmpegPath: (explicitPath?: string) => Promise<string>;
  listVideoDevices: (ffmpegPath: string) => Promise<string[]>;
  execute: ExecuteProcess;
}

export function normalizeDshowDeviceName(label: string): string {
  return label.replace(/\s+\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, '').trim();
}

export function validateDshowDeviceName(deviceName: string): string {
  const normalized = normalizeDshowDeviceName(deviceName);
  const hasControlCharacter = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!normalized || normalized.length > 128 || hasControlCharacter) {
    throw new Error('采集设备名为空、过长或包含控制字符');
  }
  return normalized;
}

/** 构造固定的 DirectShow YUY2 单帧 PNG 参数；不接受调用方追加任意 FFmpeg 参数。 */
export function buildYuy2CaptureArgs(deviceName: string): string[] {
  const safeDeviceName = validateDshowDeviceName(deviceName);
  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'dshow',
    '-rtbufsize', '512M',
    '-video_size', '1920x1080',
    '-framerate', '5',
    '-pixel_format', 'yuyv422',
    '-i', `video=${safeDeviceName}`,
    '-frames:v', '1',
    '-an',
    '-c:v', 'png',
    '-f', 'image2pipe',
    'pipe:1',
  ];
}

function isPng(buffer: Buffer): boolean {
  return buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

async function resolveFfmpegPath(explicitPath?: string): Promise<string> {
  const candidates = [
    explicitPath?.trim(),
    ...(process.env.PATH || '').split(path.delimiter).map((entry) => path.join(entry, 'ffmpeg.exe')),
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe')
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const resolved = candidates.find((candidate) =>
    path.basename(candidate).toLowerCase() === 'ffmpeg.exe' && fs.existsSync(candidate),
  );
  if (!resolved) {
    throw new Error('未找到 FFmpeg，请在设置中配置 ffmpeg.exe 路径');
  }
  return resolved;
}

/** 使用 spawn + shell:false 执行受控 FFmpeg，并限制执行时间与内存输出。 */
async function executeProcess(executable: string, args: string[]): Promise<ProcessExecutionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finishWithError = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(error);
    };
    const timer = setTimeout(() => {
      finishWithError(new Error(`FFmpeg 截图超时（${CAPTURE_TIMEOUT_MS}ms）`));
    }, CAPTURE_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        finishWithError(new Error('FFmpeg 图片输出过大'));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderrBytes >= MAX_STDERR_BYTES) return;
      const remaining = MAX_STDERR_BYTES - stderrBytes;
      const bounded = chunk.subarray(0, remaining);
      stderrBytes += bounded.length;
      stderrChunks.push(bounded);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      finishWithError(new Error(`FFmpeg 启动失败：${error.message}`));
    });
    child.once('close', (exitCode) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve({
        exitCode: exitCode ?? -1,
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks).toString('utf8').trim(),
      });
    });
  });
}

async function listVideoDevices(ffmpegPath: string): Promise<string[]> {
  const result = await executeProcess(ffmpegPath, [
    '-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy',
  ]);
  const output = `${result.stderr}\n${result.stdout.toString('utf8')}`;
  const devices = [...output.matchAll(/\]\s+"([^"]+)"\s+\(video\)/g)].map((match) => match[1]);
  return [...new Set(devices)];
}

const defaultDependencies: FfmpegCaptureDependencies = {
  resolveFfmpegPath,
  listVideoDevices,
  execute: executeProcess,
};

/** 枚举并白名单确认设备后，通过 FFmpeg 抓取一张无损 YUY2 来源 PNG。 */
export async function captureYuy2Frame(
  request: HighQualityCaptureRequest,
  dependencies: FfmpegCaptureDependencies = defaultDependencies,
): Promise<HighQualityCaptureResult> {
  const deviceName = validateDshowDeviceName(request.deviceName);
  const ffmpegPath = await dependencies.resolveFfmpegPath(request.ffmpegPath);
  const devices = await dependencies.listVideoDevices(ffmpegPath);
  const matchedDevice = devices.find((candidate) =>
    candidate.localeCompare(deviceName, undefined, { sensitivity: 'accent' }) === 0,
  );
  if (!matchedDevice) {
    throw new Error(`FFmpeg 未找到采集设备：${deviceName}`);
  }

  const result = await dependencies.execute(ffmpegPath, buildYuy2CaptureArgs(matchedDevice));
  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg YUY2 截图失败：${result.stderr || `退出码 ${result.exitCode}`}`);
  }
  if (result.stdout.length > MAX_STDOUT_BYTES) {
    throw new Error('FFmpeg 图片输出过大');
  }
  if (!isPng(result.stdout)) {
    throw new Error('FFmpeg 未返回有效 PNG 图片');
  }

  return {
    data: result.stdout.toString('base64'),
    mimeType: 'image/png',
    width: 1920,
    height: 1080,
  };
}
