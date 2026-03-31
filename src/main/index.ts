import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { IPC_CHANNELS, SHORTCUTS } from '@shared/constants';
import { setupCaptureHandlers } from './capture';
import { setupFrameHandlers } from './processor';
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
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  });

  // 开发模式加载开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // 打开开发者工具
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/main_window/index.html'));
  }

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
  globalShortcut.register(SHORTCUTS.EXTRACT_CODE, () => {
    mainWindow?.webContents.send(IPC_CHANNELS.AI_EXTRACT);
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
  setupCaptureHandlers(ipcMain);
  setupFrameHandlers(ipcMain);
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
