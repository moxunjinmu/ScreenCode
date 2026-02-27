// IPC 通道定义
export const IPC_CHANNELS = {
  // 捕获相关
  CAPTURE_START: 'capture:start',
  CAPTURE_STOP: 'capture:stop',
  CAPTURE_FRAME: 'capture:frame',
  CAPTURE_ERROR: 'capture:error',

  // 帧队列相关
  FRAME_ADD: 'frame:add',
  FRAME_CLEAR: 'frame:clear',
  FRAME_UPDATE: 'frame:update',

  // AI 相关
  AI_EXTRACT: 'ai:extract',
  AI_RESULT: 'ai:result',
  AI_ERROR: 'ai:error',
  AI_CHAT: 'ai:chat',
  AI_CHAT_RESPONSE: 'ai:chat:response',
  AI_CHAT_STREAM: 'ai:chat:stream',

  // 设备相关
  DEVICE_ENUM: 'device:enum',
  DEVICE_SELECT: 'device:select',
  DEVICE_STATUS: 'device:status',

  // 托盘相关
  TRAY_SHOW_WINDOW: 'tray:show-window',
  TRAY_UPDATE: 'tray:update',

  // 配置相关
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
} as const;

// 全局热键
export const SHORTCUTS = {
  SCREENSHOT: 'CommandOrControl+Shift+S',
  EXTRACT_CODE: 'CommandOrControl+Shift+E',
  OPEN_MAIN_WINDOW: 'CommandOrControl+Shift+M',
} as const;

// 性能目标
export const PERFORMANCE_TARGETS = {
  HOTKEY_TO_TOAST_MS: 200,
  CODE_EXTRACTION_MS: 20000,  // 20s
  AI_CHAT_MS: 8000,
} as const;

// 图像处理
export const IMAGE_PROCESSING = {
  TARGET_WIDTH: 768,
  QUALITY: 85,
  DIFF_THRESHOLD: 0.05,  // 5%
} as const;

// 帧队列
export const FRAME_QUEUE = {
  MAX_FRAMES: 8,
} as const;
