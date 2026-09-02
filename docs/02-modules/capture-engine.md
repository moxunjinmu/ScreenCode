# 采集引擎与帧处理

> 最后更新: 2026-09-02
> 目录: `src/main/capture/`, `src/main/processor/`

## 采集模块 (`src/main/capture/`)

### 设备与能力枚举

- “浏览器自动”继续使用 `navigator.mediaDevices.enumerateDevices()`；屏幕/窗口采集保留原路径
- Windows x64 的“GStreamer 精确格式”由 Rust sidecar 使用 `GstDeviceMonitor` 枚举
  Media Foundation 设备及离散 Caps
- 原生下拉框按“后端 → 格式 → 分辨率 → 帧率”联动，只允许提交本次枚举返回的设备、格式和模式 ID
- 默认从 YUY2 候选中验证不低于 30 FPS 的高质量档；短时实测达到目标帧率 95% 才标记“已验证”
- 没有 YUY2 或原生运行时不可用时保留浏览器自动模式，精确格式启动失败不会静默更换格式

### 视频流管理

- `startCapture()`: 根据设备类型获取 MediaStream
  - `videoinput` → `getUserMedia({ video: { deviceId } })` 打开指定设备一次
  - 通过 `getCapabilities()` 获取能力范围，并根据设置中的画质策略生成候选模式
  - 默认“画质优先”：分辨率优先，同分辨率优先尝试 `30/29.97/25/24 FPS`，避免选择只有标称值、
    实际仍约 30 帧的 `60 FPS` 档位；“流畅优先”仍按帧率降序
  - 通过 `applyConstraints()` 逐档应用严格宽、高、帧率约束；支持时使用 `resizeMode: none`
  - 通过 `getSettings()` 记录实际生效参数，严格模式均失败时保留理想值或浏览器默认流
  - `screen` → desktopCapturer（待实现）
- `gstreamer-mf` → `mfvideosrc + capsfilter + tee`
  - 原始分支：`appsink max-buffers=1 drop=true`，仅在 sidecar 内保存最新原始帧
  - 预览分支：转为 NV12，优先经 `mfh264enc low-latency=true` 编码后交给 `webrtcsink`；
    Media Foundation H.264 不可用时使用 VP8，截图原始格式不变
  - Renderer 使用官方 `gstwebrtc-api` 3.0.0 客户端连接 `127.0.0.1` 随机信令端口
  - IPC 只承载控制、状态及按需 PNG；连续原始帧不经过 Electron IPC
- `stopCapture()`: 停止所有 track，通知主进程
- `captureFrame()`: 原生模式请求最新原始帧 PNG；浏览器自动模式直接截取当前 `<video>` 固有尺寸

### 最高质量模式协商 (`src/renderer/capture/highQualityCapture.ts`)

浏览器不会公开 UVC 采集卡完整的离散输出模式表，因此协商器将设备能力上限与常见标准档位组合，
通过严格约束逐档验证。默认排序策略为像素总数降序，同分辨率下优先稳定的 30 FPS 档；设置页可以
切换到帧率降序的“流畅优先”。

协商过程中始终复用同一条视频轨道，避免重复释放和重开采集卡。`OverconstrainedError` 表示当前档位
不受支持，可继续尝试下一档；权限拒绝、设备占用等错误不会被吞掉或重复请求。预览工具栏显示视频源
固有宽高、`getSettings().frameRate` 和 `requestVideoFrameCallback` 测得的有效帧率，显示尺寸与 CSS
缩放不改变实际采集质量。

能力边界：Chromium WebRTC 不能选择 UVC 的 MJPEG/YUY2/NV12 等像素格式，也不能保证能力范围的宽、
高、帧率上限属于同一个离散模式。因此精确格式改由 GStreamer/Media Foundation 协商；浏览器自动模式
仍用于通用兼容和非 Windows 平台。

### 原生格式高保真截图

`captureNativeSnapshot()` 从原始分支当前 `appsink` sample 建立一次性内存管线，经 `videoconvert + pngenc`
生成全尺寸 PNG。截图不停止采集管线、不切换分辨率，也不改变预览编码。JSON Lines 控制消息限制为
64 KiB，单次 PNG 响应沿用 20 MiB 上限；sidecar 只接受枚举结果中的模式 ID，不接受 Renderer 传入
任意 GStreamer 管线文本。

