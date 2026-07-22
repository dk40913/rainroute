import httpx
import respx
from PIL import Image
from io import BytesIO

from app.config import Settings
from app.radar import RadarClient


def _png_bytes(color):
    buf = BytesIO()
    Image.new("RGBA", (10, 10), color).save(buf, format="PNG")
    return buf.getvalue()


# Fixture shaped like the recorded CWA response. Adjust field names to match
# the real API when you verify it, and keep _parse_geo/_image_url in sync.
META = {
    "cwaopendata": {
        "dataset": {
            "datasetInfo": {"datasetDescription": "雷達整合回波圖-臺灣",
                             "issueTime": "2026-07-21T14:30:00+08:00"},
            "resource": {"ProductURL": "https://cwa.example/radar.png"},
            "GeoInfo": {"LeftLongitude": "115.00", "RightLongitude": "126.50",
                        "TopLatitude": "29.25", "BottomLatitude": "17.75"},
        }
    }
}


def _clock():
    t = {"v": 1000.0}
    def now():
        return t["v"]
    return t, now


@respx.mock
def test_fetch_builds_radar_image():
    respx.get("https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/O-A0058-003").mock(
        return_value=httpx.Response(200, json=META)
    )
    respx.get("https://cwa.example/radar.png").mock(
        return_value=httpx.Response(200, content=_png_bytes((255, 0, 0, 255)))
    )
    client = RadarClient(Settings(cwa_api_key="k"))
    import asyncio
    radar = asyncio.run(client.fetch())
    assert radar.geo.left_lon == 115.0 and radar.geo.bottom_lat == 17.75
    assert radar.time == "2026-07-21T14:30:00+08:00"
    assert radar.image.getpixel((0, 0))[:3] == (255, 0, 0)


@respx.mock
def test_cache_prevents_second_download():
    meta_route = respx.get(
        "https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/O-A0058-003"
    ).mock(return_value=httpx.Response(200, json=META))
    respx.get("https://cwa.example/radar.png").mock(
        return_value=httpx.Response(200, content=_png_bytes((0, 0, 0, 0)))
    )
    t, now = _clock()
    client = RadarClient(Settings(cwa_api_key="k", radar_cache_ttl_s=600), now=now)
    import asyncio
    asyncio.run(client.fetch())
    t["v"] += 100  # within TTL
    asyncio.run(client.fetch())
    assert meta_route.call_count == 1  # served from cache
    t["v"] += 600  # past TTL
    asyncio.run(client.fetch())
    assert meta_route.call_count == 2  # refetched
