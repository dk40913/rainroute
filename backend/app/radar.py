import asyncio
import time
from io import BytesIO
from typing import Callable, Optional

import httpx
from PIL import Image

from app.config import Settings
from app.models import GeoBox
from app.classify import RadarImage

# UNVERIFIED against real CWA API (no key available at implementation time) — verify dataid + JSON field names before deploy.
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
                f"{self._settings.cwa_base_url}/fileapi/v1/opendataapi/{CWA_DATAID}",
                params={"Authorization": self._settings.cwa_api_key, "format": "JSON"},
            )
            meta_resp.raise_for_status()
            meta = meta_resp.json()
            img_resp = await http.get(self._image_url(meta))
            img_resp.raise_for_status()
        png_bytes = img_resp.content
        image = await asyncio.to_thread(lambda: Image.open(BytesIO(png_bytes)).convert("RGBA"))
        radar = RadarImage(image=image, geo=self._parse_geo(meta), time=self._issue_time(meta), png_bytes=png_bytes)
        self._cache = radar
        self._fetched_at = self._now()
        return radar
