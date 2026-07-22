import httpx

from app.config import Settings
from app.models import LatLng, RouteResponse


class RouteNotFoundError(Exception):
    pass


async def plan_route(origin: LatLng, destination: LatLng, settings: Settings) -> RouteResponse:
    if settings.routing_backend == "osrm":
        return await _plan_route_osrm(origin, destination, settings)
    return await _plan_route_ors(origin, destination, settings)


async def _plan_route_ors(origin: LatLng, destination: LatLng, settings: Settings) -> RouteResponse:
    body = {"coordinates": [[origin.lng, origin.lat], [destination.lng, destination.lat]]}
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.post(
            f"{settings.ors_base_url}/v2/directions/driving-car/geojson",
            json=body,
            headers={"Authorization": settings.ors_api_key},
        )
        resp.raise_for_status()
        data = resp.json()
    if not data.get("features"):
        raise RouteNotFoundError()
    feat = data["features"][0]
    coords = feat["geometry"]["coordinates"]  # [lng, lat]
    polyline = [(c[1], c[0]) for c in coords]
    summary = feat["properties"]["summary"]
    return RouteResponse(polyline=polyline, distance_m=summary["distance"], duration_s=summary["duration"])


async def _plan_route_osrm(origin: LatLng, destination: LatLng, settings: Settings) -> RouteResponse:
    # Key-less public server; coordinates are lng,lat pairs in the path.
    path = f"{origin.lng},{origin.lat};{destination.lng},{destination.lat}"
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.get(
            f"{settings.osrm_base_url}/route/v1/driving/{path}",
            params={"overview": "full", "geometries": "geojson"},
        )
        resp.raise_for_status()
        data = resp.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RouteNotFoundError()
    route = data["routes"][0]
    coords = route["geometry"]["coordinates"]  # [lng, lat]
    polyline = [(c[1], c[0]) for c in coords]
    return RouteResponse(polyline=polyline, distance_m=route["distance"], duration_s=route["duration"])
