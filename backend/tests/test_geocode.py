import asyncio
from unittest.mock import patch

import httpx
import respx

from app.config import Settings
from app.geocode import expand_query, geocode

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


def test_expand_query_station_suffix():
    assert expand_query("淡水捷運站") == ["淡水捷運站", "捷運淡水站"]


def test_expand_query_station_prefix():
    assert expand_query("捷運淡水站") == ["捷運淡水站", "淡水捷運站"]


def test_expand_query_no_match():
    assert expand_query("台北車站") == ["台北車站"]


def test_expand_query_empty_x_no_variant():
    assert expand_query("捷運站") == ["捷運站"]


@respx.mock
def test_geocode_merges_and_dedupes_expanded_queries():
    original_json = [
        {"display_name": "淡水捷運站, 淡水區, 新北市", "lat": "25.16758", "lon": "121.44881"},
        {"display_name": "淡水第二號出口, 新北市", "lat": "25.16800", "lon": "121.44900"},
    ]
    variant_json = [
        # duplicate coords with the original's first result (rounded to 5dp)
        {"display_name": "捷運淡水站, 淡水區, 新北市", "lat": "25.167581", "lon": "121.448809"},
        {"display_name": "捷運淡水站(出口), 新北市", "lat": "25.16900", "lon": "121.45000"},
    ]

    def responder(request: httpx.Request) -> httpx.Response:
        q = request.url.params["q"]
        if q == "淡水捷運站":
            return httpx.Response(200, json=original_json)
        elif q == "捷運淡水站":
            return httpx.Response(200, json=variant_json)
        return httpx.Response(200, json=[])

    route = respx.get("https://nominatim.openstreetmap.org/search").mock(side_effect=responder)

    with patch("app.geocode.asyncio.sleep") as mock_sleep:
        out = asyncio.run(
            geocode("淡水捷運站", Settings(nominatim_user_agent="rainroute-test"))
        )

    # merged: original results first, then variant results, deduped by rounded coords, capped at 5
    assert len(out) == 3
    assert out[0].name.startswith("淡水捷運站")
    assert out[1].name.startswith("淡水第二號出口")
    assert out[2].name.startswith("捷運淡水站(出口)")

    # sleep called between the two sequential requests (not before the first)
    mock_sleep.assert_called_once_with(1)

    # both requests carry the User-Agent + accept-language params
    assert len(route.calls) == 2
    for call in route.calls:
        assert call.request.headers["user-agent"] == "rainroute-test"
        assert call.request.url.params["accept-language"] == "zh-TW"
