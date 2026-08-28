import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { updateTrayIcon } from '../tray/trayManager';
import type { HighQualityCaptureRequest, ProcessCapturedImageRequest } from '@shared/types';
import { captureYuy2Frame } from './ffmpegCapture';
import { processCapturedImage } from '../processor/captureImageProcessor';

/**
 * 采集状态同步。
 *
 * 实际的设备枚举与视频流获取由渲染进程通过 navigator.mediaDevices 完成
 * （主进程无法访问 WebRTC API），此处只负责把采集状态反映到系统托盘。
 */
export function setupCaptureHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC_CHANNELS.CAPTURE_START, async () => {
    console.log('[Capture] 采集已启动');
    updateTrayIcon('connected');
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_STOP, async () => {
    console.log('[Capture] 采集已停止');
    updateTrayIcon('disconnected');
  });

  ipcMain.handle(
    IPC_CHANNELS.CAPTURE_HIGH_QUALITY_FRAME,
    async (_event, request: HighQualityCaptureRequest) => captureYuy2Frame(request),
  );

  ipcMain.handle(
    IPC_CHANNELS.CAPTURE_PROCESS_IMAGE,
    async (_event, request: ProcessCapturedImageRequest) => processCapturedImage(request),
  );
}
