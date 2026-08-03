/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, nativeImage } from 'electron';
import path from 'path';
import { IPC_CHANNELS, SHORTCUTS } from '@shared/constants';
import { setupCaptureHandlers } from './capture';
import { setupAIHandlers } from './ai';
import { setupTray } from './tray/trayManager';
import { setupConfigHandlers } from './config/store';

// 确保 sharp 的 DLL 可以被找到
const appDir = path.dirname(app.getPath('exe'));
const dllPaths = [
  appDir, // 应用根目录
  path.join(appDir, 'resources', 'app.asar.unpacked', 'node_modules', '@img', 'sharp-win32-x64', 'lib'),
];

// 将 DLL 目录添加到 PATH
if (process.platform === 'win32') {
  const currentPath = process.env.PATH || '';
  const newPaths = dllPaths.filter(p => !currentPath.includes(p)).join(';');
  if (newPaths) {
    process.env.PATH = newPaths + ';' + currentPath;
  }
}

// 主窗口引用
let mainWindow: BrowserWindow | null = null;

// 创建主窗口
function createWindow() {
  // 获取 preload 脚本的路径
  // 在 Vite 构建后，preload.js 和 main.js 在同一目录
  const preloadPath = path.join(__dirname, 'preload.js');
  
  console.log('=== Electron Main Process ===');
  console.log('__dirname:', __dirname);
  console.log('preload path:', preloadPath);
  console.log('dev server url:', typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' ? MAIN_WINDOW_VITE_DEV_SERVER_URL : '');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // 默认保持真实应用视口；需要调试时显式设置环境变量再打开 DevTools。
    if (process.env.SCREENCODE_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'right' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[mainWindow] did-fail-load:', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[mainWindow] render-process-gone:', details);
  });

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 注册全局热键
function registerShortcuts() {
  // 截图快捷键
  globalShortcut.register(SHORTCUTS.SCREENSHOT, () => {
    mainWindow?.webContents.send(IPC_CHANNELS.CAPTURE_FRAME);
  });

  // 代码提取快捷键
  // 注意：AI_EXTRACT 是 renderer → main 的 invoke 通道，不能复用为事件推送，
  // 否则渲染进程无人接收。此处走独立的 AI_EXTRACT_TRIGGER 事件通道。
  globalShortcut.register(SHORTCUTS.EXTRACT_CODE, () => {
    mainWindow?.webContents.send(IPC_CHANNELS.AI_EXTRACT_TRIGGER);
  });

  // 打开主窗口快捷键
  globalShortcut.register(SHORTCUTS.OPEN_MAIN_WINDOW, () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  // 创建窗口
  createWindow();

  // 注册热键
  registerShortcuts();

  // 设置 IPC 处理器
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_IMAGE, (_event, base64Data: string) => {
    const image = nativeImage.createFromDataURL(`data:image/jpeg;base64,${base64Data}`);
    clipboard.writeImage(image);
  });

  setupCaptureHandlers(ipcMain);
  setupAIHandlers(ipcMain);
  setupConfigHandlers(ipcMain);

  // 设置系统托盘
  setupTray(mainWindow);

  // macOS 激活应用时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前注销所有热键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 导出主窗口引用供其他模块使用
export function getMainWindow() {
  return mainWindow;
}
