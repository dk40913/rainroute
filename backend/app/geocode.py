import asyncio
import re

import httpx

from app.config import Settings
from app.models import GeocodeCandidate

# (pattern, template) pairs for MRT station word-order variants.
# Nominatim is word-order sensitive, e.g. "淡水捷運站" vs the OSM-registered
# "捷運淡水站" — expand a query into both orders so we search both.
_QUERY_EXPANSION_RULES = [
    (re.compile(r"^(.+?)捷運站$"), "捷運{x}站"),
    (re.compile(r"^捷運(.+?)站$"), "{x}捷運站"),
]


def expand_query(query: str) -> list[str]:
    variants = [query]
    for pattern, template in _QUERY_EXPANSION_RULES:
        match = pattern.match(query)
        if match:
            x = match.group(1)
            if x:
                variant = template.format(x=x)
                if variant not in variants:
                    variants.append(variant)
    return variants


async def _search(http: httpx.AsyncClient, settings: Settings, query: str) -> list[dict]:
    resp = await http.get(
        f"{settings.nominatim_base_url}/search",
        params={"q": query, "format": "jsonv2", "limit": 5, "countrycodes": "tw", "accept-language": "zh-TW"},
        headers={"User-Agent": settings.nominatim_user_agent},
    )
    resp.raise_for_status()
    return resp.json()


async def geocode(query: str, settings: Settings) -> list[GeocodeCandidate]:
    queries = expand_query(query)
    rows: list[dict] = []
    async with httpx.AsyncClient(timeout=15) as http:
        for i, q in enumerate(queries):
            if i > 0:
                await asyncio.sleep(1)
            rows.extend(await _search(http, settings, q))

    candidates = [
        GeocodeCandidate(name=r["display_name"], lat=float(r["lat"]), lng=float(r["lon"]))
        for r in rows
    ]

    seen: set[tuple[float, float]] = set()
    deduped: list[GeocodeCandidate] = []
    for c in candidates:
        key = (round(c.lat, 5), round(c.lng, 5))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)
        if len(deduped) == 5:
            break

    return deduped
