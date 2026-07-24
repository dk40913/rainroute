import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.config import get_settings
from app.deps import get_radar_client
from app.models import (
    GeocodeRequest, RouteRequest, RainRequest, RouteResponse,
    RainResponse, Overlay, OverlayResponse,
)
from app.geocode import geocode
from app.routing import plan_route, RouteNotFoundError
from app.classify import classify_route

app = FastAPI(title="RainRoute API")

# Configure CORS
settings = get_settings()
allow_origins = ["*"] if settings.cors_origins == "*" else [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(httpx.HTTPError)
async def httpx_error_handler(request: Request, exc: httpx.HTTPError) -> JSONResponse:
    try:
        host = exc.request.url.host
    except RuntimeError:
        host = None
    detail = f"upstream service error ({host})" if host else "upstream service error"
    return JSONResponse(status_code=502, content={"detail": detail})


@app.exception_handler(RouteNotFoundError)
async def route_not_found_handler(request: Request, exc: RouteNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": "no route found between origin and destination"})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/radar.png")
async def radar_png() -> Response:
    radar = await get_radar_client().fetch()
    return Response(content=radar.png_bytes, media_type="image/png")


@app.get("/overlay", response_model=OverlayResponse)
async def overlay_endpoint() -> OverlayResponse:
    radar = await get_radar_client().fetch()
    geo = radar.geo
    return OverlayResponse(
        image_url="/radar.png",
        bbox=(geo.left_lon, geo.bottom_lat, geo.right_lon, geo.top_lat),
        radar_time=radar.time,
    )


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
    radar_client = get_radar_client()
    radar = await radar_client.fetch()
    motion = radar_client.motion()
    verdict, max_level, wet, rain_nearby = classify_route(
        req.polyline, radar, settings.sample_interval_m,
        duration_s=req.duration_s, motion=motion,
    )
    geo = radar.geo
    overlay = Overlay(
        image_url="/radar.png",
        bbox=(geo.left_lon, geo.bottom_lat, geo.right_lon, geo.top_lat),
    )
    wet_etas = [w.eta_min for w in wet if w.eta_min is not None]
    return RainResponse(
        verdict=verdict,
        max_level=max_level.label,
        wet_segments=wet,
        radar_time=radar.time,
        overlay=overlay,
        nowcast=motion is not None and req.duration_s is not None,
        rain_start_min=min(wet_etas) if wet_etas else None,
        rain_end_min=max(wet_etas) if wet_etas else None,
        rain_nearby=rain_nearby,
    )
