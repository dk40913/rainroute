"""Validate nowcast motion estimation against real consecutive radar frames.

Usage (run from backend/):
    uv run python scripts/validate_nowcast.py collect <dir>   # save 3 frames, ~25 min
    uv run python scripts/validate_nowcast.py validate <dir>  # score them

`validate` estimates motion from frames 0->1, advects frame 1 to frame 2's
time, and scores the forecast echo mask against the real frame 2 (CSI).
Persistence (frame 1 unmoved) is the baseline the nowcast has to beat — note
that on a day with stationary rain the two scores are legitimately equal.
"""
import json
import sys
import time
import urllib.request
from datetime import datetime
from math import atan2, cos, degrees, hypot, radians
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.classify import RadarImage
from app.config import get_settings
from app.models import GeoBox
from app.nowcast import GRID, estimate_motion
from app.palette import strip_non_echo
from app.radar import CWA_DATAID

GEO = GeoBox(left_lon=118.0, right_lon=124.0, top_lat=26.5, bottom_lat=20.5)


def collect(out_dir: Path, want: int = 3) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    settings = get_settings()
    meta_url = (f"{settings.cwa_base_url}/fileapi/v1/opendataapi/{CWA_DATAID}"
                f"?Authorization={settings.cwa_api_key}&format=JSON")
    seen: set[str] = set()
    deadline = time.time() + (want + 1.5) * 600
    while len(seen) < want and time.time() < deadline:
        try:
            with urllib.request.urlopen(meta_url, timeout=30) as r:
                ds = json.load(r)["cwaopendata"]["dataset"]
            if ds["DateTime"] not in seen:
                fname = out_dir / (ds["DateTime"].replace(":", "").replace("+", "p") + ".png")
                with urllib.request.urlopen(ds["resource"]["ProductURL"], timeout=60) as img:
                    fname.write_bytes(img.read())
                seen.add(ds["DateTime"])
                print(f"saved {fname.name}", flush=True)
        except Exception as e:
            print(f"retry after error: {e}", flush=True)
        if len(seen) < want:
            time.sleep(120)
    print(f"done, {len(seen)} frames", flush=True)


def load(path: Path) -> RadarImage:
    t = path.stem.replace("p0800", "+08:00")
    t = f"{t[:13]}:{t[13:15]}:{t[15:17]}{t[17:]}"
    return RadarImage(image=strip_non_echo(Image.open(path).convert("RGBA")), geo=GEO, time=t)


def mask(radar: RadarImage) -> np.ndarray:
    alpha = radar.image.getchannel("A").resize((GRID, GRID), Image.BILINEAR)
    return np.asarray(alpha, dtype=np.float64) / 255.0 > 0.5


def csi(forecast: np.ndarray, truth: np.ndarray) -> float:
    hits = np.sum(forecast & truth)
    return float(hits / (hits + np.sum(~forecast & truth) + np.sum(forecast & ~truth)))


def validate(frame_dir: Path) -> None:
    paths = sorted(frame_dir.glob("*.png"))
    assert len(paths) >= 3, f"need 3 frames, have {len(paths)}"
    f0, f1, f2 = (load(p) for p in paths[:3])
    print(f"frames: {f0.time} -> {f1.time} -> {f2.time}")

    motion = estimate_motion(f0, f1)
    assert motion is not None, "estimate_motion returned None on real frames"
    mid_lat = (GEO.top_lat + GEO.bottom_lat) / 2
    v_n = motion.dlat_per_s * 111.0 * 3600
    v_e = motion.dlng_per_s * 111.0 * cos(radians(mid_lat)) * 3600
    print(f"motion: {hypot(v_n, v_e):.1f} km/h toward {(degrees(atan2(v_e, v_n)) + 360) % 360:.0f}°")

    dt12 = (datetime.fromisoformat(f2.time) - datetime.fromisoformat(f1.time)).total_seconds()
    dx = round(motion.dlng_per_s * dt12 / ((GEO.right_lon - GEO.left_lon) / GRID))
    dy = round(-motion.dlat_per_s * dt12 / ((GEO.top_lat - GEO.bottom_lat) / GRID))
    m1, m2 = mask(f1), mask(f2)
    print(f"frame2 echo coverage: {100 * m2.mean():.1f}% of grid")
    print(f"CSI persistence: {csi(m1, m2):.3f}")
    print(f"CSI nowcast    : {csi(np.roll(m1, (dy, dx), axis=(0, 1)), m2):.3f}")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("collect", "validate"):
        sys.exit(__doc__)
    (collect if sys.argv[1] == "collect" else validate)(Path(sys.argv[2]))
