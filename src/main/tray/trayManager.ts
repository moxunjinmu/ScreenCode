import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;

/**
 * 设置系统托盘
 */
export function setupTray(mainWindow: BrowserWindow | null) {
  // 创建托盘图标
  const iconPath = path.join(__dirname, '../../build/icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  // 如果图标不存在，创建一个空图标
  const trayIcon = icon.isEmpty() ? nativeImage.createEmpty() : icon;

  tray = new Tray(trayIcon);

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '设置',
      click: () => {
        // TODO: 打开设置窗口
      },
    },
    {
      type: 'separator',
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('ScreenCode');
  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示主窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * 更新托盘图标状态
 */
export function updateTrayIcon(status: 'connected' | 'disconnected' | 'processing') {
  if (!tray) return;

  // TODO: 根据状态更新托盘图标
  // 绿色 = 有信号
  // 红色 = 无信号
  // 黄色 = 处理中
  
  const statusText = {
    connected: '已连接',
    disconnected: '未连接',
    processing: '处理中...',
  };

  tray.setToolTip(`ScreenCode - ${statusText[status]}`);
}

/**
 * 显示托盘通知
 */
export function showTrayNotification(title: string, message: string) {
  if (!tray) return;

  tray.displayBalloon({
    title,
    content: message,
    iconType: 'info',
  });
}
