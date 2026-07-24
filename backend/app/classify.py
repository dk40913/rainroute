from dataclasses import dataclass
from math import cos, pi, radians, sin
from typing import Optional
from PIL import Image

from app.models import GeoBox, Motion, RainLevel, WetSegment
from app.geometry import haversine_m, resample_polyline
from app.pixel import latlng_to_pixel
from app.palette import pixel_to_level


@dataclass
class RadarImage:
    image: Image.Image
    geo: GeoBox
    time: str
    png_bytes: bytes = b""

    def level_at(self, lat, lng) -> RainLevel:
        w, h = self.image.size
        x, y = latlng_to_pixel(lat, lng, self.geo, w, h)
        return pixel_to_level(self.image.getpixel((x, y)))


def _eta_offsets(samples, duration_s: Optional[float]) -> list[float]:
    """Arrival-time offset (seconds from departure) of each sample, assuming
    constant speed along the route."""
    if not duration_s or len(samples) < 2:
        return [0.0] * len(samples)
    cum = [0.0]
    for a, b in zip(samples, samples[1:]):
        cum.append(cum[-1] + haversine_m(a, b))
    total = cum[-1]
    if total == 0:
        return [0.0] * len(samples)
    return [duration_s * d / total for d in cum]


# A dry centerline with rain this close still deserves a heads-up: overlay
# pixels 1-2 km off the route look like they touch it on the map, and cells
# that near can drift or grow onto the route within a ride.
NEARBY_RADIUS_M = 2000.0
_NEARBY_BEARINGS = 8
_M_PER_DEG = 111_320.0


def _rain_near(radar: RadarImage, lat: float, lng: float) -> bool:
    for k in range(_NEARBY_BEARINGS):
        ang = 2 * pi * k / _NEARBY_BEARINGS
        n_lat = lat + NEARBY_RADIUS_M * cos(ang) / _M_PER_DEG
        n_lng = lng + NEARBY_RADIUS_M * sin(ang) / (_M_PER_DEG * cos(radians(lat)))
        if radar.level_at(n_lat, n_lng) >= RainLevel.LIGHT:
            return True
    return False


def classify_route(
    polyline,
    radar: RadarImage,
    interval_m: float,
    duration_s: Optional[float] = None,
    motion: Optional[Motion] = None,
):
    samples = resample_polyline(polyline, interval_m)
    etas = _eta_offsets(samples, duration_s)
    max_level = RainLevel.NONE
    wet: list[WetSegment] = []
    query_points: list[tuple[float, float]] = []
    for i, (lat, lng) in enumerate(samples):
        t = etas[i]
        if motion is not None and duration_s:
            # The field at arrival time t is the current field advected by
            # motion*t — equivalently, sample the current field at the point
            # shifted backwards along the motion vector.
            q_lat, q_lng = lat - motion.dlat_per_s * t, lng - motion.dlng_per_s * t
        else:
            q_lat, q_lng = lat, lng
        query_points.append((q_lat, q_lng))
        level = radar.level_at(q_lat, q_lng)
        if level > max_level:
            max_level = level
        if level >= RainLevel.LIGHT:
            eta_min = round(t / 60) if duration_s else None
            wet.append(WetSegment(index=i, lat=lat, lng=lng, level=level.label, eta_min=eta_min))
    verdict = "raincoat_recommended" if max_level >= RainLevel.MODERATE else "no_raincoat_needed"
    rain_nearby = not wet and any(_rain_near(radar, qlat, qlng) for qlat, qlng in query_points)
    return verdict, max_level, wet, rain_nearby
