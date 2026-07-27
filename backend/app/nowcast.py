"""Global rain-field motion estimation from two consecutive radar frames.

Classic nowcasting premise: on a 0-60 minute horizon, rain fields mostly
translate. Phase correlation between the echo masks of two frames gives one
global displacement vector; advecting the current field by it approximates
the field at a future instant. Convective initiation (cells popping up from
nothing) is inherently outside what any extrapolation can see.
"""
from datetime import datetime
from math import cos, hypot, radians

import numpy as np
from PIL import Image

from app.classify import RadarImage
from app.models import Motion

# Correlation grid: 6 degrees / 450 cells ≈ 1.5 km per cell — finer than any
# plausible 10-minute displacement needs, coarse enough for a sub-ms FFT.
GRID = 450
MIN_ECHO_FRACTION = 0.001   # below this the mask is too empty to correlate
MIN_PEAK = 0.05             # phase-correlation peak below this = no coherent motion
MAX_SPEED_KMH = 150.0       # storm systems top out well under this
MAX_DT_S = 1860.0           # frames further apart than ~3 radar cycles are decorrelated
KM_PER_DEG_LAT = 111.0


def _echo_grid(radar: RadarImage) -> np.ndarray:
    alpha = radar.image.getchannel("A").resize((GRID, GRID), Image.BILINEAR)
    return np.asarray(alpha, dtype=np.float64) / 255.0


def _wrap(index: int) -> int:
    return index - GRID if index > GRID // 2 else index


def _subpixel(corr: np.ndarray, dy: int, dx: int) -> tuple[float, float]:
    """Parabolic peak refinement: displacements slower than one cell per frame
    (~9 km/h) would otherwise round to zero. Wrapped negative/overflow indices
    are exactly the circular neighbours phase correlation needs."""
    def offset(cm: float, c0: float, cp: float) -> float:
        denom = 2 * c0 - cp - cm
        if denom <= 0:
            return 0.0
        return max(-0.5, min(0.5, (cp - cm) / (2 * denom)))

    # After _wrap, dy/dx ∈ (-GRID/2, GRID/2], so dy±1 stays inside numpy's
    # index range and negative indices land on the correct circular neighbour.
    c0 = float(corr[dy, dx])
    oy = offset(float(corr[dy - 1, dx]), c0, float(corr[dy + 1, dx]))
    ox = offset(float(corr[dy, dx - 1]), c0, float(corr[dy, dx + 1]))
    return dy + oy, dx + ox


def estimate_motion(older: RadarImage, newer: RadarImage) -> Motion | None:
    dt_s = (datetime.fromisoformat(newer.time) - datetime.fromisoformat(older.time)).total_seconds()
    if dt_s <= 0 or dt_s > MAX_DT_S:
        return None

    a = _echo_grid(older)
    b = _echo_grid(newer)
    if a.mean() < MIN_ECHO_FRACTION or b.mean() < MIN_ECHO_FRACTION:
        return None

    window = np.outer(np.hanning(GRID), np.hanning(GRID))
    fa = np.fft.fft2(a * window)
    fb = np.fft.fft2(b * window)
    cross = fb * np.conj(fa)
    cross /= np.abs(cross) + 1e-12
    corr = np.real(np.fft.ifft2(cross))

    peak = float(corr.max())
    if peak < MIN_PEAK:
        return None

    iy, ix = np.unravel_index(int(corr.argmax()), corr.shape)
    dy, dx = _subpixel(corr, _wrap(int(iy)), _wrap(int(ix)))

    geo = newer.geo
    dlng = dx * (geo.right_lon - geo.left_lon) / GRID
    dlat = -dy * (geo.top_lat - geo.bottom_lat) / GRID  # grid y grows southward

    mid_lat = (geo.top_lat + geo.bottom_lat) / 2
    speed_kmh = hypot(dlat * KM_PER_DEG_LAT, dlng * KM_PER_DEG_LAT * cos(radians(mid_lat))) / dt_s * 3600
    if speed_kmh > MAX_SPEED_KMH:
        return None

    return Motion(dlat_per_s=dlat / dt_s, dlng_per_s=dlng / dt_s)
