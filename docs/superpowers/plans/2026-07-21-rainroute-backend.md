# RainRoute Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Python FastAPI backend that geocodes addresses, plans a route, samples an CWA radar image along that route, and returns a "wear a raincoat or not" verdict plus a rain overlay for the map.

**Architecture:** FastAPI app exposing `/health`, `/geocode`, `/route`, `/rain`. All external keys live in env vars. Pure functions (geometry, pixel mapping, colour→rain-level, verdict) are unit-tested with pytest; HTTP clients (Nominatim, OpenRouteService, CWA radar) are tested against mocked `httpx` responses. The CWA radar image is fetched and cached (~10 min) and sampled with Pillow.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, httpx (async), Pillow, pydantic v2, pydantic-settings, pytest, pytest-asyncio, respx (httpx mocking).

## Global Constraints

- Python **3.11+**.
- **No secret may be hard-coded.** CWA/ORS keys, Nominatim user-agent, host/port, cache TTL all come from env vars via `app/config.py`. A hard-coded URL, path, or key is a bug.
- Rain levels are an ordered enum: `NONE=0 < LIGHT=1 < MODERATE=2 < HEAVY=3`.
- Verdict rule: `raincoat_recommended` iff any route sample is `>= MODERATE`; otherwise `no_raincoat_needed`.
- Coordinates are always `(lat, lng)` tuples, in that order, degrees.
- The radar geo-bounds come from the CWA response metadata at runtime; the numbers in this plan (`lon 115.00–126.50`, `lat 17.75–29.25`) are defaults/validation baselines only, never the source of truth.
- All code is `async` where it does I/O. Pure functions stay sync.
- Every task ends with a commit.

---

### Task 1: Project scaffold, config, health endpoint

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Create: `backend/.env.example`
- Create: `backend/tests/__init__.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `app.config.Settings` (pydantic-settings) with fields `cwa_api_key: str`, `ors_api_key: str`, `nominatim_user_agent: str`, `nominatim_base_url: str`, `ors_base_url: str`, `radar_cache_ttl_s: int = 600`, `sample_interval_m: float = 500.0`. `get_settings()` returns a cached `Settings`.
- Produces: `app.main.app` (FastAPI instance) with `GET /health -> {"status": "ok"}`.

- [ ] **Step 1: Write `backend/pyproject.toml`**

```toml
[project]
name = "rainroute-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "httpx>=0.27",
    "pillow>=10.0",
    "pydantic>=2.6",
    "pydantic-settings>=2.2",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "respx>=0.21", "asgi-lifespan>=2.1"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 2: Write `backend/app/config.py`**

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RAINROUTE_")

    cwa_api_key: str = ""
    ors_api_key: str = ""
    nominatim_user_agent: str = "rainroute-dev (set-me@example.com)"
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    ors_base_url: str = "https://api.openrouteservice.org"
    radar_cache_ttl_s: int = 600
    sample_interval_m: float = 500.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: Write `backend/.env.example`**

```bash
RAINROUTE_CWA_API_KEY=CWA-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
RAINROUTE_ORS_API_KEY=your-openrouteservice-key
RAINROUTE_NOMINATIM_USER_AGENT=rainroute (you@example.com)
# Optional overrides:
# RAINROUTE_RADAR_CACHE_TTL_S=600
# RAINROUTE_SAMPLE_INTERVAL_M=500
```

- [ ] **Step 4: Write `backend/app/main.py` and `backend/app/__init__.py`**

`backend/app/__init__.py`: empty file.

`backend/app/main.py`:
```python
from fastapi import FastAPI

app = FastAPI(title="RainRoute API")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

`backend/tests/__init__.py`: empty file.

- [ ] **Step 5: Write the failing test `backend/tests/test_health.py`**

```python
from fastapi.testclient import TestClient
from app.main import app


def test_health_ok():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 6: Install deps and run the test**

Run:
```bash
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
pytest tests/test_health.py -v
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffold FastAPI app with config and health endpoint"
```

---

### Task 2: Domain models and rain-level enum

