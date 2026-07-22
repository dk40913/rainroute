from io import BytesIO
from fastapi import FastAPI
from fastapi.responses import Response

from app.config import get_settings
from app.deps import get_radar_client
from app.models import (
    GeocodeRequest, RouteRequest, RainRequest, RouteResponse,
    RainResponse, Overlay,
)
from app.geocode import geocode
from app.routing import plan_route
from app.classify import classify_route

app = FastAPI(title="RainRoute API")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/radar.png")
async def radar_png() -> Response:
    radar = await get_radar_client().fetch()
    buf = BytesIO()
    radar.image.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@app.post("/geocode")
async def geocode_endpoint(req: GeocodeRequest):
    candidates = await geocode(req.query, get_settings())
    return {"candidates": candidates}


@app.post("/route", response_model=RouteResponse)
async def route_endpoint(req: RouteRequest) -> RouteResponse:
    return await plan_route(req.origin, req.destination, get_settings())


@app.post("/rain", response_model=RainResponse)
async def rain_endpoint(req: RainRequest) -> RainResponse:
    settings = get_settings()
    radar = await get_radar_client().fetch()
    verdict, max_level, wet = classify_route(req.polyline, radar, settings.sample_interval_m)
    geo = radar.geo
    overlay = Overlay(
        image_url="/radar.png",
        bbox=(geo.left_lon, geo.bottom_lat, geo.right_lon, geo.top_lat),
    )
    return RainResponse(
        verdict=verdict,
        max_level=max_level.label,
        wet_segments=wet,
        radar_time=radar.time,
        overlay=overlay,
    )
