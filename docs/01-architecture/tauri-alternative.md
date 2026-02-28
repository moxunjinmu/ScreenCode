# ScreenCode 软件架构设计文档 (Tauri + Rust 版本)

## 一、架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Tauri Application                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Rust Backend (Core)                          │ │
│  │                                                                  │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐ │ │
│  │  │ Capture      │  │ Frame         │  │ AI                  │ │ │
│  │  │ Plugin       │  │ Processor     │  │ Service             │ │ │
│  │  │              │  │               │  │                     │ │ │
│  │  │ - Device     │  │ - RingBuffer  │  │ - Claude API        │ │ │
│  │  │   Enum       │  │ - FrameDiff   │  │ - PromptBuilder     │ │ │
│  │  │ - Stream     │  │ - ImageProc   │  │ - ResponseParser    │ │ │
│  │  │ - Preview    │  │   (image crate)│  │   (serde_json)      │ │ │
│  │  └──────────────┘  └───────────────┘  └─────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐ │ │
│  │  │ Global       │  │ System        │  │ Config              │ │ │
│  │  │ Shortcut     │  │ Tray          │  │ Manager             │ │ │
│  │  │              │  │               │  │                     │ │ │
│  │  │ - Register   │  │ - Icon State  │  │ - serde             │ │ │
│  │  │ - Handler    │  │ - Menu        │  │ - confy/toml        │ │ │
│  │  └──────────────┘  └───────────────┘  └─────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │              State Management (Arc<Mutex<T>>)              │ │ │
│  │  │  - AppState: frames, devices, capture_status              │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              │ Tauri IPC (Commands + Events)        │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Frontend (WebView)                            │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │ │
│  │  │ Preview     │  │ Code         │  │ Toast               │   │ │
│  │  │ Component   │  │ Display      │  │ Notification        │   │ │
│  │  │             │  │              │  │                     │   │ │
│  │  │ - Live      │  │ - Pre Tag    │  │ - Screenshot        │   │ │
│  │  │   Stream    │  │ - Copy Btn   │  │   Confirm           │   │ │
│  │  │ - Thumbnail │  │ - Syntax     │  │ - Error Alert       │   │ │
│  │  └─────────────┘  └──────────────┘  └─────────────────────┘   │ │
│  │                                                                 │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │                  Zustand Store                             │ │ │
│  │  │  - captureState  - frameQueue  - codeResult              │ │ │
│  │  │  - appStatus     - settings    - errors                  │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈清单

| 层次 | 技术选型 | 版本 | 用途 |
|------|----------|------|------|
| 运行时 | Tauri | ^2.0.0 | 轻量级跨平台框架 |
| 后端语言 | Rust | ^1.75.0 | 高性能系统编程 |
| 前端框架 | React | ^18.2.0 | UI 组件 |
| 状态管理 | Zustand | ^4.5.0 | 前端状态 |
| 样式 | Tailwind CSS | ^3.4.0 | 原子化 CSS |
| 构建工具 | Vite | ^5.0.0 | 前端构建 |
| 视频采集 | 自定义 Tauri 插件 | - | 采集卡枚举与预览 |
| 图像处理 | image + opencv-rust | ^0.24 / ^0.88 | 高性能图像处理 |
| HTTP 客户端 | reqwest | ^0.11 | 异步 HTTP |
| JSON 处理 | serde + serde_json | ^1.0 | 序列化/反序列化 |
| 异步运行时 | tokio | ^1.35 | Rust 异步 |
| 配置管理 | confy | ^0.5 | 配置持久化 |
| 系统托盘 | tauri-plugin-system-tray | ^2.0 | 托盘功能 |
| 全局热键 | tauri-plugin-global-shortcut | ^2.0 | 热键注册 |

### 1.3 与 Electron 版本对比

| 维度 | Electron | Tauri + Rust |
|------|----------|--------------|
| 打包体积 | 60-100MB | **5-15MB** |
| 内存占用 | 100-200MB | **30-60MB** |
| 启动速度 | 1-2s | **< 500ms** |
| 图像处理性能 | Sharp (C++ binding) | **Rust Native (更快)** |
| 开发效率 | 高 (JS/TS 全栈) | 中等 (需学习 Rust) |
| 生态成熟度 | 非常成熟 | 快速成长中 |
| 视频采集 | Web API 直接用 | 需自定义插件 |

