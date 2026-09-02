use screencode_gst_capture::mode_policy::{
    build_mode_id, format_id_for_caps, is_effective_fps, rank_yuy2_candidates,
    validation_cache_key, ModeCandidate,
};

#[test]
fn maps_media_foundation_caps_to_user_format_ids() {
    assert_eq!(
        format_id_for_caps("video/x-raw", Some("YUY2")),
        Some("YUY2".into())
    );
    assert_eq!(
        format_id_for_caps("video/x-raw", Some("BGR")),
        Some("BGR".into())
    );
    assert_eq!(format_id_for_caps("image/jpeg", None), Some("MJPEG".into()));
    assert_eq!(format_id_for_caps("video/x-h264", None), None);
}

#[test]
fn builds_stable_mode_id_from_exact_caps() {
    assert_eq!(
        build_mode_id("YUY2", 2560, 1440, 50, 1),
        "YUY2:2560x1440:50/1"
    );
}

#[test]
fn ranks_yuy2_by_resolution_then_frame_rate() {
    let ranked = rank_yuy2_candidates(vec![
        ModeCandidate::new("YUY2", 1920, 1080, 60, 1),
        ModeCandidate::new("YUY2", 2560, 1440, 30, 1),
        ModeCandidate::new("YUY2", 2560, 1440, 50, 1),
    ]);
    assert_eq!(ranked[0].id, "YUY2:2560x1440:50/1");
}

#[test]
fn requires_ninety_five_percent_of_requested_fps() {
    assert!(is_effective_fps(47.5, 50, 1));
    assert!(!is_effective_fps(47.49, 50, 1));
}

#[test]
fn validation_cache_key_changes_with_caps_but_not_input_order() {
    let first = ModeCandidate::new("YUY2", 2560, 1440, 50, 1);
    let second = ModeCandidate::new("YUY2", 1920, 1080, 60, 1);
    assert_eq!(
        validation_cache_key("mf:device", &[first.clone(), second.clone()]),
        validation_cache_key("mf:device", &[second.clone(), first.clone()])
    );
    assert_ne!(
        validation_cache_key("mf:device", &[first]),
        validation_cache_key("mf:device", &[second])
    );
}