活动路径不再调用 FFmpeg DirectShow 截图。旧 `ffmpegPath` 配置仅保留兼容读取，设置页已隐藏。

### YUY2 区域截图与坐标协议

区域截图不从压缩后的 WebRTC `<video>` 重新编码。用户进入区域模式时，应用先冻结当前原生全尺寸
PNG，再用冻结图作为选区背景，确保用户框选的内容与最终裁剪来自同一时刻。YUY2、NV12、RGB/BGR
均沿用当前实际采集格式，并在截图结果中记录 `sourceFormat`。

选区状态只保存源图整数像素 `{ left, top, width, height }`。渲染层根据 `object-fit: contain` 的实际
内容区域换算显示坐标，扣除上下或左右留白；左上坐标向下取整、右下坐标向上取整并收敛到图像边界。
窗口和全屏尺寸变化时，只重新计算显示矩形，不修改源像素协议，也不重复乘 Windows DPR。

主进程 `captureImageProcessor` 对 IPC 输入执行 MIME、严格 base64、20MB、4000 万像素和整数边界
校验，再使用 Sharp 完成裁剪与画质编码。默认原图档对 YUY2 来源 PNG 做无损 PNG 裁剪；其他档位
统一输出 JPEG 4:4:4。相同 `qualityProfile` 的图片进入 AI 路径时不会重复编码。

## 帧处理流水线

```
Media Foundation 精确原始帧 ─┬─ WebRTC/H.264（或 VP8）预览
                              └─ 最新原始帧 → PNG 冻结 ─┬─ 整帧
                                                        └─ 源像素区域裁剪
                                                               ↓
                                                     四档画质输出
                                                               ↓
                                               RingBuffer / 剪贴板 / AI API
```

### 环形缓冲区 (`src/main/processor/ringBuffer.ts`)

泛型环形缓冲区，存储 `Frame` 对象。

| 方法 | 说明 |
|------|------|
| `push(frame)` | 入队，满时覆盖最旧帧 |
| `getAll()` | 按时序返回所有帧 |
| `clear()` | 清空 |
| `isFull()` / `isEmpty()` | 状态查询 |
| `getCount()` | 当前帧数 |

约束: 最大容量 8 帧（`FRAME_QUEUE.MAX_FRAMES`）

### 帧差分 (`src/main/processor/frameDiff.ts`)

对比相邻帧的像素差异，自动分类：

| 差异率 | 分类 | 处理 |
|--------|------|------|
| < 5% | `static` | 丢弃（重复帧） |
| 5% - 60% | `continuation` | 保留（滚动帧） |
| > 60% | `new_scene` | 保留（场景切换） |

当前状态: `compare()` 为简化实现（固定返回 0.3），待实现像素级对比。

### 图像压缩 (`src/main/processor/imageCompressor.ts`)

基于 Sharp Native 模块处理截图和发送给 AI 的图片。截图、帧队列、剪贴板和 AI 请求使用同一画质
档位，默认是当前原生采集格式生成的全尺寸无损 PNG；浏览器自动模式则使用当前预览帧。

| 档位 | 最大宽度 | JPEG 质量 | 默认 |
|------|----------|-----------|------|
| 节省 | 768px | 85，4:4:4 | 否 |
| 平衡 | 1280px | 90，4:4:4 | 否 |
| 高画质 | 1920px | 95，4:4:4 | 否 |
| 原图无损 | 不缩放、不重编码 | 保留输入 MIME | 是 |

缩放统一使用 `lanczos3` 且不放大小图。选择“原图无损”时整帧保持原始 MIME，区域图按源像素裁剪并
保持 PNG；其他档位转换为 JPEG。每张图片记录已应用档位，AI 仅在档位变化时继续处理。

| 方法 | 说明 |
|------|------|
| `compress(input: Buffer)` | 压缩图像 |
| `toBase64(buffer)` | Buffer → base64 |
| `fromBase64(base64)` | base64 → Buffer |
| `getInfo(buffer)` | 获取图像元数据 |

## 待完成

- [ ] `frameDiff.compare()` 实现像素级对比算法（Sharp 采样对比）
- [ ] `frameDiff.calculateOverlap()` 实现重叠区域计算
- [ ] 屏幕录制设备（desktopCapturer）支持