---

## 二、项目目录结构

```
ScreenCode/
├── src-tauri/                          # Rust 后端
│   ├── src/
│   │   ├── main.rs                     # 主入口
│   │   ├── lib.rs                      # 库导出
│   │   ├── commands/                   # Tauri Commands
│   │   │   ├── mod.rs
│   │   │   ├── capture.rs              # 采集命令
│   │   │   ├── frame.rs                # 帧管理命令
│   │   │   ├── ai.rs                   # AI 服务命令
│   │   │   └── device.rs               # 设备枚举命令
│   │   ├── capture/                    # 视频采集模块
│   │   │   ├── mod.rs
│   │   │   ├── device_enumerator.rs    # 设备枚举
│   │   │   ├── stream_manager.rs       # 流管理
│   │   │   └── preview_server.rs       # 预览服务
│   │   ├── processor/                  # 帧处理模块
│   │   │   ├── mod.rs
│   │   │   ├── ring_buffer.rs          # 环形缓冲区
│   │   │   ├── frame_diff.rs           # 帧差分算法
│   │   │   └── image_processor.rs      # 图像处理
│   │   ├── ai/                         # AI 服务模块
│   │   │   ├── mod.rs
│   │   │   ├── claude_service.rs       # Claude API 封装
│   │   │   ├── prompt_builder.rs       # Prompt 构建
│   │   │   └── response_parser.rs      # JSON 解析
│   │   ├── state/                      # 状态管理
│   │   │   ├── mod.rs
│   │   │   └── app_state.rs            # 应用状态
│   │   ├── config/                     # 配置管理
│   │   │   ├── mod.rs
│   │   │   └── settings.rs             # 设置持久化
│   │   └── tray/                       # 托盘模块
│   │       ├── mod.rs
│   │       └── tray_manager.rs         # 托盘管理
│   ├── Cargo.toml                      # Rust 依赖
│   ├── tauri.conf.json                 # Tauri 配置
│   └── build.rs                        # 构建脚本
│
├── src/                                # 前端代码
│   ├── index.html                      # HTML 入口
│   ├── main.tsx                        # React 入口
│   ├── App.tsx                         # 根组件
│   ├── components/                     # UI 组件
│   │   ├── Preview/
│   │   ├── CodeDisplay/
│   │   ├── Toast/
│   │   ├── Thumbnail/
│   │   └── Layout/
│   ├── store/                          # Zustand Store
│   │   ├── captureStore.ts
│   │   ├── frameStore.ts
│   │   └── appStore.ts
│   ├── hooks/                          # 自定义 Hooks
│   │   └── useTauri.ts                 # Tauri API Hook
│   └── styles/
│       └── globals.css
│
├── src-capture-plugin/                 # 自定义采集卡插件 (可选)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

---

## 三、核心模块设计

### 3.1 状态管理 (Rust)

**文件**: `src-tauri/src/state/app_state.rs`

```rust
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Frame {
    pub id: String,
    pub timestamp: u64,
    pub data: Vec<u8>,          // 压缩后的图像数据
    pub frame_type: FrameType,
    pub overlap: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FrameType {
    NewScene,
    Continuation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub is_connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeResponse {
    pub language: String,
    pub code: String,
    pub confidence: f32,
}

#[derive(Debug)]
pub struct AppState {
    // 帧队列
    pub frames: Arc<Mutex<Vec<Frame>>>,
    pub max_frames: usize,
    
    // 设备状态
    pub devices: Arc<Mutex<Vec<Device>>>,
    pub selected_device: Arc<Mutex<Option<String>>>,
    pub is_capturing: Arc<Mutex<bool>>,
    
    // AI 结果
    pub last_result: Arc<Mutex<Option<ClaudeResponse>>>,
    pub is_processing: Arc<Mutex<bool>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            frames: Arc::new(Mutex::new(Vec::new())),
            max_frames: 8,
            devices: Arc::new(Mutex::new(Vec::new())),
            selected_device: Arc::new(Mutex::new(None)),
            is_capturing: Arc::new(Mutex::new(false)),
            last_result: Arc::new(Mutex::new(None)),
            is_processing: Arc::new(Mutex::new(false)),
        }
    }
    
    pub fn add_frame(&self, frame: Frame) {
        let mut frames = self.frames.lock().unwrap();
        if frames.len() >= self.max_frames {
            frames.remove(0);
        }
        frames.push(frame);
    }
    
    pub fn clear_frames(&self) {
        let mut frames = self.frames.lock().unwrap();
        frames.clear();
    }
    
    pub fn get_frames(&self) -> Vec<Frame> {
        self.frames.lock().unwrap().clone()
    }
}
```

### 3.2 环形缓冲区

**文件**: `src-tauri/src/processor/ring_buffer.rs`

```rust
use crate::state::Frame;

