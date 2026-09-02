use std::{
    collections::{BTreeMap, HashMap, HashSet},
    io::{self, BufRead, Write},
    net::TcpListener,
    time::{Duration, Instant},
};

use anyhow::{anyhow, bail, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app as gst_app;
use screencode_gst_capture::mode_policy::{
    format_id_for_caps, is_effective_fps, rank_yuy2_candidates, validation_cache_key, ModeCandidate,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const MAX_COMMAND_BYTES: usize = 64 * 1024;
const SNAPSHOT_LIMIT_BYTES: usize = 20 * 1024 * 1024;
const VALIDATION_SECONDS: f64 = 2.0;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureFormat {
    id: String,
    label: String,
    media_type: String,
    modes: Vec<ModeCandidate>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureDevice {
    id: String,
    label: String,
    backend: &'static str,
    formats: Vec<CaptureFormat>,
    #[serde(skip)]
    device_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureSelection {
    device_id: String,
    format_id: String,
    mode_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Command {
    #[serde(rename = "type")]
    command_type: String,
    request_id: String,
    selection: Option<CaptureSelection>,
}

struct ActiveCapture {
    pipeline: gst::Pipeline,
    snapshot_sink: gst_app::AppSink,
    mode: ModeCandidate,
    signalling_port: u16,
    preview_codec: &'static str,
}

#[derive(Default)]
struct CaptureEngine {
    devices: Vec<CaptureDevice>,
    active: Option<ActiveCapture>,
    validation_cache: HashMap<String, String>,
}

fn emit(value: Value) -> Result<()> {
    let stdout = io::stdout();
    let mut lock = stdout.lock();
    serde_json::to_writer(&mut lock, &value)?;
    lock.write_all(b"\n")?;
    lock.flush()?;
    Ok(())
}

fn emit_error(request_id: Option<&str>, error: &anyhow::Error) {
    let mut value = json!({ "type": "error", "message": format!("{error:#}") });
    if let Some(request_id) = request_id {
        value["requestId"] = Value::String(request_id.to_owned());
    }
    let _ = emit(value);
}

fn format_label(format_id: &str) -> String {
    match format_id.to_ascii_uppercase().as_str() {
        "YUY2" => "YUY2 4:2:2".to_owned(),
        "NV12" => "NV12 4:2:0".to_owned(),
        "BGR" => "RGB24 / BGR".to_owned(),
        "BGRA" => "RGB32 / BGRA".to_owned(),
        "BGRX" => "RGB32 / BGRx".to_owned(),
        "MJPEG" => "MJPEG".to_owned(),
        value => value.to_owned(),
    }
}

fn device_id(device_path: &str) -> String {
    let digest = Sha256::digest(device_path.as_bytes());
    format!("mf:{:x}", digest)[..19].to_owned()
}

fn escape_pipeline_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn exact_caps(mode: &ModeCandidate) -> String {
    if mode.format_id == "MJPEG" {
        format!(
            "image/jpeg,width={},height={},framerate={}/{}",
            mode.width, mode.height, mode.frame_rate_numerator, mode.frame_rate_denominator
        )
    } else {
        format!(
            "video/x-raw,format={},width={},height={},framerate={}/{}",
            mode.format_id,
            mode.width,
            mode.height,
            mode.frame_rate_numerator,
            mode.frame_rate_denominator
        )
    }
}

fn parse_devices() -> Result<Vec<CaptureDevice>> {
    let monitor = gst::DeviceMonitor::new();
    monitor
        .add_filter(Some("Source/Video"), None)
        .ok_or_else(|| anyhow!("无法添加 Media Foundation 设备过滤器"))?;
    monitor.start().context("无法启动 GStreamer 设备枚举")?;

    let mut result = Vec::new();
    for device in monitor.devices() {
        let Some(properties) = device.properties() else {
            continue;
        };
        let api = properties.get::<String>("device.api").unwrap_or_default();
        if api != "mediafoundation" {
            continue;
        }
        let device_path = properties
            .get::<String>("device.path")
            .context("Media Foundation 设备缺少 device.path")?;
        let label = device.display_name().to_string();
        let Some(caps) = device.caps() else {
            continue;
        };

        let mut formats: BTreeMap<String, CaptureFormat> = BTreeMap::new();
        let mut seen = HashSet::new();
        for structure in caps.iter() {
            let media_type = structure.name().as_str();
            let raw_format = structure.get::<String>("format").ok();
            let Some(format_id) = format_id_for_caps(media_type, raw_format.as_deref()) else {
                continue;
            };
            let Ok(width) = structure.get::<i32>("width") else {
                continue;
            };
            let Ok(height) = structure.get::<i32>("height") else {
                continue;
            };
            let Ok(frame_rate) = structure.get::<gst::Fraction>("framerate") else {
                continue;
            };
            let mode = ModeCandidate::new(
                &format_id,
                width,
                height,
                frame_rate.numer(),
                frame_rate.denom(),
            );
            if !seen.insert(mode.id.clone()) {
                continue;
            }
            formats
                .entry(format_id.clone())
                .or_insert_with(|| CaptureFormat {
                    id: format_id.clone(),
                    label: format_label(&format_id),
                    media_type: media_type.to_owned(),
                    modes: Vec::new(),
                })
                .modes
                .push(mode);
        }

        for format in formats.values_mut() {
            format.modes.sort_by(|left, right| {
                let left_pixels = i64::from(left.width) * i64::from(left.height);
                let right_pixels = i64::from(right.width) * i64::from(right.height);
                right_pixels
                    .cmp(&left_pixels)
                    .then_with(|| right.fps().total_cmp(&left.fps()))
            });
        }

        result.push(CaptureDevice {
            id: device_id(&device_path),
            label,
            backend: "gstreamer-mf",
            formats: formats.into_values().collect(),
            device_path,
        });
    }
    monitor.stop();
    Ok(result)
}

fn measure_sink(sink: &gst_app::AppSink, seconds: f64) -> f64 {
    let warmup_until = Instant::now() + Duration::from_millis(500);
    while Instant::now() < warmup_until {
        let _ = sink.try_pull_sample(gst::ClockTime::from_mseconds(100));
    }

    let started = Instant::now();
    let mut frames = 0_u64;
    while started.elapsed().as_secs_f64() < seconds {
        if sink
            .try_pull_sample(gst::ClockTime::from_mseconds(100))
            .is_some()
        {
            frames += 1;
        }
    }
    frames as f64 / started.elapsed().as_secs_f64()
}

fn validate_mode(device_path: &str, mode: &ModeCandidate) -> Result<f64> {
    let description = format!(
        "mfvideosrc device-path=\"{}\" ! {} ! appsink name=validation_sink max-buffers=2 drop=true sync=false",
        escape_pipeline_string(device_path),
        exact_caps(mode),
    );
    let pipeline = gst::parse::launch(&description)?
        .downcast::<gst::Pipeline>()
        .map_err(|_| anyhow!("验证管线不是 GstPipeline"))?;
    let sink = pipeline
        .by_name("validation_sink")
        .context("验证管线缺少 appsink")?
        .downcast::<gst_app::AppSink>()
        .map_err(|_| anyhow!("验证 sink 类型错误"))?;
    pipeline.set_state(gst::State::Playing)?;
    let measured = measure_sink(&sink, VALIDATION_SECONDS);
    pipeline.set_state(gst::State::Null)?;
    Ok(measured)
}

fn mark_highest_effective_yuy2(
    devices: &mut [CaptureDevice],
    validation_cache: &mut HashMap<String, String>,
) {
    for device in devices {
        let Some(format_index) = device.formats.iter().position(|format| format.id == "YUY2")
        else {
            continue;
        };
        let cache_key = validation_cache_key(&device.id, &device.formats[format_index].modes);
        if let Some(cached_mode_id) = validation_cache.get(&cache_key) {
            if let Some(mode) = device.formats[format_index]
                .modes
                .iter_mut()
                .find(|mode| &mode.id == cached_mode_id)
            {
                mode.verified = true;
                continue;
            }
        }

        // 实时预览默认要求至少 30 FPS；4K20 虽稳定但不作为“最高有效画质”默认项。
        let candidates = rank_yuy2_candidates(device.formats[format_index].modes.clone())
            .into_iter()
            .filter(|mode| mode.fps() >= 30.0);
        for candidate in candidates.take(3) {
            let Ok(measured) = validate_mode(&device.device_path, &candidate) else {
                continue;
            };
            if is_effective_fps(
                measured,
                candidate.frame_rate_numerator,
                candidate.frame_rate_denominator,
            ) {
                if let Some(mode) = device.formats[format_index]
                    .modes
                    .iter_mut()
                    .find(|mode| mode.id == candidate.id)
                {
                    mode.verified = true;
                    validation_cache.insert(cache_key.clone(), mode.id.clone());
                }
                break;
            }
        }
    }
}

fn choose_signalling_port() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn preview_chain(mode: &ModeCandidate) -> (String, &'static str, &'static str) {
    let pixels_per_second = f64::from(mode.width) * f64::from(mode.height) * mode.fps();
    let bitrate_kbps = (pixels_per_second * 0.10 / 1_000.0).clamp(8_000.0, 40_000.0) as u32;
    if gst::ElementFactory::find("mfh264enc").is_some() {
        (
            format!(
                "videoconvert ! video/x-raw,format=NV12 ! \
                 mfh264enc low-latency=true bitrate={bitrate_kbps} ! \
                 h264parse config-interval=-1 ! "
            ),
            "H264",
            "video/x-h264",
        )
    } else {
        (
            format!(
                "videoconvert ! vp8enc deadline=1 target-bitrate={} ! ",
                bitrate_kbps * 1_000
            ),
            "VP8",
            "video/x-vp8",
        )
    }
}

impl CaptureEngine {
    fn enumerate(&mut self) -> Result<Vec<CaptureDevice>> {
        self.stop()?;
        let mut devices = parse_devices()?;
        mark_highest_effective_yuy2(&mut devices, &mut self.validation_cache);
        self.devices = devices.clone();
        Ok(devices)
    }

    fn find_selection(
        &self,
        selection: &CaptureSelection,
    ) -> Result<(&CaptureDevice, ModeCandidate)> {
        let device = self
            .devices
            .iter()
            .find(|device| device.id == selection.device_id)
            .context("设备 ID 不在最近一次枚举结果中")?;
        let format = device
            .formats
            .iter()
            .find(|format| format.id == selection.format_id)
            .context("格式 ID 不在设备 Caps 中")?;
        let mode = format
            .modes
            .iter()
            .find(|mode| mode.id == selection.mode_id)
            .context("模式 ID 不在设备 Caps 中")?
            .clone();
        Ok((device, mode))
    }

    fn start(&mut self, selection: &CaptureSelection) -> Result<Value> {
        if self.devices.is_empty() {
            self.devices = parse_devices()?;
        }
        let (device, mode) = self.find_selection(selection)?;
        let device_path = device.device_path.clone();
        self.stop()?;
        let signalling_port = choose_signalling_port()?;
        let decode = if mode.format_id == "MJPEG" {
            "jpegdec ! videoconvert ! "
        } else {
            ""
        };
        let (preview_chain, codec, preview_caps_text) = preview_chain(&mode);
        let description = format!(
            concat!(
                "mfvideosrc device-path=\"{}\" ! {} ! {}tee name=t ",
                "t. ! queue leaky=downstream max-size-buffers=1 ! ",
                "appsink name=snapshot_sink max-buffers=1 drop=true sync=false ",
                "t. ! queue leaky=downstream max-size-buffers=2 ! {}",
                "webrtcsink name=preview run-signalling-server=true ",
                "signalling-server-host=127.0.0.1 signalling-server-port={} ",
                "run-web-server=false meta=\"meta,name=ScreenCode\""
            ),
            escape_pipeline_string(&device_path),
            exact_caps(&mode),
            decode,
            preview_chain,
            signalling_port,
        );
        let pipeline = gst::parse::launch(&description)?
            .downcast::<gst::Pipeline>()
            .map_err(|_| anyhow!("采集管线不是 GstPipeline"))?;
        let snapshot_sink = pipeline
            .by_name("snapshot_sink")
            .context("采集管线缺少 snapshot appsink")?
            .downcast::<gst_app::AppSink>()
            .map_err(|_| anyhow!("snapshot sink 类型错误"))?;
        let preview = pipeline
            .by_name("preview")
            .context("采集管线缺少 webrtcsink")?;
        let preview_caps = preview_caps_text.parse::<gst::Caps>()?;
        preview.set_property("video-caps", preview_caps);
        preview.set_property("do-fec", false);
        let signaller = preview.property::<gst::glib::Object>("signaller");
        signaller.set_property("uri", format!("ws://127.0.0.1:{signalling_port}"));

        pipeline.set_state(gst::State::Playing)?;
        let measured_fps = measure_sink(&snapshot_sink, VALIDATION_SECONDS);
        let verified = is_effective_fps(
            measured_fps,
            mode.frame_rate_numerator,
            mode.frame_rate_denominator,
        );
        if !verified {
            pipeline.set_state(gst::State::Null)?;
            bail!(
                "模式 {} 实测 {:.2} FPS，未达到目标 {:.2} FPS 的 95%",
                mode.id,
                measured_fps,
                mode.fps()
            );
        }

        let status = json!({
            "type": "status",
            "phase": "streaming",
            "requestedModeId": mode.id,
            "negotiated": {
                "formatId": mode.format_id,
                "width": mode.width,
                "height": mode.height,
                "frameRateNumerator": mode.frame_rate_numerator,
                "frameRateDenominator": mode.frame_rate_denominator
            },
            "measuredFps": measured_fps,
            "previewCodec": codec,
            "verified": true,
            "signallingUrl": format!("ws://127.0.0.1:{signalling_port}")
        });
        self.active = Some(ActiveCapture {
            pipeline,
            snapshot_sink,
            mode,
            signalling_port,
            preview_codec: codec,
        });
        Ok(status)
    }

    fn stop(&mut self) -> Result<()> {
        if let Some(active) = self.active.take() {
            active.pipeline.set_state(gst::State::Null)?;
        }
        Ok(())
    }

    fn snapshot(&self) -> Result<Value> {
        let active = self.active.as_ref().context("原生采集尚未启动")?;
        let sample = active
            .snapshot_sink
            .try_pull_sample(gst::ClockTime::from_seconds(2))
            .context("等待最新原始帧超时")?;
        let png = encode_png(&sample)?;
        if png.len() > SNAPSHOT_LIMIT_BYTES {
            bail!("PNG 截图超过 20MB 上限");
        }
        Ok(json!({
            "data": BASE64.encode(png),
            "mimeType": "image/png",
            "width": active.mode.width,
            "height": active.mode.height,
            "sourceFormat": active.mode.format_id,
            "previewCodec": active.preview_codec,
            "signallingPort": active.signalling_port
        }))
    }
}

fn encode_png(sample: &gst::Sample) -> Result<Vec<u8>> {
    let pipeline = gst::parse::launch(
        "appsrc name=png_source is-live=false format=time ! videoconvert ! pngenc snapshot=true ! appsink name=png_sink sync=false",
    )?
    .downcast::<gst::Pipeline>()
    .map_err(|_| anyhow!("PNG 编码管线不是 GstPipeline"))?;
    let source = pipeline
        .by_name("png_source")
        .context("PNG 编码管线缺少 appsrc")?
        .downcast::<gst_app::AppSrc>()
        .map_err(|_| anyhow!("PNG source 类型错误"))?;
    let sink = pipeline
        .by_name("png_sink")
        .context("PNG 编码管线缺少 appsink")?
        .downcast::<gst_app::AppSink>()
        .map_err(|_| anyhow!("PNG sink 类型错误"))?;
    let caps = sample.caps().context("原始帧缺少 Caps")?;
    let buffer = sample.buffer().context("原始帧缺少 Buffer")?.to_owned();
    let owned_caps = caps.to_owned();
    source.set_caps(Some(&owned_caps));
    pipeline.set_state(gst::State::Playing)?;
    source.push_buffer(buffer)?;
    source.end_of_stream()?;
    let png_sample = sink
        .try_pull_sample(gst::ClockTime::from_seconds(5))
        .context("PNG 编码超时")?;
    let png_buffer = png_sample.buffer().context("PNG 编码未返回 Buffer")?;
    let map = png_buffer.map_readable()?;
    let bytes = map.as_slice().to_vec();
    pipeline.set_state(gst::State::Null)?;
    Ok(bytes)
}

fn handle_command(engine: &mut CaptureEngine, command: Command) -> Result<bool> {
    match command.command_type.as_str() {
        "enumerate" => {
            emit(json!({
                "type": "devices",
                "requestId": command.request_id,
                "devices": engine.enumerate()?
            }))?;
        }
        "start" => {
            let selection = command.selection.context("start 命令缺少 selection")?;
            emit(json!({ "type": "status", "phase": "starting", "verified": false }))?;
            let status = engine.start(&selection)?;
            emit(status)?;
            emit(json!({ "type": "ok", "requestId": command.request_id }))?;
        }
        "stop" => {
            engine.stop()?;
            emit(json!({ "type": "status", "phase": "idle", "verified": false }))?;
            emit(json!({ "type": "ok", "requestId": command.request_id }))?;
        }
        "snapshot" => {
            emit(json!({
                "type": "snapshot",
                "requestId": command.request_id,
                "snapshot": engine.snapshot()?
            }))?;
        }
        "shutdown" => {
            engine.stop()?;
            emit(json!({ "type": "ok", "requestId": command.request_id }))?;
            return Ok(false);
        }
        _ => bail!("未知命令类型"),
    }
    Ok(true)
}

fn main() -> Result<()> {
    gst::init().context("GStreamer 初始化失败")?;
    let stdin = io::stdin();
    let mut engine = CaptureEngine::default();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.len() > MAX_COMMAND_BYTES {
            emit_error(None, &anyhow!("sidecar 命令超过上限"));
            continue;
        }
        let command: Command = match serde_json::from_str(&line) {
            Ok(command) => command,
            Err(error) => {
                emit_error(None, &anyhow!(error).context("命令不是有效 JSON"));
                continue;
            }
        };
        let request_id = command.request_id.clone();
        match handle_command(&mut engine, command) {
            Ok(true) => {}
            Ok(false) => break,
            Err(error) => emit_error(Some(&request_id), &error),
        }
    }
    engine.stop()?;
    Ok(())
}
