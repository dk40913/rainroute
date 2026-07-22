import asyncio
import time
from io import BytesIO
from typing import Callable, Optional

import httpx
from PIL import Image

from app.config import Settings
from app.models import GeoBox
from app.classify import RadarImage

# Verified against the real CWA API on 2026-07-22.
# O-A0058-003 = 雷達整合回波圖-臺灣(鄰近地區)_無地形 (no topography), 3600x3600,
# lon 118.0-124.0 / lat 20.5-26.5. The metadata endpoint 302-redirects to S3,
# so the HTTP client must follow redirects.
CWA_DATAID = "O-A0058-003"


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
        return ds["DateTime"]

    def _parse_geo(self, meta: dict) -> GeoBox:
        # Real shape: parameterSet.LongitudeRange "118.0-124.0", LatitudeRange "20.5-26.5"
        ps = meta["cwaopendata"]["dataset"]["datasetInfo"]["parameterSet"]
        left, right = (float(v) for v in ps["LongitudeRange"].split("-"))
        bottom, top = (float(v) for v in ps["LatitudeRange"].split("-"))
        return GeoBox(left_lon=left, right_lon=right, top_lat=top, bottom_lat=bottom)

    async def fetch(self) -> RadarImage:
        if self._cache is not None and (self._now() - self._fetched_at) < self._settings.radar_cache_ttl_s:
            return self._cache
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
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
