import httpx

from app.config import Settings
from app.models import LatLng, RouteResponse


async def plan_route(origin: LatLng, destination: LatLng, settings: Settings) -> RouteResponse:
    body = {"coordinates": [[origin.lng, origin.lat], [destination.lng, destination.lat]]}
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.post(
            f"{settings.ors_base_url}/v2/directions/driving-car/geojson",
            json=body,
            headers={"Authorization": settings.ors_api_key},
        )
        resp.raise_for_status()
        data = resp.json()
    feat = data["features"][0]
    coords = feat["geometry"]["coordinates"]  # [lng, lat]
    polyline = [(c[1], c[0]) for c in coords]
    summary = feat["properties"]["summary"]
    return RouteResponse(polyline=polyline, distance_m=summary["distance"], duration_s=summary["duration"])
