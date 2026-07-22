import asyncio
import httpx
import respx

from app.config import Settings
from app.geocode import geocode

NOMINATIM_JSON = [
    {"display_name": "台北車站, 中正區, 臺北市", "lat": "25.0478", "lon": "121.5170"},
    {"display_name": "台北車站 (公車), 臺北市", "lat": "25.0466", "lon": "121.5150"},
]


@respx.mock
def test_geocode_returns_candidates():
    route = respx.get("https://nominatim.openstreetmap.org/search").mock(
        return_value=httpx.Response(200, json=NOMINATIM_JSON)
    )
    out = asyncio.run(geocode("台北車站", Settings(nominatim_user_agent="rainroute-test")))
    assert out[0].name.startswith("台北車站")
    assert out[0].lat == 25.0478 and out[0].lng == 121.5170
    assert route.calls.last.request.headers["user-agent"] == "rainroute-test"
    assert route.calls.last.request.url.params["accept-language"] == "zh-TW"
