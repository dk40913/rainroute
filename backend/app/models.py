from dataclasses import dataclass
from enum import IntEnum
from pydantic import BaseModel


class RainLevel(IntEnum):
    NONE = 0
    LIGHT = 1
    MODERATE = 2
    HEAVY = 3

    @property
    def label(self) -> str:
        return self.name.lower()


class LatLng(BaseModel):
    lat: float
    lng: float


class GeoBox(BaseModel):
    left_lon: float
    right_lon: float
    top_lat: float
    bottom_lat: float


@dataclass(frozen=True)
class Motion:
    """Rain-field velocity in degrees per second (east and north positive)."""
    dlat_per_s: float
    dlng_per_s: float


class GeocodeRequest(BaseModel):
    query: str


class GeocodeCandidate(BaseModel):
    name: str
    lat: float
    lng: float
    # True when the query only resolved via progressive address fallback
    # (e.g. lane/house number stripped) — the location is approximate.
    approximate: bool = False


class RouteRequest(BaseModel):
    origin: LatLng
    destination: LatLng


class RouteResponse(BaseModel):
    polyline: list[tuple[float, float]]
    distance_m: float
    duration_s: float


class RainRequest(BaseModel):
    polyline: list[tuple[float, float]]
    # Route duration from /route; enables arrival-time (nowcast) sampling.
    duration_s: float | None = None


class WetSegment(BaseModel):
    index: int
    lat: float
    lng: float
    level: str
    # Minutes after departure the rider reaches this point; only set when the
    # rain request included the route duration.
    eta_min: int | None = None


class Overlay(BaseModel):
    image_url: str
    bbox: tuple[float, float, float, float]  # (west, south, east, north)


class MotionVector(BaseModel):
    dlat_per_s: float
    dlng_per_s: float


class OverlayResponse(Overlay):
    radar_time: str


class RainResponse(BaseModel):
    verdict: str
    max_level: str
    wet_segments: list[WetSegment]
    radar_time: str
    overlay: Overlay
    # True when the verdict used arrival-time advection (needs duration_s in
    # the request plus two radar frames of motion history on the server).
    nowcast: bool = False
    rain_start_min: int | None = None
    rain_end_min: int | None = None
    # Route itself is dry but echo exists within ~2 km of it — nearby cells
    # can drift or grow onto the route within a ride.
    rain_nearby: bool = False
    # Estimated rain-field velocity (deg/s); lets clients animate the overlay.
    motion: MotionVector | None = None
