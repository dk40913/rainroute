from PIL import Image
from app.models import GeoBox, Motion, RainLevel
from app.classify import RadarImage, classify_route

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)


def _radar(fill):
    img = Image.new("RGBA", (100, 100), fill)
    return RadarImage(image=img, geo=GEO, time="2026-07-21T14:30:00+08:00")


def _half_radar(west_fill, east_fill, split_lng=120.75):
    """Radar with west half `west_fill`, east half `east_fill` (split at split_lng)."""
    img = Image.new("RGBA", (100, 100), west_fill)
    split_x = int((split_lng - GEO.left_lon) / (GEO.right_lon - GEO.left_lon) * 100)
    for x in range(split_x, 100):
        for y in range(100):
            img.putpixel((x, y), east_fill)
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


RED = (255, 0, 0, 255)
CLEAR = (0, 0, 0, 0)
# Route heading east at lat 25, dry-east half now; rain sits west of 120.75.
EAST_ROUTE = [(25.0, 121.0), (25.0, 121.2)]
EASTWARD = Motion(dlat_per_s=0.0, dlng_per_s=0.001)  # rain field moving east


def test_static_sampling_ignores_incoming_rain():
    radar = _half_radar(RED, CLEAR)
    verdict, max_level, wet = classify_route(EAST_ROUTE, radar, interval_m=500.0)
    assert verdict == "no_raincoat_needed"
    assert wet == []


def test_nowcast_sees_rain_arriving_mid_ride():
    radar = _half_radar(RED, CLEAR)
    verdict, max_level, wet = classify_route(
        EAST_ROUTE, radar, interval_m=500.0, duration_s=1200.0, motion=EASTWARD
    )
    # Rain (moving east at 0.001°/s) reaches the rider's position for every
    # sample past ~25% of the ride: ETA > 5 min gets wet, start stays dry.
    assert verdict == "raincoat_recommended"
    assert max_level == RainLevel.HEAVY
    assert len(wet) > 0
    etas = [w.eta_min for w in wet]
    assert all(e is not None for e in etas)
    assert 4 <= min(etas) <= 7
    assert max(etas) == 20


def test_nowcast_sees_rain_leaving_before_arrival():
    radar = _half_radar(CLEAR, RED)  # rain on the route now, moving east/away
    verdict, max_level, wet = classify_route(
        EAST_ROUTE, radar, interval_m=500.0, duration_s=1200.0, motion=EASTWARD
    )
    # Only the first ~5 minutes still catch the departing rain.
    assert len(wet) > 0
    assert max(w.eta_min for w in wet) <= 7


def test_duration_without_motion_keeps_static_field_but_reports_eta():
    radar = _radar(RED)
    _, _, wet = classify_route(EAST_ROUTE, radar, interval_m=500.0, duration_s=1200.0)
    assert wet[0].eta_min == 0
    assert wet[-1].eta_min == 20


def test_no_duration_reports_no_eta():
    radar = _radar(RED)
    _, _, wet = classify_route(EAST_ROUTE, radar, interval_m=500.0)
    assert all(w.eta_min is None for w in wet)


def test_light_only_no_raincoat_but_segments_reported():
    radar = _radar((0, 236, 236, 255))  # cyan = light
    line = [(25.0, 121.0), (25.05, 121.0)]
    verdict, max_level, wet = classify_route(line, radar, interval_m=500.0)
    assert verdict == "no_raincoat_needed"
    assert max_level == RainLevel.LIGHT
    assert len(wet) >= 1  # light rain still surfaced to the user
