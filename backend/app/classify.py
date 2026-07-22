from dataclasses import dataclass
from PIL import Image

from app.models import GeoBox, RainLevel, WetSegment
from app.geometry import resample_polyline
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


def classify_route(polyline, radar: RadarImage, interval_m: float):
    samples = resample_polyline(polyline, interval_m)
    max_level = RainLevel.NONE
    wet: list[WetSegment] = []
    for i, (lat, lng) in enumerate(samples):
        level = radar.level_at(lat, lng)
        if level > max_level:
            max_level = level
        if level >= RainLevel.LIGHT:
            wet.append(WetSegment(index=i, lat=lat, lng=lng, level=level.label))
    verdict = "raincoat_recommended" if max_level >= RainLevel.MODERATE else "no_raincoat_needed"
    return verdict, max_level, wet
