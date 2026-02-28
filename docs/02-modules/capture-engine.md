# 采集引擎与帧处理

> 最后更新: 2026-02-28
> 目录: `src/main/capture/`, `src/main/processor/`

## 采集模块 (`src/main/capture/`)

### 设备枚举

- 使用 `navigator.mediaDevices.enumerateDevices()` 枚举视频输入设备
- 额外添加"屏幕录制"选项（desktopCapturer fallback）
- 恢复上次选择的设备 ID

### 视频流管理

- `startCapture()`: 根据设备类型获取 MediaStream
  - `videoinput` → `getUserMedia({ video: { deviceId } })`
  - `screen` → desktopCapturer（待实现）
- `stopCapture()`: 停止所有 track，通知主进程
- `captureFrame()`: 从 stream 创建 video → canvas → base64 JPEG

## 帧处理流水线

```
视频流 → 帧差分(5%阈值) → Sharp压缩(768px) → RingBuffer(8帧) → AI API
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

基于 Sharp Native 模块的高性能图像压缩。

| 参数 | 默认值 | 说明 |
|------|--------|------|
| targetWidth | 768px | 目标宽度（小于目标不放大） |
| quality | 85 | JPEG 质量 |
| 缩放算法 | lanczos3 | 高质量缩放 |
| 编码器 | mozjpeg | 高压缩率 |

效果: 1080p → 768px，API token 成本降低约 65%。

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