pub struct RingBuffer {
    buffer: Vec<Option<Frame>>,
    capacity: usize,
    head: usize,
    tail: usize,
    count: usize,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![None; capacity],
            capacity,
            head: 0,
            tail: 0,
            count: 0,
        }
    }
    
    pub fn push(&mut self, frame: Frame) {
        self.buffer[self.tail] = Some(frame);
        self.tail = (self.tail + 1) % self.capacity;
        
        if self.count < self.capacity {
            self.count += 1;
        } else {
            self.head = (self.head + 1) % self.capacity;
        }
    }
    
    pub fn get_all(&self) -> Vec<&Frame> {
        let mut result = Vec::new();
        for i in 0..self.count {
            let index = (self.head + i) % self.capacity;
            if let Some(ref frame) = self.buffer[index] {
                result.push(frame);
            }
        }
        result
    }
    
    pub fn clear(&mut self) {
        self.buffer = vec![None; self.capacity];
        self.head = 0;
        self.tail = 0;
        self.count = 0;
    }
    
    pub fn is_full(&self) -> bool {
        self.count == self.capacity
    }
    
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }
}
```

### 3.3 帧差分算法

**文件**: `src-tauri/src/processor/frame_diff.rs`

```rust
use image::{DynamicImage, GenericImageView, Rgba};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DiffType {
    Static,         // diff < 5%
    Continuation,   // 5% <= diff <= 60%
    NewScene,       // diff > 60%
}

pub struct DiffResult {
    pub percentage: f32,
    pub diff_type: DiffType,
}

pub struct FrameDiff {
    threshold: f32,  // 默认 0.05 (5%)
}

impl FrameDiff {
    pub fn new() -> Self {
        Self {
            threshold: 0.05,
        }
    }
    
    /// 对比两帧的像素差异
    pub fn compare(
        &self,
        current: &DynamicImage,
        previous: Option<&DynamicImage>,
    ) -> DiffResult {
        let previous = match previous {
            Some(p) => p,
            None => {
                return DiffResult {
                    percentage: 1.0,
                    diff_type: DiffType::NewScene,
                };
            }
        };
        
        if current.dimensions() != previous.dimensions() {
            return DiffResult {
                percentage: 1.0,
                diff_type: DiffType::NewScene,
            };
        }
        
        let (width, height) = current.dimensions();
        let total_pixels = width * height;
        let mut diff_pixels = 0u64;
        
        for y in 0..height {
            for x in 0..width {
                let current_pixel = current.get_pixel(x, y);
                let previous_pixel = previous.get_pixel(x, y);
                
                if !Self::pixels_similar(&current_pixel, &previous_pixel) {
                    diff_pixels += 1;
                }
            }
        }
        
        let percentage = diff_pixels as f32 / total_pixels as f32;
        let diff_type = if percentage < self.threshold {
            DiffType::Static
        } else if percentage <= 0.6 {
            DiffType::Continuation
        } else {
            DiffType::NewScene
        };
        
        DiffResult {
            percentage,
            diff_type,
        }
    }
    
    /// 计算重叠区域
    pub fn calculate_overlap(
        &self,
        current: &DynamicImage,
        previous: &DynamicImage,
    ) -> f32 {
        // 简化实现：通过行匹配计算重叠比例
        // 生产环境可用更精确的图像匹配算法
        0.3  // 默认返回 30%
    }
    
