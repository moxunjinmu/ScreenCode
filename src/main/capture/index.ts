import { app, BrowserWindow, IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { updateTrayIcon } from '../tray/trayManager';
import type {
  NativeCaptureSelection,
  NativeCaptureStatus,
  ProcessCapturedImageRequest,
} from '@shared/types';
import { processCapturedImage } from '../processor/captureImageProcessor';
import { NativeSidecarManager } from './nativeSidecarManager';

let nativeManager: NativeSidecarManager | null = null;

function broadcastNativeStatus(status: NativeCaptureStatus) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(IPC_CHANNELS.CAPTURE_NATIVE_STATUS, status);
  });
}

/**
 * 采集状态同步。
 *
 * 实际的设备枚举与视频流获取由渲染进程通过 navigator.mediaDevices 完成
 * （主进程无法访问 WebRTC API），此处只负责把采集状态反映到系统托盘。
 */
export function setupCaptureHandlers(ipcMain: IpcMain) {
  nativeManager = new NativeSidecarManager({ onStatus: broadcastNativeStatus });
  app.once('before-quit', () => nativeManager?.shutdown());
  ipcMain.handle(IPC_CHANNELS.CAPTURE_START, async () => {
    console.log('[Capture] 采集已启动');
    updateTrayIcon('connected');
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_STOP, async () => {
    console.log('[Capture] 采集已停止');
    updateTrayIcon('disconnected');
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_NATIVE_ENUMERATE, async () =>
    nativeManager?.enumerateDevices() ?? []);

  ipcMain.handle(
    IPC_CHANNELS.CAPTURE_NATIVE_START,
    async (_event, selection: NativeCaptureSelection) => {
      if (!nativeManager) throw new Error('GStreamer sidecar 管理器未初始化');
      await nativeManager.start(selection);
    },
  );

  ipcMain.handle(IPC_CHANNELS.CAPTURE_NATIVE_STOP, async () => {
    await nativeManager?.stop();
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_NATIVE_SNAPSHOT, async () => {
    if (!nativeManager) throw new Error('GStreamer sidecar 管理器未初始化');
    return nativeManager.snapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.CAPTURE_PROCESS_IMAGE,
    async (_event, request: ProcessCapturedImageRequest) => processCapturedImage(request),
  );
}
