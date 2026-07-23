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


# Progressive simplifications for Taiwanese full addresses: OSM Taiwan lacks
# lane/house-number granularity, so a full address (postal code + 村里 +
# lane/alley + house number) often yields zero Nominatim candidates while a
# simplified version (down to the road) succeeds. Each step is applied to the
# previous step's result, cumulatively peeling off components until something
# geocodes.
_POSTAL_CODE_RE = re.compile(r"^\d{3,6}\s*")
# A 村/里 token: 1-5 characters (excluding admin-unit markers, so it can't
# swallow a preceding 縣/市/區/鄉/鎮) ending in 村 or 里, followed later by a
# road/street token. The excluded-character prefix class prevents this from
# matching a 里 that is merely the first character of a place/road name, e.g.
# "里港路" or "...里港鄉..." are left untouched.
_VILLAGE_RE = re.compile(r"[^\s市縣區鄉鎮村里]{1,5}[村里](?=[\s\S]*(?:路|街|大道|巷))")
_HOUSE_NUMBER_RE = re.compile(r"\d+(之\d+)?號$")
_LANE_ALLEY_RE = re.compile(r"\d+巷(\d+弄)?$")

_ADDRESS_FALLBACK_STEPS = [
    lambda s: _POSTAL_CODE_RE.sub("", s, count=1),
    lambda s: _VILLAGE_RE.sub("", s, count=1),
    lambda s: _HOUSE_NUMBER_RE.sub("", s, count=1),
    lambda s: _LANE_ALLEY_RE.sub("", s, count=1),
]


def address_fallbacks(query: str) -> list[str]:
    variants: list[str] = []
    seen = {query}
    current = query
    for step in _ADDRESS_FALLBACK_STEPS:
        current = step(current)
        if current not in seen:
            variants.append(current)
            seen.add(current)
    return variants


async def _search(http: httpx.AsyncClient, settings: Settings, query: str) -> list[dict]:
    resp = await http.get(
        f"{settings.nominatim_base_url}/search",
        params={"q": query, "format": "jsonv2", "limit": 5, "countrycodes": "tw", "accept-language": "zh-TW"},
        headers={"User-Agent": settings.nominatim_user_agent},
    )
    resp.raise_for_status()
    return resp.json()


def _to_candidates(rows: list[dict]) -> list[GeocodeCandidate]:
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


async def geocode(query: str, settings: Settings) -> list[GeocodeCandidate]:
    queries = expand_query(query)
    rows: list[dict] = []
    async with httpx.AsyncClient(timeout=15) as http:
        for i, q in enumerate(queries):
            if i > 0:
                await asyncio.sleep(1)
            rows.extend(await _search(http, settings, q))

        candidates = _to_candidates(rows)

        if not candidates:
            for fallback_query in address_fallbacks(query):
                await asyncio.sleep(1)
                candidates = _to_candidates(await _search(http, settings, fallback_query))
                if candidates:
                    break

    return candidates