    fn pixels_similar(p1: &Rgba<u8>, p2: &Rgba<u8>) -> bool {
        let threshold = 10u8;
        (p1[0] as i16 - p2[0] as i16).abs() <= threshold as i16
            && (p1[1] as i16 - p2[1] as i16).abs() <= threshold as i16
            && (p1[2] as i16 - p2[2] as i16).abs() <= threshold as i16
    }
}
```

### 3.4 图像处理器

**文件**: `src-tauri/src/processor/image_processor.rs`

```rust
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;

pub struct ImageProcessor {
    target_width: u32,      // 默认 768
    quality: u8,            // 默认 85
}

impl ImageProcessor {
    pub fn new() -> Self {
        Self {
            target_width: 768,
            quality: 85,
        }
    }
    
    /// 压缩图像到目标宽度
    pub fn compress(&self, input: &[u8]) -> Result<Vec<u8>, String> {
        let img = image::load_from_memory(input)
            .map_err(|e| format!("Failed to load image: {}", e))?;
        
        // 计算缩放比例
        let (width, height) = img.dimensions();
        let scale = self.target_width as f32 / width as f32;
        let new_height = (height as f32 * scale) as u32;
        
        // 缩放图像
        let resized = img.resize(
            self.target_width,
            new_height,
            image::imageops::FilterType::Lanczos3,
        );
        
        // 编码为 JPEG
        let mut buffer = Cursor::new(Vec::new());
        resized
            .write_to(&mut buffer, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
        
        Ok(buffer.into_inner())
    }
    
    /// 转换为 base64
    pub fn to_base64(data: &[u8]) -> String {
        use base64::{engine::general_purpose::STANDARD, Engine};
        STANDARD.encode(data)
    }
    
    /// 解码 base64
    pub fn from_base64(base64: &str) -> Result<Vec<u8>, String> {
        use base64::{engine::general_purpose::STANDARD, Engine};
        STANDARD
            .decode(base64)
            .map_err(|e| format!("Failed to decode base64: {}", e))
    }
}
```

### 3.5 Claude 服务

**文件**: `src-tauri/src/ai/claude_service.rs`

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: Vec<Content>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum Content {
    Text { r#type: String, text: String },
    Image { r#type: String, source: ImageSource },
}

#[derive(Debug, Serialize)]
struct ImageSource {
    r#type: String,
    media_type: String,
    data: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponseRaw {
    content: Vec<ContentRaw>,
}

#[derive(Debug, Deserialize)]
struct ContentRaw {
    text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeResponse {
    pub language: String,
    pub code: String,
    pub confidence: f32,
}

pub struct ClaudeService {
    client: Client,
    api_key: String,
    model: String,
    timeout: Duration,
}

impl ClaudeService {
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(25))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            client,
            api_key,
            model: "claude-3-5-sonnet-20241022".to_string(),
            timeout: Duration::from_secs(25),
        }
    }
    
    pub async fn extract_code(
        &self,
        frames: &[crate::state::Frame],
        prompt_builder: &crate::ai::prompt_builder::PromptBuilder,
    ) -> Result<ClaudeResponse, String> {
        let (system_prompt, user_prompt, images) = prompt_builder.build_multi_frame_prompt(frames);
        
        let mut content = Vec::new();
        
        // 添加文本提示
        content.push(Content::Text {
            r#type: "text".to_string(),
            text: user_prompt,
        });
        
        // 添加图片
        for image_base64 in images {
            content.push(Content::Image {
                r#type: "image".to_string(),
                source: ImageSource {
                    r#type: "base64".to_string(),
                    media_type: "image/jpeg".to_string(),
                    data: image_base64,
                },
            });
        }
        
        let request = ClaudeRequest {
            model: self.model.clone(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content,
            }],
        };
        
        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, body));
        }
        
        let raw: ClaudeResponseRaw = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        let text = raw
            .content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default();
        
        // 解析 JSON 响应
        let result: ClaudeResponse = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        
        Ok(result)
    }
}
```

### 3.6 Prompt 构建器

**文件**: `src-tauri/src/ai/prompt_builder.rs`

```rust
use crate::processor::image_processor::ImageProcessor;
use crate::state::Frame;

pub struct PromptBuilder;

impl PromptBuilder {
    pub fn new() -> Self {
        Self
    }
    
    pub fn build_multi_frame_prompt(
        &self,
        frames: &[Frame],
    ) -> (String, String, Vec<String>) {
        let system_prompt = r#"你是代码提取专家。你将收到 N 张按时序排列的代码截图，来自同一文件的连续滚动操作。
相邻截图之间存在重叠行，请去重并输出完整连贯代码。"#
            .to_string();
        
        let mut user_prompt = String::new();
        let mut images = Vec::new();
        
        for (index, frame) in frames.iter().enumerate() {
            let total = frames.len();
            let frame_metadata = self.generate_frame_metadata(frame, index, total);
            user_prompt.push_str(&format!("[{}] <image>\n", frame_metadata));
            images.push(ImageProcessor::to_base64(&frame.data));
        }
        
        user_prompt.push_str(&format!(
            r#"
输出格式（JSON）：
{{
  "language": "编程语言",
  "code": "完整连贯的代码",
  "confidence": 0.0-1.0
}}"#
        ));
        
        (system_prompt, user_prompt, images)
    }
    
    fn generate_frame_metadata(
        &self,
        frame: &Frame,
        index: usize,
        total: usize,
    ) -> String {
        let frame_type_str = match frame.frame_type {
            crate::state::FrameType::NewScene => "new_scene",
            crate::state::FrameType::Continuation => "continuation",
        };
        
        let overlap_str = frame
            .overlap
            .map(|o| format!(" | 与上帧重叠约{:.0}%", o * 100.0))
            .unwrap_or_default();
        
        format!(
            "帧{}/{} | 类型:{}{}",
            index + 1,
            total,
            frame_type_str,
            overlap_str
        )
    }
}
```

### 3.7 视频采集插件

**文件**: `src-tauri/src/capture/device_enumerator.rs`

```rust
use crate::state::Device;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: String,
}

pub struct DeviceEnumerator;

impl DeviceEnumerator {
    pub fn new() -> Self {
        Self
    }
    
    /// 枚举视频采集设备
    /// Windows: 使用 DirectShow 或 WMI
    /// macOS: 使用 AVFoundation
    /// Linux: 使用 V4L2
    pub fn enumerate(&self) -> Result<Vec<Device>, String> {
        #[cfg(target_os = "windows")]
        {
            self.enumerate_windows()
        }
        
        #[cfg(target_os = "macos")]
        {
            self.enumerate_macos()
        }
        
        #[cfg(target_os = "linux")]
        {
            self.enumerate_linux()
        }
    }
    
    #[cfg(target_os = "windows")]
    fn enumerate_windows(&self) -> Result<Vec<Device>, String> {
        // 使用 Windows API 枚举视频设备
        // 可以通过:
        // 1. DirectShow (推荐)
        // 2. WMI
        // 3. SetupAPI
        
        // 简化实现：返回模拟数据
        // 生产环境需要调用 Windows API
        Ok(vec![
            Device {
                id: "video0".to_string(),
                name: "USB Video Device".to_string(),
                is_connected: true,
            },
        ])
    }
    
    #[cfg(target_os = "macos")]
    fn enumerate_macos(&self) -> Result<Vec<Device>, String> {
        // 使用 AVFoundation
        Ok(vec![])
    }
    
    #[cfg(target_os = "linux")]
    fn enumerate_linux(&self) -> Result<Vec<Device>, String> {
        // 使用 V4L2
        Ok(vec![])
    }
}
```

**注意**: 完整的视频采集实现需要使用 Rust 绑定系统 API：
- **Windows**: `windows-rs` crate 调用 DirectShow/MediaFoundation
- **macOS**: `cocoa` + `core-foundation` crates
- **Linux**: `v4l2` crate

或使用第三方 crate: `nokhwa` (跨平台摄像头库)

---

## 四、Tauri Commands 设计

### 4.1 Commands 定义

**文件**: `src-tauri/src/commands/capture.rs`

```rust
use tauri::State;
use crate::state::{AppState, Device};

#[tauri::command]
pub async fn enumerate_devices(
    state: State<'_, AppState>,
) -> Result<Vec<Device>, String> {
    let enumerator = crate::capture::DeviceEnumerator::new();
    let devices = enumerator.enumerate()?;
    
    let mut state_devices = state.devices.lock().unwrap();
    *state_devices = devices.clone();
    
    Ok(devices)
}

#[tauri::command]
pub async fn select_device(
    device_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut selected = state.selected_device.lock().unwrap();
    *selected = Some(device_id);
    Ok(())
}

#[tauri::command]
pub async fn start_capture(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let device_id = state
        .selected_device
        .lock()
        .unwrap()
        .clone()
        .ok_or("No device selected")?;
    
    let mut is_capturing = state.is_capturing.lock().unwrap();
    *is_capturing = true;
    
    // 启动采集线程
    // TODO: 实现实际的采集逻辑
    
    Ok(())
}

#[tauri::command]
pub async fn stop_capture(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut is_capturing = state.is_capturing.lock().unwrap();
    *is_capturing = false;
    Ok(())
}
```

**文件**: `src-tauri/src/commands/frame.rs`

```rust
use tauri::{Manager, State};
use crate::state::{AppState, Frame, FrameType};

#[tauri::command]
pub async fn capture_frame(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // 捕获当前帧
    // TODO: 从视频流获取当前帧
    
    let frame = Frame {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
        data: vec![],  // 实际的图像数据
        frame_type: FrameType::NewScene,
        overlap: None,
    };
    
    // 添加到队列
    state.add_frame(frame.clone());
    
    // 发送事件到前端
    app.emit("frame:added", &frame)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_frames(
    state: State<'_, AppState>,
) -> Result<Vec<Frame>, String> {
    Ok(state.get_frames())
}

#[tauri::command]
pub async fn clear_frames(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.clear_frames();
    Ok(())
}
```

**文件**: `src-tauri/src/commands/ai.rs`

```rust
use tauri::{Manager, State};
use crate::state::AppState;
use crate::ai::{ClaudeService, PromptBuilder};

#[tauri::command]
pub async fn extract_code(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<crate::state::ClaudeResponse, String> {
    let frames = state.get_frames();
    
    if frames.is_empty() {
        return Err("No frames in queue".to_string());
    }
    
    // 设置处理状态
    {
        let mut is_processing = state.is_processing.lock().unwrap();
        *is_processing = true;
    }
    
    // 获取 API Key
    let config = crate::config::Settings::load()?;
    let api_key = config.claude_api_key.ok_or("API key not configured")?;
    
    // 调用 Claude API
    let service = ClaudeService::new(api_key);
    let prompt_builder = PromptBuilder::new();
    
    let result = service.extract_code(&frames, &prompt_builder).await?;
    
    // 保存结果
    {
        let mut last_result = state.last_result.lock().unwrap();
        *last_result = Some(result.clone());
    }
    
    // 重置处理状态
    {
        let mut is_processing = state.is_processing.lock().unwrap();
        *is_processing = false;
    }
    
    // 发送事件到前端
    app.emit("ai:result", &result)
        .map_err(|e| e.to_string())?;
    
    Ok(result)
}
```

### 4.2 主入口注册

**文件**: `src-tauri/src/main.rs`

```rust
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;
use screencode::{commands, state::AppState, tray::TrayManager};

fn main() {
    let app_state = AppState::new();
    
    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            // 初始化系统托盘
            let tray = TrayManager::new(app.handle());
            tray.build();
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture::enumerate_devices,
            commands::capture::select_device,
            commands::capture::start_capture,
            commands::capture::stop_capture,
            commands::frame::capture_frame,
            commands::frame::get_frames,
            commands::frame::clear_frames,
            commands::ai::extract_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 五、配置管理

### 5.1 设置结构

**文件**: `src-tauri/src/config/settings.rs`

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub claude_api_key: Option<String>,
    pub last_device_id: Option<String>,
    pub toast_duration_ms: u64,
    pub frame_diff_threshold: f32,
    pub max_frames: usize,
    pub compression_width: u32,
    pub compression_quality: u8,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            claude_api_key: None,
            last_device_id: None,
            toast_duration_ms: 1500,
            frame_diff_threshold: 0.05,
            max_frames: 8,
            compression_width: 768,
            compression_quality: 85,
        }
    }
}

impl Settings {
    pub fn load() -> Result<Self, String> {
        confy::load("ScreenCode", "config")
            .map_err(|e| format!("Failed to load config: {}", e))
    }
    
    pub fn save(&self) -> Result<(), String> {
        confy::store("ScreenCode", "config", self)
            .map_err(|e| format!("Failed to save config: {}", e))
    }
    
    pub fn config_path() -> PathBuf {
        confy::get_configuration_file_path("ScreenCode", "config")
            .expect("Failed to get config path")
    }
}
```

### 5.2 Tauri 配置

**文件**: `src-tauri/tauri.conf.json`

```json
{
  "productName": "ScreenCode",
  "version": "1.0.0",
  "identifier": "com.screencode.app",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "ScreenCode",
        "width": 800,
        "height": 600,
        "resizable": true,
        "fullscreen": false,
        "visible": false
      }
    ],
    "security": {
      "csp": null
    },
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "identifier": "com.screencode.app",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  },
  "plugins": {
    "global-shortcut": {
      "shortcuts": [
        {
          "shortcut": "Ctrl+Shift+S",
          "handler": "capture_frame"
        },
        {
          "shortcut": "Ctrl+Shift+E",
          "handler": "extract_code"
        }
      ]
    },
    "system-tray": {}
  }
}
```

---

## 六、Cargo 依赖

**文件**: `src-tauri/Cargo.toml`

```toml
[package]
name = "screencode"
version = "1.0.0"
description = "Screen capture and code extraction tool"
authors = ["ScreenCode Team"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
# Tauri
tauri = { version = "2.0", features = ["tray-icon"] }
tauri-plugin-global-shortcut = "2.0"
tauri-plugin-system-tray = "2.0"

# Async
tokio = { version = "1.35", features = ["full"] }

# HTTP
reqwest = { version = "0.11", features = ["json"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Image processing
image = "0.24"
base64 = "0.21"

# Configuration
confy = "0.5"

# UUID
uuid = { version = "1.6", features = ["v4"] }

# Logging
log = "0.4"
env_logger = "0.10"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Windows-specific dependencies
[target.'cfg(windows)'.dependencies]
windows = { version = "0.52", features = [
    "Win32_Foundation",
    "Win32_Media_DirectShow",
    "Win32_System_Com",
] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

---

## 七、前端集成

### 7.1 Tauri API Hook

**文件**: `src/hooks/useTauri.ts`

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

export interface Device {
  id: string;
  name: string;
  is_connected: boolean;
}

export interface Frame {
  id: string;
  timestamp: number;
  data: number[];
  frame_type: 'NewScene' | 'Continuation';
  overlap?: number;
}

export interface ClaudeResponse {
  language: string;
  code: string;
  confidence: number;
}

export function useTauri() {
  // 设备管理
  const enumerateDevices = () => invoke<Device[]>('enumerate_devices');
  const selectDevice = (deviceId: string) => invoke('select_device', { deviceId });
  const startCapture = () => invoke('start_capture');
  const stopCapture = () => invoke('stop_capture');
  
  // 帧管理
  const captureFrame = () => invoke('capture_frame');
  const getFrames = () => invoke<Frame[]>('get_frames');
  const clearFrames = () => invoke('clear_frames');
  
  // AI 服务
  const extractCode = () => invoke<ClaudeResponse>('extract_code');
  
  // 事件监听
  const onFrameAdded = (callback: (frame: Frame) => void) => {
    const unlisten = listen<Frame>('frame:added', (event) => {
      callback(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  };
  
  const onAIResult = (callback: (result: ClaudeResponse) => void) => {
    const unlisten = listen<ClaudeResponse>('ai:result', (event) => {
      callback(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  };
  
  return {
    // 设备
    enumerateDevices,
    selectDevice,
    startCapture,
    stopCapture,
    
    // 帧
    captureFrame,
    getFrames,
    clearFrames,
    
    // AI
    extractCode,
    
    // 事件
    onFrameAdded,
    onAIResult,
  };
}
```

### 7.2 全局热键注册

**文件**: `src-tauri/src/tray/tray_manager.rs`

```rust
use tauri::{
    AppHandle, Manager,
    tray::{TrayIcon, TrayIconBuilder},
    menu::{Menu, MenuItem},
};

pub struct TrayManager {
    app: AppHandle,
}

impl TrayManager {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
    
    pub fn build(&self) {
        // 创建托盘菜单
        let show_window = MenuItem::with_id("show_window", "显示主窗口", true, None);
        let settings = MenuItem::with_id("settings", "设置", true, None);
        let quit = MenuItem::with_id("quit", "退出", true, None);
        
        let menu = Menu::with_items(&[
            &show_window,
            &settings,
            &quit,
        ]);
        
        // 构建托盘图标
        let _tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .menu(&menu)
            .on_menu_event(|app, event| {
                match event.id.0.as_str() {
                    "show_window" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            })
            .build(&self.app);
    }
    
    pub fn update_icon(&self, status: &str) {
        // 更新托盘图标状态
        // 绿色 = 有信号
        // 红色 = 无信号
        // 黄色 = 处理中
    }
}
```

---

## 八、全局热键处理

### 8.1 热键注册

**文件**: `src-tauri/src/main.rs` (补充)

```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

fn setup_shortcuts(app: &tauri::AppHandle) {
    let shortcut = app.global_shortcut();
    
    // Ctrl+Shift+S: 截图
    shortcut
        .register("Ctrl+Shift+S", |app, _shortcut, _event| {
            let state = app.state::<AppState>();
            // 触发截图
            tokio::spawn(async move {
                if let Err(e) = commands::frame::capture_frame(state.inner().clone(), app.clone()).await {
                    eprintln!("Capture failed: {}", e);
                }
            });
        })
        .expect("Failed to register screenshot shortcut");
    
    // Ctrl+Shift+E: 提取代码
    shortcut
        .register("Ctrl+Shift+E", |app, _shortcut, _event| {
            let state = app.state::<AppState>();
            // 触发代码提取
            tokio::spawn(async move {
                if let Err(e) = commands::ai::extract_code(state.inner().clone(), app.clone()).await {
                    eprintln!("Extract failed: {}", e);
                }
            });
        })
        .expect("Failed to register extract shortcut");
}
```

---

## 九、打包与分发

### 9.1 构建命令

```bash
# 开发模式
npm run tauri dev

# 生产构建
npm run tauri build

# 输出文件
# src-tauri/target/release/bundle/
#   ├── nsis/ScreenCode_1.0.0_x64-setup.exe
#   └── msi/ScreenCode_1.0.0_x64.msi
```

### 9.2 打包体积对比

| 框架 | 安装包大小 | 内存占用 |
|------|-----------|----------|
| Electron | 60-100MB | 100-200MB |
| **Tauri** | **5-15MB** | **30-60MB** |

---

## 十、性能优化

### 10.1 图像处理优化

```rust
// 使用并行处理
use rayon::prelude::*;

impl ImageProcessor {
    pub fn compress_batch(&self, inputs: Vec<&[u8]>) -> Vec<Vec<u8>> {
        inputs
            .par_iter()
            .map(|input| self.compress(input).unwrap())
            .collect()
    }
}
```

### 10.2 内存优化

```rust
// 使用 Arc 共享数据，避免复制
use std::sync::Arc;

pub struct Frame {
    pub id: String,
    pub timestamp: u64,
    pub data: Arc<Vec<u8>>,  // 共享所有权
    pub frame_type: FrameType,
    pub overlap: Option<f32>,
}
```

---

## 十一、开发路线图

### Week 1: 基础链路

| Day | 任务 | 文件 |
|-----|------|------|
| 1-2 | Tauri 初始化，设备枚举 | `src-tauri/src/capture/` |
| 3-4 | 全局热键，Ring Buffer，托盘 | `src-tauri/src/processor/` |
| 5 | 图像压缩，帧差分 | `src-tauri/src/processor/` |

### Week 2: AI 集成

| Day | 任务 | 文件 |
|-----|------|------|
| 6-7 | Claude API 集成，Prompt | `src-tauri/src/ai/` |
| 8 | 前端 UI 集成 | `src/` |
| 9 | 错误处理，打包 | `tauri.conf.json` |
| 10 | 测试，发布 | - |

---

## 十二、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 视频采集插件开发复杂 | 延期 | 使用 `nokhwa` 或 `opencv-rust` |
| Rust 学习曲线 | 效率降低 | 核心功能先简化实现 |
| 跨平台兼容性 | 功能差异 | MVP 先专注 Windows |
| Tauri 生态不成熟 | 问题难解决 | 查阅源码，社区支持 |

---

*Tauri + Rust 架构设计 v1.0*
