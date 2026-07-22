from unittest.mock import AsyncMock, patch
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.models import GeoBox, GeocodeCandidate, RouteResponse
from app.classify import RadarImage

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


def test_rain_endpoint_heavy():
    radar = RadarImage(image=Image.new("RGBA", (50, 50), (255, 0, 0, 255)),
                       geo=GEO, time="2026-07-21T14:30:00+08:00")
    fake_client = AsyncMock()
    fake_client.fetch = AsyncMock(return_value=radar)
    with patch("app.main.get_radar_client", return_value=fake_client):
        resp = client.post("/rain", json={"polyline": [[25.0, 121.0], [25.05, 121.0]]})
    body = resp.json()
    assert body["verdict"] == "raincoat_recommended"
    assert body["max_level"] == "heavy"
    assert body["overlay"]["bbox"] == [115.0, 17.75, 126.5, 29.25]
    assert body["overlay"]["image_url"] == "/radar.png"
    assert body["radar_time"] == "2026-07-21T14:30:00+08:00"
