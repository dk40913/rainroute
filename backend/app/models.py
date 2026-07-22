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


class GeocodeRequest(BaseModel):
    query: str


class GeocodeCandidate(BaseModel):
    name: str
    lat: float
    lng: float


class RouteRequest(BaseModel):
    origin: LatLng
    destination: LatLng


class RouteResponse(BaseModel):
    polyline: list[tuple[float, float]]
    distance_m: float
    duration_s: float


class RainRequest(BaseModel):
    polyline: list[tuple[float, float]]


class WetSegment(BaseModel):
    index: int
    lat: float
    lng: float
    level: str


class Overlay(BaseModel):
    image_url: str
    bbox: tuple[float, float, float, float]  # (west, south, east, north)


class RainResponse(BaseModel):
    verdict: str
    max_level: str
    wet_segments: list[WetSegment]
    radar_time: str
    overlay: Overlay
