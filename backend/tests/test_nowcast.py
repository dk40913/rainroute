import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.classify import RadarImage
from app.models import GeoBox
from app.nowcast import estimate_motion

GEO = GeoBox(left_lon=118.0, right_lon=124.0, top_lat=26.5, bottom_lat=20.5)
SIZE = 360  # 360 px over 6 degrees -> 1 px = 1/60 degree
T0 = "2026-07-24T14:00:00+08:00"
T1 = "2026-07-24T14:10:00+08:00"
DT = 600.0


def frame(time: str, blobs: list[tuple[int, int]], radius: int = 25) -> RadarImage:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for cx, cy in blobs:
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(0, 0, 255, 255))
    return RadarImage(image=img, geo=GEO, time=time)


def test_recovers_a_known_shift():
    # Blob moves +12 px east (+0.2 deg lng) and -6 px in y (+0.1 deg lat) in 10 min.
    older = frame(T0, [(150, 200), (240, 120)])
    newer = frame(T1, [(162, 194), (252, 114)])
    motion = estimate_motion(older, newer)
    assert motion is not None
    assert motion.dlng_per_s == pytest.approx(0.2 / DT, rel=0.15)
    assert motion.dlat_per_s == pytest.approx(0.1 / DT, rel=0.15)


def test_subpixel_refinement_catches_slow_drift():
    # 2 px in a 360 px frame = 2.5 correlation cells at GRID=450 — a fractional
    # displacement that integer peak-picking would round to 2 or 3 cells.
    older = frame(T0, [(150, 200), (240, 120)])
    newer = frame(T1, [(152, 200), (242, 120)])
    motion = estimate_motion(older, newer)
    assert motion is not None
    true_dlng = (2 / 60) / DT  # 2 px = 2/60 deg over 10 min
    assert motion.dlng_per_s == pytest.approx(true_dlng, rel=0.08)
    assert abs(motion.dlat_per_s) < true_dlng * 0.1


def test_stationary_rain_gives_near_zero_motion():
    older = frame(T0, [(150, 200)])
    newer = frame(T1, [(150, 200)])
    motion = estimate_motion(older, newer)
    assert motion is not None
    assert abs(motion.dlng_per_s) < 1e-6
    assert abs(motion.dlat_per_s) < 1e-6


def test_no_echo_returns_none():
    assert estimate_motion(frame(T0, []), frame(T1, [(150, 200)])) is None
    assert estimate_motion(frame(T0, [(150, 200)]), frame(T1, [])) is None


def test_non_positive_dt_returns_none():
    older = frame(T0, [(150, 200)])
    newer = frame(T0, [(162, 194)])
    assert estimate_motion(older, newer) is None
    assert estimate_motion(frame(T1, [(150, 200)]), frame(T0, [(162, 194)])) is None


def test_frames_too_far_apart_return_none():
    older = frame(T0, [(150, 200)])
    newer = frame("2026-07-24T15:00:00+08:00", [(162, 194)])
    assert estimate_motion(older, newer) is None


def test_implausible_speed_returns_none():
    # 180 px = 3 degrees in 10 minutes ≈ 2000 km/h — reject.
    older = frame(T0, [(90, 200)])
    newer = frame(T1, [(270, 200)])
    assert estimate_motion(older, newer) is None


def test_uncorrelated_noise_returns_none():
    rng = np.random.default_rng(42)
    def noise_frame(time: str) -> RadarImage:
        alpha = (rng.random((SIZE, SIZE)) < 0.02).astype(np.uint8) * 255
        img = Image.merge(
            "RGBA",
            [Image.new("L", (SIZE, SIZE), 0)] * 3 + [Image.fromarray(alpha, mode="L")],
        )
        return RadarImage(image=img, geo=GEO, time=time)
    assert estimate_motion(noise_frame(T0), noise_frame(T1)) is None
