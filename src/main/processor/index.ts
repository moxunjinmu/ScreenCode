import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { Frame } from '@shared/types';
import { RingBuffer } from './ringBuffer';
import { FrameDiff } from './frameDiff';
import { ImageCompressor } from './imageCompressor';

// 帧缓冲区
const frameBuffer = new RingBuffer(8);
const frameDiff = new FrameDiff();
const imageCompressor = new ImageCompressor();

// 设置帧处理相关的 IPC 处理器
export function setupFrameHandlers(ipcMain: IpcMain) {
  // 添加帧
  ipcMain.handle(IPC_CHANNELS.FRAME_ADD, async (_event, frame: Frame) => {
    return addFrame(frame);
  });

  // 获取所有帧
  ipcMain.handle(IPC_CHANNELS.FRAME_UPDATE, async (): Promise<Frame[]> => {
    return getFrames();
  });

  // 清空帧
  ipcMain.handle(IPC_CHANNELS.FRAME_CLEAR, async () => {
    return clearFrames();
  });
}

// 添加帧到缓冲区
async function addFrame(frame: Frame): Promise<void> {
  // TODO: 实现帧差分检测
  // TODO: 实现图像压缩
  frameBuffer.push(frame);
}

// 获取所有帧
function getFrames(): Frame[] {
  return frameBuffer.getAll();
}

// 清空帧缓冲区
function clearFrames(): void {
  frameBuffer.clear();
}

export { frameBuffer, frameDiff, imageCompressor };
