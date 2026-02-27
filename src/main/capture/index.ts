import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { Device } from '@shared/types';

// 设置捕获相关的 IPC 处理器
export function setupCaptureHandlers(ipcMain: IpcMain) {
  // 枚举设备
  ipcMain.handle(IPC_CHANNELS.DEVICE_ENUM, async (): Promise<Device[]> => {
    return enumerateDevices();
  });

  // 选择设备
  ipcMain.handle(IPC_CHANNELS.DEVICE_SELECT, async (_event, deviceId: string) => {
    return selectDevice(deviceId);
  });

  // 开始捕获
  ipcMain.handle(IPC_CHANNELS.CAPTURE_START, async () => {
    return startCapture();
  });

  // 停止捕获
  ipcMain.handle(IPC_CHANNELS.CAPTURE_STOP, async () => {
    return stopCapture();
  });
}

// 枚举视频采集设备
async function enumerateDevices(): Promise<Device[]> {
  // TODO: 实现实际的设备枚举逻辑
  // 使用 navigator.mediaDevices.enumerateDevices() 或 desktopCapturer
  
  return [
    {
      id: 'screen:0',
      name: 'Screen 1',
      type: 'screen',
      isConnected: true,
    },
  ];
}

// 选择设备
async function selectDevice(deviceId: string): Promise<void> {
  // TODO: 实现设备选择逻辑
  console.log('Selected device:', deviceId);
}

// 开始捕获
async function startCapture(): Promise<void> {
  // TODO: 实现捕获启动逻辑
  console.log('Capture started');
}

// 停止捕获
async function stopCapture(): Promise<void> {
  // TODO: 实现捕获停止逻辑
  console.log('Capture stopped');
}
