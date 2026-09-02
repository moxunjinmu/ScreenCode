// IPC 通道定义
// 说明：设备枚举由渲染进程直接通过 navigator.mediaDevices 完成，不走 IPC；
// 帧队列的唯一真源是渲染进程的 frameStore，主进程不再镜像一份。
export const IPC_CHANNELS = {
  // 捕获相关
  CAPTURE_START: 'capture:start',           // renderer → main (invoke)，同步采集状态到托盘
  CAPTURE_STOP: 'capture:stop',             // renderer → main (invoke)
  CAPTURE_FRAME: 'capture:frame',           // main → renderer (event)，全局热键触发截图
  CAPTURE_PROCESS_IMAGE: 'capture:process-image', // renderer → main (invoke)，源像素裁剪与画质编码
  CAPTURE_NATIVE_ENUMERATE: 'capture:native-enumerate',
  CAPTURE_NATIVE_START: 'capture:native-start',
  CAPTURE_NATIVE_STOP: 'capture:native-stop',
  CAPTURE_NATIVE_SNAPSHOT: 'capture:native-snapshot',
  CAPTURE_NATIVE_STATUS: 'capture:native-status',

  // AI 相关
  AI_EXTRACT: 'ai:extract',                 // renderer → main (invoke)
  AI_EXTRACT_TRIGGER: 'ai:extract:trigger', // main → renderer (event)，全局热键触发提取
  AI_RESULT: 'ai:result',                   // main → renderer (event)
  AI_ERROR: 'ai:error',                     // main → renderer (event)
  AI_CHAT: 'ai:chat',                       // renderer → main (invoke)

  // 剪贴板相关
  CLIPBOARD_WRITE_IMAGE: 'clipboard:write-image',

  // 配置相关
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_CHANGED: 'config:changed',         // main → renderer (event)
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

// AI 请求超时（ms）— 传给 SDK，避免使用其默认的 10 分钟超时
export const AI_TIMEOUT = 25_000;

// Toast 通知展示时长（ms）
export const TOAST_DURATION = {
  SUCCESS: 1500,
  ERROR: 2500,
} as const;

// 单条聊天消息可携带的最大图片数
export const MAX_CHAT_IMAGES = 4;
