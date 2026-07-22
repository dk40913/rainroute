import asyncio
import httpx
import respx

from app.config import Settings
from app.models import LatLng
from app.routing import plan_route

ORS_JSON = {
    "features": [
        {
            "geometry": {"type": "LineString",
                         "coordinates": [[121.5170, 25.0478], [121.5300, 25.0600]]},
            "properties": {"summary": {"distance": 1850.0, "duration": 300.0}},
        }
    ]
}


@respx.mock
def test_plan_route_swaps_to_latlng():
    respx.post(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
    ).mock(return_value=httpx.Response(200, json=ORS_JSON))
    out = asyncio.run(
        plan_route(LatLng(lat=25.0478, lng=121.5170),
                   LatLng(lat=25.0600, lng=121.5300),
                   Settings(ors_api_key="k"))
    )
    assert out.polyline[0] == (25.0478, 121.5170)  # (lat, lng)
    assert out.distance_m == 1850.0 and out.duration_s == 300.0
