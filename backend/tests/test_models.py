from app.models import RainLevel, LatLng, RainResponse, Overlay


def test_rain_level_ordering():
    assert RainLevel.NONE < RainLevel.LIGHT < RainLevel.MODERATE < RainLevel.HEAVY
    assert max([RainLevel.LIGHT, RainLevel.HEAVY, RainLevel.NONE]) == RainLevel.HEAVY


def test_latlng_roundtrip():
    p = LatLng(lat=25.04, lng=121.51)
    assert p.lat == 25.04 and p.lng == 121.51


def test_rain_response_serialises():
    r = RainResponse(
        verdict="no_raincoat_needed",
        max_level="none",
        wet_segments=[],
        radar_time="2026-07-21T14:30:00+08:00",
        overlay=Overlay(image_url="http://x/radar.png", bbox=(115.0, 17.75, 126.5, 29.25)),
    )
    assert r.model_dump()["overlay"]["bbox"] == (115.0, 17.75, 126.5, 29.25)
