from io import BytesIO
from unittest.mock import AsyncMock, patch
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.models import GeoBox
from app.classify import RadarImage

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)


def _png_bytes(image: Image.Image) -> bytes:
    buf = BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def test_radar_png_streams_image():
    image = Image.new("RGBA", (20, 20), (0, 255, 0, 255))
    radar = RadarImage(image=image, geo=GEO, time="t", png_bytes=_png_bytes(image))
    fake_client = AsyncMock()
    fake_client.fetch = AsyncMock(return_value=radar)
    with patch("app.main.get_radar_client", return_value=fake_client):
        resp = TestClient(app).get("/radar.png")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"
