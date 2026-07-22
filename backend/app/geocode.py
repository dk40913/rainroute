import httpx

from app.config import Settings
from app.models import GeocodeCandidate


async def geocode(query: str, settings: Settings) -> list[GeocodeCandidate]:
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(
            f"{settings.nominatim_base_url}/search",
            params={"q": query, "format": "jsonv2", "limit": 5, "countrycodes": "tw", "accept-language": "zh-TW"},
            headers={"User-Agent": settings.nominatim_user_agent},
        )
        resp.raise_for_status()
        rows = resp.json()
    return [
        GeocodeCandidate(name=r["display_name"], lat=float(r["lat"]), lng=float(r["lon"]))
        for r in rows
    ]
