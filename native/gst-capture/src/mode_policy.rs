use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModeCandidate {
    pub id: String,
    pub format_id: String,
    pub width: i32,
    pub height: i32,
    pub frame_rate_numerator: i32,
    pub frame_rate_denominator: i32,
    pub advertised: bool,
    pub verified: bool,
}

impl ModeCandidate {
    pub fn new(format_id: &str, width: i32, height: i32, numerator: i32, denominator: i32) -> Self {
        Self {
            id: build_mode_id(format_id, width, height, numerator, denominator),
            format_id: format_id.to_owned(),
            width,
            height,
            frame_rate_numerator: numerator,
            frame_rate_denominator: denominator,
            advertised: true,
            verified: false,
        }
    }

    pub fn fps(&self) -> f64 {
        self.frame_rate_numerator as f64 / self.frame_rate_denominator as f64
    }
}

pub fn format_id_for_caps(media_type: &str, raw_format: Option<&str>) -> Option<String> {
    match media_type {
        "video/x-raw" => raw_format.map(str::to_owned),
        "image/jpeg" => Some("MJPEG".to_owned()),
        _ => None,
    }
}

pub fn build_mode_id(
    format_id: &str,
    width: i32,
    height: i32,
    numerator: i32,
    denominator: i32,
) -> String {
    format!("{format_id}:{width}x{height}:{numerator}/{denominator}")
}

pub fn rank_yuy2_candidates(mut modes: Vec<ModeCandidate>) -> Vec<ModeCandidate> {
    modes.retain(|mode| mode.format_id.eq_ignore_ascii_case("YUY2"));
    modes.sort_by(|left, right| {
        let left_pixels = i64::from(left.width) * i64::from(left.height);
        let right_pixels = i64::from(right.width) * i64::from(right.height);
        right_pixels
            .cmp(&left_pixels)
            .then_with(|| right.fps().total_cmp(&left.fps()))
            .then_with(|| left.id.cmp(&right.id))
    });
    modes
}

/** 设备 ID 与排序后的 Caps 摘要共同组成验证缓存键，设备能力变化后自动失效。 */
pub fn validation_cache_key(device_id: &str, modes: &[ModeCandidate]) -> String {
    let mut mode_ids = modes
        .iter()
        .map(|mode| mode.id.as_str())
        .collect::<Vec<_>>();
    mode_ids.sort_unstable();
    let mut digest = Sha256::new();
    for mode_id in mode_ids {
        digest.update(mode_id.as_bytes());
        digest.update([0]);
    }
    format!("{device_id}:{:x}", digest.finalize())
}

/** Electron WebRTC 当前可稳定协商的预览编码 Caps。 */
pub fn browser_preview_caps() -> &'static str {
    "video/x-vp8"
}

pub fn is_effective_fps(measured_fps: f64, numerator: i32, denominator: i32) -> bool {
    if numerator <= 0 || denominator <= 0 || !measured_fps.is_finite() {
        return false;
    }
    measured_fps >= (numerator as f64 / denominator as f64) * 0.95
}
