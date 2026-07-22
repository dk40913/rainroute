from PIL import Image
from app.models import GeoBox, RainLevel
from app.classify import RadarImage, classify_route

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)


def _radar(fill):
    img = Image.new("RGBA", (100, 100), fill)
    return RadarImage(image=img, geo=GEO, time="2026-07-21T14:30:00+08:00")


def test_clear_sky_no_raincoat():
    radar = _radar((0, 0, 0, 0))  # fully transparent = no echo
    line = [(25.0, 121.0), (25.05, 121.0)]
    verdict, max_level, wet = classify_route(line, radar, interval_m=500.0)
    assert verdict == "no_raincoat_needed"
    assert max_level == RainLevel.NONE
    assert wet == []


def test_heavy_rain_recommends_raincoat():
    radar = _radar((255, 0, 0, 255))  # red everywhere = heavy
    line = [(25.0, 121.0), (25.05, 121.0)]
    verdict, max_level, wet = classify_route(line, radar, interval_m=500.0)
    assert verdict == "raincoat_recommended"
    assert max_level == RainLevel.HEAVY
    assert len(wet) >= 1
    assert wet[0].level == "heavy"


def test_light_only_no_raincoat_but_segments_reported():
    radar = _radar((0, 236, 236, 255))  # cyan = light
    line = [(25.0, 121.0), (25.05, 121.0)]
    verdict, max_level, wet = classify_route(line, radar, interval_m=500.0)
    assert verdict == "no_raincoat_needed"
    assert max_level == RainLevel.LIGHT
    assert len(wet) >= 1  # light rain still surfaced to the user
