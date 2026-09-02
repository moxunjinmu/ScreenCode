# 原生采集第三方组件声明

ScreenCode 的 Windows 精确格式采集功能使用以下开源组件：

- GStreamer 1.28.6：LGPL-2.1-or-later；发布包仅包含本功能所需的动态链接运行时和插件。
- gstreamer-rs 0.24：MIT OR Apache-2.0，用于编译 Rust sidecar。
- gst-plugins-rs / rswebrtc 0.15.1：MPL-2.0，用于本机 WebRTC 预览。
- gstwebrtc-api 3.0.0：MPL-2.0；仓库保留未修改 ESM 构建产物及完整许可证。
- webrtc-adapter 8.2.3：BSD-3-Clause，由 gstwebrtc-api 官方构建产物包含。

本功能不打包 gst-libav、x264 或其他 GPL 插件。GStreamer 官方安装器版本及 SHA-256 固定在
`scripts/prepare-gstreamer-runtime.ps1`，生成的发布运行时包含逐文件哈希清单。