**Files:**
- Create: `backend/app/models.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces: `RainLevel(IntEnum)` = `NONE=0, LIGHT=1, MODERATE=2, HEAVY=3`.
- Produces pydantic models: `LatLng(lat: float, lng: float)`; `GeoBox(left_lon, right_lon, top_lat, bottom_lat: float)`; `GeocodeRequest(query: str)`; `GeocodeCandidate(name: str, lat: float, lng: float)`; `RouteRequest(origin: LatLng, destination: LatLng)`; `RouteResponse(polyline: list[tuple[float, float]], distance_m: float, duration_s: float)`; `RainRequest(polyline: list[tuple[float, float]])`; `WetSegment(index: int, lat: float, lng: float, level: str)`; `Overlay(image_url: str, bbox: tuple[float, float, float, float])`; `RainResponse(verdict: str, max_level: str, wet_segments: list[WetSegment], radar_time: str, overlay: Overlay)`.
- `bbox` order is `(west, south, east, north)`.

- [ ] **Step 1: Write the failing test `backend/tests/test_models.py`**

```python
from app.models import RainLevel, LatLng, RainResponse, Overlay


def test_rain_level_ordering():
    assert RainLevel.NONE < RainLevel.LIGHT < RainLevel.MODERATE < RainLevel.HEAVY
    assert max([RainLevel.LIGHT, RainLevel.HEAVY, RainLevel.NONE]) == RainLevel.HEAVY


def test_latlng_roundtrip():
    p = LatLng(lat=25.04, lng=121.51)
    assert p.lat == 25.04 and p.lng == 121.51


def test_rain_response_serialises():
    r = RainResponse(
        verdict="no_raincoat_needed",
        max_level="none",
        wet_segments=[],
        radar_time="2026-07-21T14:30:00+08:00",
        overlay=Overlay(image_url="http://x/radar.png", bbox=(115.0, 17.75, 126.5, 29.25)),
    )
    assert r.model_dump()["overlay"]["bbox"] == (115.0, 17.75, 126.5, 29.25)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_models.py -v`
Expected: FAIL with `ModuleNotFoundError: app.models`.

- [ ] **Step 3: Write `backend/app/models.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/tests/test_models.py
git commit -m "feat(backend): add domain models and RainLevel enum"
```

---

### Task 3: Geometry — haversine distance and polyline resampling

**Files:**
- Create: `backend/app/geometry.py`
- Test: `backend/tests/test_geometry.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float` (points are `(lat, lng)`).
- Produces: `resample_polyline(polyline: list[tuple[float, float]], interval_m: float) -> list[tuple[float, float]]` — returns points spaced ~`interval_m` apart along the path, always including the first and last vertex. A single-point input returns that point; empty input returns `[]`.

- [ ] **Step 1: Write the failing test `backend/tests/test_geometry.py`**

```python
import math
from app.geometry import haversine_m, resample_polyline


def test_haversine_known_distance():
    # ~1 deg latitude ≈ 111 km
    d = haversine_m((25.0, 121.0), (26.0, 121.0))
    assert 110_000 < d < 112_000


def test_haversine_zero():
    assert haversine_m((25.0, 121.0), (25.0, 121.0)) == 0.0


def test_resample_includes_endpoints():
    line = [(25.0, 121.0), (25.1, 121.0)]  # ~11.1 km north
    pts = resample_polyline(line, interval_m=1000.0)
    assert pts[0] == (25.0, 121.0)
    assert pts[-1] == (25.1, 121.0)
    # ~11.1 km at 1 km spacing -> ~12 points
    assert 10 <= len(pts) <= 14


