from unittest.mock import AsyncMock, patch
import httpx
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.models import GeoBox, GeocodeCandidate, Motion, RouteResponse
from app.classify import RadarImage
from app.routing import RouteNotFoundError

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)
client = TestClient(app)


def test_geocode_endpoint():
    with patch("app.main.geocode", new=AsyncMock(return_value=[
        GeocodeCandidate(name="台北車站", lat=25.0478, lng=121.517)
    ])):
        resp = client.post("/geocode", json={"query": "台北車站"})
    assert resp.status_code == 200
    assert resp.json()["candidates"][0]["name"] == "台北車站"


def test_route_endpoint():
    fake = RouteResponse(polyline=[(25.0, 121.0), (25.05, 121.0)], distance_m=1000.0, duration_s=200.0)
    with patch("app.main.plan_route", new=AsyncMock(return_value=fake)):
        resp = client.post("/route", json={
            "origin": {"lat": 25.0, "lng": 121.0},
            "destination": {"lat": 25.05, "lng": 121.0},
        })
    assert resp.status_code == 200
    assert resp.json()["distance_m"] == 1000.0


def test_route_endpoint_upstream_error():
    with patch("app.main.plan_route", new=AsyncMock(side_effect=httpx.ConnectError("boom"))):
        resp = client.post("/route", json={
            "origin": {"lat": 25.0, "lng": 121.0},
            "destination": {"lat": 25.05, "lng": 121.0},
        })
    assert resp.status_code == 502


def test_route_endpoint_no_route_found():
    with patch("app.main.plan_route", new=AsyncMock(side_effect=RouteNotFoundError())):
        resp = client.post("/route", json={
            "origin": {"lat": 25.0, "lng": 121.0},
            "destination": {"lat": 25.05, "lng": 121.0},
        })
    assert resp.status_code == 422


def _fake_radar_client(radar, motion=None):
    fake = AsyncMock()
    fake.fetch = AsyncMock(return_value=radar)
    fake.motion = lambda: motion
    return fake


def test_rain_endpoint_heavy():
    radar = RadarImage(image=Image.new("RGBA", (50, 50), (255, 0, 0, 255)),
                       geo=GEO, time="2026-07-21T14:30:00+08:00")
    with patch("app.main.get_radar_client", return_value=_fake_radar_client(radar)):
        resp = client.post("/rain", json={"polyline": [[25.0, 121.0], [25.05, 121.0]]})
    body = resp.json()
    assert body["verdict"] == "raincoat_recommended"
    assert body["max_level"] == "heavy"
    assert body["overlay"]["bbox"] == [115.0, 17.75, 126.5, 29.25]
    assert body["overlay"]["image_url"] == "/radar.png"
    assert body["radar_time"] == "2026-07-21T14:30:00+08:00"
    assert body["nowcast"] is False
    assert body["rain_start_min"] is None


def test_rain_endpoint_with_duration_and_motion_reports_rain_window():
    radar = RadarImage(image=Image.new("RGBA", (50, 50), (255, 0, 0, 255)),
                       geo=GEO, time="2026-07-21T14:30:00+08:00")
    fake = _fake_radar_client(radar, motion=Motion(dlat_per_s=0.0, dlng_per_s=0.0))
    with patch("app.main.get_radar_client", return_value=fake):
        resp = client.post("/rain", json={
            "polyline": [[25.0, 121.0], [25.05, 121.0]],
            "duration_s": 1200,
        })
    body = resp.json()
    assert body["nowcast"] is True
    assert body["rain_start_min"] == 0
    assert body["rain_end_min"] == 20
    assert body["wet_segments"][0]["eta_min"] == 0


def test_rain_endpoint_duration_without_motion_still_reports_window():
    radar = RadarImage(image=Image.new("RGBA", (50, 50), (255, 0, 0, 255)),
                       geo=GEO, time="2026-07-21T14:30:00+08:00")
    with patch("app.main.get_radar_client", return_value=_fake_radar_client(radar)):
        resp = client.post("/rain", json={
            "polyline": [[25.0, 121.0], [25.05, 121.0]],
            "duration_s": 1200,
        })
    body = resp.json()
    assert body["nowcast"] is False  # cold start: fewer than two frames yet
    assert body["rain_start_min"] == 0
    assert body["rain_end_min"] == 20


def test_overlay_endpoint():
    radar = RadarImage(image=Image.new("RGBA", (50, 50), (0, 0, 0, 0)),
                       geo=GEO, time="2026-07-21T14:30:00+08:00")
    fake_client = AsyncMock()
    fake_client.fetch = AsyncMock(return_value=radar)
    with patch("app.main.get_radar_client", return_value=fake_client):
        resp = client.get("/overlay")
    assert resp.status_code == 200
    body = resp.json()
    assert body["image_url"] == "/radar.png"
    assert body["bbox"] == [115.0, 17.75, 126.5, 29.25]
    assert body["radar_time"] == "2026-07-21T14:30:00+08:00"


def test_lifespan_starts_and_stops_radar_warmer():
    radar = RadarImage(image=Image.new("RGBA", (50, 50), (0, 0, 0, 0)),
                       geo=GEO, time="2026-07-21T14:30:00+08:00")
    fake = _fake_radar_client(radar)
    with patch("app.main.get_radar_client", return_value=fake):
        with TestClient(app):
            pass  # entering runs lifespan startup, exiting cancels the warmer
    assert fake.fetch.await_count >= 1


def test_cors_headers():
    """Test that CORS headers are present in response."""
    resp = client.get("/health", headers={"origin": "http://example.com"})
    assert resp.status_code == 200
    assert "access-control-allow-origin" in resp.headers
    assert resp.headers["access-control-allow-origin"] == "*"
