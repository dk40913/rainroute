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


# Fixture matching the REAL O-A0058-003 response recorded on 2026-07-22
# (irrelevant fields trimmed). Keep _parse_geo/_image_url/_issue_time in sync.
META = {
    "cwaopendata": {
        "dataid": "O-A0058-003",
        "dataset": {
            "datasetInfo": {
                "datasetDescription": "資料說明",
                "parameterSet": {
                    "LongitudeRange": "118.0-124.0",
                    "LatitudeRange": "20.5-26.5",
                    "ImageDimension": "3600x3600",
                },
            },
            "resource": {
                "resourceDesc": "雷達整合回波圖-臺灣(鄰近地區)_無地形",
                "mimeType": "image/png",
                "ProductURL": "https://cwa.example/radar.png",
            },
            "DateTime": "2026-07-21T14:30:00+08:00",
        },
    }
}


def _clock():
    t = {"v": 1000.0}
    def now():
        return t["v"]
    return t, now


@respx.mock
def test_fetch_builds_radar_image():
    raw = _png_bytes((255, 0, 0, 255))
    respx.get("https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/O-A0058-003").mock(
        return_value=httpx.Response(200, json=META)
    )
    respx.get("https://cwa.example/radar.png").mock(
        return_value=httpx.Response(200, content=raw)
    )
    client = RadarClient(Settings(cwa_api_key="k"))
    import asyncio
    radar = asyncio.run(client.fetch())
    assert radar.geo.left_lon == 118.0 and radar.geo.right_lon == 124.0
    assert radar.geo.top_lat == 26.5 and radar.geo.bottom_lat == 20.5
    assert radar.time == "2026-07-21T14:30:00+08:00"
    assert radar.image.getpixel((0, 0))[:3] == (255, 0, 0)
    assert radar.png_bytes == raw


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
