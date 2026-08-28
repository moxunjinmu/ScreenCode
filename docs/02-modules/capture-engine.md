# 采集引擎与帧处理

> 最后更新: 2026-08-28
> 目录: `src/main/capture/`, `src/main/processor/`

## 采集模块 (`src/main/capture/`)

### 设备枚举

- 使用 `navigator.mediaDevices.enumerateDevices()` 枚举视频输入设备
- 额外添加"屏幕录制"选项（desktopCapturer fallback）
- 恢复上次选择的设备 ID

### 视频流管理

- `startCapture()`: 根据设备类型获取 MediaStream
  - `videoinput` → `getUserMedia({ video: { deviceId } })` 打开指定设备一次
  - 通过 `getCapabilities()` 获取能力范围，按分辨率优先、同分辨率帧率优先生成候选模式
  - 通过 `applyConstraints()` 逐档应用严格宽、高、帧率约束；支持时使用 `resizeMode: none`
  - 通过 `getSettings()` 记录实际生效参数，严格模式均失败时保留理想值或浏览器默认流
  - `screen` → desktopCapturer（待实现）
- `stopCapture()`: 停止所有 track，通知主进程
- `captureFrame()`: 复用预览 video，以视频源固有尺寸绘制 canvas → base64 JPEG

### 最高质量模式协商 (`src/renderer/capture/highQualityCapture.ts`)

浏览器不会公开 UVC 采集卡完整的离散输出模式表，因此协商器将设备能力上限与常见标准档位组合，
通过严格约束逐档验证。排序策略固定为：像素总数降序，同分辨率下帧率降序。

协商过程中始终复用同一条视频轨道，避免重复释放和重开采集卡。`OverconstrainedError` 表示当前档位
不受支持，可继续尝试下一档；权限拒绝、设备占用等错误不会被吞掉或重复请求。预览工具栏显示视频源
固有宽高和 `getSettings().frameRate`，显示尺寸与 CSS 缩放不改变实际采集质量。

能力边界：WebRTC 不能选择 UVC 的 MJPEG/YUY2/NV12 等像素格式，也不能保证能力范围的宽、高、
帧率上限属于同一个离散模式。若浏览器无法获得厂商标称档位，需要另行评估 FFmpeg DirectShow 管线。

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