def test_resample_spacing_roughly_uniform():
    line = [(25.0, 121.0), (25.1, 121.0)]
    pts = resample_polyline(line, interval_m=1000.0)
    gaps = [haversine_m(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    # every interior gap is close to 1000 m (last one may be shorter)
    assert all(g <= 1100 for g in gaps)


def test_resample_edge_cases():
    assert resample_polyline([], 500.0) == []
    assert resample_polyline([(25.0, 121.0)], 500.0) == [(25.0, 121.0)]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_geometry.py -v`
Expected: FAIL with `ModuleNotFoundError: app.geometry`.

- [ ] **Step 3: Write `backend/app/geometry.py`**

```python
import math

_EARTH_R = 6_371_000.0  # metres


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_R * math.asin(math.sqrt(h))


def _interpolate(a, b, frac):
    return (a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac)


def resample_polyline(polyline, interval_m):
    if len(polyline) <= 1:
        return list(polyline)

    out = [polyline[0]]
    carry = 0.0  # distance already covered since last emitted point
    for seg_start, seg_end in zip(polyline, polyline[1:]):
        seg_len = haversine_m(seg_start, seg_end)
        if seg_len == 0:
            continue
        dist_into = interval_m - carry
        while dist_into < seg_len:
            out.append(_interpolate(seg_start, seg_end, dist_into / seg_len))
            dist_into += interval_m
        carry = seg_len - (dist_into - interval_m)
    if out[-1] != polyline[-1]:
        out.append(polyline[-1])
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_geometry.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/geometry.py backend/tests/test_geometry.py
git commit -m "feat(backend): add haversine and polyline resampling"
```

---

### Task 4: Coordinate → pixel mapping

**Files:**
- Create: `backend/app/pixel.py`
- Test: `backend/tests/test_pixel.py`

**Interfaces:**
- Consumes: `app.models.GeoBox`.
- Produces: `latlng_to_pixel(lat: float, lng: float, geo: GeoBox, width: int, height: int) -> tuple[int, int]` returning integer `(x, y)` clamped to `[0, width-1] x [0, height-1]`.

- [ ] **Step 1: Write the failing test `backend/tests/test_pixel.py`**

```python
from app.models import GeoBox
from app.pixel import latlng_to_pixel

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)


def test_top_left_corner():
    assert latlng_to_pixel(29.25, 115.0, GEO, 3600, 3600) == (0, 0)


def test_bottom_right_corner():
    x, y = latlng_to_pixel(17.75, 126.5, GEO, 3600, 3600)
    assert x == 3599 and y == 3599  # clamped to width-1 / height-1


def test_centre():
    x, y = latlng_to_pixel((29.25 + 17.75) / 2, (115.0 + 126.5) / 2, GEO, 3600, 3600)
    assert 1795 <= x <= 1805 and 1795 <= y <= 1805


def test_out_of_bounds_clamped():
    assert latlng_to_pixel(90.0, 0.0, GEO, 3600, 3600) == (0, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_pixel.py -v`
Expected: FAIL with `ModuleNotFoundError: app.pixel`.

- [ ] **Step 3: Write `backend/app/pixel.py`**

```python
from app.models import GeoBox


def latlng_to_pixel(lat, lng, geo: GeoBox, width, height):
    fx = (lng - geo.left_lon) / (geo.right_lon - geo.left_lon)
    fy = (geo.top_lat - lat) / (geo.top_lat - geo.bottom_lat)
    x = min(width - 1, max(0, int(fx * width)))
    y = min(height - 1, max(0, int(fy * height)))
    return (x, y)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_pixel.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/pixel.py backend/tests/test_pixel.py
git commit -m "feat(backend): add latlng-to-pixel mapping"
```

---

### Task 5: Colour → rain level (radar palette lookup)

**Files:**
- Create: `backend/app/palette.py`
- Test: `backend/tests/test_palette.py`

**Interfaces:**
- Consumes: `app.models.RainLevel`.
- Produces: `PALETTE: list[tuple[tuple[int, int, int], RainLevel]]` (default CWA dBZ colours — **CALIBRATION REQUIRED**, see docstring).
- Produces: `pixel_to_level(pixel: tuple[int, ...], palette=PALETTE, max_dist: float = 100.0) -> RainLevel`. Handles RGB and RGBA; transparent (alpha < 128) or no near colour returns `RainLevel.NONE`.

- [ ] **Step 1: Write the failing test `backend/tests/test_palette.py`**

```python
from app.models import RainLevel
from app.palette import pixel_to_level, PALETTE


def test_exact_palette_colours_match():
    for rgb, level in PALETTE:
        assert pixel_to_level(rgb) == level


def test_transparent_is_none():
    assert pixel_to_level((0, 255, 0, 0)) == RainLevel.NONE  # green but fully transparent


def test_near_colour_snaps_to_nearest():
    green_rgb = next(rgb for rgb, lvl in PALETTE if lvl == RainLevel.MODERATE)
    nudged = (green_rgb[0] + 5, green_rgb[1] - 5, green_rgb[2] + 3)
    assert pixel_to_level(nudged) == RainLevel.MODERATE


def test_far_colour_is_none():
    assert pixel_to_level((123, 45, 200)) == RainLevel.NONE  # not near any echo colour
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_palette.py -v`
Expected: FAIL with `ModuleNotFoundError: app.palette`.

- [ ] **Step 3: Write `backend/app/palette.py`**

```python
from app.models import RainLevel

# Approximate CWA / QPESUMS radar reflectivity (dBZ) echo colours mapped to a
# coarse rain level. These are STARTING values — the implementer MUST calibrate
# against a real O-A0058 image (sample known pixels, compare to the legend) and
# adjust. Tests use this table as the source of truth, so they stay valid after
# recalibration as long as the structure is kept.
PALETTE: list[tuple[tuple[int, int, int], RainLevel]] = [
    ((0, 236, 236), RainLevel.LIGHT),      # ~15 dBZ cyan
    ((0, 160, 255), RainLevel.LIGHT),      # ~20 dBZ blue
    ((0, 255, 0), RainLevel.MODERATE),     # ~30 dBZ green
    ((255, 255, 0), RainLevel.MODERATE),   # ~35 dBZ yellow
    ((255, 144, 0), RainLevel.HEAVY),      # ~45 dBZ orange
    ((255, 0, 0), RainLevel.HEAVY),        # ~50 dBZ red
    ((214, 0, 214), RainLevel.HEAVY),      # ~60 dBZ magenta
]


def _dist2(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


def pixel_to_level(pixel, palette=PALETTE, max_dist=100.0):
    if len(pixel) >= 4 and pixel[3] < 128:
        return RainLevel.NONE
    rgb = tuple(pixel[:3])
    best_level, best_d2 = RainLevel.NONE, max_dist * max_dist
    for colour, level in palette:
        d2 = _dist2(rgb, colour)
        if d2 < best_d2:
            best_level, best_d2 = level, d2
    return best_level
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_palette.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/palette.py backend/tests/test_palette.py
git commit -m "feat(backend): add radar palette to rain-level lookup"
```

---

### Task 6: Radar image wrapper + route classification + verdict

**Files:**
- Create: `backend/app/classify.py`
- Test: `backend/tests/test_classify.py`

**Interfaces:**
- Consumes: `app.models` (GeoBox, RainLevel, WetSegment), `app.geometry.resample_polyline`, `app.pixel.latlng_to_pixel`, `app.palette.pixel_to_level`.
- Produces: `@dataclass RadarImage(image: PIL.Image.Image, geo: GeoBox, time: str)` with `level_at(self, lat, lng) -> RainLevel`.
- Produces: `classify_route(polyline, radar: RadarImage, interval_m: float) -> tuple[str, RainLevel, list[WetSegment]]` returning `(verdict, max_level, wet_segments)`. `verdict` is `"raincoat_recommended"` if `max_level >= MODERATE` else `"no_raincoat_needed"`. `wet_segments` lists samples with level `>= LIGHT`.

- [ ] **Step 1: Write the failing test `backend/tests/test_classify.py`**

```python
from PIL import Image
from app.models import GeoBox, RainLevel
from app.classify import RadarImage, classify_route

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)


def _radar(fill):
    img = Image.new("RGBA", (100, 100), fill)
    return RadarImage(image=img, geo=GEO, time="2026-07-21T14:30:00+08:00")


def test_clear_sky_no_raincoat():
    radar = _radar((0, 0, 0, 0))  # fully transparent = no echo
    line = [(25.0, 121.0), (25.05, 121.0)]
    verdict, max_level, wet = classify_route(line, radar, interval_m=500.0)
    assert verdict == "no_raincoat_needed"
    assert max_level == RainLevel.NONE
    assert wet == []


def test_heavy_rain_recommends_raincoat():
    radar = _radar((255, 0, 0, 255))  # red everywhere = heavy
    line = [(25.0, 121.0), (25.05, 121.0)]
    verdict, max_level, wet = classify_route(line, radar, interval_m=500.0)
    assert verdict == "raincoat_recommended"
    assert max_level == RainLevel.HEAVY
    assert len(wet) >= 1
    assert wet[0].level == "heavy"


def test_light_only_no_raincoat_but_segments_reported():
    radar = _radar((0, 236, 236, 255))  # cyan = light
    line = [(25.0, 121.0), (25.05, 121.0)]
    verdict, max_level, wet = classify_route(line, radar, interval_m=500.0)
    assert verdict == "no_raincoat_needed"
    assert max_level == RainLevel.LIGHT
    assert len(wet) >= 1  # light rain still surfaced to the user
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_classify.py -v`
Expected: FAIL with `ModuleNotFoundError: app.classify`.

- [ ] **Step 3: Write `backend/app/classify.py`**

```python
from dataclasses import dataclass
from PIL import Image

from app.models import GeoBox, RainLevel, WetSegment
from app.geometry import resample_polyline
from app.pixel import latlng_to_pixel
from app.palette import pixel_to_level


@dataclass
class RadarImage:
    image: Image.Image
    geo: GeoBox
    time: str

    def level_at(self, lat, lng) -> RainLevel:
        w, h = self.image.size
        x, y = latlng_to_pixel(lat, lng, self.geo, w, h)
        return pixel_to_level(self.image.getpixel((x, y)))


def classify_route(polyline, radar: RadarImage, interval_m: float):
    samples = resample_polyline(polyline, interval_m)
    max_level = RainLevel.NONE
    wet: list[WetSegment] = []
    for i, (lat, lng) in enumerate(samples):
        level = radar.level_at(lat, lng)
        if level > max_level:
            max_level = level
        if level >= RainLevel.LIGHT:
            wet.append(WetSegment(index=i, lat=lat, lng=lng, level=level.label))
    verdict = "raincoat_recommended" if max_level >= RainLevel.MODERATE else "no_raincoat_needed"
    return verdict, max_level, wet
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_classify.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/classify.py backend/tests/test_classify.py
git commit -m "feat(backend): add radar image wrapper and route classification"
```

---

### Task 7: CWA radar client with TTL cache

**Files:**
- Create: `backend/app/radar.py`
- Test: `backend/tests/test_radar.py`

**Interfaces:**
- Consumes: `app.config.Settings`, `app.classify.RadarImage`, `app.models.GeoBox`.
- Produces: `class RadarClient` with:
  - `__init__(self, settings: Settings, now: Callable[[], float] = time.monotonic)` — `now` is injectable for cache tests.
  - `async fetch(self) -> RadarImage` — returns a cached `RadarImage` if the last fetch is younger than `settings.radar_cache_ttl_s`, else downloads the CWA O-A0058 image, parses geo-bounds + time, builds a fresh `RadarImage`, caches it, and returns it.
  - `_parse_geo(self, meta: dict) -> GeoBox` and `_image_url(self, meta: dict) -> str` — extracted so the exact CWA JSON shape lives in one place.

> **Implementer note:** The CWA dataid, JSON field names for the image URL, geo-bounds, and time are **unverified in this plan**. Before writing `_parse_geo`/`_image_url`, hit the real API once (Swagger: https://opendata.cwa.gov.tw/dist/opendata-swagger.html), pick the O-A0058 "no-topography" variant, and record the real field names in the docstring. The test below uses a **fixture dict shaped like your recorded response** — adjust the fixture and parser together.

- [ ] **Step 1: Write the failing test `backend/tests/test_radar.py`**

```python
import httpx
import respx
from PIL import Image
from io import BytesIO

from app.config import Settings
from app.radar import RadarClient


def _png_bytes(color):
    buf = BytesIO()
    Image.new("RGBA", (10, 10), color).save(buf, format="PNG")
    return buf.getvalue()


# Fixture shaped like the recorded CWA response. Adjust field names to match
# the real API when you verify it, and keep _parse_geo/_image_url in sync.
META = {
    "cwaopendata": {
        "dataset": {
            "datasetInfo": {"datasetDescription": "雷達整合回波圖-臺灣",
                             "issueTime": "2026-07-21T14:30:00+08:00"},
            "resource": {"ProductURL": "https://cwa.example/radar.png"},
            "GeoInfo": {"LeftLongitude": "115.00", "RightLongitude": "126.50",
                        "TopLatitude": "29.25", "BottomLatitude": "17.75"},
        }
    }
}


def _clock():
    t = {"v": 1000.0}
    def now():
        return t["v"]
    return t, now


@respx.mock
def test_fetch_builds_radar_image():
    respx.get("https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/O-A0058-003").mock(
        return_value=httpx.Response(200, json=META)
    )
    respx.get("https://cwa.example/radar.png").mock(
        return_value=httpx.Response(200, content=_png_bytes((255, 0, 0, 255)))
    )
    client = RadarClient(Settings(cwa_api_key="k"))
    import asyncio
    radar = asyncio.run(client.fetch())
    assert radar.geo.left_lon == 115.0 and radar.geo.bottom_lat == 17.75
    assert radar.time == "2026-07-21T14:30:00+08:00"
    assert radar.image.getpixel((0, 0))[:3] == (255, 0, 0)


@respx.mock
def test_cache_prevents_second_download():
    meta_route = respx.get(
        "https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/O-A0058-003"
    ).mock(return_value=httpx.Response(200, json=META))
    respx.get("https://cwa.example/radar.png").mock(
        return_value=httpx.Response(200, content=_png_bytes((0, 0, 0, 0)))
    )
    t, now = _clock()
    client = RadarClient(Settings(cwa_api_key="k", radar_cache_ttl_s=600), now=now)
    import asyncio
    asyncio.run(client.fetch())
    t["v"] += 100  # within TTL
    asyncio.run(client.fetch())
    assert meta_route.call_count == 1  # served from cache
    t["v"] += 600  # past TTL
    asyncio.run(client.fetch())
    assert meta_route.call_count == 2  # refetched
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_radar.py -v`
Expected: FAIL with `ModuleNotFoundError: app.radar`.

- [ ] **Step 3: Write `backend/app/radar.py`**

```python
import time
from io import BytesIO
from typing import Callable, Optional

import httpx
from PIL import Image

from app.config import Settings
from app.models import GeoBox
from app.classify import RadarImage

# Verified against CWA Swagger on <DATE> — record the real dataid here.
CWA_DATAID = "O-A0058-003"  # "no-topography" Taiwan radar composite — VERIFY.


class RadarClient:
    def __init__(self, settings: Settings, now: Callable[[], float] = time.monotonic):
        self._settings = settings
        self._now = now
        self._cache: Optional[RadarImage] = None
        self._fetched_at: float = -1e18

    def _image_url(self, meta: dict) -> str:
        ds = meta["cwaopendata"]["dataset"]
        return ds["resource"]["ProductURL"]

    def _issue_time(self, meta: dict) -> str:
        ds = meta["cwaopendata"]["dataset"]
        return ds["datasetInfo"]["issueTime"]

    def _parse_geo(self, meta: dict) -> GeoBox:
        g = meta["cwaopendata"]["dataset"]["GeoInfo"]
        return GeoBox(
            left_lon=float(g["LeftLongitude"]),
            right_lon=float(g["RightLongitude"]),
            top_lat=float(g["TopLatitude"]),
            bottom_lat=float(g["BottomLatitude"]),
        )

    async def fetch(self) -> RadarImage:
        if self._cache is not None and (self._now() - self._fetched_at) < self._settings.radar_cache_ttl_s:
            return self._cache
        async with httpx.AsyncClient(timeout=30) as http:
            meta_resp = await http.get(
                f"https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/{CWA_DATAID}",
                params={"Authorization": self._settings.cwa_api_key, "format": "JSON"},
            )
            meta_resp.raise_for_status()
            meta = meta_resp.json()
            img_resp = await http.get(self._image_url(meta))
            img_resp.raise_for_status()
        image = Image.open(BytesIO(img_resp.content)).convert("RGBA")
        radar = RadarImage(image=image, geo=self._parse_geo(meta), time=self._issue_time(meta))
        self._cache = radar
        self._fetched_at = self._now()
        return radar
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_radar.py -v`
Expected: PASS.
(If it fails because the real CWA JSON differs from `META`, update `META`, `_parse_geo`, `_image_url`, `_issue_time` together, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/radar.py backend/tests/test_radar.py
git commit -m "feat(backend): add CWA radar client with TTL cache"
```

---

### Task 8: Geocode client (Nominatim)

**Files:**
- Create: `backend/app/geocode.py`
- Test: `backend/tests/test_geocode.py`

**Interfaces:**
- Consumes: `app.config.Settings`, `app.models.GeocodeCandidate`.
- Produces: `async geocode(query: str, settings: Settings) -> list[GeocodeCandidate]` — calls Nominatim `/search`, sends the required `User-Agent`, returns up to 5 candidates.

- [ ] **Step 1: Write the failing test `backend/tests/test_geocode.py`**

```python
import asyncio
import httpx
import respx

from app.config import Settings
from app.geocode import geocode

NOMINATIM_JSON = [
    {"display_name": "台北車站, 中正區, 臺北市", "lat": "25.0478", "lon": "121.5170"},
    {"display_name": "台北車站 (公車), 臺北市", "lat": "25.0466", "lon": "121.5150"},
]


@respx.mock
def test_geocode_returns_candidates():
    route = respx.get("https://nominatim.openstreetmap.org/search").mock(
        return_value=httpx.Response(200, json=NOMINATIM_JSON)
    )
    out = asyncio.run(geocode("台北車站", Settings(nominatim_user_agent="rainroute-test")))
    assert out[0].name.startswith("台北車站")
    assert out[0].lat == 25.0478 and out[0].lng == 121.5170
    assert route.calls.last.request.headers["user-agent"] == "rainroute-test"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_geocode.py -v`
Expected: FAIL with `ModuleNotFoundError: app.geocode`.

- [ ] **Step 3: Write `backend/app/geocode.py`**

```python
import httpx

from app.config import Settings
from app.models import GeocodeCandidate


async def geocode(query: str, settings: Settings) -> list[GeocodeCandidate]:
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(
            f"{settings.nominatim_base_url}/search",
            params={"q": query, "format": "jsonv2", "limit": 5, "countrycodes": "tw"},
            headers={"User-Agent": settings.nominatim_user_agent},
        )
        resp.raise_for_status()
        rows = resp.json()
    return [
        GeocodeCandidate(name=r["display_name"], lat=float(r["lat"]), lng=float(r["lon"]))
        for r in rows
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_geocode.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/geocode.py backend/tests/test_geocode.py
git commit -m "feat(backend): add Nominatim geocode client"
```

---

### Task 9: Routing client (OpenRouteService)

**Files:**
- Create: `backend/app/routing.py`
- Test: `backend/tests/test_routing.py`

**Interfaces:**
- Consumes: `app.config.Settings`, `app.models.LatLng`, `app.models.RouteResponse`.
- Produces: `async plan_route(origin: LatLng, destination: LatLng, settings: Settings) -> RouteResponse` — calls ORS `/v2/directions/driving-car/geojson`, returns polyline as `(lat, lng)` tuples (ORS returns `[lng, lat]`, so swap), plus distance and duration.

- [ ] **Step 1: Write the failing test `backend/tests/test_routing.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_routing.py -v`
Expected: FAIL with `ModuleNotFoundError: app.routing`.

- [ ] **Step 3: Write `backend/app/routing.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_routing.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routing.py backend/tests/test_routing.py
git commit -m "feat(backend): add OpenRouteService routing client"
```

---

### Task 10: Wire the API endpoints

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/app/deps.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: all prior modules.
- Produces endpoints:
  - `POST /geocode` (body `GeocodeRequest`) → `{"candidates": [GeocodeCandidate...]}`
  - `POST /route` (body `RouteRequest`) → `RouteResponse`
  - `POST /rain` (body `RainRequest`) → `RainResponse`
- `app.deps.get_radar_client()` returns a process-wide singleton `RadarClient` (so the cache persists across requests).
- `/rain` builds `Overlay` with `image_url = radar.time`-stamped CWA image URL and `bbox = (geo.left_lon, geo.bottom_lat, geo.right_lon, geo.top_lat)`.

- [ ] **Step 1: Write the failing test `backend/tests/test_api.py`**

```python
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
    assert body["radar_time"] == "2026-07-21T14:30:00+08:00"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api.py -v`
Expected: FAIL (endpoints not defined / import errors).

- [ ] **Step 3: Write `backend/app/deps.py`**

```python
from functools import lru_cache

from app.config import get_settings
from app.radar import RadarClient


@lru_cache
def get_radar_client() -> RadarClient:
    return RadarClient(get_settings())
```

- [ ] **Step 4: Rewrite `backend/app/main.py`**

```python
from fastapi import FastAPI

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
        image_url=radar.time,  # placeholder handle; App uses /rain to know overlay freshness
        bbox=(geo.left_lon, geo.bottom_lat, geo.right_lon, geo.top_lat),
    )
    return RainResponse(
        verdict=verdict,
        max_level=max_level.label,
        wet_segments=wet,
        radar_time=radar.time,
        overlay=overlay,
    )
```

> **Note on `overlay.image_url`:** the App needs an actual PNG URL to display. Simplest correct option: add a `GET /radar.png` endpoint that streams `get_radar_client().fetch().image` as PNG, and set `image_url` to that path. Implement it in this task if time allows; otherwise the frontend plan covers requesting it. For now the test only asserts `bbox`/`radar_time`, so keep `image_url` as the timestamp until the streaming endpoint exists.

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_api.py -v`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `pytest -v`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/app/deps.py backend/tests/test_api.py
git commit -m "feat(backend): wire /geocode, /route, /rain endpoints"
```

---

### Task 11: Radar PNG streaming endpoint + README/run docs

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/deps.py` (none) / `backend/app/models.py` (none)
- Create: `backend/README.md`
- Test: `backend/tests/test_radar_png.py`

**Interfaces:**
- Produces: `GET /radar.png` → streams the current radar image as `image/png`.
- Updates `/rain` so `overlay.image_url` is `"/radar.png"` (a path the App resolves against `BACKEND_BASE_URL`).

- [ ] **Step 1: Write the failing test `backend/tests/test_radar_png.py`**

```python
from unittest.mock import AsyncMock, patch
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.models import GeoBox
from app.classify import RadarImage

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)


def test_radar_png_streams_image():
    radar = RadarImage(image=Image.new("RGBA", (20, 20), (0, 255, 0, 255)),
                       geo=GEO, time="t")
    fake_client = AsyncMock()
    fake_client.fetch = AsyncMock(return_value=radar)
    with patch("app.main.get_radar_client", return_value=fake_client):
        resp = TestClient(app).get("/radar.png")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_radar_png.py -v`
Expected: FAIL (no `/radar.png`).

- [ ] **Step 3: Add the endpoint to `backend/app/main.py`**

Add imports at the top:
```python
from io import BytesIO
from fastapi.responses import Response
```
Add the endpoint:
```python
@app.get("/radar.png")
async def radar_png() -> Response:
    radar = await get_radar_client().fetch()
    buf = BytesIO()
    radar.image.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")
```
And in `rain_endpoint`, change the overlay line to:
```python
    overlay = Overlay(
        image_url="/radar.png",
        bbox=(geo.left_lon, geo.bottom_lat, geo.right_lon, geo.top_lat),
    )
```

- [ ] **Step 4: Update `test_api.py` assertion**

In `backend/tests/test_api.py::test_rain_endpoint_heavy`, change the overlay expectation:
```python
    assert body["overlay"]["image_url"] == "/radar.png"
```

- [ ] **Step 5: Run tests**

Run: `pytest tests/test_radar_png.py tests/test_api.py -v`
Expected: PASS.

- [ ] **Step 6: Write `backend/README.md`**

````markdown
# RainRoute Backend

FastAPI service: geocode → route → sample CWA radar → "wear a raincoat?" verdict.

## Setup
```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # then fill in RAINROUTE_CWA_API_KEY and RAINROUTE_ORS_API_KEY
```
Get keys: CWA https://opendata.cwa.gov.tw/ (free register), OpenRouteService https://openrouteservice.org/dev (free).

## Run
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Test
```bash
pytest -v
```

## Endpoints
- `GET /health`
- `POST /geocode` `{ "query": "台北車站" }`
- `POST /route` `{ "origin": {lat,lng}, "destination": {lat,lng} }`
- `POST /rain` `{ "polyline": [[lat,lng], ...] }`
- `GET /radar.png` — current radar overlay image

## Deploy on the NUC (Phase 1) + remote access
1. Run uvicorn on the NUC bound to `0.0.0.0:8000` (a systemd unit or `tmux` is fine).
2. Install Tailscale on the NUC and on your phone; log both into the same tailnet.
3. The phone reaches the backend at `http://<NUC-tailscale-ip>:8000` from anywhere.
4. Set the app's `BACKEND_BASE_URL` to that address.

## Migrating to the cloud later (Phase A)
Nothing in the code is host-specific. Deploy the same app to Render/Railway/Fly/Cloud Run,
set the same `RAINROUTE_*` env vars, and point `BACKEND_BASE_URL` at the new URL.
````

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/tests/test_radar_png.py backend/tests/test_api.py backend/README.md
git commit -m "feat(backend): add /radar.png streaming endpoint and docs"
```

---

## Self-Review Notes

- **Spec coverage:** geocode (T8), route (T9), radar fetch+cache (T7), pixel sampling (T3–T6), verdict rule (T6), overlay/bbox (T10–T11), env-var-only secrets (T1), NUC+Tailscale deploy (T11 README). Phase 2 (time forecast) intentionally out of scope.
- **Calibration risk flagged** in T5 (palette) and T7 (CWA JSON shape) — both isolated behind one function with a fixture, so verification is a contained edit.
- **Type consistency:** `(lat, lng)` order used everywhere; `RainLevel.label` used in T6/T10; `bbox` is `(west, south, east, north)` in T2/T10/T11.
